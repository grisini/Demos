import { buildInitiativeDailyDigestEmailNotifications } from "../src/domain/notifications.js";
import { deliverEmailNotifications } from "./email.mjs";

const defaultTimeZone = "Europe/Ljubljana";
const digestSentEventType = "daily_creator_digest_sent";
const maxRows = 10000;

export default async function handler(request, response) {
  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }

  if (!["GET", "POST"].includes(request.method)) {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  if (!isAuthorizedRequest(request, process.env)) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  try {
    const url = requestUrl(request);
    const timeZone = firstValue(
      url.searchParams.get("timeZone"),
      process.env.DAILY_DIGEST_TIME_ZONE,
      defaultTimeZone
    );
    const dateKey = firstValue(url.searchParams.get("date"), previousLocalDateKey(new Date(), timeZone));
    const dryRun = ["1", "true", "yes"].includes(String(url.searchParams.get("dryRun") || "").toLowerCase());

    const result = await sendDailyCreatorDigest({
      env: process.env,
      dateKey,
      timeZone,
      dryRun,
      siteUrl: publicSiteUrl(request, process.env)
    });
    sendJson(response, 202, result);
  } catch (error) {
    console.error("[Demokracija 2.0] Daily creator digest failed", error);
    sendJson(response, error.status || 500, {
      error: error.message || "Daily creator digest failed"
    });
  }
}

export async function sendDailyCreatorDigest({
  env,
  dateKey,
  timeZone = defaultTimeZone,
  dryRun = false,
  siteUrl,
  deliverNotifications = deliverEmailNotifications
} = {}) {
  const client = supabaseClient(env);
  if (!client) {
    const error = new Error("Supabase service role is required for daily creator digests.");
    error.status = 503;
    throw error;
  }

  const digestDateKey = dateKey || previousLocalDateKey(new Date(), timeZone);
  const range = localDateRangeUtc(digestDateKey, timeZone);
  const [votes, signatures, comments] = await Promise.all([
    readActivityRows(client, "votes", "voter_ref", range),
    readActivityRows(client, "signatures", "signer_ref", range),
    readActivityRows(client, "comments", "author_ref", range)
  ]);
  const initiativeIds = uniqueIds([
    ...votes.map((row) => row.initiative_id),
    ...signatures.map((row) => row.initiative_id),
    ...comments.map((row) => row.initiative_id)
  ]);

  if (!initiativeIds.length) {
    return {
      dateKey: digestDateKey,
      timeZone,
      range,
      activity: { votes: 0, signatures: 0, comments: 0 },
      notifications: 0,
      skippedDuplicates: 0,
      delivery: { accepted: 0, mode: "none" }
    };
  }

  const [initiatives, sentKeys] = await Promise.all([
    readInitiatives(client, initiativeIds),
    readSentDigestKeys(client, digestDateKey)
  ]);
  const notifications = [];
  const sentRecords = [];
  let skippedDuplicates = 0;

  for (const initiative of initiatives) {
    const dedupeKey = digestKey(digestDateKey, initiative.id);
    if (sentKeys.has(dedupeKey)) {
      skippedDuplicates += 1;
      continue;
    }

    const counts = {
      votes: countRowsForInitiative(votes, initiative, "voter_ref"),
      signatures: countRowsForInitiative(signatures, initiative, "signer_ref"),
      comments: countRowsForInitiative(comments, initiative, "author_ref")
    };
    const items = buildInitiativeDailyDigestEmailNotifications({
      initiative: mapInitiativeForEmail(initiative),
      dateKey: digestDateKey,
      counts,
      siteUrl
    });

    for (const notification of items) {
      notifications.push(notification);
      sentRecords.push({
        notification,
        initiative,
        counts
      });
    }
  }

  if (dryRun) {
    return {
      dateKey: digestDateKey,
      timeZone,
      range,
      dryRun: true,
      activity: {
        votes: votes.length,
        signatures: signatures.length,
        comments: comments.length
      },
      notifications: notifications.length,
      skippedDuplicates,
      digests: sentRecords.map(digestSummary)
    };
  }

  const delivery = await deliverNotifications({ notifications }, env);
  const shouldPersist = notifications.length > 0 && delivery?.mode === "smtp";
  const persistedSentEvents = shouldPersist
    ? await recordSentDigestEvents(client, {
        dateKey: digestDateKey,
        range,
        delivery,
        records: sentRecords
      })
    : 0;

  return {
    dateKey: digestDateKey,
    timeZone,
    range,
    activity: {
      votes: votes.length,
      signatures: signatures.length,
      comments: comments.length
    },
    notifications: notifications.length,
    skippedDuplicates,
    digests: sentRecords.map(digestSummary),
    delivery,
    persistedSentEvents
  };
}

function digestSummary({ notification, initiative, counts }) {
  return {
    initiativeId: initiative.id,
    recipient: maskEmail(notification.to),
    counts
  };
}

async function readActivityRows(client, table, refColumn, range) {
  const params = new URLSearchParams({
    select: `initiative_id,${refColumn},created_at`,
    created_at: `gte.${range.start}`,
    limit: String(maxRows)
  });
  params.append("created_at", `lt.${range.end}`);
  return supabaseRequest(client, `/rest/v1/${table}?${params.toString()}`);
}

async function readInitiatives(client, initiativeIds) {
  const params = new URLSearchParams({
    select: "id,title,category,status,author_ref,author_name",
    id: `in.(${initiativeIds.join(",")})`,
    limit: String(maxRows)
  });
  return supabaseRequest(client, `/rest/v1/initiatives?${params.toString()}`);
}

