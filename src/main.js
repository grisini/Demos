import { config, isSupabaseEnabled } from "./config.js";
import {
  calculateAnalytics,
  calculateSystemAnalytics,
  calculateUserAnalytics
} from "./domain/analytics.js";
import {
  NOTIFICATION_EVENTS,
  buildCategoryMatchEmailNotifications,
  buildInitiativeChangeEmailNotifications,
  isValidEmail
} from "./domain/notifications.js";
import {
  CATEGORIES,
  STATUSES,
  createInitiative,
  evaluateInitiative,
  riskLabel,
  suitabilityLabel,
  statusLabel,
  validateInitiative
} from "./domain/validation.js";
import { DemoAuth } from "./lib/auth.js";
import {
  identifyClarityUser,
  initializeMicrosoftClarity,
  setClarityTag,
  trackClarityEvent
} from "./lib/clarity.js";
import { EmailNotificationClient } from "./lib/notifications.js";
import { createRepository } from "./lib/supabase.js";
import { browserResourceSnapshot, estimateTextTokens, SystemTelemetry } from "./lib/telemetry.js";
import { initializeVercelAnalytics, trackVercelEvent } from "./lib/vercel-analytics.js";

const DEMO_ADMIN_EMAIL = "admin@demos.local";
const APP_VIEWS = ["dashboard", "submit", "analytics", "integrations", "systemAnalytics"];
const PUBLIC_INITIATIVE_STATUSES = ["active", "signature_collection"];
const ANONYMOUS_VOTER_KEY = "demos.anonymousVoterId";

class DemocracyApp {
  constructor({ root, repository, auth, notificationClient, telemetry, config: appConfig }) {
    this.root = root;
    this.repository = repository;
    this.auth = auth;
    this.notificationClient = notificationClient;
    this.telemetry = telemetry;
    this.config = appConfig;
    this.anonymousVoterSessionId = "";
    this.state = {
      initiatives: [],
      selectedId: null,
      activeView: initialView(auth.currentUser()),
      query: "",
      category: "all",
      status: "all",
      sort: "popular",
      draft: emptyDraft(),
      errors: {},
      toast: "",
      aiPreviewReview: null,
      aiPreviewLoading: false,
      systemTelemetryEvents: [],
      systemTelemetryLoading: false,
      sidebarOpen: defaultSidebarOpen(),
      loading: true
    };

    this.root.addEventListener("click", (event) => this.handleClick(event));
    this.root.addEventListener("submit", (event) => this.handleSubmit(event));
    this.root.addEventListener("input", (event) => this.handleInput(event));
    this.root.addEventListener("change", (event) => this.handleChange(event));
    window.addEventListener("popstate", () => this.handleRouteChange());
  }

  async init() {
    this.syncViewUrl({ replace: true });
    initializeVercelAnalytics();
    initializeMicrosoftClarity(this.config.MICROSOFT_CLARITY_PROJECT_ID);
    this.syncExternalAnalytics();
    await this.refresh();
  }

  async refresh() {
    this.state.loading = true;
    this.render();
    const startedAt = performance.now();
    try {
      this.state.initiatives = await this.repository.list();
      this.recordSystemEvent("data_load", {
        count: this.state.initiatives.length,
        durationMs: Math.round(performance.now() - startedAt),
        dataSource: this.config.DATA_SOURCE
      });
      this.state.selectedId ||= this.state.initiatives[0]?.id || null;
      this.state.loading = false;
      this.render();
    } catch (error) {
      this.reportError("Napaka pri nalaganju pobud", error);
      this.state.loading = false;
      this.toast("Podatkov ni bilo mogoce naloziti.");
      this.render();
    }
  }

  currentUser() {
    return this.auth.currentUser();
  }

  anonymousActor(options = {}) {
    let existing = "";
    try {
      existing = localStorage.getItem(ANONYMOUS_VOTER_KEY);
    } catch {
      existing = "";
    }
    if (!existing && !options.create) return null;

    const id = existing || this.anonymousVoterSessionId || anonymousVoterId();
    this.anonymousVoterSessionId = id;
    if (!existing) {
      try {
        localStorage.setItem(ANONYMOUS_VOTER_KEY, id);
      } catch {
        // Voting can continue for the current action even if the browser blocks storage.
      }
    }

    return {
      id,
      name: "Anonimni glasovalec",
      provider: "anonymous"
    };
  }

  isAdminUser(user = this.currentUser()) {
    return isDemoAdminUser(user);
  }

  filteredInitiatives() {
    const query = this.state.query.toLowerCase();
    const source = this.visibleInitiatives();
    const filtered = source.filter((initiative) => {
      const text = `${initiative.title} ${initiative.summary} ${initiative.category}`.toLowerCase();
      const queryMatch = !query || text.includes(query);
      const categoryMatch = this.state.category === "all" || initiative.category === this.state.category;
      const statusMatch = this.state.status === "all" || initiative.status === this.state.status;
      return queryMatch && categoryMatch && statusMatch;
    });

    return filtered.sort((a, b) => {
      if (this.state.sort === "newest") return new Date(b.createdAt) - new Date(a.createdAt);
      if (this.state.sort === "score") return (b.aiReview?.score || 0) - (a.aiReview?.score || 0);
      return b.votes.length + b.signatures.length - (a.votes.length + a.signatures.length);
    });
  }

  selectedInitiative() {
    return (
      this.visibleInitiatives().find((initiative) => initiative.id === this.state.selectedId) ||
      this.filteredInitiatives()[0] ||
      null
    );
  }

  visibleInitiatives() {
    if (this.currentUser()) return this.state.initiatives;
    return this.state.initiatives.filter((initiative) => PUBLIC_INITIATIVE_STATUSES.includes(initiative.status));
  }

  render() {
    const user = this.currentUser();
    const analytics = calculateAnalytics(this.state.initiatives);
    const selected = this.selectedInitiative();
    const dataMode = isSupabaseEnabled(this.config) ? "Supabase" : "Lokalni prototip";
    const sidebarState = this.state.sidebarOpen ? "sidebar-open" : "sidebar-closed";

    this.root.className = `app-shell ${sidebarState}`;

    this.root.innerHTML = `
      <button class="sidebar-backdrop" type="button" data-action="close-sidebar" aria-label="Zapri meni"></button>
      <button class="sidebar-edge-toggle" type="button" data-action="toggle-sidebar" aria-controls="app-sidebar" aria-expanded="${this.state.sidebarOpen ? "true" : "false"}" aria-label="${this.state.sidebarOpen ? "Zapri meni" : "Odpri meni"}">
        <span class="toggle-icon" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </span>
      </button>

      <aside id="app-sidebar" class="sidebar" aria-label="Stranski meni" aria-hidden="${this.state.sidebarOpen ? "false" : "true"}">
        <div class="sidebar-header">
          <a class="brand" href="#" data-action="view" data-view="dashboard" aria-label="Demokracija 2.0">
            <span class="brand-mark" aria-hidden="true">D2</span>
            <span>
              <strong>Demokracija 2.0</strong>
              <small>${dataMode}</small>
            </span>
          </a>
        </div>
        <nav class="nav-list" aria-label="Glavna navigacija">
          ${this.navButton("dashboard", "Pregled", "01")}
          ${user ? this.navButton("submit", "Nova pobuda", "02") : ""}
          ${user ? this.navButton("analytics", "Analitika pobud", "03") : ""}
          ${user ? this.navButton("integrations", "Integracije", "04") : ""}
          ${this.isAdminUser(user) ? this.navButton("systemAnalytics", "Sistemska analitika", "05") : ""}
        </nav>
        <div class="user-panel">
          ${user ? this.renderUser(user) : this.renderLogin()}
        </div>
      </aside>

      <main class="content">
        <header class="topbar">
          <div class="topbar-title">
            <div>
              <p class="eyebrow">Projekt Demos</p>
              <h1>${this.pageTitle()}</h1>
            </div>
          </div>
          <div class="topbar-actions">
            <span class="env-pill">${this.config.SIPASS_ENV === "test" ? "SI-PASS test" : "SI-PASS prod"}</span>
            <button class="button secondary" data-action="refresh">Osvezi</button>
          </div>
        </header>
        ${this.state.toast ? `<div class="toast" role="status">${escapeHtml(this.state.toast)}</div>` : ""}
        ${this.state.loading ? this.renderLoading() : this.renderView(analytics, selected)}
      </main>
    `;
    this.syncExternalAnalytics();
  }

