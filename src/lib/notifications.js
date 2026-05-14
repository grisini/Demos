export class EmailNotificationClient {
  constructor(appConfig, fetcher = (...args) => globalThis.fetch(...args)) {
    this.endpoint = appConfig.EMAIL_NOTIFICATIONS_ENDPOINT || "";
    this.fetcher = fetcher;
  }

  async send(notifications) {
    const items = Array.isArray(notifications) ? notifications.filter(Boolean) : [];
    console.info("[Demokracija 2.0] Email client: priprava posiljanja", {
      endpoint: this.endpoint || "(ni nastavljen)",
      count: items.length,
      recipients: items.map((item) => maskEmail(item.to)),
      types: [...new Set(items.map((item) => item.type).filter(Boolean))]
    });

    if (!items.length) {
      console.info("[Demokracija 2.0] Email client: preskoceno, ni obvestil");
      return { accepted: 0, skipped: true, reason: "empty" };
    }

    if (!this.endpoint || typeof this.fetcher !== "function") {
      console.warn("[Demokracija 2.0] Email client: endpoint ali fetch ni nastavljen");
      return { accepted: 0, skipped: true, reason: "endpoint_not_configured" };
    }

    const response = await this.fetcher(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ notifications: items })
    });

    console.info("[Demokracija 2.0] Email client: endpoint odgovor", {
      status: response.status,
      ok: response.ok
    });

    if (!response.ok) {
      throw new Error(`Email notification endpoint failed (${response.status}).`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return { accepted: items.length };
    }

    const text = await response.text();
    const result = text ? JSON.parse(text) : { accepted: items.length };
    console.info("[Demokracija 2.0] Email client: rezultat", result);
    return result;
  }
}

function maskEmail(value) {
  const email = String(value || "");
  const [name, domain] = email.split("@");
  if (!name || !domain) return email || "(brez)";
  return `${name.slice(0, 2)}***@${domain}`;
}