async function readSentDigestKeys(client, dateKey) {
  const params = new URLSearchParams({
    select: "data",
    event_type: `eq.${digestSentEventType}`,
    "data->>dateKey": `eq.${dateKey}`,
    limit: String(maxRows)
  });
  try {
    const rows = await supabaseRequest(client, `/rest/v1/system_analytics_events?${params.toString()}`);
    return new Set(
      rows
        .map((row) => digestKey(row?.data?.dateKey, row?.data?.initiativeId))
        .filter(Boolean)
    );
  } catch (error) {
    console.warn("[Demokracija 2.0] Daily digest dedupe read failed", error);
    return new Set();
  }
}

async function recordSentDigestEvents(client, { dateKey, range, delivery, records }) {
  if (!records.length) return 0;
  const createdAt = new Date().toISOString();
  const rows = records.map(({ notification, initiative, counts }) => ({
    event_type: digestSentEventType,
    source: "server_cron",
    user_ref: initiative.author_ref || null,
    user_role: "system",
    path: "/api/notifications/daily-digest",
    data: {
      dateKey,
      initiativeId: initiative.id,
      notificationId: notification.id,
      recipient: notification.to,
      counts,
      range,
      deliveryMode: delivery?.mode || "unknown"
    },
    created_at: createdAt
  }));

  try {
    await supabaseRequest(client, "/rest/v1/system_analytics_events", {
      method: "POST",
      headers: {
        Prefer: "return=minimal"
      },
      body: JSON.stringify(rows)
    });
    return rows.length;
  } catch (error) {
    console.error("[Demokracija 2.0] Daily digest sent-event persistence failed", error);
    return 0;
  }
}

async function supabaseRequest(client, path, options = {}) {
  const response = await fetch(`${client.url}${path}`, {
    ...options,
    headers: {
      apikey: client.serviceKey,
      Authorization: `Bearer ${client.serviceKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(`Supabase daily digest request failed (${response.status}): ${await response.text()}`);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function countRowsForInitiative(rows, initiative, refColumn) {
  const authorRef = normalizeRef(initiative.author_ref);
  return rows.filter((row) => {
    if (row.initiative_id !== initiative.id) return false;
    const actorRef = normalizeRef(row[refColumn]);
    return !authorRef || actorRef !== authorRef;
  }).length;
}

function mapInitiativeForEmail(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    status: row.status,
    author: {
      id: row.author_ref,
      name: row.author_name,
      email: row.author_ref
    }
  };
}

function supabaseClient(env = {}) {
  const url = firstValue(env.SUPABASE_URL, env.VITE_SUPABASE_URL).replace(/\/$/, "");
  const serviceKey = firstValue(env.SUPABASE_SERVICE_ROLE_KEY, env.SUPABASE_SERVICE_KEY);
  if (!url || !serviceKey) return null;
  return { url, serviceKey };
}

function localDateRangeUtc(dateKey, timeZone) {
  const start = zonedDateKeyToUtc(dateKey, timeZone);
  const end = zonedDateKeyToUtc(addDaysToDateKey(dateKey, 1), timeZone);
  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
}

function zonedDateKeyToUtc(dateKey, timeZone) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const utcGuessMs = Date.UTC(year, month - 1, day, 0, 0, 0);
  const firstGuess = new Date(utcGuessMs - timeZoneOffsetMs(new Date(utcGuessMs), timeZone));
  return new Date(utcGuessMs - timeZoneOffsetMs(firstGuess, timeZone));
}

function timeZoneOffsetMs(date, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  const localAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return localAsUtc - date.getTime();
}

function previousLocalDateKey(now, timeZone) {
  const local = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    })
      .formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  return addDaysToDateKey(`${local.year}-${local.month}-${local.day}`, -1);
}

function addDaysToDateKey(dateKey, days) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0")
  ].join("-");
}

function digestKey(dateKey, initiativeId) {
  if (!dateKey || !initiativeId) return "";
  return `${dateKey}:${initiativeId}`;
}

function uniqueIds(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function normalizeRef(value) {
  return String(value || "").trim().toLowerCase();
}

function publicSiteUrl(request, env = {}) {
  const configured = firstValue(env.PUBLIC_SITE_URL, env.VITE_PUBLIC_SITE_URL, env.SITE_URL);
  if (configured) return withProtocol(configured);

  const vercelHost = firstValue(env.VERCEL_PROJECT_PRODUCTION_URL, env.VERCEL_URL);
  if (vercelHost) return withProtocol(vercelHost);

  const host = request?.headers?.host || "localhost:5173";
  const protocol = host.includes("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

function withProtocol(value) {
  const text = String(value || "").trim().replace(/\/$/, "");
  if (!text) return "";
  return /^https?:\/\//i.test(text) ? text : `https://${text}`;
}

function requestUrl(request) {
  return new URL(request.url || "/", publicSiteUrl(request, process.env));
}

function isAuthorizedRequest(request, env = {}) {
  const secret = firstValue(env.DAILY_DIGEST_CRON_SECRET, env.CRON_SECRET);
  if (!secret) return true;
  const authorization = String(request.headers?.authorization || "");
  const headerSecret = String(request.headers?.["x-cron-secret"] || "");
  return authorization === `Bearer ${secret}` || headerSecret === secret;
}

function sendJson(response, status, value) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.statusCode = status;
  response.end(JSON.stringify(value));
}

function firstValue(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function maskEmail(value) {
  const email = String(value || "");
  const [name, domain] = email.split("@");
  if (!name || !domain) return email || "(brez)";
  return `${name.slice(0, 2)}***@${domain}`;
}