  renderView(analytics, selected) {
    if (!this.currentUser() && this.state.activeView !== "dashboard") return this.renderLoginRequiredView();
    if (this.state.activeView === "submit") return this.renderSubmitView();
    if (this.state.activeView === "analytics") return this.renderAnalyticsView(analytics);
    if (this.state.activeView === "integrations") return this.renderIntegrationsView();
    if (this.state.activeView === "systemAnalytics") return this.renderSystemAnalyticsView();
    return this.renderDashboardView(analytics, selected);
  }

  renderDashboardView(analytics, selected) {
    const initiatives = this.filteredInitiatives();
    const user = this.currentUser();
    const dashboardAnalytics = user ? analytics : calculateAnalytics(this.visibleInitiatives());
    return `
      <section class="metric-grid" aria-label="Povzetek">
        ${this.metric(user ? "Pobude" : "Aktualne pobude", dashboardAnalytics.initiativeCount, user ? "Vse oddane pobude" : "Javno odprte pobude")}
        ${this.metric("Glasovi", dashboardAnalytics.totalVotes, "Oddani glasovi")}
        ${this.metric("Komentarji", user ? dashboardAnalytics.totalComments : "-", user ? "Razprava ob pobudah" : "Vidno po prijavi")}
        ${this.metric("AI ocena", user ? `${dashboardAnalytics.averageScore}%` : "-", user ? "Povprecje skladnosti" : "Vidno po prijavi")}
      </section>

      <section class="workspace-grid">
        <div class="panel list-panel">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Pobude</p>
              <h2>Aktivni seznam</h2>
            </div>
          </div>
          <div class="filters">
            <label>
              <span>Iskanje</span>
              <input type="search" value="${escapeAttribute(this.state.query)}" data-filter="query" placeholder="Naslov, povzetek, kategorija" />
            </label>
            <label>
              <span>Kategorija</span>
              <select data-filter="category">
                <option value="all">Vse</option>
                ${CATEGORIES.map((category) => option(category, category, this.state.category)).join("")}
              </select>
            </label>
            <label>
              <span>Status</span>
              <select data-filter="status" ${user ? "" : "disabled"}>
                <option value="all">Vsi</option>
                ${STATUSES.map((status) => option(status.value, status.label, this.state.status)).join("")}
              </select>
            </label>
            <label>
              <span>Razvrsti</span>
              <select data-filter="sort">
                ${option("popular", "Najvec podpore", this.state.sort)}
                ${option("newest", "Najnovejse", this.state.sort)}
                ${option("score", "AI ocena", this.state.sort)}
              </select>
            </label>
          </div>
          <div class="initiative-list">
            ${
              initiatives.length
                ? initiatives.map((initiative) => this.renderInitiativeCard(initiative)).join("")
                : `<div class="empty-state">${user ? "Ni pobud za izbrane filtre." : "Trenutno ni javno odprtih pobud."}</div>`
            }
          </div>
        </div>
        <div class="panel detail-panel">
          ${selected ? this.renderInitiativeDetail(selected) : `<div class="empty-state">Izberite pobudo.</div>`}
        </div>
      </section>
    `;
  }

  renderSubmitView() {
    const review = this.state.aiPreviewReview || evaluateInitiative(this.state.draft);
    return `
      <section class="submit-grid">
        <form class="panel form-panel" data-form="initiative">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Nova zakonodajna pobuda</p>
              <h2>Oddaja pobude</h2>
            </div>
          </div>
          ${this.input("title", "Naslov pobude", "npr. Javna sledljivost zakonodajnih sprememb")}
          <label class="field">
            <span>Kategorija</span>
            <select name="category" data-draft="category">
              <option value="">Izberi kategorijo</option>
              ${CATEGORIES.map((category) => option(category, category, this.state.draft.category)).join("")}
            </select>
            ${this.error("category")}
          </label>
          ${this.textarea("summary", "Kratek povzetek", 3)}
          ${this.textarea("description", "Obrazlozitev", 7)}
          ${this.input("legalReference", "Pravna podlaga", "zakon, clen, pravilnik ali sorodna podlaga")}
          ${this.textarea("expectedImpact", "Pricakovani ucinek", 3)}
          <div class="form-actions">
            <button class="button primary" type="submit">Oddaj pobudo</button>
            <button class="button secondary" type="button" data-action="clear-draft">Pocisti</button>
          </div>
        </form>
        <aside class="panel review-panel">
          ${this.renderReviewContent(review, { showRemoteAiAction: true })}
        </aside>
      </section>
    `;
  }

  renderAnalyticsView(analytics) {
    const user = this.currentUser();
    const userAnalytics = calculateUserAnalytics(this.state.initiatives, user);
    const maxCategoryVotes = Math.max(1, ...analytics.categoryStats.map((item) => item.votes));
    const maxVotes = Math.max(1, analytics.voteDistribution.maxVotes);
    return `
      <section class="metric-grid analytics-metrics" aria-label="Kazalniki pobud">
        ${this.metric("Pobude", analytics.initiativeCount, "vse oddane pobude")}
        ${this.metric("Glasovi", analytics.totalVotes, "skupna podpora")}
        ${this.metric("Podpisi", analytics.totalSignatures, "evidentirani podpisi")}
        ${this.metric("Komentarji", analytics.totalComments, "razprava v aplikaciji")}
      </section>
      <section class="metric-grid analytics-metrics" aria-label="Napredni kazalniki">
        ${this.metric("Najvec glasov", analytics.voteDistribution.maxVotes, "najbolj glasovana pobuda")}
        ${this.metric("Povprecje", analytics.voteDistribution.averageVotes, "glasov na pobudo")}
        ${this.metric("Mediana", analytics.voteDistribution.medianVotes, "sredinska vrednost glasov")}
        ${this.metric("Brez glasov", analytics.voteDistribution.zeroVoteInitiatives, "pobude brez podpore")}
      </section>
      <section class="analytics-grid">
        ${this.renderPersonalInitiativeAnalytics(user, userAnalytics)}
        <div class="panel">
          <p class="eyebrow">Statusi</p>
          <h2>Tok pobud</h2>
          <div class="status-bars">
            ${analytics.byStatus
              .map(
                (item) => `
                  <div class="bar-row">
                    <span>${item.label}</span>
                    <div class="bar-track"><div style="width:${analytics.initiativeCount ? (item.count / analytics.initiativeCount) * 100 : 0}%"></div></div>
                    <strong title="${item.votes} glasov">${item.count}</strong>
                  </div>
                `
              )
              .join("")}
          </div>
        </div>
        <div class="panel">
          <p class="eyebrow">Kategorije</p>
          <h2>Glasovi po kategorijah</h2>
          <div class="category-analytics">
            ${
              analytics.categoryStats.length
                ? analytics.categoryStats.map((item) => this.renderCategoryAnalytics(item, maxCategoryVotes)).join("")
                : `<div class="empty-state">Ni kategorij za prikaz.</div>`
            }
          </div>
        </div>
        <div class="panel wide-panel">
          <p class="eyebrow">AI presoja</p>
          <h2>Tveganja pobud</h2>
          <div class="risk-grid">
            ${analytics.riskSummary.map((item) => this.renderRiskMetric(item, analytics.initiativeCount)).join("")}
          </div>
        </div>
        <div class="panel wide-panel">
          <p class="eyebrow">Glasovi na pobudo</p>
          <h2>Napredna tabela pobud</h2>
          <div class="initiative-analytics-table" role="table" aria-label="Glasovi na pobudo">
            <div class="initiative-analytics-head" role="row">
              <span>Pobuda</span>
              <span>Glasovi</span>
              <span>Delez</span>
              <span>Podpisi</span>
              <span>Komentarji</span>
              <span>AI</span>
            </div>
            ${
              analytics.initiativeStats.length
                ? analytics.initiativeStats.map((item) => this.renderInitiativeAnalyticsRow(item, maxVotes)).join("")
                : `<div class="empty-state">Ni pobud za analitiko.</div>`
            }
          </div>
        </div>
        <div class="panel wide-panel">
          <p class="eyebrow">Podpora</p>
          <h2>Najbolj podprte pobude</h2>
          <div class="ranking">
            ${analytics.topInitiatives.map((initiative, index) => this.renderRanking(initiative, index)).join("")}
          </div>
        </div>
      </section>
    `;
  }

