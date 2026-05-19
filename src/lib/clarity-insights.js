import { emptyClarityInsights } from "../domain/clarity-insights.js";

export class ClarityInsightsClient {
  constructor(options = {}) {
    this.endpoint = options.endpoint || "";
  }

  async read(options = {}) {
    if (!this.endpoint || typeof fetch !== "function") {
      return emptyClarityInsights("CLARITY_ANALYTICS_ENDPOINT ni nastavljen.");
    }

    const url = new URL(this.endpoint, window.location.href);
    url.searchParams.set("days", String(options.days || 1));

    const response = await fetch(url, {
      headers: {
        Accept: "application/json"
      }
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ...emptyClarityInsights(payload?.error || "Clarity metrike niso dosegljive."),
        configured: Boolean(payload?.configured),
        error: payload?.error || `HTTP ${response.status}`
      };
    }

    return payload || emptyClarityInsights("Clarity endpoint ni vrnil podatkov.");
  }
}
