const defaultWindowMs = 60 * 1000;
const defaultLimit = 60;
const buckets = new Map();

export function checkRateLimit(request, options = {}) {
  const now = Date.now();
  const windowMs = positiveInteger(options.windowMs, defaultWindowMs);
  const limit = positiveInteger(options.limit, defaultLimit);
  const key = `${options.name || "default"}:${clientKey(request, options)}`;
  const current = buckets.get(key);
  const resetAt = current && current.resetAt > now ? current.resetAt : now + windowMs;
  const count = current && current.resetAt > now ? current.count + 1 : 1;
  const remaining = Math.max(0, limit - count);

  buckets.set(key, { count, resetAt });
  pruneExpiredBuckets(now);

  return {
    limited: count > limit,
    limit,
    remaining,
    retryAfter: Math.max(1, Math.ceil((resetAt - now) / 1000)),
    resetAt
  };
}

export function rateLimitHeaders(result) {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    ...(result.limited ? { "Retry-After": String(result.retryAfter) } : {})
  };
}

export function clientIpFromRequest(request) {
  const headers = request?.headers || {};
  const value =
    headerValue(headers, "cf-connecting-ip") ||
    headerValue(headers, "x-real-ip") ||
    headerValue(headers, "x-forwarded-for") ||
    request?.socket?.remoteAddress ||
    request?.connection?.remoteAddress ||
    "";

  return String(value).split(",")[0].trim() || "unknown";
}

function clientKey(request, options) {
  const parts = [clientIpFromRequest(request)];
  if (options.includePath) {
    parts.push(String(request?.url || "").split("?")[0]);
  }
  return parts.join(":").slice(0, 400);
}

function headerValue(headers, name) {
  return headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : fallback;
}

function pruneExpiredBuckets(now) {
  if (buckets.size < 2000) return;
  for (const [key, value] of buckets.entries()) {
    if (value.resetAt <= now) buckets.delete(key);
  }
}