  renderPersonalInitiativeAnalytics(user, userAnalytics) {
    if (!user) {
      return `
        <div class="panel wide-panel">
          <p class="eyebrow">Moj racun</p>
          <h2>Osebna analitika pobud</h2>
          <div class="empty-state">Za osebno statistiko pobud se prijavite.</div>
        </div>
      `;
    }

    return `
      <div class="panel wide-panel">
        <p class="eyebrow">Moj racun</p>
        <h2>Moje pobude in aktivnost</h2>
        <div class="analytics-summary-strip">
          ${this.summaryCell("Moje pobude", userAnalytics.authoredCount)}
          ${this.summaryCell("Moji glasovi", userAnalytics.votedCount)}
          ${this.summaryCell("Moji podpisi", userAnalytics.signedCount)}
          ${this.summaryCell("Moji komentarji", userAnalytics.commentsWritten)}
          ${this.summaryCell("Podpora mojim pobudam", userAnalytics.supportReceived)}
          ${this.summaryCell("AI povprecje", `${userAnalytics.averageAiScore}%`)}
        </div>
        <div class="personal-analytics-grid">
          <div>
            <h3>Moje teme</h3>
            <div class="category-analytics">
              ${
                userAnalytics.authoredCategoryStats.length
                  ? userAnalytics.authoredCategoryStats.map((item) => this.renderUserCategoryAnalytics(item)).join("")
                  : `<div class="empty-state">Niste oddali pobude.</div>`
              }
            </div>
          </div>
          <div>
            <h3>Zadnja moja aktivnost</h3>
            <div class="activity-list">
              ${
                userAnalytics.recentActivity.length
                  ? userAnalytics.recentActivity.map((item) => this.renderActivityItem(item)).join("")
                  : `<div class="empty-state">Ni aktivnosti.</div>`
              }
            </div>
          </div>
        </div>
        <div class="ranking">
          ${
            userAnalytics.topAuthoredInitiatives.length
              ? userAnalytics.topAuthoredInitiatives.map((initiative, index) => this.renderRanking(initiative, index)).join("")
              : ""
          }
        </div>
      </div>
    `;
  }

  renderSystemAnalyticsView() {
    if (!this.isAdminUser()) {
      return `
        <section class="panel">
          <p class="eyebrow">Admin</p>
          <h2>Sistemska analitika</h2>
          <div class="empty-state">Ta pogled je namenjen samo administratorju.</div>
        </section>
      `;
    }

    const system = calculateSystemAnalytics(this.state.initiatives, this.systemTelemetryEvents(), browserResourceSnapshot());

    return `
      <section class="metric-grid analytics-metrics" aria-label="Sistemski kazalniki">
        ${this.metric("Zapisi v aplikaciji", system.dataRows, "pobude, glasovi, podpisi, komentarji")}
        ${this.metric("AI pregledi", system.aiRequestCount, "zabelezeni klici v tej seji brskalnika")}
        ${this.metric("Ocenjeni tokeni", system.aiEstimatedTokens || system.estimatedStoredAiTokens, "ocena porabe AI vnosa")}
        ${this.metric("Prenos virov", `${system.resourceSnapshot.transferKb} KB`, "frontend viri v brskalniku")}
        ${this.metric("Udelezenci", system.uniqueParticipantCount, "unikatni avtorji, glasovalci, podpisniki, komentatorji")}
        ${this.metric("Anonimni glasovi", system.anonymousVoteRows, "glasovi brez demo prijave")}
        ${this.metric("Seje", system.uniqueSessionCount, "zaznane sistemske telemetry seje")}
        ${this.metric("Javne pobude", system.publicInitiativeRows, "vidne neprijavljenim uporabnikom")}
      </section>
      <section class="analytics-grid">
        <div class="panel">
          <p class="eyebrow">Viri</p>
          <h2>Obremenitev strani</h2>
          <dl class="config-list">
            <div><dt>Resource requesti</dt><dd>${system.resourceSnapshot.resourceCount}</dd></div>
            <div><dt>Scripti</dt><dd>${system.resourceSnapshot.scriptCount}</dd></div>
            <div><dt>CSS/link viri</dt><dd>${system.resourceSnapshot.stylesheetCount}</dd></div>
            <div><dt>Fetch requesti</dt><dd>${system.resourceSnapshot.fetchCount}</dd></div>
            <div><dt>Load event</dt><dd>${system.resourceSnapshot.loadMs} ms</dd></div>
          </dl>
        </div>
        <div class="panel">
          <p class="eyebrow">AI in sporocila</p>
          <h2>Poraba storitev</h2>
          <dl class="config-list">
            <div><dt>AI fallbacki</dt><dd>${system.aiFallbackCount}</dd></div>
            <div><dt>Povprecen AI cas</dt><dd>${system.averageAiDurationMs} ms</dd></div>
            <div><dt>Email dogodki</dt><dd>${system.emailNotificationEvents}</dd></div>
            <div><dt>Email postavke</dt><dd>${system.emailNotificationItems}</dd></div>
            <div><dt>AI review zapisi</dt><dd>${system.reviewRows}</dd></div>
          </dl>
        </div>
        <div class="panel">
          <p class="eyebrow">Uporabniki</p>
          <h2>Udelezba in dostop</h2>
          <dl class="config-list">
            <div><dt>Registrirani/demo akterji</dt><dd>${system.registeredParticipantCount}</dd></div>
            <div><dt>Anonimni akterji</dt><dd>${system.anonymousParticipantCount}</dd></div>
            <div><dt>Anonimni vote eventi</dt><dd>${system.anonymousVoteEvents}</dd></div>
            <div><dt>Telemetrijski dogodki</dt><dd>${system.telemetryEventCount}</dd></div>
          </dl>
        </div>
        <div class="panel">
          <p class="eyebrow">Javni rezim</p>
          <h2>Vidnost neprijavljenih</h2>
          <dl class="config-list">
            <div><dt>Javno vidni statusi</dt><dd>Aktivna, Zbiranje podpisov</dd></div>
            <div><dt>Oddaja pobude</dt><dd>samo prijava</dd></div>
            <div><dt>Podpis in komentarji</dt><dd>samo prijava</dd></div>
            <div><dt>Anonimno glasovanje</dt><dd>1 glas na pobudo na lokalni ID</dd></div>
          </dl>
        </div>
        <div class="panel wide-panel">
          <p class="eyebrow">Podatkovni obseg</p>
          <h2>Zapisi po tipu</h2>
          <div class="analytics-summary-strip">
            ${this.summaryCell("Pobude", system.initiativeRows)}
            ${this.summaryCell("Glasovi", system.voteRows)}
            ${this.summaryCell("Podpisi", system.signatureRows)}
            ${this.summaryCell("Komentarji", system.commentRows)}
            ${this.summaryCell("Stored AI tokeni", system.estimatedStoredAiTokens)}
          </div>
        </div>
        <div class="panel wide-panel">
          <p class="eyebrow">Vsebina</p>
          <h2>Statusi in teme</h2>
          <div class="personal-analytics-grid">
            <div class="system-event-list">
              ${system.statusRows.map((item) => this.renderSystemSimpleRow(item.label, `${item.count} pobud`)).join("")}
            </div>
            <div class="system-event-list">
              ${
                system.categoryRows.length
                  ? system.categoryRows.map((item) => this.renderSystemSimpleRow(item.category, `${item.initiatives} pobud - ${item.votes} glasov - ${item.comments} komentarjev`)).join("")
                  : `<div class="empty-state">Ni kategorij.</div>`
              }
            </div>
          </div>
        </div>
        <div class="panel wide-panel">
          <p class="eyebrow">Telemetrija</p>
          <h2>Dogodki po tipu</h2>
          <div class="system-event-list">
            ${
              system.telemetryEventTypes.length
                ? system.telemetryEventTypes.map((item) => this.renderSystemSimpleRow(item.type, `${item.count} dogodkov`)).join("")
                : `<div class="empty-state">Telemetrijskih dogodkov se ni.</div>`
            }
          </div>
        </div>
        <div class="panel wide-panel">
          <p class="eyebrow">Audit</p>
          <h2>Zadnji sistemski dogodki</h2>
          ${this.state.systemTelemetryLoading ? `<p class="note">Nalaganje Vercel/Supabase sistemskih dogodkov ...</p>` : ""}
          <div class="system-event-list">
            ${
              system.recentEvents.length
                ? system.recentEvents.map((event) => this.renderSystemEvent(event)).join("")
                : `<div class="empty-state">Sistemski dogodki se niso zabelezeni.</div>`
            }
          </div>
        </div>
      </section>
    `;
  }

