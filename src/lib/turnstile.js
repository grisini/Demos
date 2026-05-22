const TURNSTILE_SCRIPT_ID = "cloudflare-turnstile-script";
const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let turnstileScriptPromise = null;

export function isTurnstileEnabled(appConfig) {
  return Boolean(appConfig?.TURNSTILE_SITE_KEY);
}

export async function renderTurnstileWidget(container, options = {}) {
  if (!container || !options.siteKey || typeof window === "undefined") return null;
  await loadTurnstileScript();
  if (!container.isConnected || typeof window.turnstile?.render !== "function") return null;
  if (container.dataset.turnstileRendered === "true") return container.dataset.turnstileWidgetId || null;

  const widgetId = window.turnstile.render(container, {
    sitekey: options.siteKey,
    action: options.action || "initiative_submit",
    theme: "light",
    callback: options.callback,
    "expired-callback": options.expiredCallback,
    "error-callback": options.errorCallback
  });

  container.dataset.turnstileRendered = "true";
  container.dataset.turnstileWidgetId = widgetId;
  return widgetId;
}

export function resetTurnstileWidget(widgetId) {
  if (typeof window === "undefined" || typeof window.turnstile?.reset !== "function" || !widgetId) return;
  window.turnstile.reset(widgetId);
}

export async function validateTurnstileToken({ endpoint, token, action }) {
  if (!endpoint || typeof fetch !== "function") {
    return {
      configured: false,
      verified: false,
      provider: "cloudflare_turnstile",
      error: "TURNSTILE_ENDPOINT ni nastavljen."
    };
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({ token, action })
  });
  const payload = await response.json().catch(() => null);
  if (payload) return payload;

  return {
    configured: response.status !== 503,
    verified: false,
    provider: "cloudflare_turnstile",
    error: `Turnstile endpoint je vrnil HTTP ${response.status}.`
  };
}

export function turnstileRuntimeStatus() {
  const hasLoader = typeof window !== "undefined" && typeof window.turnstile?.render === "function";
  const hasScript =
    typeof document !== "undefined" &&
    Boolean(document.getElementById(TURNSTILE_SCRIPT_ID));

  return {
    loader: hasLoader ? "inicializiran" : "ni inicializiran",
    script: hasScript ? "prisoten" : "ni prisoten"
  };
}

function loadTurnstileScript() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve(false);
  }

  if (typeof window.turnstile?.render === "function") return Promise.resolve(true);
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise((resolveScript, rejectScript) => {
    const existing = document.getElementById(TURNSTILE_SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => resolveScript(true), { once: true });
      existing.addEventListener("error", () => rejectScript(new Error("Turnstile script failed")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = TURNSTILE_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = TURNSTILE_SRC;
    script.onload = () => resolveScript(true);
    script.onerror = () => rejectScript(new Error("Turnstile script failed"));
    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
}
