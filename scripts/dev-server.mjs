import { createServer } from "node:http";
import { appendFileSync, createReadStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import net from "node:net";
import { dirname, extname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import tls from "node:tls";
import {
  clearSipassCookie,
  createSipassCookie,
  sanitizedReturnUrl,
  sessionUserFromRequest,
  sipassUserFromHeaders
} from "../server/sipass-session.mjs";
import {
  createServerComment,
  createServerInitiative,
  sessionUserWithAdminRole,
  updateServerInitiativeStatus
} from "../server/initiatives.mjs";
import { adminEmails, createDemoLogin } from "../server/demo-login.mjs";
import { createSipassSignature } from "../server/signatures.mjs";
import { publicTurnstileConfig, verifyTurnstileToken } from "../server/turnstile.mjs";
import { checkRateLimit, rateLimitHeaders } from "../server/rate-limit.mjs";
import { securityHeaders } from "../server/security-headers.mjs";
import { buildRemoteAiReviewText } from "../src/domain/ai-review.js";
import { emptyClarityInsights, normalizeClarityInsights } from "../src/domain/clarity-insights.js";
import { CATEGORIES, evaluateInitiative, normalizeInput } from "../src/domain/validation.js";
import { sendDailyCreatorDigest } from "../server/daily-digest.mjs";

const root = resolve(process.cwd());
const defaultPort = Number(process.env.PORT || 5173);
const huggingFaceRouterBase = "https://router.huggingface.co/hf-inference/models";
const defaultHuggingFaceZeroShotModel = "facebook/bart-large-mnli";
const systemTelemetryEvents = [];

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

function parseEnvFile(fileName) {
  const file = join(root, fileName);
  if (!existsSync(file)) return {};

  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trimStart().startsWith("#"))
    .reduce((acc, line) => {
      const index = line.indexOf("=");
      if (index === -1) return acc;
      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
      acc[key] = value;
      return acc;
    }, {});
}

function runtimeConfig() {
  const env = {
    ...parseEnvFile(".env"),
    ...parseEnvFile(".env.local"),
    ...process.env
  };

  return {
    DATA_SOURCE: env.DATA_SOURCE || env.VITE_DATA_SOURCE || "local",
    AUTH_MODE: env.AUTH_MODE || env.VITE_AUTH_MODE || "demo",
    SUPABASE_URL: env.SUPABASE_URL || env.VITE_SUPABASE_URL || "",
    SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || "",
    SIPASS_ENV: env.SIPASS_ENV || env.VITE_SIPASS_ENV || "test",
    SIPASS_AUTHORITY: env.SIPASS_AUTHORITY || env.VITE_SIPASS_AUTHORITY || "https://sicas-test.sigov.si/",
    SIPASS_CLIENT_ID: env.SIPASS_CLIENT_ID || env.VITE_SIPASS_CLIENT_ID || "",
    SIPASS_REDIRECT_URI:
      env.SIPASS_REDIRECT_URI ||
      env.VITE_SIPASS_REDIRECT_URI ||
      `http://localhost:${env.PORT || defaultPort}/auth/sipass/callback`,
    SIPASS_LOGIN_URL:
      env.SIPASS_LOGIN_URL ||
      env.VITE_SIPASS_LOGIN_URL ||
      "https://auth.demokracija-20.si/auth/sipass/login",
    AUTH_SESSION_ENDPOINT: env.AUTH_SESSION_ENDPOINT || env.VITE_AUTH_SESSION_ENDPOINT || "/api/auth/session",
    AUTH_LOGOUT_ENDPOINT: env.AUTH_LOGOUT_ENDPOINT || env.VITE_AUTH_LOGOUT_ENDPOINT || "/api/auth/logout",
    DEMO_LOGIN_ENDPOINT: env.DEMO_LOGIN_ENDPOINT || env.VITE_DEMO_LOGIN_ENDPOINT || "/api/auth/demo-login",
    INITIATIVES_ENDPOINT: env.INITIATIVES_ENDPOINT || env.VITE_INITIATIVES_ENDPOINT || "/api/initiatives",
    SIGNATURES_ENDPOINT: env.SIGNATURES_ENDPOINT || env.VITE_SIGNATURES_ENDPOINT || "/api/signatures",
    AI_PROVIDER: env.AI_PROVIDER || env.VITE_AI_PROVIDER || (env.HF_TOKEN ? "huggingface" : "local"),
    AI_REVIEW_ENDPOINT:
      env.AI_REVIEW_ENDPOINT || env.VITE_AI_REVIEW_ENDPOINT || (env.HF_TOKEN ? "/api/ai/review-initiative" : ""),
    EMAIL_NOTIFICATIONS_ENDPOINT:
      env.EMAIL_NOTIFICATIONS_ENDPOINT || env.VITE_EMAIL_NOTIFICATIONS_ENDPOINT || "/api/notifications/email",
    EMAIL_DELIVERY_MODE: env.SMTP_HOST ? "smtp" : "outbox",
    EMAIL_NOTIFY_ACTOR: (env.EMAIL_NOTIFY_ACTOR || env.VITE_EMAIL_NOTIFY_ACTOR) === "true",
    SYSTEM_ANALYTICS_ENDPOINT:
      env.SYSTEM_ANALYTICS_ENDPOINT || env.VITE_SYSTEM_ANALYTICS_ENDPOINT || "/api/analytics/system",
    CLARITY_ANALYTICS_ENDPOINT:
      env.CLARITY_ANALYTICS_ENDPOINT || env.VITE_CLARITY_ANALYTICS_ENDPOINT || "/api/analytics/clarity",
    ...publicTurnstileConfig(env),
    MICROSOFT_CLARITY_PROJECT_ID:
      env.MICROSOFT_CLARITY_PROJECT_ID || env.VITE_MICROSOFT_CLARITY_PROJECT_ID || env.CLARITY_PROJECT_ID || "",
    HUGGINGFACE_ZERO_SHOT_MODEL:
      env.HUGGINGFACE_ZERO_SHOT_MODEL || env.VITE_HUGGINGFACE_ZERO_SHOT_MODEL || defaultHuggingFaceZeroShotModel,
    HUGGINGFACE_EMBEDDING_MODEL:
      env.HUGGINGFACE_EMBEDDING_MODEL || env.VITE_HUGGINGFACE_EMBEDDING_MODEL || "intfloat/multilingual-e5-small"
  };
}

function serverEnv() {
  return {
    ...parseEnvFile(".env"),
    ...parseEnvFile(".env.local"),
    ...process.env
  };
}

function send(res, status, body, type = "text/plain; charset=utf-8", headers = {}) {
  res.writeHead(status, {
    ...securityHeaders,
    "Content-Type": type,
    "Cache-Control": "no-store",
    ...headers
  });
  res.end(body);
}

function readJsonBody(req, maxBytes = 128 * 1024) {
  return new Promise((resolveBody, rejectBody) => {
    let raw = "";
    let tooLarge = false;

    req.on("data", (chunk) => {
      if (tooLarge) return;
      raw += chunk;
      if (Buffer.byteLength(raw, "utf8") > maxBytes) {
        tooLarge = true;
        const error = new Error("Request body is too large.");
        error.status = 413;
        rejectBody(error);
      }
    });
    req.on("end", () => {
      if (tooLarge) return;
      try {
        resolveBody(raw ? JSON.parse(raw) : {});
      } catch {
        rejectBody(new Error("Request body is not valid JSON."));
      }
    });
    req.on("error", rejectBody);
  });
}

function json(res, status, value, headers = {}) {
  send(res, status, JSON.stringify(value), "application/json; charset=utf-8", headers);
}

function redirect(res, location, headers = {}) {
  res.writeHead(302, {
    ...securityHeaders,
    Location: location,
    "Cache-Control": "no-store",
    ...headers
  });
  res.end();
}

function enforceRateLimit(req, res, options) {
  const result = checkRateLimit(req, options);
  if (!result.limited) return true;

  json(res, 429, { error: "Too many requests." }, rateLimitHeaders(result));
  return false;
}

async function reviewInitiativeWithHuggingFace(payload) {
  const env = serverEnv();
  const token = env.HF_TOKEN;
  const model = env.HUGGINGFACE_ZERO_SHOT_MODEL || defaultHuggingFaceZeroShotModel;
  const values = normalizeInput(payload);
  const localReview = evaluateInitiative(values);

  if (!token) {
    return remoteAiFallbackReview(localReview, {
      model,
      fallbackReason: "hf_token_missing"
    });
  }

  const text = buildRemoteAiReviewText(values);
  const models = uniqueValues([model, defaultHuggingFaceZeroShotModel]);
  let lastError = null;

  for (const candidateModel of models) {
    try {
      const [categoryResult, suitabilityResult] = await Promise.all([
        queryHuggingFaceZeroShot({
          token,
          model: candidateModel,
          inputs: text,
          candidateLabels: CATEGORIES,
          hypothesisTemplate: "Ta zakonodajna pobuda spada v kategorijo {}."
        }),
        queryHuggingFaceZeroShot({
          token,
          model: candidateModel,
          inputs: text,
          candidateLabels: ["primerna za objavo", "potreben uredniski pregled", "nezadostna za oddajo"],
          hypothesisTemplate: "Ta zakonodajna pobuda je {}."
        })
      ]);

      return normalizeHuggingFaceReview({
        categoryResult,
        suitabilityResult,
        fallback: localReview,
        model: candidateModel
      });
    } catch (error) {
      lastError = error;
      console.warn("[Demokracija 2.0] AI review model failed", {
        model: candidateModel,
        message: error.message,
        status: error.status || "unknown",
        details: abbreviateErrorDetails(error.details)
      });
    }
  }

  return remoteAiFallbackReview(localReview, {
    model,
    fallbackReason: lastError ? "huggingface_unavailable" : "huggingface_no_model"
  });
}

async function queryHuggingFaceZeroShot({ token, model, inputs, candidateLabels, hypothesisTemplate }) {
  const modelPath = model.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${huggingFaceRouterBase}/${modelPath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      inputs,
      parameters: {
        candidate_labels: candidateLabels,
        hypothesis_template: hypothesisTemplate,
        multi_label: false
      },
      options: {
        wait_for_model: true
      }
    })
  });

  const raw = await response.text();
  if (!response.ok) {
    const error = new Error(`Hugging Face request failed (${response.status}).`);
    error.status = 502;
    error.details = raw;
    throw error;
  }

  return raw ? JSON.parse(raw) : {};
}

