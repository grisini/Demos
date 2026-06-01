import { verifyTurnstileToken } from "../../server/turnstile.mjs";
import { checkRateLimit, rateLimitHeaders } from "../../server/rate-limit.mjs";

const maxBodyBytes = 32 * 1024;
const rateLimit = { name: "turnstile", limit: 30, windowMs: 60 * 1000 };

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
    sendJson(response, 429, { error: "Too many Turnstile verification requests." }, rateLimitHeaders(limit));
    return;
  }

  try {
    const payload = await readJsonBody(request);
    const result = await verifyTurnstileToken(payload, {
      env: process.env,
      remoteIp: request.headers["cf-connecting-ip"] || request.headers["x-forwarded-for"] || request.socket?.remoteAddress
    });
    sendJson(response, result.verified ? 200 : result.configured ? 403 : 503, result);
  } catch (error) {
    console.error("[Demokracija 2.0] Turnstile verification failed", error);
    sendJson(response, error.status || 500, {
      configured: true,
      verified: false,
      provider: "cloudflare_turnstile",
      error: error.message || "Turnstile verification failed"
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
