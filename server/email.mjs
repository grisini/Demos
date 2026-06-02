import net from "node:net";
import tls from "node:tls";
import { isValidEmailAddress } from "../src/domain/email.js";
import { checkRateLimit, rateLimitHeaders } from "./rate-limit.mjs";

const maxBodyBytes = 128 * 1024;
const rateLimit = { name: "email-notifications", limit: 20, windowMs: 60 * 1000 };

export default async function handler(request, response) {
  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  const limit = checkRateLimit(request, rateLimit);
  if (limit.limited) {
    sendJson(response, 429, { error: "Too many email notification requests." }, rateLimitHeaders(limit));
    return;
  }

  try {
    const payload = await readJsonBody(request);
    const result = await deliverEmailNotifications(payload, process.env);
    sendJson(response, 202, result);
  } catch (error) {
    console.error("[Demokracija 2.0] Email notifications failed", error);
    sendJson(response, error.status || 500, {
      error: error.message || "Email notifications failed"
    });
  }
}

function sendJson(response, status, value, headers = {}) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  for (const [name, headerValue] of Object.entries(headers)) {
    response.setHeader(name, headerValue);
  }
  response.statusCode = status;
  response.end(JSON.stringify(value));
}

async function readJsonBody(request) {
  if (request.body && typeof request.body === "object") return request.body;
  if (typeof request.body === "string") return request.body ? JSON.parse(request.body) : {};

  const raw = await new Promise((resolveBody, rejectBody) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > maxBodyBytes) {
        const error = new Error("Request body is too large.");
        error.status = 413;
        rejectBody(error);
        request.destroy();
      }
    });
    request.on("end", () => resolveBody(body));
    request.on("error", rejectBody);
  });

  return raw ? JSON.parse(raw) : {};
}

export async function deliverEmailNotifications(payload, env) {
  const rawCount = Array.isArray(payload?.notifications) ? payload.notifications.length : Array.isArray(payload) ? payload.length : 0;
  const notifications = normalizeEmailNotifications(payload, env);

  console.info("[Demokracija 2.0] Email API: zahteva prejeta", {
    rawCount,
    acceptedCount: notifications.length,
    hasSmtpHost: Boolean(env.SMTP_HOST),
    recipients: notifications.map((notification) => maskEmail(notification.to)),
    types: [...new Set(notifications.map((notification) => notification.type).filter(Boolean))]
  });

  if (!notifications.length) {
    return { accepted: 0, mode: "none" };
  }

  if (!env.SMTP_HOST) {
    for (const notification of notifications) {
      console.info("[Demokracija 2.0] Email API: SMTP ni nastavljen, obvestilo je samo zabelezeno", {
        to: maskEmail(notification.to),
        subject: notification.subject
      });
    }
    return { accepted: notifications.length, mode: "outbox", persisted: false };
  }

  for (const notification of notifications) {
    await sendSmtpEmail(notification, env);
  }

  return { accepted: notifications.length, mode: "smtp" };
}

function normalizeEmailNotifications(payload, env = {}) {
  const rawItems = Array.isArray(payload?.notifications) ? payload.notifications : Array.isArray(payload) ? payload : [];
  const testRecipient = String(env.EMAIL_TEST_RECIPIENT || "").trim().toLowerCase();
  const overrideRecipient = isEmailAddress(testRecipient) ? testRecipient : "";

  return rawItems
    .map((item) => {
      const originalTo = String(item?.to || "").trim().toLowerCase();
      const to = overrideRecipient || originalTo;
      if (!isEmailAddress(to)) return null;

      const text = String(item?.text || "").trim();
      if (!text) return null;

      return {
        id: String(item?.id || `notification-${Date.now()}-${Math.random().toString(16).slice(2)}`),
        type: String(item?.type || "email_notification"),
        to,
        toName: overrideRecipient ? "Test prejemnik" : String(item?.toName || item?.to || "").trim(),
        subject: sanitizeHeader(item?.subject || "Obvestilo Demokracija 2.0"),
        text,
        metadata: {
          ...(item?.metadata && typeof item.metadata === "object" ? item.metadata : {}),
          ...(overrideRecipient ? { originalTo } : {})
        }
      };
    })
    .filter(Boolean);
}

async function sendSmtpEmail(notification, env) {
  const host = env.SMTP_HOST;
  const port = Number(env.SMTP_PORT || (env.SMTP_SECURE === "true" ? 465 : 587));
  const secure = envFlag(env.SMTP_SECURE, port === 465);
  const startTls = !secure && envFlag(env.SMTP_STARTTLS, port === 587);
  const from = env.SMTP_FROM || env.EMAIL_FROM || "Demokracija 2.0 <no-reply@demos.local>";
  const fromEmail = mailboxEmail(from);
  const client = new SmtpClient(await openSmtpSocket({ host, port, secure }));

  try {
    await client.read([220]);
    await client.send(`EHLO ${sanitizeEhloName(env.SMTP_EHLO_NAME || "vercel")}`, [250]);

    if (startTls) {
      await client.send("STARTTLS", [220]);
      await client.upgradeToTls(host);
      await client.send(`EHLO ${sanitizeEhloName(env.SMTP_EHLO_NAME || "vercel")}`, [250]);
    }

    if (env.SMTP_USER && env.SMTP_PASS) {
      await client.send("AUTH LOGIN", [334]);
      await client.send(Buffer.from(env.SMTP_USER).toString("base64"), [334]);
      await client.send(Buffer.from(env.SMTP_PASS).toString("base64"), [235]);
    }

    await client.send(`MAIL FROM:<${fromEmail}>`, [250]);
    await client.send(`RCPT TO:<${notification.to}>`, [250, 251]);
    await client.send("DATA", [354]);
    await client.sendData(formatEmailMessage(notification, from), [250]);
    await client.send("QUIT", [221]).catch(() => {});

    console.info("[Demokracija 2.0] Email API: SMTP poslano", {
      to: maskEmail(notification.to),
      subject: notification.subject
    });
  } finally {
    client.close();
  }
}

