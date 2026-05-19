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

function publicRuntimeConfig(env) {
  return {
    DATA_SOURCE: firstValue(env.DATA_SOURCE, env.VITE_DATA_SOURCE, "supabase"),
    AUTH_MODE: firstValue(env.AUTH_MODE, env.VITE_AUTH_MODE, "demo"),
    SUPABASE_URL: firstValue(env.SUPABASE_URL, env.VITE_SUPABASE_URL),
    SUPABASE_ANON_KEY: firstValue(env.SUPABASE_ANON_KEY, env.VITE_SUPABASE_ANON_KEY),
    SIPASS_ENV: firstValue(env.SIPASS_ENV, env.VITE_SIPASS_ENV, "test"),
    SIPASS_AUTHORITY: firstValue(env.SIPASS_AUTHORITY, env.VITE_SIPASS_AUTHORITY, "https://sicas-test.sigov.si/"),
    SIPASS_CLIENT_ID: firstValue(env.SIPASS_CLIENT_ID, env.VITE_SIPASS_CLIENT_ID),
    SIPASS_REDIRECT_URI: firstValue(env.SIPASS_REDIRECT_URI, env.VITE_SIPASS_REDIRECT_URI),
    AI_PROVIDER: firstValue(env.AI_PROVIDER, env.VITE_AI_PROVIDER, env.HF_TOKEN ? "huggingface" : "local"),
    AI_REVIEW_ENDPOINT: firstValue(
      env.AI_REVIEW_ENDPOINT,
      env.VITE_AI_REVIEW_ENDPOINT,
      env.AI_PROVIDER === "huggingface" || env.VITE_AI_PROVIDER === "huggingface" || env.HF_TOKEN
        ? "/api/ai/review-initiative"
        : ""
    ),
    EMAIL_NOTIFICATIONS_ENDPOINT: firstValue(
      env.EMAIL_NOTIFICATIONS_ENDPOINT,
      env.VITE_EMAIL_NOTIFICATIONS_ENDPOINT,
      "/api/notifications/email"
    ),
    EMAIL_DELIVERY_MODE: firstValue(
      env.EMAIL_DELIVERY_MODE,
      env.VITE_EMAIL_DELIVERY_MODE,
      env.SMTP_HOST ? "smtp" : "outbox"
    ),
    EMAIL_NOTIFY_ACTOR: firstValue(env.EMAIL_NOTIFY_ACTOR, env.VITE_EMAIL_NOTIFY_ACTOR, "false") === "true",
    SYSTEM_ANALYTICS_ENDPOINT: firstValue(
      env.SYSTEM_ANALYTICS_ENDPOINT,
      env.VITE_SYSTEM_ANALYTICS_ENDPOINT,
      "/api/analytics/system"
    ),
    MICROSOFT_CLARITY_PROJECT_ID: firstValue(
      env.MICROSOFT_CLARITY_PROJECT_ID,
      env.VITE_MICROSOFT_CLARITY_PROJECT_ID,
      env.CLARITY_PROJECT_ID
    ),
    HUGGINGFACE_ZERO_SHOT_MODEL: firstValue(
      env.HUGGINGFACE_ZERO_SHOT_MODEL,
      env.VITE_HUGGINGFACE_ZERO_SHOT_MODEL,
      "facebook/bart-large-mnli"
    ),
    HUGGINGFACE_EMBEDDING_MODEL: firstValue(
      env.HUGGINGFACE_EMBEDDING_MODEL,
      env.VITE_HUGGINGFACE_EMBEDDING_MODEL,
      "intfloat/multilingual-e5-small"
    )
  };
}

export default function handler(_request, response) {
  response.setHeader("Content-Type", "text/javascript; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.statusCode = 200;
  response.end(`window.DEMOS_CONFIG = ${JSON.stringify(publicRuntimeConfig(process.env), null, 2)};\n`);
}