  renderLoginRequiredView() {
    return `
      <section class="panel">
        <p class="eyebrow">Prijava</p>
        <h2>Za ta pogled je potrebna prijava</h2>
        <div class="empty-state">Brez prijave lahko vidite samo aktualne pobude in oddate en anonimen glas na pobudo.</div>
      </section>
    `;
  }

  renderCategoryAnalytics(item, maxVotes) {
    return `
      <div class="category-analytics-row">
        <div>
          <strong>${escapeHtml(item.category)}</strong>
          <small>${item.count} pobud - ${item.votes} glasov - ${item.comments} komentarjev</small>
        </div>
        <em>${item.averageAiScore}% AI</em>
        <div class="bar-track"><div style="width:${(item.votes / maxVotes) * 100}%"></div></div>
      </div>
    `;
  }

  renderUserCategoryAnalytics(item) {
    return `
      <div class="category-analytics-row">
        <div>
          <strong>${escapeHtml(item.category)}</strong>
          <small>${item.count} pobud - ${item.support} podpore - ${item.comments} komentarjev</small>
        </div>
      </div>
    `;
  }

  renderActivityItem(item) {
    return `
      <div class="activity-item">
        <strong>${escapeHtml(item.label)}</strong>
        <span>${escapeHtml(item.title)}</span>
        <small>${escapeHtml(item.category)} - ${formatDate(item.createdAt)}</small>
      </div>
    `;
  }

  renderSystemEvent(event) {
    return `
      <div class="system-event">
        <strong>${escapeHtml(event.type)}</strong>
        <span>${formatDate(event.createdAt)}</span>
        <small>${escapeHtml(systemEventDetails(event))}</small>
      </div>
    `;
  }

  renderSystemSimpleRow(label, value) {
    return `
      <div class="system-event">
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(value)}</span>
        <small></small>
      </div>
    `;
  }

  renderRiskMetric(item, total) {
    return `
      <div class="risk-metric ${item.risk}">
        <span>${riskLabel(item.risk)}</span>
        <strong>${item.count}</strong>
        <small>${percentageLabel(item.count, total)} pobud</small>
      </div>
    `;
  }

  renderInitiativeAnalyticsRow(item, maxVotes) {
    return `
      <div class="initiative-analytics-row" role="row">
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          <small>${escapeHtml(item.category)} - ${statusLabel(item.status)}</small>
        </div>
        <div>
          <strong>${item.votes}</strong>
          <div class="mini-bar"><div style="width:${(item.votes / maxVotes) * 100}%"></div></div>
        </div>
        <span>${item.voteShare}%</span>
        <span>${item.signatures}</span>
        <span>${item.comments}</span>
        <span>${item.aiScore}%</span>
      </div>
    `;
  }

  renderIntegrationsView() {
    return `
      <section class="integration-grid">
        <div class="panel">
          <p class="eyebrow">Podatki</p>
          <h2>Supabase</h2>
          <dl class="config-list">
            <div><dt>Vir podatkov</dt><dd>${escapeHtml(this.config.DATA_SOURCE)}</dd></div>
            <div><dt>URL nastavljen</dt><dd>${this.config.SUPABASE_URL ? "da" : "ne"}</dd></div>
            <div><dt>Anon kljuc nastavljen</dt><dd>${this.config.SUPABASE_ANON_KEY ? "da" : "ne"}</dd></div>
          </dl>
          <p class="note">SQL shema in razvojna navodila so pripravljena v mapi <code>supabase</code> in <code>docs</code>.</p>
        </div>
        <div class="panel">
          <p class="eyebrow">Identiteta</p>
          <h2>SI-PASS</h2>
          <dl class="config-list">
            <div><dt>Okolje</dt><dd>${escapeHtml(this.config.SIPASS_ENV)}</dd></div>
            <div><dt>Avtoriteta</dt><dd>${escapeHtml(this.config.SIPASS_AUTHORITY)}</dd></div>
            <div><dt>Client ID</dt><dd>${this.config.SIPASS_CLIENT_ID ? "nastavljen" : "ni nastavljen"}</dd></div>
          </dl>
          <button class="button secondary" data-action="sipass-placeholder">SI-PASS testni tok</button>
        </div>
        <div class="panel">
          <p class="eyebrow">AI presoja</p>
          <h2>Napredna AI presoja</h2>
          <dl class="config-list">
            <div><dt>Nacin</dt><dd>${this.config.AI_PROVIDER === "huggingface" ? "napredno AI preverjanje" : "lokalni fallback"}</dd></div>
            <div><dt>Review endpoint</dt><dd>${this.config.AI_REVIEW_ENDPOINT ? "nastavljen" : "lokalni fallback"}</dd></div>
            <div><dt>Zero-shot model</dt><dd>${escapeHtml(this.config.HUGGINGFACE_ZERO_SHOT_MODEL)}</dd></div>
            <div><dt>Embedding model</dt><dd>${escapeHtml(this.config.HUGGINGFACE_EMBEDDING_MODEL)}</dd></div>
          </dl>
          <p class="note">AI token ostane na backendu oziroma v dev strezniku; frontend klice samo varen review endpoint.</p>
        </div>
        <div class="panel">
          <p class="eyebrow">Hosting analitika</p>
          <h2>Vercel Web Analytics</h2>
          <dl class="config-list">
            <div><dt>Namen</dt><dd>SEO, obiski, strani</dd></div>
            <div><dt>Dostop</dt><dd>lastnik Vercel projekta</dd></div>
            <div><dt>Script</dt><dd>vklopljen</dd></div>
          </dl>
          <p class="note">Podatki so vidni v Vercel dashboardu po deployu in obisku strani.</p>
        </div>
        <div class="panel">
          <p class="eyebrow">Vedenjska analitika</p>
          <h2>Microsoft Clarity</h2>
          <dl class="config-list">
            <div><dt>Project ID</dt><dd>${this.config.MICROSOFT_CLARITY_PROJECT_ID ? "nastavljen" : "ni nastavljen"}</dd></div>
            <div><dt>Runtime loader</dt><dd>${clarityRuntimeStatus().loader}</dd></div>
            <div><dt>Script tag</dt><dd>${clarityRuntimeStatus().script}</dd></div>
            <div><dt>Dogodki</dt><dd>pogledi, pobude, glasovi, komentarji</dd></div>
            <div><dt>Osebna statistika</dt><dd>iz aplikacijske baze</dd></div>
          </dl>
          <p class="note">Clarity oznacuje seje in dogodke, analitika pobud v aplikaciji pa uporablja podatke iz baze.</p>
        </div>
        <div class="panel">
          <p class="eyebrow">Obvestila</p>
          <h2>E-posta</h2>
          <dl class="config-list">
            <div><dt>Endpoint</dt><dd>${this.config.EMAIL_NOTIFICATIONS_ENDPOINT ? "nastavljen" : "ni nastavljen"}</dd></div>
            <div><dt>Dostava</dt><dd>${this.config.EMAIL_DELIVERY_MODE === "smtp" ? "SMTP" : "outbox log"}</dd></div>
            <div><dt>Test akterja</dt><dd>${this.config.EMAIL_NOTIFY_ACTOR ? "vklopljen" : "izklopljen"}</dd></div>
            <div><dt>Dogodki</dt><dd>status, komentar, podpora, nova sorodna pobuda</dd></div>
          </dl>
          <button class="button secondary" data-action="test-email">Test email obvestila</button>
          <p class="note">V dev nacinu endpoint obvestila zapise v outbox ali jih poslje prek SMTP, ce je nastavljen.</p>
        </div>
      </section>
    `;
  }

