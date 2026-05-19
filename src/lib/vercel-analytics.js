const VERCEL_SCRIPT_ID = "vercel-web-analytics-script";

export function initializeVercelAnalytics({ forceProduction = false } = {}) {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  if (document.getElementById(VERCEL_SCRIPT_ID)) return true;

  window.va =
    window.va ||
    function vercelAnalyticsQueue(...params) {
      window.vaq = window.vaq || [];
      window.vaq.push(params);
    };

  const script = document.createElement("script");
  const local = isLocalHost(window.location.hostname);
  script.id = VERCEL_SCRIPT_ID;
  script.defer = true;
  script.src = local && !forceProduction
    ? "https://va.vercel-scripts.com/v1/script.debug.js"
    : "/_vercel/insights/script.js";
  script.dataset.sdkn = "demos-static";
  script.dataset.sdkv = "1";
  document.head.appendChild(script);
  return true;
}

export function trackVercelEvent(name, properties = {}) {
  if (typeof window === "undefined" || typeof window.va !== "function") return;
  window.va("event", {
    name,
    data: primitiveProperties(properties)
  });
}

function primitiveProperties(properties) {
  return Object.fromEntries(
    Object.entries(properties || {}).filter(([, value]) =>
      value === null || ["string", "number", "boolean"].includes(typeof value)
    )
  );
}

function isLocalHost(hostname) {
  return ["localhost", "127.0.0.1", "::1"].includes(hostname);
}