function openSmtpSocket({ host, port, secure }) {
  return new Promise((resolveSocket, rejectSocket) => {
    const socket = secure
      ? tls.connect({ host, port, servername: host })
      : net.createConnection({ host, port });
    const timeoutMs = 15000;

    const onConnect = () => {
      socket.off("error", onError);
      socket.setTimeout(timeoutMs);
      resolveSocket(socket);
    };
    const onError = (error) => {
      socket.off("connect", onConnect);
      socket.off("secureConnect", onConnect);
      rejectSocket(error);
    };

    socket.once(secure ? "secureConnect" : "connect", onConnect);
    socket.once("error", onError);
    socket.once("timeout", () => {
      socket.destroy(new Error("SMTP connection timed out."));
    });
  });
}

class SmtpClient {
  constructor(socket) {
    this.buffer = "";
    this.pending = [];
    this.onData = (chunk) => {
      this.buffer += String(chunk).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      this.flush();
    };
    this.onError = (error) => {
      while (this.pending.length) {
        this.pending.shift().reject(error);
      }
    };
    this.setSocket(socket);
  }

  setSocket(socket) {
    if (this.socket) {
      this.socket.off("data", this.onData);
      this.socket.off("error", this.onError);
    }

    this.socket = socket;
    this.socket.setEncoding("utf8");
    this.socket.on("data", this.onData);
    this.socket.on("error", this.onError);
  }

  read(expectedCodes) {
    return new Promise((resolveRead, rejectRead) => {
      this.pending.push({ expectedCodes, resolve: resolveRead, reject: rejectRead });
      this.flush();
    });
  }

  async send(command, expectedCodes) {
    this.socket.write(`${command}\r\n`);
    return this.read(expectedCodes);
  }

  async sendData(message, expectedCodes) {
    this.socket.write(`${dotStuff(message)}\r\n.\r\n`);
    return this.read(expectedCodes);
  }

  async upgradeToTls(host) {
    this.buffer = "";
    const rawSocket = this.socket;
    rawSocket.off("data", this.onData);
    rawSocket.off("error", this.onError);

    const secureSocket = await new Promise((resolveTls, rejectTls) => {
      const tlsSocket = tls.connect({ socket: rawSocket, servername: host }, () => resolveTls(tlsSocket));
      tlsSocket.once("error", rejectTls);
    });

    this.setSocket(secureSocket);
  }

  flush() {
    while (this.pending.length) {
      const response = nextSmtpResponse(this.buffer);
      if (!response) return;

      this.buffer = response.rest;
      const pending = this.pending.shift();
      const expected = Array.isArray(pending.expectedCodes) ? pending.expectedCodes : [pending.expectedCodes];

      if (expected.includes(response.code)) {
        pending.resolve(response);
      } else {
        pending.reject(new Error(`SMTP response ${response.code}: ${response.text}`));
      }
    }
  }

  close() {
    this.socket?.end();
  }
}

function nextSmtpResponse(buffer) {
  const parts = buffer.split("\n");
  const completeLines = parts.slice(0, -1);
  if (!completeLines.length) return null;

  const first = completeLines[0];
  const code = Number(first.slice(0, 3));
  if (!Number.isFinite(code)) return null;

  let endIndex = -1;
  for (let index = 0; index < completeLines.length; index += 1) {
    if (completeLines[index].startsWith(`${code} `)) {
      endIndex = index;
      break;
    }
  }

  if (endIndex === -1) return null;

  const consumedLength = completeLines
    .slice(0, endIndex + 1)
    .reduce((length, line) => length + line.length + 1, 0);

  return {
    code,
    text: completeLines.slice(0, endIndex + 1).join("\n"),
    rest: buffer.slice(consumedLength)
  };
}

function formatEmailMessage(notification, from) {
  return [
    `From: ${sanitizeHeader(from)}`,
    `To: ${formatMailbox(notification.to, notification.toName)}`,
    `Subject: ${sanitizeHeader(notification.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${sanitizeMessageId(notification.id)}@demos.local>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    notification.text
  ].join("\r\n");
}

function formatMailbox(email, name) {
  const cleanName = sanitizeHeader(name);
  if (!cleanName || cleanName === email) return `<${email}>`;
  return `"${cleanName.replace(/"/g, "'")}" <${email}>`;
}

function mailboxEmail(value) {
  const text = String(value || "").trim();
  const match = text.match(/<([^>]+)>/);
  return (match ? match[1] : text).trim();
}

function sanitizeHeader(value) {
  return String(value || "")
    .replace(/[\r\n]+/g, " ")
    .trim();
}

function sanitizeMessageId(value) {
  return String(value || `message-${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, ".");
}

function sanitizeEhloName(value) {
  return String(value || "vercel").replace(/[^a-zA-Z0-9.-]/g, "");
}

function dotStuff(message) {
  return String(message || "")
    .replace(/\r?\n/g, "\r\n")
    .replace(/^\./gm, "..");
}

function envFlag(value, fallback) {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function isEmailAddress(value) {
  return isValidEmailAddress(value);
}

function maskEmail(value) {
  const email = String(value || "");
  const [name, domain] = email.split("@");
  if (!name || !domain) return email || "(brez)";
  return `${name.slice(0, 2)}***@${domain}`;
}
