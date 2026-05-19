const TELEMETRY_KEY = "demos.systemTelemetry";
const MAX_EVENTS = 120;

export class SystemTelemetry {
  constructor(options = {}) {
    if (options?.getItem) {
      this.storage = options;
      this.endpoint = "";
      return;
    }

    this.storage = options.storage || globalThis.localStorage;
    this.endpoint = options.endpoint || "";
  }

  read() {
    try {
      const raw = this.storage?.getItem(TELEMETRY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  record(type, data = {}) {
    const event = {
      id: globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `event-${Date.now()}`,
      type,
      createdAt: new Date().toISOString(),
      ...primitiveProperties(data)
    };

    try {
      const events = [event, ...this.read()].slice(0, MAX_EVENTS);
      this.storage?.setItem(TELEMETRY_KEY, JSON.stringify(events));
    } catch {
      // Telemetry is best-effort and must never block the app.
    }

    this.send(event);
    return event;
  }

  async readRemote(adminUser) {
    if (!this.endpoint || typeof fetch !== "function") return [];

    try {
      const response = await fetch(this.endpoint, {
        headers: {
          "x-demos-admin": String(adminUser?.email || adminUser?.id || "")
        }
      });

      if (!response.ok) return [];
      const payload = await response.json();
      return Array.isArray(payload.events) ? payload.events : [];
    } catch {
      return [];
    }
  }

  send(event) {
    if (!this.endpoint || typeof fetch !== "function") return;

    const body = JSON.stringify({ event });
    try {
      if (globalThis.navigator?.sendBeacon) {
        const sent = globalThis.navigator.sendBeacon(
          this.endpoint,
          new Blob([body], { type: "application/json" })
        );
        if (sent) return;
      }

      fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body,
        keepalive: true
      }).catch(() => {});
    } catch {
      // Remote telemetry is best-effort and local storage remains the fallback.
    }
  }
}

export function browserResourceSnapshot(performanceApi = globalThis.performance) {
  if (!performanceApi?.getEntriesByType) {
    return {
      resourceCount: 0,
      transferKb: 0,
      scriptCount: 0,
      stylesheetCount: 0,
      fetchCount: 0,
      loadMs: 0
    };
  }

  const resources = performanceApi.getEntriesByType("resource") || [];
  const navigation = performanceApi.getEntriesByType("navigation")?.[0];

  return {
    resourceCount: resources.length,
    transferKb: roundOne(sum(resources.map((entry) => entry.transferSize || 0)) / 1024),
    scriptCount: resources.filter((entry) => entry.initiatorType === "script").length,
    stylesheetCount: resources.filter((entry) => entry.initiatorType === "link" || entry.initiatorType === "css").length,
    fetchCount: resources.filter((entry) => ["fetch", "xmlhttprequest"].includes(entry.initiatorType)).length,
    loadMs: Math.round(navigation?.loadEventEnd || navigation?.duration || 0)
  };
}

export function estimateTextTokens(value) {
  const text = String(value || "").trim();
  if (!text) return 0;
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(Math.max(words * 1.35, text.length / 4)));
}

function primitiveProperties(properties) {
  return Object.fromEntries(
    Object.entries(properties || {}).filter(([, value]) =>
      value === null || ["string", "number", "boolean"].includes(typeof value)
    )
  );
}

function sum(values) {
  return values.reduce((total, value) => total + (Number(value) || 0), 0);
}

function roundOne(value) {
  return Math.round(value * 10) / 10;
}
