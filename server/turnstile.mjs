const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_TOKEN_LENGTH = 2048;

export function publicTurnstileConfig(env = {}) {
  return {
    TURNSTILE_SITE_KEY: firstValue(
      env.TURNSTILE_SITE_KEY,
      env.VITE_TURNSTILE_SITE_KEY,
      env.CLOUDFLARE_TURNSTILE_SITE_KEY,
      env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY
    ),
    TURNSTILE_ENDPOINT: firstValue(
      env.TURNSTILE_ENDPOINT,
      env.VITE_TURNSTILE_ENDPOINT,
      "/api/security/turnstile"
    )
  };
}

export async function verifyTurnstileToken(payload = {}, options = {}) {
  const env = options.env || {};
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const secret = firstValue(env.TURNSTILE_SECRET_KEY, env.CLOUDFLARE_TURNSTILE_SECRET_KEY);

  if (!secret) {
    return {
      configured: false,
      verified: false,
      provider: "cloudflare_turnstile",
      error: "TURNSTILE_SECRET_KEY ni nastavljen na strezniku."
    };
  }

  const token = String(payload.token || payload.response || payload["cf-turnstile-response"] || "").trim();
  const action = sanitizeAction(payload.action);

  if (!token) {
    return failedTurnstileResult("Turnstile token manjka.", { action });
  }

  if (token.length > MAX_TOKEN_LENGTH) {
    return failedTurnstileResult("Turnstile token je predolg.", { action });
  }

  if (typeof fetchImpl !== "function") {
    return failedTurnstileResult("Fetch ni dosegljiv za Turnstile preverjanje.", { action });
  }

  const body = new URLSearchParams({
    secret,
    response: token
  });
  const remoteIp = clientIp(options.remoteIp || payload.remoteIp);
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const response = await fetchImpl(SITEVERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });
    const result = await response.json().catch(() => ({}));
    const cloudflareSuccess = Boolean(response.ok && result.success);
    const actionOk = actionMatches(action, result.action);
    const hostnameOk = hostnameAllowed(result.hostname, env);
    const verified = cloudflareSuccess && actionOk && hostnameOk;

    return {
      configured: true,
      verified,
      provider: "cloudflare_turnstile",
      action,
      hostname: String(result.hostname || ""),
      challengeTs: String(result.challenge_ts || ""),
      errorCodes: Array.isArray(result["error-codes"]) ? result["error-codes"] : [],
      error: verified ? "" : turnstileFailureReason({ cloudflareSuccess, actionOk, hostnameOk, result })
    };
  } catch (error) {
    return failedTurnstileResult(error.message || "Turnstile Siteverify ni dosegljiv.", { action });
  }
}

function failedTurnstileResult(error, extra = {}) {
  return {
    configured: true,
    verified: false,
    provider: "cloudflare_turnstile",
    error,
    ...extra
  };
}

function actionMatches(expectedAction, actualAction) {
  if (!expectedAction) return true;
  const actual = String(actualAction || "").trim();
  return !actual || actual === expectedAction;
}

function hostnameAllowed(hostname, env) {
  const allowed = splitList(
    firstValue(env.TURNSTILE_ALLOWED_HOSTNAMES, env.CLOUDFLARE_TURNSTILE_ALLOWED_HOSTNAMES)
  );
  if (!allowed.length) return true;
  return allowed.includes(String(hostname || "").trim().toLowerCase());
}

function turnstileFailureReason({ cloudflareSuccess, actionOk, hostnameOk, result }) {
  if (!cloudflareSuccess) {
    const codes = Array.isArray(result?.["error-codes"]) ? result["error-codes"].join(", ") : "";
    return codes ? `Turnstile zavrnjen: ${codes}.` : "Turnstile preverjanje ni uspelo.";
  }
  if (!actionOk) return "Turnstile action se ne ujema s pricakovano akcijo.";
  if (!hostnameOk) return "Turnstile hostname ni dovoljen.";
  return "Turnstile preverjanje ni uspelo.";
}

function sanitizeAction(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 64);
}

function clientIp(value) {
  return String(value || "")
    .split(",")[0]
    .trim()
    .slice(0, 128);
}

function splitList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function firstValue(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}
