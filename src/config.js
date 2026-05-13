export const config = {
  DATA_SOURCE: "local",
  AUTH_MODE: "demo",
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
  SIPASS_ENV: "test",
  SIPASS_AUTHORITY: "https://sicas-test.sigov.si/",
  SIPASS_CLIENT_ID: "",
  SIPASS_REDIRECT_URI: "http://localhost:5173/auth/sipass/callback",
  AI_PROVIDER: "local",
  AI_REVIEW_ENDPOINT: "",
  HUGGINGFACE_ZERO_SHOT_MODEL: "facebook/bart-large-mnli",
  HUGGINGFACE_EMBEDDING_MODEL: "intfloat/multilingual-e5-small",
  ...(globalThis.DEMOS_CONFIG || {})
};

export function isSupabaseEnabled(appConfig = config) {
  return (
    appConfig.DATA_SOURCE === "supabase" &&
    Boolean(appConfig.SUPABASE_URL) &&
    Boolean(appConfig.SUPABASE_ANON_KEY)
  );
}