  renderInitiativeCard(initiative) {
    const user = this.currentUser();
    const active = initiative.id === this.state.selectedId ? "active" : "";
    const voteCount = initiative.votes.length;
    const commentCount = initiative.comments.length;
    return `
      <article class="initiative-card ${active}">
        <button class="card-button" data-action="select" data-id="${initiative.id}">
          <span class="status-dot ${initiative.status}"></span>
          <span>
            <strong>${escapeHtml(initiative.title)}</strong>
            <small>${escapeHtml(initiative.category)} - ${statusLabel(initiative.status)} - ${voteCount} glasov${user ? ` - ${commentCount} komentarjev` : ""}</small>
          </span>
          <span class="support-count" title="Glasovi">${voteCount}</span>
        </button>
      </article>
    `;
  }

  renderInitiativeDetail(initiative) {
    const user = this.currentUser();
    if (!user) return this.renderPublicInitiativeDetail(initiative);

    const voted = user && initiative.votes.some((vote) => vote.userId === user.id);
    const signed = user && initiative.signatures.some((signature) => signature.userId === user.id);
    const review = initiative.aiReview || { score: 0, risk: "low", findings: [] };

    return `
      <div class="detail-header">
        <div>
          <p class="eyebrow">${escapeHtml(initiative.category)}</p>
          <h2>${escapeHtml(initiative.title)}</h2>
        </div>
        <span class="status-badge ${initiative.status}">${statusLabel(initiative.status)}</span>
      </div>
      <p class="summary">${escapeHtml(initiative.summary)}</p>
      <div class="support-actions">
        <button class="button primary" data-action="vote" data-id="${initiative.id}" ${voted ? "disabled" : ""}>
          ${voted ? "Glas oddan" : "Glasuj"}
        </button>
        <button class="button secondary" data-action="sign" data-id="${initiative.id}" ${signed ? "disabled" : ""}>
          ${signed ? "Podpis evidentiran" : "Demo podpis"}
        </button>
        <label class="status-select">
          <span>Status</span>
          <select data-status-id="${initiative.id}">
            ${STATUSES.map((status) => option(status.value, status.label, initiative.status)).join("")}
          </select>
        </label>
      </div>
      <div class="detail-metrics">
        ${this.metric("Glasovi", initiative.votes.length, "en uporabnik, en glas")}
        ${this.metric("Podpisi", initiative.signatures.length, "priprava za SI-PASS")}
        ${this.metric("Komentarji", initiative.comments.length, "javna razprava")}
        ${this.metric("AI ocena", `${review.score}%`, riskLabel(review.risk))}
      </div>
      <section class="detail-section">
        <h3>Obrazlozitev</h3>
        <p>${escapeHtml(initiative.description)}</p>
      </section>
      <section class="detail-section two-columns">
        <div>
          <h3>Pravna podlaga</h3>
          <p>${escapeHtml(initiative.legalReference || "Ni navedena.")}</p>
        </div>
        <div>
          <h3>Pricakovani ucinek</h3>
          <p>${escapeHtml(initiative.expectedImpact || "Ni naveden.")}</p>
        </div>
      </section>
      <section class="detail-section">
        <h3>AI ugotovitve</h3>
        ${this.renderReviewFacts(review, { detailed: true })}
        <ul class="check-list">
          ${review.findings.map((finding) => `<li>${escapeHtml(finding)}</li>`).join("")}
        </ul>
      </section>
      <section class="detail-section">
        <h3>Komentarji</h3>
        <form class="comment-form" data-form="comment" data-id="${initiative.id}">
          <input name="body" placeholder="Dodaj komentar" autocomplete="off" />
          <button class="button secondary" type="submit">Objavi</button>
        </form>
        <div class="comments">
          ${
            initiative.comments.length
              ? initiative.comments.map((comment) => this.renderComment(comment)).join("")
              : `<p class="muted">Komentarjev se ni.</p>`
          }
        </div>
      </section>
    `;
  }

  renderComment(comment) {
    return `
      <article class="comment">
        <strong>${escapeHtml(comment.userName)}</strong>
        <p>${escapeHtml(comment.body)}</p>
      </article>
    `;
  }

  renderRanking(initiative, index) {
    const support = initiative.votes.length + initiative.signatures.length;
    return `
      <div class="rank-row">
        <span>${index + 1}</span>
        <strong>${escapeHtml(initiative.title)}</strong>
        <em>${support}</em>
      </div>
    `;
  }

  renderLoading() {
    return `
      <section class="panel">
        <div class="loading-line"></div>
        <div class="loading-line short"></div>
      </section>
    `;
  }

  renderReviewContent(review, options = {}) {
    const provider = review.checks?.provider || review.provider || "local";
    const providerLabel = provider === "huggingface" ? "Napredno AI preverjanje" : "Lokalni predpregled";
    const model = review.checks?.model || review.model || "local-rule-engine-v1";
    const modelLabel = provider === "huggingface" ? `Hugging Face / ${model}` : "lokalna pravila";
    const canCallRemoteAi = options.showRemoteAiAction && this.config.AI_REVIEW_ENDPOINT;
    return `
      <p class="eyebrow">AI predpregled</p>
      <div class="score-ring" style="--score: ${review.score}">
        <strong>${review.score}%</strong>
        <span>${riskLabel(review.risk)}</span>
      </div>
      ${this.renderReviewFacts(review)}
      <dl class="review-facts">
        <div><dt>Nacin pregleda</dt><dd>${escapeHtml(providerLabel)}</dd></div>
        <div><dt>Vir ocene</dt><dd>${escapeHtml(modelLabel)}</dd></div>
      </dl>
      <ul class="check-list">
        ${review.findings.map((finding) => `<li>${escapeHtml(finding)}</li>`).join("")}
      </ul>
      ${
        canCallRemoteAi
          ? `<button class="button secondary full-width" type="button" data-action="ai-preview" ${this.state.aiPreviewLoading ? "disabled" : ""}>${
              this.state.aiPreviewLoading ? "AI preverja ..." : "Preglej bolj podrobno z AI"
            }</button>`
          : ""
      }
    `;
  }

  renderReviewFacts(review, options = {}) {
    const checks = review.checks || {};
    const completeness = checks.completeness?.score ?? 0;
    const suitability = checks.suitability || "insufficient";
    const category = checks.categorySuggestion?.category || "Ni predloga";
    const confidence = checks.categorySuggestion?.confidence;
    const legalHits = Array.isArray(checks.legalHits) ? checks.legalHits : [];
    const budgetHits = Array.isArray(checks.budgetHits) ? checks.budgetHits : [];
    const wordCount = checks.length ?? 0;
    const provider = checks.provider || review.provider || "local";
    const source = provider === "huggingface" ? `Hugging Face / ${checks.model || review.model || "AI model"}` : "lokalna pravila";

    return `
      <dl class="review-facts">
        ${options.detailed ? `<div><dt>Risk level</dt><dd>${riskLabel(review.risk)}</dd></div>` : ""}
        <div><dt>Ustreznost</dt><dd>${suitabilityLabel(suitability)}</dd></div>
        <div><dt>Popolnost</dt><dd>${completeness}%</dd></div>
        <div><dt>AI kategorija</dt><dd>${escapeHtml(category)}</dd></div>
        ${
          options.detailed
            ? `
              <div><dt>Zanesljivost kategorije</dt><dd>${confidence ?? 0}%</dd></div>
              <div><dt>Pravne oporne tocke</dt><dd>${legalHits.length ? escapeHtml(legalHits.join(", ")) : "ni zaznanih"}</dd></div>
              <div><dt>Proracunska opozorila</dt><dd>${budgetHits.length ? escapeHtml(budgetHits.join(", ")) : "ni zaznanih"}</dd></div>
              <div><dt>Obseg besedila</dt><dd>${wordCount} besed</dd></div>
              <div><dt>Vir ocene</dt><dd>${escapeHtml(source)}</dd></div>
            `
            : ""
        }
      </dl>
    `;
  }