function remoteAiFallbackReview(fallback, options = {}) {
  return {
    ...fallback,
    checks: {
      ...fallback.checks,
      provider: "local",
      model: "local-rule-engine-v1",
      remoteModel: options.model || defaultHuggingFaceZeroShotModel,
      fallbackReason: options.fallbackReason || "huggingface_unavailable",
      reviewedAt: new Date().toISOString()
    }
  };
}

function abbreviateErrorDetails(value) {
  const details = String(value || "").replace(/\s+/g, " ").trim();
  return details.length > 240 ? `${details.slice(0, 237)}...` : details;
}

function uniqueValues(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function normalizeHuggingFaceReview({ categoryResult, suitabilityResult, fallback, model }) {
  const categoryTop = topZeroShotLabel(categoryResult);
  const suitabilityTop = topZeroShotLabel(suitabilityResult);
  const suitability = mapSuitabilityLabel(suitabilityTop.label) || fallback.checks.suitability;
  const category = CATEGORIES.includes(categoryTop.label) ? categoryTop.label : fallback.checks.categorySuggestion.category;
  const categoryConfidence = clampInteger(categoryTop.score * 100, fallback.checks.categorySuggestion.confidence);
  const suitabilityConfidence = clampInteger(suitabilityTop.score * 100, 0);
  const score = clampInteger(
    fallback.score * 0.7 + categoryConfidence * 0.15 + suitabilityScore(suitability, suitabilityConfidence) * 0.15,
    fallback.score
  );
  const risk = suitability === "insufficient" || fallback.risk === "high"
    ? "high"
    : suitability === "needs_review" || fallback.risk === "medium"
      ? "medium"
      : "low";

  return {
    provider: "huggingface",
    model,
    score,
    risk,
    findings: [
      `Napredno preverjanje ocenjuje: ${suitabilityLabelForFinding(suitability)} (${suitabilityConfidence}% zanesljivost).`,
      category && category !== fallback.checks.categorySuggestion.category
        ? `Napredno preverjanje predlaga kategorijo ${category} z ${categoryConfidence}% ujemanjem.`
        : `Napredno preverjanje potrjuje kategorijo ${category} z ${categoryConfidence}% ujemanjem.`,
      ...fallback.findings.slice(2)
    ],
    checks: {
      ...fallback.checks,
      suitability,
      categorySuggestion: {
        category,
        confidence: categoryConfidence,
        labels: zeroShotLabels(categoryResult),
        scores: zeroShotScores(categoryResult)
      },
      huggingFaceSuitability: {
        label: suitabilityTop.label,
        confidence: suitabilityConfidence,
        labels: zeroShotLabels(suitabilityResult),
        scores: zeroShotScores(suitabilityResult)
      },
      provider: "huggingface",
      model,
      reviewedAt: new Date().toISOString(),
      rawResponse: {
        category: categoryResult,
        suitability: suitabilityResult
      }
    }
  };
}

function topZeroShotLabel(result) {
  if (Array.isArray(result)) {
    const [top] = [...result].sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
    return {
      label: top?.label || "",
      score: Number(top?.score) || 0
    };
  }

  const labels = Array.isArray(result?.labels) ? result.labels : [];
  const scores = Array.isArray(result?.scores) ? result.scores : [];
  return {
    label: labels[0] || "",
    score: Number(scores[0]) || 0
  };
}

function zeroShotLabels(result) {
  if (Array.isArray(result)) return result.map((item) => item.label).filter(Boolean);
  return Array.isArray(result?.labels) ? result.labels : [];
}

function zeroShotScores(result) {
  if (Array.isArray(result)) return result.map((item) => Number(item.score) || 0);
  return Array.isArray(result?.scores) ? result.scores : [];
}

function mapSuitabilityLabel(label) {
  return {
    "primerna za objavo": "ready",
    "potreben uredniski pregled": "needs_review",
    "nezadostna za oddajo": "insufficient"
  }[label];
}

function suitabilityScore(suitability, confidence) {
  if (suitability === "ready") return confidence;
  if (suitability === "needs_review") return Math.round(confidence * 0.65);
  return Math.round(confidence * 0.25);
}

function suitabilityLabelForFinding(value) {
  return {
    ready: "primerna za objavo",
    needs_review: "potreben uredniski pregled",
    insufficient: "nezadostna za oddajo"
  }[value] || "ni ocene";
}

function clampInteger(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

async function deliverEmailNotifications(payload) {
  const env = serverEnv();
  const rawCount = Array.isArray(payload?.notifications) ? payload.notifications.length : Array.isArray(payload) ? payload.length : 0;
  console.log("[Demokracija 2.0] Email server: zahteva prejeta", {
    rawCount,
    hasSmtpHost: Boolean(env.SMTP_HOST),
    hasSmtpUser: Boolean(env.SMTP_USER),
    hasSmtpPass: Boolean(env.SMTP_PASS),
    hasSmtpFrom: Boolean(env.SMTP_FROM || env.EMAIL_FROM),
    testRecipient: env.EMAIL_TEST_RECIPIENT ? maskEmail(env.EMAIL_TEST_RECIPIENT) : ""
  });

  const notifications = normalizeEmailNotifications(payload, env);
  console.log("[Demokracija 2.0] Email server: normalizirana obvestila", {
    acceptedCount: notifications.length,
    droppedCount: Math.max(0, rawCount - notifications.length),
    recipients: notifications.map((notification) => maskEmail(notification.to)),
    types: [...new Set(notifications.map((notification) => notification.type).filter(Boolean))]
  });

  if (!notifications.length) {
    console.log("[Demokracija 2.0] Email server: ni veljavnih obvestil za posiljanje");
    return { accepted: 0, mode: "none" };
  }

  if (env.SMTP_HOST) {
    console.log("[Demokracija 2.0] Email server: uporabljen bo SMTP", {
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT || (env.SMTP_SECURE === "true" ? 465 : 587)),
      secure: env.SMTP_SECURE === "true",
      startTls: env.SMTP_STARTTLS || "(privzeto)"
    });

    for (const notification of notifications) {
      await sendSmtpEmail(notification, env);
    }
    console.log("[Demokracija 2.0] Email server: SMTP posiljanje koncano", {
      accepted: notifications.length
    });
    return { accepted: notifications.length, mode: "smtp" };
  }

  console.log("[Demokracija 2.0] Email server: SMTP_HOST ni nastavljen, zapisujem v outbox");
  const outboxPath = appendEmailOutbox(notifications, env);
  return {
    accepted: notifications.length,
    mode: "outbox",
    outbox: relative(root, outboxPath)
  };
}

function handleSystemAnalytics(payload) {
  const events = normalizeSystemAnalyticsEvents(payload);
  systemTelemetryEvents.unshift(...events);
  systemTelemetryEvents.splice(200);

  console.log("[Demokracija 2.0] System analytics dev endpoint", {
    accepted: events.length,
    stored: systemTelemetryEvents.length
  });

  return {
    accepted: events.length,
    storage: "dev_memory",
    persisted: events.length
  };
}

async function readClarityInsights(env, searchParams = new URLSearchParams()) {
  const token = env.CLARITY_API_TOKEN || env.MICROSOFT_CLARITY_API_TOKEN || "";
  if (!token) {
    return emptyClarityInsights("CLARITY_API_TOKEN ni nastavljen v .env.local ali okolju.");
  }

  const days = clampClarityDays(searchParams.get("days"));
  const dimension = sanitizeClarityDimension(searchParams.get("dimension") || "URL");
  const url = new URL("https://www.clarity.ms/export-data/api/v1/project-live-insights");
  url.searchParams.set("numOfDays", String(days));
  url.searchParams.set("dimension1", dimension);

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      return {
        ...emptyClarityInsights(`Clarity Data Export API je vrnil HTTP ${response.status}.`),
        configured: true,
        error: await response.text()
      };
    }

    return normalizeClarityInsights(await response.json(), { days, dimension });
  } catch (error) {
    return {
      ...emptyClarityInsights("Clarity Data Export API ni dosegljiv."),
      configured: true,
      error: error.message || "Clarity fetch failed"
    };
  }
}

