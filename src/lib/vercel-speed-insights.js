const SPEED_SCRIPT_ID = "vercel-speed-insights-script";
const SPEED_SDK_NAME = "@vercel/speed-insights";
const SPEED_SDK_VERSION = "2.0.0";

export function initializeVercelSpeedInsights({ route = "", forceProduction = false } = {}) {
  if (typeof window === "undefined" || typeof document === "undefined") return false;

  window.si =
    window.si ||
    function vercelSpeedInsightsQueue(...params) {
      window.siq = window.siq || [];
      window.siq.push(params);
    };

  const existing = document.getElementById(SPEED_SCRIPT_ID);
  if (existing) {
    setVercelSpeedInsightsRoute(route);
    return true;
  }

  const script = document.createElement("script");
  const local = isLocalHost(window.location.hostname);
  script.id = SPEED_SCRIPT_ID;
  script.defer = true;
  script.src = local && !forceProduction
    ? "https://va.vercel-scripts.com/v1/speed-insights/script.debug.js"
    : "/_vercel/speed-insights/script.js";
  script.dataset.sdkn = SPEED_SDK_NAME;
  script.dataset.sdkv = SPEED_SDK_VERSION;
  if (route) script.dataset.route = route;
  document.head.appendChild(script);
  return true;
}

export function setVercelSpeedInsightsRoute(route) {
  if (typeof document === "undefined") return;
  const script = document.getElementById(SPEED_SCRIPT_ID);
  if (!script) return;
  if (route) {
    script.dataset.route = route;
  } else {
    delete script.dataset.route;
  }
}

export function vercelSpeedInsightsStatus() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return {
      loader: "ni nalozen",
      script: "ni vstavljen",
      route: ""
    };
  }

  const script = document.getElementById(SPEED_SCRIPT_ID);
  return {
    loader: typeof window.si === "function" ? "nalozen" : "ni nalozen",
    script: script ? "vstavljen" : "ni vstavljen",
    route: script?.dataset.route || ""
  };
}

function isLocalHost(hostname) {
  return ["localhost", "127.0.0.1", "::1"].includes(hostname);
}
