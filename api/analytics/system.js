import { checkRateLimit, rateLimitHeaders } from "../../server/rate-limit.mjs";

const maxBodyBytes = 128 * 1024;
const maxEventsPerRequest = 20;
const maxRecentEvents = 200;
const demoAdminEmail = "admin@demos.local";
const writeRateLimit = { name: "system-analytics-write", limit: 60, windowMs: 60 * 1000 };
const readRateLimit = { name: "system-analytics-read", limit: 30, windowMs: 60 * 1000 };

export default async function handler(request, response) {
  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }

  if (request.method === "GET") {
    const limit = checkRateLimit(request, readRateLimit);
    if (limit.limited) {
      sendJson(response, 429, { error: "Too many analytics read requests." }, rateLimitHeaders(limit));
      return;
    }

    if (!isAdminRequest(request, process.env)) {
      sendJson(response, 403, { error: "Forbidden" });
      return;
    }

    const result = await readRecentEvents(process.env);
    sendJson(response, 200, result);
    return;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  const limit = checkRateLimit(request, writeRateLimit);
  if (limit.limited) {
    sendJson(response, 429, { error: "Too many analytics write requests." }, rateLimitHeaders(limit));
    return;
  }

  try {
    const payload = await readJsonBody(request);
    const events = normalizeEvents(payload);
    const persistence = await persistEvents(events, process.env);

    console.info("[Demokracija 2.0] System analytics API", {
      accepted: events.length,
      storage: persistence.storage,
      persisted: persistence.persisted
    });

    sendJson(response, 202, {
      accepted: events.length,
      ...persistence
    });
  } catch (error) {
    console.error("[Demokracija 2.0] System analytics failed", error);
    sendJson(response, error.status || 500, {
      error: error.message || "System analytics failed"
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

function normalizeEvents(payload) {
  const rawEvents = Array.isArray(payload?.events)
    ? payload.events
    : payload?.event
      ? [payload.event]
      : Array.isArray(payload)
        ? payload
        : [];

  return rawEvents.slice(0, maxEventsPerRequest).map((event) => {
    const data = primitiveProperties(event);
    return {
      id: String(data.id || cryptoRandomId()),
      type: String(data.type || "system_event").slice(0, 80),
      createdAt: safeIsoDate(data.createdAt),
      source: String(data.source || "frontend").slice(0, 80),
      userRef: String(data.userRef || "").slice(0, 200),
      userRole: String(data.userRole || "").slice(0, 80),
      sessionId: String(data.sessionId || "").slice(0, 200),
      path: String(data.path || "").slice(0, 300),
      data
    };
  });
}

async function persistEvents(events, env) {
  if (!events.length) return { storage: "none", persisted: 0 };

  const url = firstValue(env.SUPABASE_URL, env.VITE_SUPABASE_URL);
  const serviceKey = firstValue(env.SUPABASE_SERVICE_ROLE_KEY, env.SUPABASE_SERVICE_KEY);

  if (!url || !serviceKey) {
    return { storage: "vercel_log", persisted: 0 };
  }

  const rows = events.map((event) => ({
    event_type: event.type,
    source: event.source,
    user_ref: event.userRef || null,
    user_role: event.userRole || null,
    session_id: event.sessionId || null,
    path: event.path || null,
    data: event.data,
    created_at: event.createdAt
  }));

  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/system_analytics_events`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify(rows)
    });

    if (!response.ok) {
      throw new Error(`Supabase telemetry insert failed (${response.status}): ${await response.text()}`);
    }

    return { storage: "supabase", persisted: rows.length };
  } catch (error) {
    console.error("[Demokracija 2.0] System analytics Supabase persistence failed", error);
    return { storage: "vercel_log", persisted: 0 };
  }
}

async function readRecentEvents(env) {
  const url = firstValue(env.SUPABASE_URL, env.VITE_SUPABASE_URL);
  const serviceKey = firstValue(env.SUPABASE_SERVICE_ROLE_KEY, env.SUPABASE_SERVICE_KEY);

  if (!url || !serviceKey) {
    return {
      events: [],
      storage: "vercel_log",
      persisted: false
    };
  }

  try {
    const response = await fetch(
      `${url.replace(/\/$/, "")}/rest/v1/system_analytics_events?select=*&order=created_at.desc&limit=${maxRecentEvents}`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Supabase telemetry read failed (${response.status}): ${await response.text()}`);
    }

    const rows = await response.json();
    return {
      events: rows.map(mapEventRow),
      storage: "supabase",
      persisted: true
    };
  } catch (error) {
    console.error("[Demokracija 2.0] System analytics Supabase read failed", error);
    return {
      events: [],
      storage: "vercel_log",
      persisted: false
    };
  }
}

function mapEventRow(row) {
  return {
    id: row.id,
    type: row.event_type,
    createdAt: row.created_at,
    source: row.source,
    userRef: row.user_ref || "",
    userRole: row.user_role || "",
    sessionId: row.session_id || "",
    path: row.path || "",
    ...(row.data && typeof row.data === "object" ? row.data : {})
  };
}

function isAdminRequest(request, env) {
  const admin = String(request.headers["x-demos-admin"] || "").trim().toLowerCase();
  return adminEmails(env).has(admin);
}

function primitiveProperties(value) {
  return Object.fromEntries(
    Object.entries(value || {}).filter(([, item]) =>
      item === null || ["string", "number", "boolean"].includes(typeof item)
    )
  );
}

function safeIsoDate(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function firstValue(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
      continue;
    }
    return value;
  }

  return "";
}

function cryptoRandomId() {
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `event-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
