const CLARITY_SCRIPT_ID = "microsoft-clarity-script";

export function initializeMicrosoftClarity(projectId) {
  if (typeof window === "undefined" || typeof document === "undefined") return false;

  const cleanProjectId = normalizeProjectId(projectId);
  if (!cleanProjectId) return false;

  window.clarity =
    window.clarity ||
    function clarityQueue(...params) {
      window.clarity.q = window.clarity.q || [];
      window.clarity.q.push(params);
    };

  if (document.getElementById(CLARITY_SCRIPT_ID)) return true;

  const script = document.createElement("script");
  script.id = CLARITY_SCRIPT_ID;
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${cleanProjectId}`;
  document.head.appendChild(script);
  return true;
}

export function identifyClarityUser(user, pageId) {
  if (typeof window === "undefined" || typeof window.clarity !== "function" || !user?.id) return;
  window.clarity("identify", String(user.id), currentSessionId(), String(pageId || location.pathname), user.name || "");
}

export function setClarityTag(key, value) {
  if (typeof window === "undefined" || typeof window.clarity !== "function") return;
  const values = Array.isArray(value) ? value : [value];
  for (const item of values) {
    if (item === undefined || item === null || item === "") continue;
    window.clarity("set", String(key), String(item));
  }
}

export function trackClarityEvent(name) {
  if (typeof window === "undefined" || typeof window.clarity !== "function") return;
  window.clarity("event", String(name));
}

function normalizeProjectId(projectId) {
  const value = String(projectId || "").trim();
  return /^[a-zA-Z0-9_-]{4,80}$/.test(value) ? value : "";
}

function currentSessionId() {
  const key = "demos.claritySessionId";
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
  } catch {
    return `session-${Date.now()}`;
  }

  const id = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  try {
    sessionStorage.setItem(key, id);
  } catch {
    // Ignore storage errors; Clarity can still receive a per-page session id.
  }
  return id;
}