function normalizeSystemAnalyticsEvents(payload) {
  const rawEvents = Array.isArray(payload?.events)
    ? payload.events
    : payload?.event
      ? [payload.event]
      : Array.isArray(payload)
        ? payload
        : [];

  return rawEvents.slice(0, 20).map((event) => {
    const data = primitiveSystemProperties(event);
    return {
      id: String(data.id || cryptoRandomId()),
      type: String(data.type || "system_event").slice(0, 80),
      createdAt: safeIsoDate(data.createdAt),
      source: String(data.source || "frontend").slice(0, 80),
      userRef: String(data.userRef || "").slice(0, 200),
      userRole: String(data.userRole || "").slice(0, 80),
      sessionId: String(data.sessionId || "").slice(0, 200),
      path: String(data.path || "").slice(0, 300),
      ...data
    };
  });
}

function primitiveSystemProperties(value) {
  return Object.fromEntries(
    Object.entries(value || {}).filter(([, item]) =>
      item === null || ["string", "number", "boolean"].includes(typeof item)
    )
  );
}

function sanitizeClarityDimension(value) {
  const allowed = ["URL", "Device", "Browser", "OS", "Country/Region", "Source", "Medium", "Campaign", "Channel"];
  return allowed.includes(value) ? value : "URL";
}