  renderLogin() {
    return `
      <form class="login-form" data-form="login">
        <label>
          <span>Ime</span>
          <input name="name" value="Demo uporabnik" />
        </label>
        <label>
          <span>E-posta</span>
          <input name="email" value="demo@demos.local" />
        </label>
        <div class="login-actions">
          <button class="button primary compact" type="submit">Demo prijava</button>
          <button class="button secondary compact" type="button" data-action="demo-admin-login">Demo admin</button>
        </div>
      </form>
    `;
  }

  renderPublicInitiativeDetail(initiative) {
    const anonymousActor = this.anonymousActor({ create: false });
    const voted = anonymousActor && initiative.votes.some((vote) => vote.userId === anonymousActor.id);

    return `
      <div class="detail-header">
        <div>
          <p class="eyebrow">${escapeHtml(initiative.category)}</p>
          <h2>${escapeHtml(initiative.title)}</h2>
        </div>
        <span class="status-badge ${initiative.status}">${statusLabel(initiative.status)}</span>
      </div>
      <p class="summary">${escapeHtml(initiative.summary)}</p>
      <div class="support-actions">
        <button class="button primary" data-action="vote" data-id="${initiative.id}" ${voted ? "disabled" : ""}>
          ${voted ? "Anonimni glas oddan" : "Glasuj anonimno"}
        </button>
      </div>
      <div class="detail-metrics">
        ${this.metric("Glasovi", initiative.votes.length, "en anonimen glas na brskalnik")}
        ${this.metric("Status", statusLabel(initiative.status), "aktualna pobuda")}
      </div>
      <section class="detail-section">
        <div class="empty-state">Za oddajo pobude, podpis, komentarje, celoten opis in analitiko se prijavite.</div>
      </section>
    `;
  }

  renderUser(user) {
    return `
      <div class="signed-user">
        <span>${escapeHtml(user.name)}</span>
        <small>${escapeHtml(this.isAdminUser(user) ? "Admin" : user.provider === "demo" ? "Demo identiteta" : user.provider)}</small>
        <button class="button secondary compact" data-action="logout">Odjava</button>
      </div>
    `;
  }

  navButton(view, label, number) {
    const active = this.state.activeView === view ? "active" : "";
    return `
      <button class="nav-button ${active}" data-action="view" data-view="${view}">
        <span>${number}</span>
        ${label}
      </button>
    `;
  }

  metric(label, value, hint) {
    return `
      <div class="metric-card">
        <span>${label}</span>
        <strong>${value}</strong>
        <small>${hint}</small>
      </div>
    `;
  }

  summaryCell(label, value) {
    return `
      <div>
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `;
  }

  input(name, label, placeholder) {
    return `
      <label class="field">
        <span>${label}</span>
        <input name="${name}" data-draft="${name}" value="${escapeAttribute(this.state.draft[name])}" placeholder="${placeholder}" />
        ${this.error(name)}
      </label>
    `;
  }

  textarea(name, label, rows) {
    return `
      <label class="field">
        <span>${label}</span>
        <textarea name="${name}" data-draft="${name}" rows="${rows}">${escapeHtml(this.state.draft[name])}</textarea>
        ${this.error(name)}
      </label>
    `;
  }

  error(name) {
    return this.state.errors[name] ? `<small class="field-error">${escapeHtml(this.state.errors[name])}</small>` : "";
  }

  pageTitle() {
    return {
      dashboard: "Pregled pobud",
      submit: "Oddaja nove pobude",
      analytics: "Analitika pobud",
      integrations: "Nastavitve integracij",
      systemAnalytics: "Sistemska analitika"
    }[this.state.activeView];
  }

  async handleClick(event) {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;

    if (action === "view") {
      event.preventDefault();
      if (target.dataset.view === "systemAnalytics" && !this.isAdminUser()) {
        this.toast("Sistemska analitika je namenjena administratorju.");
        this.render();
        return;
      }
      this.setActiveView(target.dataset.view);
      if (isSmallViewport()) {
        this.state.sidebarOpen = false;
      }
      trackClarityEvent(`view_${this.state.activeView}`);
      setClarityTag("app_view", this.state.activeView);
      trackVercelEvent("ViewChanged", { view: this.state.activeView });
      if (this.state.activeView === "systemAnalytics") {
        await this.loadSystemTelemetry();
      }
      this.render();
      return;
    }

    if (action === "toggle-sidebar") {
      this.state.sidebarOpen = !this.state.sidebarOpen;
      this.render();
      return;
    }

    if (action === "close-sidebar") {
      this.state.sidebarOpen = false;
      this.render();
      return;
    }

    if (action === "refresh") {
      await this.refresh();
      return;
    }

    if (action === "select") {
      this.state.selectedId = target.dataset.id;
      const selected = this.state.initiatives.find((initiative) => initiative.id === target.dataset.id);
      if (selected) {
        setClarityTag("initiative_category", selected.category);
        trackClarityEvent("initiative_selected");
      }
      this.render();
      return;
    }

    if (action === "clear-draft") {
      this.state.draft = emptyDraft();
      this.state.errors = {};
      this.state.aiPreviewReview = null;
      this.render();
      return;
    }

    if (action === "ai-preview") {
      trackClarityEvent("ai_preview_requested");
      await this.updateRemoteAiPreview();
      return;
    }

    if (action === "logout") {
      this.auth.signOut();
      this.state.status = "all";
      this.state.category = "all";
      if (this.state.activeView !== "dashboard") {
        this.setActiveView("dashboard", { replace: true });
      }
      this.toast("Odjavljeni ste.");
      this.render();
      return;
    }

    if (action === "demo-admin-login") {
      const user = this.auth.signIn({
        name: "Demo admin",
        email: DEMO_ADMIN_EMAIL,
        role: "admin"
      });
      identifyClarityUser(user, this.state.activeView);
      setClarityTag("user_role", "admin");
      trackClarityEvent("demo_admin_login");
      this.toast("Prijavljeni ste kot demo admin.");
      this.render();
      return;
    }

    if (action === "sipass-placeholder") {
      this.toast("SI-PASS je pripravljen kot integracijski nastavek; za realen tok so potrebni registrirani testni podatki.");
      this.render();
      return;
    }

    if (action === "test-email") {
      await this.sendTestEmailNotification();
      return;
    }

    if (action === "vote") {
      const actor = this.currentUser() || this.anonymousActor({ create: true });
      try {
        const id = target.dataset.id;
        const initiative = this.state.initiatives.find((item) => item.id === id);
        if (!this.currentUser() && (!initiative || !PUBLIC_INITIATIVE_STATUSES.includes(initiative.status))) {
          this.toast("Anonimno glasovanje je dovoljeno samo pri aktualnih pobudah.");
          this.render();
          return;
        }

        const updated = await this.repository.vote(id, actor);
        if (this.currentUser()) {
          await this.sendEmailNotifications(
            buildInitiativeChangeEmailNotifications({
              initiative: updated,
              actor,
              eventType: NOTIFICATION_EVENTS.VOTE_ADDED,
              siteUrl: this.appUrl(),
              includeActor: this.config.EMAIL_NOTIFY_ACTOR
            })
          );
        }
        await this.refresh();
        trackClarityEvent(this.currentUser() ? "initiative_voted" : "initiative_voted_anonymous");
        this.recordSystemEvent("vote", {
          initiativeId: id,
          anonymous: !this.currentUser()
        });
        this.toast(this.currentUser() ? "Glas je zabelezen." : "Anonimni glas je zabelezen.");
      } catch (error) {
        this.reportError("Napaka pri glasovanju", error);
        this.toast(userFacingErrorMessage(error));
        this.render();
      }
      return;
    }

    if (action === "sign") {
      await this.withActor(async (actor) => {
        const id = target.dataset.id;
        const updated = await this.repository.sign(id, actor, this.config.AUTH_MODE === "sipass" ? "sipass" : "demo");
        await this.sendEmailNotifications(
          buildInitiativeChangeEmailNotifications({
            initiative: updated,
            actor,
            eventType: NOTIFICATION_EVENTS.SIGNATURE_ADDED,
            siteUrl: this.appUrl(),
            includeActor: this.config.EMAIL_NOTIFY_ACTOR
          })
        );
        await this.refresh();
        trackClarityEvent("initiative_signed");
        this.toast("Podpis je evidentiran.");
      });
    }
  }

