const viteEnv = import.meta.env || {};
const runtimeConfig = globalThis.DEMOS_CONFIG || {};

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "") || "";
}

function booleanValue(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null || value === "") return fallback;
  return String(value).toLowerCase() === "true";
}
export const config = {
  DATA_SOURCE: firstValue(runtimeConfig.DATA_SOURCE, viteEnv.VITE_DATA_SOURCE, "local"),
  AUTH_MODE: firstValue(runtimeConfig.AUTH_MODE, viteEnv.VITE_AUTH_MODE, "demo"),
  SUPABASE_URL: firstValue(runtimeConfig.SUPABASE_URL, viteEnv.VITE_SUPABASE_URL),
  SUPABASE_ANON_KEY: firstValue(runtimeConfig.SUPABASE_ANON_KEY, viteEnv.VITE_SUPABASE_ANON_KEY),
  SIPASS_ENV: firstValue(runtimeConfig.SIPASS_ENV, viteEnv.VITE_SIPASS_ENV, "test"),
  SIPASS_AUTHORITY: firstValue(
    runtimeConfig.SIPASS_AUTHORITY,
    viteEnv.VITE_SIPASS_AUTHORITY,
    "https://sicas-test.sigov.si/"
  ),
  SIPASS_CLIENT_ID: firstValue(runtimeConfig.SIPASS_CLIENT_ID, viteEnv.VITE_SIPASS_CLIENT_ID),
  SIPASS_REDIRECT_URI: firstValue(
    runtimeConfig.SIPASS_REDIRECT_URI,
    viteEnv.VITE_SIPASS_REDIRECT_URI,
    "http://localhost:5173/auth/sipass/callback"
  ),
  AI_PROVIDER: firstValue(runtimeConfig.AI_PROVIDER, viteEnv.VITE_AI_PROVIDER, "local"),
  AI_REVIEW_ENDPOINT: firstValue(runtimeConfig.AI_REVIEW_ENDPOINT, viteEnv.VITE_AI_REVIEW_ENDPOINT),
  EMAIL_NOTIFICATIONS_ENDPOINT: firstValue(
    runtimeConfig.EMAIL_NOTIFICATIONS_ENDPOINT,
    viteEnv.VITE_EMAIL_NOTIFICATIONS_ENDPOINT
  ),
  EMAIL_DELIVERY_MODE: firstValue(runtimeConfig.EMAIL_DELIVERY_MODE, viteEnv.VITE_EMAIL_DELIVERY_MODE, "outbox"),
  EMAIL_NOTIFY_ACTOR: booleanValue(runtimeConfig.EMAIL_NOTIFY_ACTOR, viteEnv.VITE_EMAIL_NOTIFY_ACTOR === "true"),
  HUGGINGFACE_ZERO_SHOT_MODEL: firstValue(
    runtimeConfig.HUGGINGFACE_ZERO_SHOT_MODEL,
    viteEnv.VITE_HUGGINGFACE_ZERO_SHOT_MODEL,
    "facebook/bart-large-mnli"
  ),
  HUGGINGFACE_EMBEDDING_MODEL: firstValue(
    runtimeConfig.HUGGINGFACE_EMBEDDING_MODEL,
    viteEnv.VITE_HUGGINGFACE_EMBEDDING_MODEL,
    "intfloat/multilingual-e5-small"
  )
};

export function isSupabaseEnabled(appConfig = config) {
  return (
    appConfig.DATA_SOURCE === "supabase" &&
    Boolean(appConfig.SUPABASE_URL) &&
    Boolean(appConfig.SUPABASE_ANON_KEY)
  );
}
