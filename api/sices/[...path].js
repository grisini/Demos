import { completeSicesSignature, startSicesSignature } from "../../server/sices.mjs";
import { checkRateLimit, rateLimitHeaders } from "../../server/rate-limit.mjs";

const maxBodyBytes = 32 * 1024;
const startRateLimit = { name: "sices-start", limit: 8, windowMs: 5 * 60 * 1000 };
const callbackRateLimit = { name: "sices-callback", limit: 60, windowMs: 5 * 60 * 1000 };

export default async function handler(request, response) {
  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }

  const action = sicesAction(request);

  if (action === "start") {
    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    const limit = checkRateLimit(request, startRateLimit);
    if (limit.limited) {
      sendJson(response, 429, { started: false, error: "Too many SI-CeS requests." }, rateLimitHeaders(limit));
      return;
    }

    try {
      const payload = await readJsonBody(request);
      const result = await startSicesSignature(request, payload, process.env);
      sendJson(response, 200, {
        started: true,
        ...result
      }, rateLimitHeaders(limit));
    } catch (error) {
      console.error("[Demokracija 2.0] SI-CeS start failed", error);
      sendJson(response, error.status || 500, {
        started: false,
        error: error.message || "SI-CeS start failed"
      });
    }
    return;
  }

  if (action === "callback") {
    if (request.method !== "GET") {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    const limit = checkRateLimit(request, callbackRateLimit);
    if (limit.limited) {
      sendHtml(response, 429, callbackHtml("/", "Prevec SI-CeS callback zahtevkov."));
      return;
    }

    try {
      const url = new URL(request.url, publicOrigin(request));
      const result = await completeSicesSignature(request, Object.fromEntries(url.searchParams), process.env);
      const returnUrl = new URL("/", publicOrigin(request));
      returnUrl.searchParams.set("view", "dashboard");
      if (result.initiativeId) returnUrl.searchParams.set("initiative", result.initiativeId);
      returnUrl.searchParams.set("sices", result.signed ? "signed" : "failed");
      sendHtml(
        response,
        200,
        callbackHtml(returnUrl.toString(), result.signed ? "SI-CeS podpis je evidentiran." : result.error || "SI-CeS podpis ni uspel.")
      );
    } catch (error) {
      console.error("[Demokracija 2.0] SI-CeS callback failed", error);
      const returnUrl = new URL("/", publicOrigin(request));
      returnUrl.searchParams.set("view", "dashboard");
      returnUrl.searchParams.set("sices", "failed");
      sendHtml(response, error.status || 500, callbackHtml(returnUrl.toString(), error.message || "SI-CeS callback failed"));
    }
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

function sicesAction(request) {
  const queryPath = request.query?.path;
  const parts = Array.isArray(queryPath)
    ? queryPath
    : queryPath
      ? String(queryPath).split("/")
      : pathParts(request);
  return parts[0] || "";
}

function pathParts(request) {
  const pathname = String(request.url || "").split("?")[0];
  const parts = pathname.split("/").filter(Boolean);
  const index = parts.indexOf("sices");
  return index === -1 ? [] : parts.slice(index + 1).map(decodeURIComponent);
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

function sendHtml(response, status, html) {
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.statusCode = status;
  response.end(html);
}

function callbackHtml(returnUrl, message) {
  return `<!doctype html>
<html lang="sl">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="1; url=${escapeAttribute(returnUrl)}">
  <title>SI-CeS podpis</title>
</head>
<body>
  <p>${escapeHtml(message)}</p>
  <p><a href="${escapeAttribute(returnUrl)}">Nazaj v aplikacijo</a></p>
</body>
</html>`;
}

async function readJsonBody(request) {
  if (request.body && typeof request.body === "object" && !Buffer.isBuffer(request.body)) return request.body;
  if (typeof request.body === "string") return request.body ? JSON.parse(request.body) : {};
  if (Buffer.isBuffer(request.body)) return request.body.length ? JSON.parse(request.body.toString("utf8")) : {};

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

function publicOrigin(request) {
  const proto = request.headers["x-forwarded-proto"] || "https";
  const host = request.headers["x-forwarded-host"] || request.headers.host || "demokracija-20.si";
  return `${proto}://${host}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value) {
  return escapeHtml(value)
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