  async handleSubmit(event) {
    const form = event.target.closest("[data-form]");
    if (!form) return;
    event.preventDefault();

    if (form.dataset.form === "login") {
      const data = Object.fromEntries(new FormData(form));
      const user = this.auth.signIn({
        ...data,
        role: isDemoAdminEmail(data.email) ? "admin" : "citizen"
      });
      identifyClarityUser(user, this.state.activeView);
      setClarityTag("user_role", user.role);
      trackClarityEvent("demo_login");
      this.toast("Prijava je uspela.");
      this.render();
      return;
    }

    if (form.dataset.form === "initiative") {
      await this.withActor(async (actor) => {
        const validation = validateInitiative(this.state.draft);
        this.state.errors = validation.errors;
        if (!validation.valid) {
          this.toast("Pobuda potrebuje nekaj popravkov.");
          this.render();
          return;
        }

        const review = await this.reviewInitiative(validation.values);
        const initiative = createInitiative(validation.values, actor, review);
        const existingInitiatives = this.state.initiatives;
        await this.repository.create(initiative);
        await this.sendEmailNotifications(
          buildCategoryMatchEmailNotifications({
            newInitiative: initiative,
            initiatives: existingInitiatives,
            actor,
            siteUrl: this.appUrl(),
            includeActor: this.config.EMAIL_NOTIFY_ACTOR
          })
        );
        this.state.draft = emptyDraft();
        this.state.errors = {};
        this.state.aiPreviewReview = null;
        this.setActiveView("dashboard");
        this.state.selectedId = initiative.id;
        await this.refresh();
        setClarityTag("initiative_category", initiative.category);
        trackClarityEvent("initiative_created");
        this.toast("Pobuda je oddana.");
      });
      return;
    }

    if (form.dataset.form === "comment") {
      await this.withActor(async (actor) => {
        const body = new FormData(form).get("body");
        const updated = await this.repository.comment(form.dataset.id, actor, body);
        await this.sendEmailNotifications(
          buildInitiativeChangeEmailNotifications({
            initiative: updated,
            actor,
            eventType: NOTIFICATION_EVENTS.COMMENT_ADDED,
            commentBody: body,
            siteUrl: this.appUrl(),
            includeActor: this.config.EMAIL_NOTIFY_ACTOR
          })
        );
        await this.refresh();
        trackClarityEvent("comment_created");
        this.toast("Komentar je objavljen.");
      });
    }
  }

  handleInput(event) {
    const draftField = event.target.dataset.draft;
    const filterField = event.target.dataset.filter;

    if (draftField) {
      this.state.draft[draftField] = event.target.value;
      this.state.aiPreviewReview = null;
      this.updateReviewPreview();
    }

    if (filterField === "query") {
      this.state.query = event.target.value;
      this.render();
    }
  }

  async handleChange(event) {
    const filterField = event.target.dataset.filter;
    if (filterField && filterField !== "query") {
      this.state[filterField] = event.target.value;
      this.render();
      return;
    }

    const statusId = event.target.dataset.statusId;
    if (statusId) {
      if (!this.currentUser()) {
        this.toast("Za spremembo statusa je potrebna prijava.");
        this.render();
        return;
      }

      try {
        const previous = this.state.initiatives.find((initiative) => initiative.id === statusId);
        const updated = await this.repository.updateStatus(statusId, event.target.value);
        await this.sendEmailNotifications(
          buildInitiativeChangeEmailNotifications({
            initiative: updated,
            actor: this.currentUser(),
            eventType: NOTIFICATION_EVENTS.STATUS_CHANGED,
            previousStatus: previous?.status,
            siteUrl: this.appUrl(),
            includeActor: this.config.EMAIL_NOTIFY_ACTOR
          })
        );
        await this.refresh();
        this.toast("Status pobude je posodobljen.");
      } catch (error) {
        this.reportError("Napaka pri posodobitvi statusa", error);
        this.toast("Statusa pobude ni bilo mogoce posodobiti.");
        this.render();
      }
    }
  }

  async withActor(callback) {
    const actor = this.currentUser();
    if (!actor) {
      this.toast("Najprej se prijavite z demo identiteto.");
      this.render();
      return;
    }

    try {
      await callback(actor);
    } catch (error) {
      this.reportError("Napaka pri dejanju uporabnika", error);
      this.toast(userFacingErrorMessage(error));
      this.render();
    }
  }

  async sendEmailNotifications(notifications) {
    const items = Array.isArray(notifications) ? notifications.filter(Boolean) : [];
    console.info("[Demokracija 2.0] Email UI: dogodek je pripravil obvestila", {
      count: items.length,
      recipients: items.map((item) => maskEmail(item.to)),
      types: [...new Set(items.map((item) => item.type).filter(Boolean))]
    });

    try {
      const result = await this.notificationClient?.send(items);
      this.recordSystemEvent("email_notifications", {
        count: items.length,
        mode: result?.mode || "unknown",
        skipped: result?.skipped === true
      });
      if (result && !result.skipped) {
        console.info("[Demokracija 2.0] Email obvestila", result);
      } else {
        console.info("[Demokracija 2.0] Email UI: posiljanje preskoceno", result);
      }
    } catch (error) {
      this.reportError("Email obvestila niso bila poslana", error);
    }
  }

  async sendTestEmailNotification() {
    const user = this.currentUser();
    const email = user?.email || user?.id || "";

    if (!isValidEmail(email)) {
      this.toast("Za test emaila se prijavite z veljavnim email naslovom.");
      this.render();
      return;
    }

    try {
      const result = await this.notificationClient.send([
        {
          id: `test-${Date.now()}`,
          type: "test_email",
          to: email,
          toName: user.name || email,
          subject: "Testno obvestilo Demokracija 2.0",
          text: [
            `Pozdravljeni ${user.name || email},`,
            "",
            "To je testno email obvestilo iz razvojnega okolja Demokracija 2.0."
          ].join("\n"),
          metadata: {
            eventType: "test_email",
            createdAt: new Date().toISOString()
          }
        }
      ]);

      if (result.mode === "smtp") {
        this.toast("Testni email je bil poslan prek SMTP.");
      } else if (result.mode === "outbox") {
        this.toast("Testno obvestilo je zapisano v outbox log; SMTP ni nastavljen.");
      } else {
        this.toast("Testno obvestilo ni imelo prejemnika.");
      }
    } catch (error) {
      this.reportError("Test email obvestila ni uspel", error);
      this.toast("Test email ni uspel. Preverite SMTP nastavitve in dev-server log.");
    } finally {
      this.render();
    }
  }

  appUrl() {
    return `${window.location.origin}${window.location.pathname}`.replace(/\/$/, "");
  }

  reportError(context, error) {
    console.error(`[Demokracija 2.0] ${context}`, error);
  }

