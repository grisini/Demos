const viteEnv = import.meta.env || {};
const runtimeConfig = globalThis.DEMOS_CONFIG || {};

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

function booleanValue(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null || value === "") return fallback;
  return String(value).toLowerCase() === "true";
}

function publicConfigValue(name, ...fallbacks) {
  return firstValue(
    runtimeConfig[name],
    runtimeConfig[`VITE_${name}`],
    viteEnv[`VITE_${name}`],
    viteEnv[name],
    ...fallbacks
  );
}

function optionConfigValue(name, fallback) {
  return String(publicConfigValue(name, fallback)).toLowerCase();
}

export const config = {
  DATA_SOURCE: optionConfigValue("DATA_SOURCE", "supabase"),
  AUTH_MODE: optionConfigValue("AUTH_MODE", "demo"),
  SUPABASE_URL: publicConfigValue("SUPABASE_URL"),
  SUPABASE_ANON_KEY: publicConfigValue("SUPABASE_ANON_KEY"),
  SIPASS_ENV: optionConfigValue("SIPASS_ENV", "test"),
  SIPASS_AUTHORITY: publicConfigValue("SIPASS_AUTHORITY", "https://sicas-test.sigov.si/"),
  SIPASS_CLIENT_ID: publicConfigValue("SIPASS_CLIENT_ID"),
  SIPASS_REDIRECT_URI: publicConfigValue("SIPASS_REDIRECT_URI", "http://localhost:5173/auth/sipass/callback"),
  AI_PROVIDER: optionConfigValue("AI_PROVIDER", "local"),
  AI_REVIEW_ENDPOINT: publicConfigValue("AI_REVIEW_ENDPOINT"),
  EMAIL_NOTIFICATIONS_ENDPOINT: publicConfigValue("EMAIL_NOTIFICATIONS_ENDPOINT"),
  EMAIL_DELIVERY_MODE: optionConfigValue("EMAIL_DELIVERY_MODE", "outbox"),
  EMAIL_NOTIFY_ACTOR: booleanValue(publicConfigValue("EMAIL_NOTIFY_ACTOR"), false),
  SYSTEM_ANALYTICS_ENDPOINT: publicConfigValue("SYSTEM_ANALYTICS_ENDPOINT", "/api/analytics/system"),
  CLARITY_ANALYTICS_ENDPOINT: publicConfigValue("CLARITY_ANALYTICS_ENDPOINT", "/api/analytics/clarity"),
  MICROSOFT_CLARITY_PROJECT_ID: publicConfigValue("MICROSOFT_CLARITY_PROJECT_ID", publicConfigValue("CLARITY_PROJECT_ID")),
  HUGGINGFACE_ZERO_SHOT_MODEL: publicConfigValue("HUGGINGFACE_ZERO_SHOT_MODEL", "facebook/bart-large-mnli"),
  HUGGINGFACE_EMBEDDING_MODEL: publicConfigValue("HUGGINGFACE_EMBEDDING_MODEL", "intfloat/multilingual-e5-small")
};

if (booleanValue(publicConfigValue("DEBUG_CONFIG"), false)) {
  console.info("Demos config", {
    ...config,
    SUPABASE_ANON_KEY: config.SUPABASE_ANON_KEY ? "set" : "missing"
  });
}

export function isSupabaseEnabled(appConfig = config) {
  return (
    appConfig.DATA_SOURCE === "supabase" &&
    Boolean(appConfig.SUPABASE_URL) &&
    Boolean(appConfig.SUPABASE_ANON_KEY)
  );
}