function clampClarityDays(value) {
  const number = Number(value) || 1;
  return Math.min(3, Math.max(1, Math.round(number)));
}

function normalizeEmailNotifications(payload, env = {}) {
  const rawItems = Array.isArray(payload?.notifications) ? payload.notifications : Array.isArray(payload) ? payload : [];
  const testRecipient = String(env.EMAIL_TEST_RECIPIENT || "").trim().toLowerCase();
  const overrideRecipient = isEmailAddress(testRecipient) ? testRecipient : "";

  return rawItems
    .map((item) => {
      const originalTo = String(item?.to || "").trim().toLowerCase();
      const to = overrideRecipient || originalTo;
      if (!isEmailAddress(to)) {
        console.warn("[Demokracija 2.0] Email server: zavrnjen prejemnik", {
          originalTo: maskEmail(originalTo),
          overrideRecipient: maskEmail(overrideRecipient),
          type: item?.type || ""
        });
        return null;
      }

      const text = String(item?.text || "").trim();
      if (!text) {
        console.warn("[Demokracija 2.0] Email server: zavrnjeno obvestilo brez besedila", {
          to: maskEmail(to),
          type: item?.type || ""
        });
        return null;
      }

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

function appendEmailOutbox(notifications, env) {
  const outboxPath = safeOutboxPath(env.EMAIL_OUTBOX_FILE || "demos-email-outbox.log");
  const acceptedAt = new Date().toISOString();
  const lines = notifications.map((notification) => JSON.stringify({ acceptedAt, ...notification })).join("\n") + "\n";

  mkdirSync(dirname(outboxPath), { recursive: true });
  appendFileSync(outboxPath, lines, "utf8");

  for (const notification of notifications) {
    console.log("[Demokracija 2.0] Email outbox: zapisano", {
      to: maskEmail(notification.to),
      subject: notification.subject,
      outbox: relative(root, outboxPath)
    });
  }

  return outboxPath;
}

function safeOutboxPath(fileName) {
  const outboxPath = normalize(resolve(root, fileName));
  const relativePath = relative(root, outboxPath);
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new Error("EMAIL_OUTBOX_FILE must stay inside the project directory.");
  }
  return outboxPath;
}

async function sendSmtpEmail(notification, env) {
  const host = env.SMTP_HOST;
  const port = Number(env.SMTP_PORT || (env.SMTP_SECURE === "true" ? 465 : 587));
  const secure = envFlag(env.SMTP_SECURE, port === 465);
  const startTls = !secure && envFlag(env.SMTP_STARTTLS, port === 587);
  const from = env.SMTP_FROM || env.EMAIL_FROM || "Demokracija 2.0 <no-reply@demos.local>";
  const fromEmail = mailboxEmail(from);
  console.log("[Demokracija 2.0] SMTP: zacetek", {
    host,
    port,
    secure,
    startTls,
    from: maskEmail(fromEmail),
    to: maskEmail(notification.to),
    subject: notification.subject
  });

  const client = new SmtpClient(await openSmtpSocket({ host, port, secure }));

  try {
    console.log("[Demokracija 2.0] SMTP: socket odprt");
    await client.read([220]);
    console.log("[Demokracija 2.0] SMTP: greeting OK");
    await client.send(`EHLO ${sanitizeEhloName(env.SMTP_EHLO_NAME || "localhost")}`, [250]);
    console.log("[Demokracija 2.0] SMTP: EHLO OK");

    if (startTls) {
      console.log("[Demokracija 2.0] SMTP: STARTTLS");
      await client.send("STARTTLS", [220]);
      await client.upgradeToTls(host);
      console.log("[Demokracija 2.0] SMTP: TLS nadgradnja OK");
      await client.send(`EHLO ${sanitizeEhloName(env.SMTP_EHLO_NAME || "localhost")}`, [250]);
      console.log("[Demokracija 2.0] SMTP: EHLO po TLS OK");
    }

    if (env.SMTP_USER && env.SMTP_PASS) {
      console.log("[Demokracija 2.0] SMTP: AUTH LOGIN", {
        user: maskEmail(env.SMTP_USER)
      });
      await client.send("AUTH LOGIN", [334]);
      await client.send(Buffer.from(env.SMTP_USER).toString("base64"), [334]);
      await client.send(Buffer.from(env.SMTP_PASS).toString("base64"), [235]);
      console.log("[Demokracija 2.0] SMTP: AUTH OK");
    } else {
      console.log("[Demokracija 2.0] SMTP: AUTH preskocen, SMTP_USER ali SMTP_PASS ni nastavljen");
    }

    await client.send(`MAIL FROM:<${fromEmail}>`, [250]);
    console.log("[Demokracija 2.0] SMTP: MAIL FROM OK", {
      from: maskEmail(fromEmail)
    });
    await client.send(`RCPT TO:<${notification.to}>`, [250, 251]);
    console.log("[Demokracija 2.0] SMTP: RCPT TO OK", {
      to: maskEmail(notification.to)
    });
    await client.send("DATA", [354]);
    const dataResponse = await client.sendData(formatEmailMessage(notification, from), [250]);
    console.log("[Demokracija 2.0] SMTP: DATA OK", {
      response: dataResponse.text
    });
    await client.send("QUIT", [221]).catch(() => {});
  } finally {
    client.close();
    console.log("[Demokracija 2.0] SMTP: povezava zaprta");
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
  return String(value || "localhost").replace(/[^a-zA-Z0-9.-]/g, "");
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

function maskEmail(value) {
  const email = String(value || "");
  const [name, domain] = email.split("@");
  if (!name || !domain) return email || "(brez)";
  return `${name.slice(0, 2)}***@${domain}`;
}

function isEmailAddress(value) {
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(String(value || "").trim());
}

function safeIsoDate(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function cryptoRandomId() {
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `event-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isDemoAdminRequest(req) {
  return adminEmails(serverEnv()).has(String(req.headers["x-demos-admin"] || "").trim().toLowerCase());
}

function createAppServer() {
  return createServer(async (req, res) => {
    const requestedUrl = new URL(req.url || "/", `http://${req.headers.host}`);
    const pathname = decodeURIComponent(requestedUrl.pathname);

    if (pathname === "/api/ai/review-initiative") {
      if (req.method !== "POST") {
        json(res, 405, { error: "Method not allowed" });
        return;
      }
      if (!enforceRateLimit(req, res, { name: "dev-ai-review", limit: 20, windowMs: 60 * 1000 })) return;

      try {
        const payload = await readJsonBody(req, 256 * 1024);
        const review = await reviewInitiativeWithHuggingFace(payload);
        json(res, 200, review);
      } catch (error) {
        console.error("[Demokracija 2.0] AI review failed", error);
        json(res, error.status || 500, {
          error: error.message || "AI review failed"
        });
      }
      return;
    }

    if (pathname === "/api/auth/session") {
      if (req.method !== "GET") {
        json(res, 405, { error: "Method not allowed" });
        return;
      }

      let user = null;
      try {
        user = sessionUserWithAdminRole(req, serverEnv());
      } catch (error) {
        console.error("[Demokracija 2.0] SI-PASS session read failed", error);
      }
      json(res, 200, { authenticated: Boolean(user), user });
      return;
    }

    if (pathname === "/api/auth/logout") {
      if (!["GET", "POST"].includes(req.method || "")) {
        json(res, 405, { error: "Method not allowed" });
        return;
      }

      res.setHeader("Set-Cookie", clearSipassCookie(serverEnv()));
      json(res, 200, { signedOut: true });
      return;
    }

    if (pathname === "/api/auth/demo-login") {
      if (req.method !== "POST") {
        json(res, 405, { error: "Method not allowed" });
        return;
      }

      try {
        const payload = await readJsonBody(req, 16 * 1024);
        json(res, 200, createDemoLogin(payload, serverEnv()));
      } catch (error) {
        json(res, error.status || 400, {
          authenticated: false,
          error: error.message || "Demo prijava ni uspela."
        });
      }
      return;
    }

    if (pathname === "/api/signatures") {
      if (req.method !== "POST") {
        json(res, 405, { error: "Method not allowed" });
        return;
      }
      if (!enforceRateLimit(req, res, { name: "dev-signatures", limit: 12, windowMs: 5 * 60 * 1000 })) return;

      try {
        const payload = await readJsonBody(req, 16 * 1024);
        const initiative = await createSipassSignature(req, payload, serverEnv());
        json(res, 200, {
          signed: true,
          initiative
        });
      } catch (error) {
        console.error("[Demokracija 2.0] SI-PASS signature failed", error);
        json(res, error.status || 500, {
          signed: false,
          error: error.message || "SI-PASS signature failed"
        });
      }
      return;
    }

    if (pathname === "/api/initiatives") {
      if (req.method !== "POST") {
        json(res, 405, { error: "Method not allowed" });
        return;
      }

      try {
        const payload = await readJsonBody(req, 256 * 1024);
        const initiative = await createServerInitiative(req, payload, serverEnv());
        json(res, 201, {
          created: true,
          initiative
        });
      } catch (error) {
        console.error("[Demokracija 2.0] Initiative create failed", error);
        json(res, error.status || 500, {
          created: false,
          error: error.message || "Initiative create failed",
          errors: error.errors || undefined
        });
      }
      return;
    }

    const commentRoute = pathname.match(/^\/api\/initiatives\/([^/]+)\/comments$/);
    if (commentRoute) {
      if (req.method !== "POST") {
        json(res, 405, { error: "Method not allowed" });
        return;
      }

      try {
        const payload = await readJsonBody(req, 16 * 1024);
        const initiative = await createServerComment(
          req,
          { ...payload, initiativeId: decodeURIComponent(commentRoute[1]) },
          serverEnv()
        );
        json(res, 201, {
          created: true,
          initiative
        });
      } catch (error) {
        console.error("[Demokracija 2.0] Comment create failed", error);
        json(res, error.status || 500, {
          created: false,
          error: error.message || "Comment create failed"
        });
      }
      return;
    }

    const statusRoute = pathname.match(/^\/api\/initiatives\/([^/]+)\/status$/);
    if (statusRoute) {
      if (!["PATCH", "POST"].includes(req.method || "")) {
        json(res, 405, { error: "Method not allowed" });
        return;
      }

      try {
        const payload = await readJsonBody(req, 16 * 1024);
        const initiative = await updateServerInitiativeStatus(
          req,
          { ...payload, initiativeId: decodeURIComponent(statusRoute[1]) },
          serverEnv()
        );
        json(res, 200, {
          updated: true,
          initiative
        });
      } catch (error) {
        console.error("[Demokracija 2.0] Initiative status update failed", error);
        json(res, error.status || 500, {
          updated: false,
          error: error.message || "Initiative status update failed"
        });
      }
      return;
    }

    if (pathname === "/auth/sipass/login") {
      const env = serverEnv();
      const appOrigin = env.SIPASS_APP_ORIGIN || "https://demokracija-20.si";
      const returnTo = sanitizedReturnUrl(requestedUrl.searchParams.get("returnTo"), appOrigin);
      const completeUrl = new URL(env.SIPASS_COMPLETE_URL || "https://auth.demokracija-20.si/auth/sipass/complete");
      completeUrl.searchParams.set("returnTo", returnTo);
      const loginUrl = new URL("/Shibboleth.sso/Login", env.SIPASS_SP_ORIGIN || "https://auth.demokracija-20.si");
      loginUrl.searchParams.set("entityID", env.SIPASS_IDP_ENTITY_ID || "SICAS");
      loginUrl.searchParams.set("target", completeUrl.toString());
      redirect(res, loginUrl.toString());
      return;
    }

    if (pathname === "/auth/sipass/complete") {
      const env = serverEnv();
      try {
        const user = sipassUserFromHeaders(req.headers, env);
        if (!user) {
          json(res, 401, {
            error: "SI-PASS attributes are missing. This endpoint must be protected by Shibboleth on the VPS."
          });
          return;
        }

        const returnTo = sanitizedReturnUrl(
          requestedUrl.searchParams.get("returnTo"),
          env.SIPASS_APP_ORIGIN || "https://demokracija-20.si"
        );
        redirect(res, returnTo, {
          "Set-Cookie": createSipassCookie(user, env)
        });
      } catch (error) {
        console.error("[Demokracija 2.0] SI-PASS completion failed", error);
        json(res, 500, { error: error.message || "SI-PASS completion failed" });
      }
      return;
    }

    if (pathname === "/api/analytics/system") {
      if (req.method === "GET") {
        if (!enforceRateLimit(req, res, { name: "dev-system-analytics-read", limit: 30, windowMs: 60 * 1000 })) return;
        if (!isDemoAdminRequest(req)) {
          json(res, 403, { error: "Forbidden" });
          return;
        }

        json(res, 200, {
          events: systemTelemetryEvents,
          storage: "dev_memory",
          persisted: true
        });
        return;
      }

      if (req.method !== "POST") {
        json(res, 405, { error: "Method not allowed" });
        return;
      }
      if (!enforceRateLimit(req, res, { name: "dev-system-analytics-write", limit: 60, windowMs: 60 * 1000 })) return;

      try {
        const payload = await readJsonBody(req, 128 * 1024);
        const result = handleSystemAnalytics(payload);
        json(res, 202, result);
      } catch (error) {
        console.error("[Demokracija 2.0] System analytics failed", error);
        json(res, error.status || 500, {
          error: error.message || "System analytics failed"
        });
      }
      return;
    }

    if (pathname === "/api/analytics/clarity") {
      if (req.method !== "GET") {
        json(res, 405, { error: "Method not allowed" });
        return;
      }
      if (!enforceRateLimit(req, res, { name: "dev-clarity-analytics", limit: 60, windowMs: 60 * 1000 })) return;

      json(res, 200, await readClarityInsights(serverEnv(), requestedUrl.searchParams));
      return;
    }

    if (pathname === "/api/security/turnstile") {
      if (req.method !== "POST") {
        json(res, 405, { error: "Method not allowed" });
        return;
      }
      if (!enforceRateLimit(req, res, { name: "dev-turnstile", limit: 30, windowMs: 60 * 1000 })) return;

      try {
        const payload = await readJsonBody(req, 32 * 1024);
        const result = await verifyTurnstileToken(payload, {
          env: serverEnv(),
          remoteIp: req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.socket?.remoteAddress
        });
        json(res, result.verified ? 200 : result.configured ? 403 : 503, result);
      } catch (error) {
        console.error("[Demokracija 2.0] Turnstile verification failed", error);
        json(res, error.status || 500, {
          configured: true,
          verified: false,
          provider: "cloudflare_turnstile",
          error: error.message || "Turnstile verification failed"
        });
      }
      return;
    }

    if (pathname === "/api/notifications/email") {
      if (req.method !== "POST") {
        json(res, 405, { error: "Method not allowed" });
        return;
      }
      if (!enforceRateLimit(req, res, { name: "dev-email-notifications", limit: 20, windowMs: 60 * 1000 })) return;

      try {
        const payload = await readJsonBody(req, 128 * 1024);
        const result = await deliverEmailNotifications(payload);
        json(res, 202, result);
      } catch (error) {
        console.error("[Demokracija 2.0] Email notifications failed", error);
        json(res, error.status || 500, {
          error: error.message || "Email notifications failed"
        });
      }
      return;
    }

    if (pathname === "/api/notifications/daily-digest") {
      if (!["GET", "POST"].includes(req.method || "")) {
        json(res, 405, { error: "Method not allowed" });
        return;
      }
      if (!enforceRateLimit(req, res, { name: "dev-daily-digest", limit: 10, windowMs: 60 * 1000 })) return;

      try {
        const env = serverEnv();
        const result = await sendDailyCreatorDigest({
          env,
          dateKey: requestedUrl.searchParams.get("date") || "",
          timeZone: requestedUrl.searchParams.get("timeZone") || env.DAILY_DIGEST_TIME_ZONE || "Europe/Ljubljana",
          dryRun: ["1", "true", "yes"].includes(String(requestedUrl.searchParams.get("dryRun") || "").toLowerCase()),
          siteUrl: `http://${req.headers.host}`,
          deliverNotifications: deliverEmailNotifications
        });
        json(res, 202, result);
      } catch (error) {
        console.error("[Demokracija 2.0] Daily creator digest failed", error);
        json(res, error.status || 500, {
          error: error.message || "Daily creator digest failed"
        });
      }
      return;
    }

    if (pathname === "/config.local.js") {
      const body = `window.DEMOS_CONFIG = ${JSON.stringify(runtimeConfig(), null, 2)};\n`;
      send(res, 200, body, "text/javascript; charset=utf-8");
      return;
    }

    const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const filePath = normalize(resolve(join(root, relative)));

    if (!filePath.startsWith(root)) {
      send(res, 403, "Forbidden");
      return;
    }

    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      send(res, 404, "Not found");
      return;
    }

    const type = contentTypes[extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { ...securityHeaders, "Content-Type": type, "Cache-Control": "no-store" });
    createReadStream(filePath).pipe(res);
  });
}

function listenOnAvailablePort(port) {
  const server = createAppServer();

  server.once("error", (error) => {
    if (error.code === "EADDRINUSE") {
      listenOnAvailablePort(port + 1);
      return;
    }
    throw error;
  });

  server.listen(port, () => {
    console.log(`Demokracija 2.0 dev server: http://localhost:${port}`);
  });
}

listenOnAvailablePort(defaultPort);