  toast(message) {
    this.state.toast = message;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.state.toast = "";
      this.render();
    }, 3600);
  }

  updateReviewPreview() {
    const panel = this.root.querySelector(".review-panel");
    if (!panel) return;
    panel.innerHTML = this.renderReviewContent(evaluateInitiative(this.state.draft), { showRemoteAiAction: true });
  }

  async updateRemoteAiPreview() {
    this.state.aiPreviewLoading = true;
    this.render();
    try {
      this.state.aiPreviewReview = await this.reviewInitiative(this.state.draft);
      const provider = this.state.aiPreviewReview.checks?.provider || this.state.aiPreviewReview.provider || "local";
      this.toast(
        provider === "huggingface"
          ? "Napredni AI pregled je pripravljen."
          : "Napredni AI pregled ni uspel; uporabljen je lokalni fallback."
      );
    } catch (error) {
      this.reportError("Napaka pri naprednem AI predpregledu", error);
      this.toast("Napredni AI pregled ni uspel; uporabljen je lokalni fallback.");
    } finally {
      this.state.aiPreviewLoading = false;
      this.render();
    }
  }

  async reviewInitiative(values) {
    const fallback = evaluateInitiative(values);
    const startedAt = performance.now();
    const estimatedTokens = estimateTextTokens([
      values?.title,
      values?.summary,
      values?.description,
      values?.legalReference,
      values?.expectedImpact
    ].join(" "));
    if (!this.config.AI_REVIEW_ENDPOINT || this.config.AI_PROVIDER !== "huggingface") {
      this.recordSystemEvent("ai_review", {
        provider: "local",
        estimatedTokens,
        durationMs: Math.round(performance.now() - startedAt),
        fallback: true
      });
      return fallback;
    }

    try {
      const response = await fetch(this.config.AI_REVIEW_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(values)
      });

      if (!response.ok) {
        throw new Error(`AI review endpoint failed (${response.status})`);
      }

      const review = await response.json();
      this.recordSystemEvent("ai_review", {
        provider: review.checks?.provider || review.provider || "huggingface",
        estimatedTokens,
        durationMs: Math.round(performance.now() - startedAt),
        fallback: false
      });
      return review;
    } catch (error) {
      this.reportError("Hugging Face review fallback", error);
      this.recordSystemEvent("ai_review", {
        provider: "local",
        estimatedTokens,
        durationMs: Math.round(performance.now() - startedAt),
        fallback: true
      });
      return {
        ...fallback,
        checks: {
          ...fallback.checks,
          provider: "local",
          model: "local-rule-engine-v1",
          fallbackReason: "huggingface_unavailable"
        }
      };
    }
  }

  syncExternalAnalytics() {
    const user = this.currentUser();
    setClarityTag("app_view", this.state.activeView);
    setClarityTag("data_source", isSupabaseEnabled(this.config) ? "supabase" : "local");
    setClarityTag("auth_state", user ? "signed_in" : "anonymous");

    if (user) {
      identifyClarityUser(user, this.state.activeView);
      setClarityTag("user_role", this.isAdminUser(user) ? "admin" : "citizen");
    }
  }

  recordSystemEvent(type, data = {}) {
    const user = this.currentUser();
    return this.telemetry.record(type, {
      source: "frontend",
      userRef: user?.id || "",
      userRole: user ? (this.isAdminUser(user) ? "admin" : "citizen") : "anonymous",
      sessionId: sessionTelemetryId(),
      path: `${window.location.pathname}${window.location.hash || ""}`,
      ...data
    });
  }

  async loadSystemTelemetry() {
    if (!this.isAdminUser()) return;

    this.state.systemTelemetryLoading = true;
    this.render();
    try {
      this.state.systemTelemetryEvents = await this.telemetry.readRemote(this.currentUser());
    } catch {
      this.state.systemTelemetryEvents = [];
    } finally {
      this.state.systemTelemetryLoading = false;
    }
  }

  systemTelemetryEvents() {
    const byId = new Map();
    for (const event of [...this.state.systemTelemetryEvents, ...this.telemetry.read()]) {
      byId.set(event.id || `${event.type}-${event.createdAt}`, event);
    }

    return [...byId.values()].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }

  setActiveView(view, options = {}) {
    this.state.activeView = normalizeView(view, this.currentUser());
    this.syncViewUrl(options);
  }

  syncViewUrl(options = {}) {
    const url = new URL(window.location.href);
    url.searchParams.set("view", this.state.activeView);
    const method = options.replace ? "replaceState" : "pushState";
    window.history[method]({ view: this.state.activeView }, "", `${url.pathname}${url.search}${url.hash}`);
  }

  handleRouteChange() {
    this.state.activeView = initialView(this.currentUser());
    this.render();
  }
}

function emptyDraft() {
  return {
    title: "",
    category: "",
    summary: "",
    description: "",
    legalReference: "",
    expectedImpact: ""
  };
}

function defaultSidebarOpen() {
  return !isSmallViewport();
}

function isSmallViewport() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 860px)").matches
  );
}

function initialView(user) {
  if (typeof window === "undefined") return "dashboard";
  return normalizeView(new URL(window.location.href).searchParams.get("view"), user);
}

function normalizeView(view, user) {
  const value = APP_VIEWS.includes(view) ? view : "dashboard";
  if (value === "systemAnalytics" && !isDemoAdminUser(user)) return "dashboard";
  return value;
}

function option(value, label, selected) {
  return `<option value="${escapeAttribute(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function percentageLabel(value, total) {
  return total ? Math.round((value / total) * 100) : 0;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function maskEmail(value) {
  const email = String(value || "");
  const [name, domain] = email.split("@");
  if (!name || !domain) return email || "(brez)";
  return `${name.slice(0, 2)}***@${domain}`;
}

function isDemoAdminUser(user) {
  if (!user || user.provider !== "demo") return false;
  return isDemoAdminEmail(user.email) || isDemoAdminEmail(user.id);
}

function isDemoAdminEmail(value) {
  return String(value || "").trim().toLowerCase() === DEMO_ADMIN_EMAIL;
}

function formatDate(value) {
  if (!value) return "ni datuma";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "ni datuma";
  return date.toLocaleDateString("sl-SI", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function systemEventDetails(event) {
  if (event.type === "ai_review") {
    return `${event.provider || "unknown"} - ${event.estimatedTokens || 0} tokenov - ${event.durationMs || 0} ms`;
  }

  if (event.type === "email_notifications") {
    return `${event.count || 0} obvestil - ${event.mode || "unknown"}`;
  }

  if (event.type === "data_load") {
    return `${event.count || 0} pobud - ${event.durationMs || 0} ms - ${event.dataSource || event.source || "unknown"}`;
  }

  return Object.entries(event)
    .filter(([key]) => !["id", "type", "createdAt"].includes(key))
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");
}

function clarityRuntimeStatus() {
  const hasLoader = typeof window !== "undefined" && typeof window.clarity === "function";
  const hasScript =
    typeof document !== "undefined" &&
    Boolean(document.getElementById("microsoft-clarity-script"));

  return {
    loader: hasLoader ? "nalozen" : "ni nalozen",
    script: hasScript ? "vstavljen" : "ni vstavljen"
  };
}

function sessionTelemetryId() {
  const key = "demos.systemTelemetrySessionId";
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;

    const id = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    sessionStorage.setItem(key, id);
    return id;
  } catch {
    return "session-unavailable";
  }
}

function anonymousVoterId() {
  const token = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `anon-${token}`;
}

function userFacingErrorMessage(error) {
  const message = String(error?.message || "");

  if (message.includes("Za glasovanje je potrebna prijava.")) return message;
  if (message.includes("Za podpis je potrebna prijava.")) return message;
  if (message.includes("Za komentiranje je potrebna prijava.")) return message;
  if (message.includes("Komentar je prekratek.")) return message;
  if (message.includes("Pobuda ne obstaja.")) return message;
  if (message.includes("Status ni veljaven.")) return message;

  if (message.includes("duplicate key value") || message.includes("23505")) {
    return "To dejanje je ze bilo zabelezeno.";
  }

  return "Dejanje ni uspelo.";
}

const app = new DemocracyApp({
  root: document.querySelector("#app"),
  repository: createRepository(config),
  auth: new DemoAuth(),
  notificationClient: new EmailNotificationClient(config),
  telemetry: new SystemTelemetry({ endpoint: config.SYSTEM_ANALYTICS_ENDPOINT }),
  config
});

app.init();
