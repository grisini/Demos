import { emptyClarityInsights, normalizeClarityInsights } from "../src/domain/clarity-insights.js";

const clarityEndpoint = "https://www.clarity.ms/export-data/api/v1/project-live-insights";
const cacheTtlMs = 6 * 60 * 60 * 1000;
const cache = new Map();

export default async function handler(request, response) {
  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }

  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  const token = firstValue(process.env.CLARITY_API_TOKEN, process.env.MICROSOFT_CLARITY_API_TOKEN);
  if (!token) {
    sendJson(response, 200, emptyClarityInsights("CLARITY_API_TOKEN ni nastavljen na strezniku."));
    return;
  }

  const url = new URL(request.url || "/", "https://demos.local");
  const days = clampDays(url.searchParams.get("days"));
  const dimension = sanitizeDimension(url.searchParams.get("dimension") || "URL");
  const cacheKey = `${days}:${dimension}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < cacheTtlMs) {
    sendJson(response, 200, {
      ...cached.value,
      cache: "memory"
    });
    return;
  }

  const apiUrl = new URL(clarityEndpoint);
  apiUrl.searchParams.set("numOfDays", String(days));
  apiUrl.searchParams.set("dimension1", dimension);

  try {
    const clarityResponse = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    if (!clarityResponse.ok) {
      sendJson(response, 200, {
        ...emptyClarityInsights(`Clarity Data Export API je vrnil HTTP ${clarityResponse.status}.`),
        configured: true,
        error: await clarityResponse.text()
      });
      return;
    }

    const payload = await clarityResponse.json();
    const normalized = normalizeClarityInsights(payload, { days, dimension });
    cache.set(cacheKey, { createdAt: Date.now(), value: normalized });
    sendJson(response, 200, normalized);
  } catch (error) {
    sendJson(response, 200, {
      ...emptyClarityInsights("Clarity Data Export API ni dosegljiv."),
      configured: true,
      error: error.message || "Clarity fetch failed"
    });
  }
}

function sendJson(response, status, value) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.statusCode = status;
  response.end(JSON.stringify(value));
}

function sanitizeDimension(value) {
  const allowed = ["URL", "Device", "Browser", "OS", "Country/Region", "Source", "Medium", "Campaign", "Channel"];
  return allowed.includes(value) ? value : "URL";
}

function clampDays(value) {
  const number = Number(value) || 1;
  return Math.min(3, Math.max(1, Math.round(number)));
}

function firstValue(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}
