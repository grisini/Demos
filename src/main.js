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
import { ClarityInsightsClient } from "./lib/clarity-insights.js";
import {
  buildInitiativeDocxBlob,
  buildInitiativeOdtBlob,
  initiativeDocxFileName,
  initiativeOdtFileName
} from "./lib/docx-export.js";
import { EmailNotificationClient } from "./lib/notifications.js";
import { createRepository } from "./lib/supabase.js";
import { browserResourceSnapshot, estimateTextTokens, SystemTelemetry } from "./lib/telemetry.js";
import {
  isTurnstileEnabled,
  renderTurnstileWidget,
  resetTurnstileWidget,
  turnstileRuntimeStatus,
  validateTurnstileToken
} from "./lib/turnstile.js";
import { initializeVercelAnalytics, trackVercelEvent } from "./lib/vercel-analytics.js";
import {
  initializeVercelSpeedInsights,
  setVercelSpeedInsightsRoute,
  vercelSpeedInsightsStatus
} from "./lib/vercel-speed-insights.js";

const DEMO_ADMIN_EMAIL = "admin@demos.local";
const APP_VIEWS = ["dashboard", "submit", "analytics", "integrations", "systemAnalytics", "accessibility"];
const PUBLIC_INITIATIVE_STATUSES = ["active", "signature_collection"];
const ANONYMOUS_VOTER_KEY = "demos.anonymousVoterId";
const REMOTE_SEARCH_DEBOUNCE_MS = 800;
const REMOTE_SEARCH_MIN_LENGTH = 2;
const EXPORTABLE_INITIATIVE_STATUSES = ["signature_collection", "submitted"];
const INITIATIVE_TURNSTILE_ACTION = "submit_initiative";
const ACCESSIBILITY_STANDARD = "EN 301 549 v3.2.1 / WCAG 2.1 AA";
const ACCESSIBILITY_REVIEW_DATE = "26. 5. 2026";
const ACCESSIBILITY_STORAGE_KEY = "demos.accessibilityPreferences";
const ACCESSIBILITY_DEFAULTS = {
  textSize: "normal",
  contrast: "default",
  spacing: "normal",
  motion: "system",
  targetSize: "default",
  readableFont: false
};
const LEGAL_COMPLIANCE_CERTIFICATE =
  "Certifikat skladnosti s slovensko zakonodajo: dokument je pripravljen po kontrolnem seznamu za predlog zakona po slovenski zakonodaji in Poslovniku Drzavnega zbora. Pravna skladnost pred uradno vlozitvijo ostaja odgovornost predlagatelja.";
const INITIATIVE_EXPORT_ACTIONS = {
  "print-pdf": {
    systemEvent: "initiative_pdf_print",
    clarityEvent: "initiative_pdf_printed",
    vercelEvent: "InitiativePdfPrinted",
    toast: "Izvoz je pripravljen za tiskanje."
  },
  "download-pdf": {
    systemEvent: "initiative_pdf_download",
    clarityEvent: "initiative_pdf_downloaded",
    vercelEvent: "InitiativePdfDownloaded",
    toast: "PDF je prenesen."
  },
  "download-docx": {
    systemEvent: "initiative_docx_download",
    clarityEvent: "initiative_docx_downloaded",
    vercelEvent: "InitiativeDocxDownloaded",
    toast: "DOCX je prenesen."
  },
  "download-odt": {
    systemEvent: "initiative_odt_download",
    clarityEvent: "initiative_odt_downloaded",
    vercelEvent: "InitiativeOdtDownloaded",
    toast: "ODT je prenesen."
  }
};

class DemocracyApp {
  constructor({ root, repository, auth, notificationClient, telemetry, clarityInsightsClient, config: appConfig }) {
    this.root = root;
    this.repository = repository;
    this.auth = auth;
    this.notificationClient = notificationClient;
    this.telemetry = telemetry;
    this.clarityInsightsClient = clarityInsightsClient;
    this.config = appConfig;
    this.pendingMainFocus = false;
    const accessibilityPreferences = readAccessibilityPreferences();
    applyAccessibilityPreferences(accessibilityPreferences);
    this.anonymousVoterSessionId = "";
    this.searchRequestId = 0;
    this.searchDebounceTimer = null;
    this.state = {
      initiatives: [],
      searchResults: null,
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
      clarityInsights: null,
      clarityInsightsLoading: false,
      clarityInsightsError: "",
      turnstileToken: "",
      turnstileWidgetId: "",
      turnstileError: "",
      turnstileVerifying: false,
      searchLoading: false,
      searchError: "",
      sidebarOpen: defaultSidebarOpen(),
      accessibilityPreferences,
      loading: true
    };

    this.root.addEventListener("click", (event) => this.handleClick(event));
    this.root.addEventListener("submit", (event) => this.handleSubmit(event));
    this.root.addEventListener("input", (event) => this.handleInput(event));
    this.root.addEventListener("change", (event) => this.handleChange(event));
    window.addEventListener("keydown", (event) => this.handleGlobalKeydown(event));
    window.addEventListener("popstate", () => this.handleRouteChange());
  }

  async init() {
    await this.auth.refreshSipassSession?.(this.config.AUTH_SESSION_ENDPOINT);
    this.syncViewUrl({ replace: true });
    initializeVercelAnalytics();
    initializeVercelSpeedInsights({ route: this.speedInsightsRoute() });
    initializeMicrosoftClarity(this.config.MICROSOFT_CLARITY_PROJECT_ID);
    this.syncExternalAnalytics();
    await this.refresh();
    if (this.state.activeView === "analytics" && this.currentUser()) {
      await this.loadClarityInsights();
    }
    if (this.state.activeView === "systemAnalytics" && this.isAdminUser()) {
      await this.loadSystemTelemetry();
      await this.loadClarityInsights();
    }
  }

  async refresh() {
    this.state.loading = true;
    this.render();
    const startedAt = performance.now();
    try {
      this.state.initiatives = await this.repository.list();
      if (this.shouldUseRemoteSearch()) {
        await this.loadRemoteSearch({ render: false });
      }
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
    if (this.shouldUseRemoteSearch()) {
      if (Array.isArray(this.state.searchResults)) return this.state.searchResults;
      if (this.state.searchLoading) return [];
    }

    const query = this.state.query.toLowerCase();
    const source = this.visibleInitiatives();
    const filtered = source.filter((initiative) => {
      const text = [
        initiative.title,
        initiative.summary,
        initiative.category,
        initiative.description,
        initiative.legalReference,
        initiative.expectedImpact,
        initiative.legislativeText,
        initiative.articleExplanation,
        initiative.comparativeReview,
        initiative.impactAssessment
      ]
        .join(" ")
        .toLowerCase();
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
    const filtered = this.filteredInitiatives();
    return filtered.find((initiative) => initiative.id === this.state.selectedId) || filtered[0] || null;
  }

  visibleInitiatives() {
    if (this.currentUser()) return this.state.initiatives;
    return this.state.initiatives.filter((initiative) => PUBLIC_INITIATIVE_STATUSES.includes(initiative.status));
  }

  shouldUseRemoteSearch() {
    return (
      isSupabaseEnabled(this.config) &&
      typeof this.repository.search === "function" &&
      this.state.query.trim().length >= REMOTE_SEARCH_MIN_LENGTH
    );
  }

  scheduleRemoteSearch() {
    window.clearTimeout(this.searchDebounceTimer);

    if (!this.shouldUseRemoteSearch()) {
      this.searchRequestId += 1;
      this.state.searchResults = null;
      this.state.searchLoading = false;
      this.state.searchError = "";
      this.render();
      return;
    }

    this.state.searchResults = null;
    this.state.searchLoading = false;
    this.state.searchError = "";
    const requestId = ++this.searchRequestId;
    this.searchDebounceTimer = window.setTimeout(() => {
      this.loadRemoteSearch({ requestId, renderLoading: true });
    }, REMOTE_SEARCH_DEBOUNCE_MS);
  }

  async loadRemoteSearch(options = {}) {
    if (!this.shouldUseRemoteSearch()) {
      this.state.searchResults = null;
      this.state.searchLoading = false;
      this.state.searchError = "";
      return;
    }

    const requestId = options.requestId || ++this.searchRequestId;
    this.state.searchLoading = true;
    this.state.searchError = "";
    if (options.renderLoading && options.render !== false) this.render();

    try {
      const results = await this.repository.search({
        query: this.state.query,
        category: this.state.category,
        status: this.currentUser() ? this.state.status : "all",
        publicOnly: !this.currentUser(),
        sort: this.state.sort,
        limit: 50,
        offset: 0
      });

      if (requestId !== this.searchRequestId) return;
      this.state.searchResults = results;
      this.state.searchLoading = false;
      this.state.searchError = "";
    } catch (error) {
      if (requestId !== this.searchRequestId) return;
      this.reportError("Supabase hybrid search failed", error);
      this.state.searchResults = null;
      this.state.searchLoading = false;
      this.state.searchError = "Iskanje v ni uspelo";
    } finally {
      if (requestId === this.searchRequestId && options.render !== false) {
        this.render();
      }
    }
  }

  render() {
    const user = this.currentUser();
    const analytics = calculateAnalytics(this.state.initiatives);
    const selected = this.selectedInitiative();
    const dataMode = isSupabaseEnabled(this.config) ? "Supabase" : "Lokalni prototip";
    const sidebarState = this.state.sidebarOpen ? "sidebar-open" : "sidebar-closed";
    const focusState = this.captureFocusState();

    this.root.className = `app-shell ${sidebarState}`;
    applyAccessibilityPreferences(this.state.accessibilityPreferences);

    this.root.innerHTML = `
      <a class="skip-link" href="#main-content">Preskoci na glavno vsebino</a>
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
          ${this.isAdminUser(user) ? this.navButton("integrations", "Integracije", "04") : ""}
          ${this.isAdminUser(user) ? this.navButton("systemAnalytics", "Sistemska analitika", "05") : ""}
        </nav>
        <div class="user-panel">
          ${user ? this.renderUser(user) : this.renderLogin()}
        </div>
      </aside>

      <main id="main-content" class="content" tabindex="-1" aria-busy="${this.state.loading ? "true" : "false"}" aria-labelledby="page-title">
        <header class="topbar">
          <div class="topbar-title">
            <div>
              <p class="eyebrow">Projekt Demos</p>
              <h1 id="page-title" tabindex="-1">${this.pageTitle()}</h1>
            </div>
          </div>
          <div class="topbar-actions">
            <span class="env-pill">${this.config.SIPASS_ENV === "test" ? "SI-PASS test" : "SI-PASS prod"}</span>
            <button class="button secondary" type="button" data-action="view" data-view="accessibility">Dostopnost</button>
            <button class="button secondary" type="button" data-action="refresh">Osvezi</button>
          </div>
        </header>
        ${this.state.toast ? `<div class="toast" role="status" aria-live="polite" aria-atomic="true">${escapeHtml(this.state.toast)}</div>` : ""}
        ${
          this.state.loading
            ? this.renderLoading()
            : `${this.renderView(analytics, selected)}${this.renderAppFooter(dataMode)}`
        }
      </main>
    `;
    this.restoreFocusState(focusState);
    this.focusMainHeading();
    this.syncExternalAnalytics();
    this.syncSecurityWidgets();
  }

  renderAppFooter(dataMode) {
    const year = new Date().getFullYear();
    const sipassMode = this.config.SIPASS_ENV === "test" ? "SI-PASS test" : "SI-PASS prod";
    const securityMode = isTurnstileEnabled(this.config) ? "Turnstile aktiviran" : "Demo varnostni nacin";

    return `
      <footer class="app-footer" aria-label="Noga aplikacije">
        <div class="footer-main">
          <div class="footer-brand">
            <span class="footer-mark" aria-hidden="true">D2</span>
            <div>
              <strong>Demokracija 2.0</strong>
              <small>Digitalni delovni prostor za zakonodajne pobude</small>
            </div>
          </div>
          <p>Pripravljeno za pregledno oddajo pobud, zbiranje podpore in izvoz gradiv za nadaljnji zakonodajni postopek.</p>
        </div>
        <div class="footer-badges" aria-label="Stanje sistema">
          <span>Kontrolni seznam DZ</span>
          <span>${escapeHtml(ACCESSIBILITY_STANDARD)}</span>
          <span>${escapeHtml(dataMode)}</span>
          <span>${escapeHtml(sipassMode)}</span>
          <span>${escapeHtml(securityMode)}</span>
        </div>
        <nav class="footer-links" aria-label="Povezave v nogi">
          <button type="button" data-action="view" data-view="dashboard">Pregled pobud</button>
          ${this.currentUser() ? `<button type="button" data-action="view" data-view="submit">Nova pobuda</button>` : ""}
          ${this.currentUser() ? `<button type="button" data-action="view" data-view="analytics">Analitika</button>` : ""}
          <button type="button" data-action="view" data-view="accessibility">Dostopnost</button>
          <button type="button" data-action="refresh">Osvezi podatke</button>
        </nav>
        <div class="footer-bottom">
          <span>(c) ${year} Demos</span>
          <span>${escapeHtml(LEGAL_COMPLIANCE_CERTIFICATE)}</span>
        </div>
      </footer>
    `;
  }

  captureFocusState() {
    const active = document.activeElement;
    if (!active) return null;

    if (active.dataset?.accessibilitySetting) {
      return {
        accessibilitySetting: active.dataset.accessibilitySetting
      };
    }

    if (active.dataset?.filter !== "query") return null;

    return {
      filter: "query",
      start: active.selectionStart,
      end: active.selectionEnd
    };
  }

  restoreFocusState(focusState) {
    if (!focusState) return;

    if (focusState.accessibilitySetting) {
      const control = this.root.querySelector(`[data-accessibility-setting="${focusState.accessibilitySetting}"]`);
      if (control) control.focus({ preventScroll: true });
      return;
    }

    const input = this.root.querySelector(`[data-filter="${focusState.filter}"]`);
    if (!input) return;

    input.focus({ preventScroll: true });
    if (typeof input.setSelectionRange === "function" && focusState.start !== null && focusState.end !== null) {
      input.setSelectionRange(focusState.start, focusState.end);
    }
  }

  requestMainFocus() {
    this.pendingMainFocus = true;
  }

  focusMainHeading() {
    if (!this.pendingMainFocus) return;
    this.pendingMainFocus = false;
    const heading = this.root.querySelector("#page-title");
    if (heading) heading.focus({ preventScroll: true });
  }

  renderView(analytics, selected) {
    if (!this.currentUser() && !["dashboard", "accessibility"].includes(this.state.activeView)) {
      return this.renderLoginRequiredView();
    }
    if (this.state.activeView === "submit") return this.renderSubmitView();
    if (this.state.activeView === "analytics") return this.renderAnalyticsView(analytics);
    if (this.state.activeView === "integrations") return this.renderIntegrationsView();
    if (this.state.activeView === "systemAnalytics") return this.renderSystemAnalyticsView();
    if (this.state.activeView === "accessibility") return this.renderAccessibilityView();
    return this.renderDashboardView(analytics, selected);
  }

  renderDashboardView(analytics, selected) {
    const initiatives = this.filteredInitiatives();
    const user = this.currentUser();
    const dashboardAnalytics = user ? analytics : calculateAnalytics(this.visibleInitiatives());
    const mobileDetailOpen = Boolean(this.state.selectedId && selected);
    return `
      <section class="dashboard-layout">
        <section class="metric-grid dashboard-metrics" aria-label="Povzetek">
          ${this.metric(user ? "Pobude" : "Aktualne pobude", dashboardAnalytics.initiativeCount, user ? "Vse oddane pobude" : "Javno odprte pobude")}
          ${this.metric("Glasovi", dashboardAnalytics.totalVotes, "Oddani glasovi")}
          ${this.metric("Komentarji", user ? dashboardAnalytics.totalComments : "-", user ? "Razprava ob pobudah" : "Vidno po prijavi")}
          ${this.metric("AI ocena", user ? `${dashboardAnalytics.averageScore}%` : "-", user ? "Povprecje skladnosti" : "Vidno po prijavi")}
        </section>

        <section class="workspace-grid dashboard-workspace">
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
                <input type="search" value="${escapeAttribute(this.state.query)}" data-filter="query" placeholder="Naslov, povzetek, cleni" />
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
            ${this.state.searchLoading ? `<div class="empty-state" role="status" aria-live="polite">Iskanje...</div>` : ""}
            ${this.state.searchError ? `<div class="empty-state" role="alert">${escapeHtml(this.state.searchError)}</div>` : ""}
            <div class="initiative-list" role="list" aria-label="Seznam pobud">
              ${
                this.state.searchLoading
                  ? ""
                  : initiatives.length
                  ? initiatives.map((initiative) => this.renderInitiativeCard(initiative)).join("")
                  : `<div class="empty-state">${user ? "Ni pobud za izbrane filtre." : "Trenutno ni javno odprtih pobud."}</div>`
              }
            </div>
          </div>
          ${
            mobileDetailOpen
              ? `<button class="mobile-detail-backdrop" type="button" data-action="close-detail" aria-label="Zapri podrobnosti pobude"></button>`
              : ""
          }
          <div class="panel detail-panel ${mobileDetailOpen ? "mobile-detail-open" : ""}" ${
            mobileDetailOpen ? 'role="dialog" aria-modal="true"' : 'role="region"'
          } aria-label="Podrobnosti pobude">
            ${
              selected
                ? `
                  <div class="mobile-detail-toolbar">
                    <span class="mobile-detail-handle" aria-hidden="true"></span>
                    <button class="detail-close-button" type="button" data-action="close-detail">Zapri</button>
                  </div>
                  ${this.renderInitiativeDetail(selected)}
                `
                : `<div class="empty-state">Izberite pobudo.</div>`
            }
          </div>
        </section>
      </section>
    `;
  }

  renderSubmitView() {
    const review = this.state.aiPreviewReview || evaluateInitiative(this.state.draft);
    const categoryId = this.fieldId("category");
    return `
      <section class="submit-grid">
        <form class="panel form-panel" data-form="initiative" aria-labelledby="submit-form-title">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Nova zakonodajna pobuda</p>
              <h2 id="submit-form-title">Oddaja pobude</h2>
            </div>
          </div>
          ${this.input("title", "Naslov pobude", "npr. Javna sledljivost zakonodajnih sprememb")}
          <label class="field" for="${categoryId}">
            <span>Kategorija</span>
            <select id="${categoryId}" name="category" data-draft="category" ${this.fieldAriaAttributes("category")}>
              <option value="">Izberi kategorijo</option>
              ${CATEGORIES.map((category) => option(category, category, this.state.draft.category)).join("")}
            </select>
            ${this.error("category")}
          </label>
          ${this.textarea("summary", "Kratek povzetek", 3)}
          ${this.input("legalReference", "Pravna podlaga", "zakon, clen, pravilnik ali sorodna podlaga")}
          ${this.textarea("description", "Ocena stanja in razlogi za sprejem", 6)}
          ${this.textarea("expectedImpact", "Cilji, nacela in poglavitne resitve", 4)}
          ${this.textarea("legislativeText", "Besedilo clenov", 7)}
          ${this.textarea("articleExplanation", "Obrazlozitev clenov", 6)}
          ${this.textarea("financialImpact", "Financne posledice za proracun in javna sredstva", 3)}
          ${this.textarea("budgetFunding", "Zagotovitev sredstev", 3)}
          ${this.textarea("comparativeReview", "Primerjalni prikaz in skladnost s pravom EU", 5)}
          ${this.textarea("impactAssessment", "Presoja posledic", 5)}
          ${this.textarea("publicParticipation", "Sodelovanje javnosti", 3)}
          ${this.input("proposerRepresentatives", "Predstavniki predlagatelja", "ime, funkcija ali kontakt")}
          ${this.textarea("affectedProvisions", "Besedilo dolocb, ki se spreminjajo", 4)}
          ${this.renderSecurityGate(INITIATIVE_TURNSTILE_ACTION)}
          <div class="form-actions">
            <button class="button primary" type="submit" ${this.state.turnstileVerifying ? "disabled" : ""}>${
              this.state.turnstileVerifying ? "Preverjam ..." : "Oddaj pobudo"
            }</button>
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
        ${this.renderClarityInsightsPanel()}
        <div class="panel">
          <p class="eyebrow">Statusi</p>
          <h2>Tok pobud</h2>
          <div class="status-bars">
            ${analytics.byStatus
              .map(
                (item) => `
                  <div class="bar-row">
                    <span>${item.label}</span>
                    <div class="bar-track" aria-hidden="true"><div style="width:${analytics.initiativeCount ? (item.count / analytics.initiativeCount) * 100 : 0}%"></div></div>
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
              <span role="columnheader">Pobuda</span>
              <span role="columnheader">Glasovi</span>
              <span role="columnheader">Delez</span>
              <span role="columnheader">Podpisi</span>
              <span role="columnheader">Komentarji</span>
              <span role="columnheader">AI</span>
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

  renderClarityInsightsPanel() {
    const insights = this.state.clarityInsights;

    if (this.state.clarityInsightsLoading) {
      return `
        <div class="panel wide-panel">
          <p class="eyebrow">Microsoft Clarity</p>
          <h2>Vedenjski grafi</h2>
          <div class="empty-state">Nalagam agregirane Clarity metrike ...</div>
        </div>
      `;
    }

    if (!insights) {
      return `
        <div class="panel wide-panel">
          <p class="eyebrow">Microsoft Clarity</p>
          <h2>Vedenjski grafi</h2>
          <div class="empty-state">Clarity grafi se nalozijo ob odprtju analitike.</div>
          <button class="button secondary compact" type="button" data-action="refresh-clarity-insights">Nalozi Clarity grafe</button>
        </div>
      `;
    }

    if (!insights.configured) {
      return `
        <div class="panel wide-panel">
          <p class="eyebrow">Microsoft Clarity</p>
          <h2>Vedenjski grafi</h2>
          <div class="empty-state">${escapeHtml(insights.reason || "Clarity Data Export API ni nastavljen.")}</div>
          <p class="note">Za prikaz grafov nastavite server-only CLARITY_API_TOKEN; Project ID sam omogoci sledenje, ne pa branja metrik nazaj v aplikacijo.</p>
        </div>
      `;
    }

    return `
      <div class="panel wide-panel">
        <p class="eyebrow">Microsoft Clarity</p>
        <h2>Vedenjski grafi</h2>
        <div class="analytics-summary-strip">
          ${this.summaryCell("Seje", insights.summary.sessions)}
          ${this.summaryCell("Uporabniki", insights.summary.users)}
          ${this.summaryCell("Bot seje", insights.summary.botSessions)}
          ${this.summaryCell("Mrtvi kliki", insights.summary.deadClicks)}
          ${this.summaryCell("Rage kliki", insights.summary.rageClicks)}
          ${this.summaryCell("JS napake", insights.summary.scriptErrors)}
        </div>
        <div class="personal-analytics-grid">
          ${
            insights.charts.length
              ? insights.charts.map((chart) => this.renderClarityChart(chart)).join("")
              : `<div class="empty-state">Clarity se nima agregiranih metrik za zadnje ${escapeHtml(insights.days)} dni.</div>`
          }
        </div>
        <p class="note">Podatki prihajajo iz Clarity Data Export API za zadnje ${escapeHtml(insights.days)} dni, segmentirano po ${escapeHtml(insights.dimension)}. Heatmapi in posnetki sej ostanejo v Clarity dashboardu.</p>
        ${this.state.clarityInsightsError ? `<p class="note">${escapeHtml(this.state.clarityInsightsError)}</p>` : ""}
      </div>
    `;
  }

  renderClarityChart(chart) {
    const maxValue = Math.max(1, ...chart.rows.map((row) => Number(row.value) || 0));
    return `
      <div>
        <h3>${escapeHtml(chart.title)}</h3>
        <div class="category-analytics">
          ${chart.rows
            .map(
              (row) => `
                <div class="category-analytics-row">
                  <span>
                    <strong>${escapeHtml(row.label)}</strong>
                    <small>${escapeHtml(row.secondary || chart.metricName)}</small>
                  </span>
                  <em>${escapeHtml(formatClarityMetric(row.value, row.unit))}</em>
                  <div class="bar-track" aria-hidden="true"><div style="width:${Math.min(100, ((Number(row.value) || 0) / maxValue) * 100)}%"></div></div>
                </div>
              `
            )
            .join("")}
        </div>
      </div>
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

    const system = calculateSystemAnalytics(
      this.state.initiatives,
      this.systemTelemetryEvents(),
      browserResourceSnapshot(),
      this.state.clarityInsights
    );
    const clarityIssues = system.clarity.deadClicks + system.clarity.rageClicks + system.clarity.scriptErrors;

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
        ${this.metric("Clarity seje", system.clarity.sessions, system.clarity.configured ? `zadnjih ${system.clarity.days} dni` : "Data Export ni nastavljen")}
        ${this.metric("UX opozorila", clarityIssues, "mrtvi kliki, rage kliki, JS napake")}
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
          <p class="eyebrow">Microsoft Clarity</p>
          <h2>Vedenjska sistemska slika</h2>
          <dl class="config-list">
            <div><dt>Project ID</dt><dd>${this.config.MICROSOFT_CLARITY_PROJECT_ID ? "nastavljen" : "ni nastavljen"}</dd></div>
            <div><dt>Runtime loader</dt><dd>${clarityRuntimeStatus().loader}</dd></div>
            <div><dt>Script tag</dt><dd>${clarityRuntimeStatus().script}</dd></div>
            <div><dt>Data Export</dt><dd>${system.clarity.configured ? "povezan" : "ni povezan"}</dd></div>
            <div><dt>Seje</dt><dd>${system.clarity.sessions}</dd></div>
            <div><dt>Uporabniki</dt><dd>${system.clarity.users}</dd></div>
            <div><dt>Bot seje</dt><dd>${system.clarity.botSessions}</dd></div>
            <div><dt>Mrtvi/rage kliki</dt><dd>${system.clarity.deadClicks + system.clarity.rageClicks}</dd></div>
            <div><dt>JS napake</dt><dd>${system.clarity.scriptErrors}</dd></div>
          </dl>
          <button class="button secondary compact" type="button" data-action="refresh-clarity-insights">Osvezi Clarity</button>
          ${
            system.clarity.reason || system.clarity.error
              ? `<p class="note">${escapeHtml(system.clarity.reason || system.clarity.error)}</p>`
              : `<p class="note">Isti Clarity agregati so vidni tudi v uporabniski analitiki, tukaj pa sluzijo za sistemski nadzor UX in napak.</p>`
          }
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

  renderAccessibilityView() {
    return `
      <section class="accessibility-grid">
        ${this.renderAccessibilitySettings()}
        <div class="panel wide-panel">
          <p class="eyebrow">Dostopnost</p>
          <h2>Izjava o dostopnosti</h2>
          <p class="summary">Aplikacija Demokracija 2.0 je pripravljena z namenom skladnosti s standardom ${escapeHtml(ACCESSIBILITY_STANDARD)} za spletne strani javnega sektorja.</p>
          <dl class="config-list">
            <div><dt>Standard</dt><dd>${escapeHtml(ACCESSIBILITY_STANDARD)}</dd></div>
            <div><dt>Obseg</dt><dd>Spletna aplikacija, obrazci, pregled pobud in analitika</dd></div>
            <div><dt>Metoda pregleda</dt><dd>Samoocena prototipa, pregled tipkovnice in avtomatizirani domenjski testi</dd></div>
            <div><dt>Datum pregleda</dt><dd>${escapeHtml(ACCESSIBILITY_REVIEW_DATE)}</dd></div>
          </dl>
        </div>
        <div class="panel">
          <p class="eyebrow">Vkljuceno</p>
          <h2>Tehnicni ukrepi</h2>
          <ul class="check-list">
            <li>Semanticni pogledi z glavnim obmocjem, navigacijo, obrazci in statusnimi obvestili.</li>
            <li>Preskok na glavno vsebino in vidna tipkovnicna fokusna oznaka.</li>
            <li>Oznacena polja, povezane napake obrazcev in opisi gumbov z ikonami.</li>
            <li>Graficni kazalniki imajo tekstovne vrednosti in niso edini vir informacije.</li>
            <li>Postovana je nastavitev za zmanjsano gibanje v brskalniku.</li>
          </ul>
        </div>
        <div class="panel">
          <p class="eyebrow">Omejitve</p>
          <h2>Znane neskladnosti</h2>
          <ul class="check-list">
            <li>Varnostni gradnik Turnstile je zunanji element in je odvisen od dostopnosti ponudnika.</li>
            <li>Izvoz PDF je namenjen tiskanju in se ne razglasa kot popolnoma oznacen dostopen PDF.</li>
            <li>DOCX in ODT izvoz uporabljata osnovno strukturo dokumenta; pred uradno objavo je potreben rocni pregled dokumenta.</li>
          </ul>
        </div>
        <div class="panel">
          <p class="eyebrow">Povratne informacije</p>
          <h2>Postopek izboljsav</h2>
          <p class="summary">Dostopnost je treba preveriti ob vsaki vecji spremembi uporabniskega vmesnika, posebej pri novih obrazcih, grafih, dokumentih in integracijah.</p>
          <p class="note">Za ugotovljene ovire obvestite skrbnika aplikacije, da se napaka evidentira in popravi.</p>
        </div>
      </section>
    `;
  }

  renderAccessibilitySettings() {
    const preferences = this.state.accessibilityPreferences;
    return `
      <form class="panel wide-panel accessibility-settings" data-form="accessibility-settings" aria-labelledby="accessibility-settings-title">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Prilagoditve</p>
            <h2 id="accessibility-settings-title">Nastavitve prikaza</h2>
          </div>
          <button class="button secondary compact" type="button" data-action="reset-accessibility">Ponastavi</button>
        </div>
        <div class="accessibility-settings-grid">
          ${this.accessibilitySelect("textSize", "Velikost besedila", [
            ["normal", "Obicajna"],
            ["large", "Vecja"],
            ["xlarge", "Zelo velika"]
          ])}
          ${this.accessibilitySelect("contrast", "Kontrast", [
            ["default", "Obicajen"],
            ["high", "Visok kontrast"],
            ["dark", "Temen kontrast"]
          ])}
          ${this.accessibilitySelect("spacing", "Razmik", [
            ["normal", "Obicajen"],
            ["wide", "Vecji razmik"]
          ])}
          ${this.accessibilitySelect("motion", "Gibanje", [
            ["system", "Po nastavitvi naprave"],
            ["reduce", "Zmanjsaj gibanje"]
          ])}
          ${this.accessibilitySelect("targetSize", "Gumbi in polja", [
            ["default", "Obicajni"],
            ["large", "Vecji"]
          ])}
          <label class="switch-field">
            <input type="checkbox" data-accessibility-setting="readableFont" ${preferences.readableFont ? "checked" : ""} />
            <span>Berljivejsa pisava</span>
          </label>
        </div>
      </form>
    `;
  }

  accessibilitySelect(name, label, options) {
    const value = this.state.accessibilityPreferences[name];
    return `
      <label class="field">
        <span>${escapeHtml(label)}</span>
        <select data-accessibility-setting="${escapeAttribute(name)}">
          ${options.map(([optionValue, optionLabel]) => option(optionValue, optionLabel, value)).join("")}
        </select>
      </label>
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
        <div class="bar-track" aria-hidden="true"><div style="width:${(item.votes / maxVotes) * 100}%"></div></div>
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
        <div role="cell">
          <strong>${escapeHtml(item.title)}</strong>
          <small>${escapeHtml(item.category)} - ${statusLabel(item.status)}</small>
        </div>
        <div role="cell">
          <strong>${item.votes}</strong>
          <div class="mini-bar" aria-hidden="true"><div style="width:${(item.votes / maxVotes) * 100}%"></div></div>
        </div>
        <span role="cell">${item.voteShare}%</span>
        <span role="cell">${item.signatures}</span>
        <span role="cell">${item.comments}</span>
        <span role="cell">${item.aiScore}%</span>
      </div>
    `;
  }

  renderIntegrationsView() {
    if (!this.isAdminUser()) {
      return `
        <section class="panel">
          <p class="eyebrow">Admin</p>
          <h2>Integracije so namenjene administratorju</h2>
          <div class="empty-state">Za nastavitev in pregled integracij uporabite demo admin racun.</div>
        </section>
      `;
    }

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
          <p class="note">Podatkovna povezava je namenjena shranjevanju pobud, glasov, podpisov, komentarjev in sistemskih dogodkov.</p>
        </div>
        <div class="panel">
          <p class="eyebrow">Identiteta</p>
          <h2>SI-PASS</h2>
          <dl class="config-list">
            <div><dt>Okolje</dt><dd>${escapeHtml(this.config.SIPASS_ENV)}</dd></div>
            <div><dt>Avtoriteta</dt><dd>${escapeHtml(this.config.SIPASS_AUTHORITY)}</dd></div>
            <div><dt>Client ID</dt><dd>${this.config.SIPASS_CLIENT_ID ? "nastavljen" : "ni nastavljen"}</dd></div>
          </dl>
          <button class="button secondary" type="button" data-action="sipass-login">SI-PASS prijava</button>
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
          <p class="eyebrow">Performance</p>
          <h2>Vercel Speed Insights</h2>
          <dl class="config-list">
            <div><dt>Namen</dt><dd>Core Web Vitals in hitrost strani</dd></div>
            <div><dt>Runtime loader</dt><dd>${vercelSpeedInsightsStatus().loader}</dd></div>
            <div><dt>Script tag</dt><dd>${vercelSpeedInsightsStatus().script}</dd></div>
            <div><dt>Route</dt><dd>${escapeHtml(vercelSpeedInsightsStatus().route || this.speedInsightsRoute())}</dd></div>
          </dl>
          <p class="note">Meritve se zbirajo na Vercelu po deployu, obisku strani in navigaciji med pogledi.</p>
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
          <p class="eyebrow">Dokumenti</p>
          <h2>Office izvoz</h2>
          <dl class="config-list">
            <div><dt>Formati</dt><dd>PDF tisk, PDF prenos, DOCX in ODT prenos</dd></div>
            <div><dt>Generator</dt><dd>brskalniski OOXML/ODF paket</dd></div>
            <div><dt>Podatki</dt><dd>pobuda, podpisi, AI predpregled</dd></div>
          </dl>
          <p class="note">DOCX in ODT izvoz ustvarita dokument lokalno v brskalniku, brez posiljanja vsebine zunanji storitvi.</p>
          <p class="eyebrow">Varnost</p>
          <h2>Cloudflare Turnstile</h2>
          <dl class="config-list">
            <div><dt>Site key</dt><dd>${this.config.TURNSTILE_SITE_KEY ? "nastavljen" : "ni nastavljen"}</dd></div>
            <div><dt>Endpoint</dt><dd>${this.config.TURNSTILE_ENDPOINT ? "nastavljen" : "ni nastavljen"}</dd></div>
            <div><dt>Runtime loader</dt><dd>${turnstileRuntimeStatus().loader}</dd></div>
            <div><dt>Script tag</dt><dd>${turnstileRuntimeStatus().script}</dd></div>
            <div><dt>Zascitena akcija</dt><dd>oddaja pobude</dd></div>
          </dl>
          <p class="note">Server-side secret mora biti nastavljen kot TURNSTILE_SECRET_KEY; frontend prejme samo public site key.</p>
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
          <button class="button secondary" type="button" data-action="test-email">Test email obvestila</button>
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
    const description = `${initiative.title}, ${statusLabel(initiative.status)}, ${voteCount} glasov${
      user ? `, ${commentCount} komentarjev` : ""
    }`;
    return `
      <article class="initiative-card ${active}" role="listitem">
        <button class="card-button" type="button" data-action="select" data-id="${initiative.id}" aria-pressed="${
          active ? "true" : "false"
        }" aria-label="Izberi pobudo: ${escapeAttribute(description)}">
          <span class="status-dot ${initiative.status}" aria-hidden="true"></span>
          <span>
            <strong>${escapeHtml(initiative.title)}</strong>
            <small>${escapeHtml(initiative.category)} - ${statusLabel(initiative.status)} - ${voteCount} glasov${user ? ` - ${commentCount} komentarjev` : ""}</small>
          </span>
          <span class="support-count" title="Glasovi" aria-hidden="true">${voteCount}</span>
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
    const exportReady = canExportInitiative(initiative);
    const admin = this.isAdminUser(user);

    return `
      <div class="detail-header">
        <div>
          <p class="eyebrow">${escapeHtml(initiative.category)}</p>
          <h2>${escapeHtml(initiative.title)}</h2>
        </div>
        <span class="status-badge ${initiative.status}">${statusLabel(initiative.status)}</span>
      </div>
      <p class="summary">${escapeHtml(initiative.summary)}</p>
      <div class="support-actions" aria-label="Dejanja pobude">
        <button class="button primary" type="button" data-action="vote" data-id="${initiative.id}" ${voted ? "disabled" : ""}>
          ${voted ? "Glas oddan" : "Glasuj"}
        </button>
        <button class="button secondary" type="button" data-action="sign" data-id="${initiative.id}" ${signed ? "disabled" : ""}>
          ${signed ? "Podpis evidentiran" : "Demo podpis"}
        </button>
        ${
          exportReady
            ? `
              <button class="button secondary icon-button" type="button" data-action="print-pdf" data-id="${initiative.id}" aria-label="Natisni izvoz za DZ" title="Natisni izvoz za DZ">
                ${printIcon()}
              </button>
              <button class="button secondary icon-button" type="button" data-action="download-pdf" data-id="${initiative.id}" aria-label="Prenesi PDF za DZ" title="Prenesi PDF za DZ">
                ${downloadIcon()}
              </button>
              <details class="export-menu">
                <summary class="button secondary export-menu-trigger" aria-haspopup="menu" aria-label="Prenesi dokument za DZ" title="Prenesi dokument za DZ">
                  ${wordIcon()}
                  <span>DOCX/ODT</span>
                  ${chevronDownIcon()}
                </summary>
                <div class="export-menu-list" role="menu" aria-label="Format dokumenta">
                  <button type="button" data-action="download-docx" data-id="${initiative.id}" role="menuitem">
                    <span>Word</span>
                    <small>.docx</small>
                  </button>
                  <button type="button" data-action="download-odt" data-id="${initiative.id}" role="menuitem">
                    <span>ODT</span>
                    <small>.odt</small>
                  </button>
                </div>
              </details>
            `
            : ""
        }
        ${
          admin
            ? `
              <label class="status-select">
                <span>Status</span>
                <select data-status-id="${initiative.id}">
                  ${STATUSES.map((status) => option(status.value, status.label, initiative.status)).join("")}
                </select>
              </label>
            `
            : ""
        }
      </div>
      <div class="detail-metrics">
        ${this.metric("Glasovi", initiative.votes.length, "en uporabnik, en glas")}
        ${this.metric("Podpisi", initiative.signatures.length, "priprava za SI-PASS")}
        ${this.metric("Komentarji", initiative.comments.length, "javna razprava")}
        ${this.metric("AI ocena", `${review.score}%`, riskLabel(review.risk))}
      </div>
      <section class="detail-section">
        <h3>Ocena stanja in razlogi</h3>
        <p>${escapeHtml(initiative.description)}</p>
      </section>
      <section class="detail-section two-columns">
        <div>
          <h3>Pravna podlaga</h3>
          <p>${escapeHtml(initiative.legalReference || "Ni navedena.")}</p>
        </div>
        <div>
          <h3>Cilji in resitve</h3>
          <p>${escapeHtml(initiative.expectedImpact || "Ni navedeno.")}</p>
        </div>
      </section>
      <section class="detail-section">
        <h3>Besedilo clenov</h3>
        <p>${escapeHtml(initiative.legislativeText || "Ni navedeno.")}</p>
      </section>
      <section class="detail-section">
        <h3>Obrazlozitev clenov</h3>
        <p>${escapeHtml(initiative.articleExplanation || "Ni navedena.")}</p>
      </section>
      <section class="detail-section two-columns">
        <div>
          <h3>Financne posledice</h3>
          <p>${escapeHtml(initiative.financialImpact || "Ni navedeno.")}</p>
        </div>
        <div>
          <h3>Zagotovitev sredstev</h3>
          <p>${escapeHtml(initiative.budgetFunding || "Ni navedena.")}</p>
        </div>
      </section>
      <section class="detail-section">
        <h3>Primerjalni prikaz in pravo EU</h3>
        <p>${escapeHtml(initiative.comparativeReview || "Ni navedeno.")}</p>
      </section>
      <section class="detail-section">
        <h3>Presoja posledic</h3>
        <p>${escapeHtml(initiative.impactAssessment || "Ni navedena.")}</p>
      </section>
      <section class="detail-section two-columns">
        <div>
          <h3>Sodelovanje javnosti</h3>
          <p>${escapeHtml(initiative.publicParticipation || "Ni navedeno.")}</p>
        </div>
        <div>
          <h3>Predstavniki predlagatelja</h3>
          <p>${escapeHtml(initiative.proposerRepresentatives || "Ni navedeno.")}</p>
        </div>
      </section>
      <section class="detail-section">
        <h3>Dolocbe, ki se spreminjajo</h3>
        <p>${escapeHtml(initiative.affectedProvisions || "Ni sprememb obstojecega zakona oziroma ni navedeno.")}</p>
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
          <label class="sr-only" for="comment-body-${escapeAttribute(initiative.id)}">Dodaj komentar</label>
          <input id="comment-body-${escapeAttribute(initiative.id)}" name="body" placeholder="Dodaj komentar" autocomplete="off" />
          <button class="button secondary" type="submit">Objavi</button>
        </form>
        <div class="comments" aria-live="polite">
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
      <section class="panel" role="status" aria-live="polite" aria-label="Nalaganje podatkov">
        <span class="sr-only">Nalaganje podatkov.</span>
        <div class="loading-line" aria-hidden="true"></div>
        <div class="loading-line short" aria-hidden="true"></div>
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
      <div class="score-ring" style="--score: ${review.score}" role="img" aria-label="AI ocena ${review.score} odstotkov, tveganje ${escapeAttribute(riskLabel(review.risk))}">
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
      <form class="login-form" data-form="login" aria-label="Demo prijava">
        <label>
          <span>Ime</span>
          <input name="name" type="text" value="Demo uporabnik" autocomplete="name" />
        </label>
        <label>
          <span>E-posta</span>
          <input name="email" type="email" value="demo@demos.local" autocomplete="email" inputmode="email" />
        </label>
        <div class="login-actions">
          <button class="button primary compact" type="submit">Demo prijava</button>
          <button class="button secondary compact" type="button" data-action="sipass-login">SI-PASS prijava</button>
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
        <button class="button primary" type="button" data-action="vote" data-id="${initiative.id}" ${voted ? "disabled" : ""}>
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
    const admin = this.isAdminUser(user);
    return `
      <div class="signed-user" aria-label="Prijavljen uporabnik">
        <span>${escapeHtml(user.name)}</span>
        <small>${escapeHtml(admin ? "Demo admin" : user.provider === "demo" ? "Demo identiteta" : user.provider || "Uporabnik")}</small>
        ${admin ? "" : `<button class="button secondary compact" type="button" data-action="demo-admin-login">Demo admin</button>`}
        <button class="button secondary compact" type="button" data-action="logout">Odjava</button>
      </div>
    `;
  }

  navButton(view, label, number) {
    const active = this.state.activeView === view ? "active" : "";
    return `
      <button class="nav-button ${active}" type="button" data-action="view" data-view="${view}" ${
        active ? 'aria-current="page"' : ""
      }>
        <span aria-hidden="true">${number}</span>
        ${label}
      </button>
    `;
  }

  metric(label, value, hint) {
    return `
      <div class="metric-card" role="group" aria-label="${escapeAttribute(`${label}: ${value}. ${hint}`)}">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
        <small>${escapeHtml(hint)}</small>
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
    const id = this.fieldId(name);
    return `
      <label class="field" for="${id}">
        <span>${label}</span>
        <input id="${id}" name="${name}" data-draft="${name}" value="${escapeAttribute(this.state.draft[name])}" placeholder="${escapeAttribute(placeholder)}" ${this.fieldAriaAttributes(name)} />
        ${this.error(name)}
      </label>
    `;
  }

  textarea(name, label, rows) {
    const id = this.fieldId(name);
    return `
      <label class="field" for="${id}">
        <span>${label}</span>
        <textarea id="${id}" name="${name}" data-draft="${name}" rows="${rows}" ${this.fieldAriaAttributes(name)}>${escapeHtml(this.state.draft[name])}</textarea>
        ${this.error(name)}
      </label>
    `;
  }

  error(name) {
    return this.state.errors[name]
      ? `<small id="${this.fieldErrorId(name)}" class="field-error" role="alert">${escapeHtml(this.state.errors[name])}</small>`
      : "";
  }

  fieldId(name) {
    return `field-${name}`;
  }

  fieldErrorId(name) {
    return `${this.fieldId(name)}-error`;
  }

  fieldAriaAttributes(name) {
    return this.state.errors[name]
      ? `aria-invalid="true" aria-describedby="${this.fieldErrorId(name)}"`
      : 'aria-invalid="false"';
  }

  renderSecurityGate(action) {
    if (!isTurnstileEnabled(this.config)) return "";

    return `
      <div class="security-gate" role="group" aria-label="Varnostno preverjanje">
        <div data-turnstile-widget data-turnstile-action="${escapeAttribute(action)}"></div>
        ${this.state.turnstileError ? `<small class="field-error" role="alert">${escapeHtml(this.state.turnstileError)}</small>` : ""}
      </div>
    `;
  }

  pageTitle() {
    return {
      dashboard: "Pregled pobud",
      submit: "Oddaja nove pobude",
      analytics: "Analitika pobud",
      integrations: "Nastavitve integracij",
      systemAnalytics: "Sistemska analitika",
      accessibility: "Izjava o dostopnosti"
    }[this.state.activeView];
  }

  handleGlobalKeydown(event) {
    if (event.key !== "Escape" || !this.state.sidebarOpen || !isSmallViewport()) return;
    this.state.sidebarOpen = false;
    this.render();
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
      this.requestMainFocus();
      if (isSmallViewport()) {
        this.state.sidebarOpen = false;
      }
      trackClarityEvent(`view_${this.state.activeView}`);
      setClarityTag("app_view", this.state.activeView);
      trackVercelEvent("ViewChanged", { view: this.state.activeView });
      if (this.state.activeView === "systemAnalytics") {
        await this.loadSystemTelemetry();
        await this.loadClarityInsights();
      }
      if (this.state.activeView === "analytics") {
        await this.loadClarityInsights();
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

    if (action === "close-detail") {
      this.state.selectedId = null;
      this.render();
      return;
    }

    if (action === "refresh") {
      await this.refresh();
      if (this.state.activeView === "analytics") {
        await this.loadClarityInsights({ force: true });
      }
      return;
    }

    if (action === "refresh-clarity-insights") {
      await this.loadClarityInsights({ force: true });
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
      this.resetSecurityGate();
      this.render();
      return;
    }

    if (action === "reset-accessibility") {
      this.resetAccessibilityPreferences();
      return;
    }

    if (action === "ai-preview") {
      trackClarityEvent("ai_preview_requested");
      await this.updateRemoteAiPreview();
      return;
    }

    const exportAction = INITIATIVE_EXPORT_ACTIONS[action];
    if (exportAction) {
      const initiative = this.findInitiativeForAction(target.dataset.id);
      if (!initiative) {
        this.toast("Pobuda ne obstaja.");
        this.render();
        return;
      }

      if (!canExportInitiative(initiative)) {
        this.toast(exportStatusHint(initiative));
        this.render();
        return;
      }

      if (action === "print-pdf") {
        const opened = openInitiativePrintExport(initiative, this.currentUser());
        if (!opened) {
          this.toast("Brskalnik je blokiral okno za tiskanje.");
          this.render();
          return;
        }
      } else if (action === "download-pdf") {
        downloadInitiativePdfExport(initiative, this.currentUser());
      } else if (action === "download-docx") {
        downloadInitiativeDocxExport(initiative, this.currentUser());
      } else {
        downloadInitiativeOdtExport(initiative, this.currentUser());
      }

      this.recordSystemEvent(exportAction.systemEvent, {
        initiativeId: initiative.id,
        status: initiative.status,
        signatureCount: initiative.signatures.length,
        voteCount: initiative.votes.length
      });
      trackClarityEvent(exportAction.clarityEvent);
      trackVercelEvent(exportAction.vercelEvent, {
        status: initiative.status,
        category: initiative.category
      });
      this.toast(exportAction.toast);
      this.render();
      return;
    }

    if (action === "logout") {
      if (this.currentUser()?.provider === "sipass" && this.config.AUTH_LOGOUT_ENDPOINT) {
        await fetch(this.config.AUTH_LOGOUT_ENDPOINT, {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json"
          }
        }).catch(() => {});
      }
      this.auth.signOut();
      this.state.status = "all";
      this.state.category = "all";
      if (this.state.activeView !== "dashboard") {
        this.setActiveView("dashboard", { replace: true });
      }
      this.toast("Odjavljeni ste.");
      this.scheduleRemoteSearch();
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
      this.scheduleRemoteSearch();
      return;
    }

    if (action === "sipass-login") {
      window.location.assign(this.sipassLoginUrl());
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
      this.scheduleRemoteSearch();
      return;
    }

    if (form.dataset.form === "initiative") {
      await this.withActor(async (actor) => {
        const validation = validateInitiative(this.state.draft);
        this.state.errors = validation.errors;
        if (!validation.valid) {
          this.resetSecurityGate();
          this.toast("Pobuda potrebuje nekaj popravkov.");
          this.render();
          return;
        }

        if (!(await this.verifySecurityGate(INITIATIVE_TURNSTILE_ACTION))) {
          this.render();
          return;
        }

        const review = await this.reviewInitiative(validation.values);
        const initiative = createInitiative(validation.values, actor, review);
        const existingInitiatives = this.state.initiatives;
        const savedInitiative = await this.repository.create(initiative);
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
        this.resetSecurityGate();
        this.state.query = "";
        this.state.category = "all";
        this.state.status = "all";
        this.state.searchResults = null;
        this.state.searchLoading = false;
        this.state.searchError = "";
        this.setActiveView("dashboard");
        this.state.selectedId = savedInitiative?.id || initiative.id;
        await this.refresh();
        this.state.selectedId = savedInitiative?.id || initiative.id;
        setClarityTag("initiative_category", initiative.category);
        trackClarityEvent("initiative_created");
        this.toast("Pobuda je oddana.");
        this.render();
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

  findInitiativeForAction(id) {
    return (
      this.state.initiatives.find((initiative) => initiative.id === id) ||
      (this.state.searchResults || []).find((initiative) => initiative.id === id) ||
      null
    );
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
      this.scheduleRemoteSearch();
    }
  }

  async handleChange(event) {
    const accessibilitySetting = event.target.dataset.accessibilitySetting;
    if (accessibilitySetting) {
      this.updateAccessibilityPreference(
        accessibilitySetting,
        event.target.type === "checkbox" ? event.target.checked : event.target.value
      );
      return;
    }

    const filterField = event.target.dataset.filter;
    if (filterField && filterField !== "query") {
      this.state[filterField] = event.target.value;
      this.scheduleRemoteSearch();
      return;
    }

    const statusId = event.target.dataset.statusId;
    if (statusId) {
      if (!this.currentUser()) {
        this.toast("Za spremembo statusa je potrebna prijava.");
        this.render();
        return;
      }

      if (!this.isAdminUser()) {
        this.toast("Status pobude lahko spremeni samo administrator.");
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

  updateAccessibilityPreference(setting, value) {
    const preferences = normalizeAccessibilityPreferences({
      ...this.state.accessibilityPreferences,
      [setting]: value
    });
    this.state.accessibilityPreferences = preferences;
    writeAccessibilityPreferences(preferences);
    applyAccessibilityPreferences(preferences);
    this.toast("Nastavitve prikaza so posodobljene.");
    this.render();
  }

  resetAccessibilityPreferences() {
    const preferences = normalizeAccessibilityPreferences();
    this.state.accessibilityPreferences = preferences;
    writeAccessibilityPreferences(preferences);
    applyAccessibilityPreferences(preferences);
    this.toast("Nastavitve prikaza so ponastavljene.");
    this.render();
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

  sipassLoginUrl() {
    const fallback = "https://auth.demokracija-20.si/auth/sipass/login";
    try {
      const loginUrl = new URL(this.config.SIPASS_LOGIN_URL || fallback, window.location.origin);
      loginUrl.searchParams.set("returnTo", window.location.href);
      return loginUrl.toString();
    } catch {
      return fallback;
    }
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
      values?.expectedImpact,
      values?.legislativeText,
      values?.articleExplanation,
      values?.financialImpact,
      values?.budgetFunding,
      values?.comparativeReview,
      values?.impactAssessment,
      values?.publicParticipation,
      values?.proposerRepresentatives,
      values?.affectedProvisions
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

  syncSecurityWidgets() {
    if (this.state.activeView !== "submit" || !isTurnstileEnabled(this.config)) return;

    const container = this.root.querySelector("[data-turnstile-widget]");
    if (!container) return;

    renderTurnstileWidget(container, {
      siteKey: this.config.TURNSTILE_SITE_KEY,
      action: container.dataset.turnstileAction || INITIATIVE_TURNSTILE_ACTION,
      callback: (token) => {
        this.state.turnstileToken = token;
        this.state.turnstileError = "";
      },
      expiredCallback: () => {
        this.state.turnstileToken = "";
      },
      errorCallback: () => {
        this.state.turnstileToken = "";
        this.state.turnstileError = "Varnostno preverjanje ni uspelo.";
      }
    })
      .then((widgetId) => {
        if (widgetId) this.state.turnstileWidgetId = widgetId;
      })
      .catch((error) => {
        this.reportError("Cloudflare Turnstile loader", error);
        this.state.turnstileError = "Varnostno preverjanje ni dosegljivo.";
      });
  }

  async verifySecurityGate(action) {
    if (!isTurnstileEnabled(this.config)) return true;

    if (!this.state.turnstileToken) {
      this.state.turnstileError = "Potrdite varnostno preverjanje.";
      this.toast("Varnostno preverjanje je potrebno.");
      return false;
    }

    this.state.turnstileVerifying = true;
    try {
      const result = await validateTurnstileToken({
        endpoint: this.config.TURNSTILE_ENDPOINT,
        token: this.state.turnstileToken,
        action
      });

      this.recordSystemEvent("security_check", {
        provider: result.provider || "cloudflare_turnstile",
        action,
        passed: result.verified === true,
        configured: result.configured === true
      });

      if (result.verified) return true;

      const message = result.error || "Varnostno preverjanje ni uspelo.";
      this.resetSecurityGate();
      this.state.turnstileError = message;
      this.toast("Varnostno preverjanje ni uspelo.");
      return false;
    } catch (error) {
      this.reportError("Cloudflare Turnstile verification", error);
      this.recordSystemEvent("security_check", {
        provider: "cloudflare_turnstile",
        action,
        passed: false,
        configured: true
      });
      const message = "Varnostno preverjanje ni dosegljivo.";
      this.resetSecurityGate();
      this.state.turnstileError = message;
      this.toast("Varnostno preverjanje ni dosegljivo.");
      return false;
    } finally {
      this.state.turnstileVerifying = false;
    }
  }

  resetSecurityGate() {
    resetTurnstileWidget(this.state.turnstileWidgetId);
    this.state.turnstileToken = "";
    this.state.turnstileWidgetId = "";
    this.state.turnstileError = "";
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

  async loadClarityInsights(options = {}) {
    if (!this.currentUser()) return;
    if (this.state.clarityInsights && !options.force) return;

    this.state.clarityInsightsLoading = true;
    this.state.clarityInsightsError = "";
    this.render();
    try {
      this.state.clarityInsights = await this.clarityInsightsClient.read({ days: 1 });
      this.state.clarityInsightsError = this.state.clarityInsights?.error || "";
    } catch (error) {
      this.state.clarityInsightsError = error.message || "Clarity grafov ni bilo mogoce naloziti.";
      this.state.clarityInsights = null;
    } finally {
      this.state.clarityInsightsLoading = false;
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
    setVercelSpeedInsightsRoute(this.speedInsightsRoute());
  }

  handleRouteChange() {
    this.state.activeView = initialView(this.currentUser());
    setVercelSpeedInsightsRoute(this.speedInsightsRoute());
    this.requestMainFocus();
    this.render();
  }

  speedInsightsRoute() {
    if (typeof window === "undefined") return this.state.activeView;
    return `${window.location.pathname}?view=${this.state.activeView}`;
  }
}

function emptyDraft() {
  return {
    title: "",
    category: "",
    summary: "",
    description: "",
    legalReference: "",
    expectedImpact: "",
    legislativeText: "",
    articleExplanation: "",
    financialImpact: "",
    budgetFunding: "",
    comparativeReview: "",
    impactAssessment: "",
    publicParticipation: "",
    proposerRepresentatives: "",
    affectedProvisions: ""
  };
}

function normalizeAccessibilityPreferences(value = {}) {
  const textSize = ["normal", "large", "xlarge"].includes(value.textSize)
    ? value.textSize
    : ACCESSIBILITY_DEFAULTS.textSize;
  const contrast = ["default", "high", "dark"].includes(value.contrast)
    ? value.contrast
    : ACCESSIBILITY_DEFAULTS.contrast;
  const spacing = ["normal", "wide"].includes(value.spacing)
    ? value.spacing
    : ACCESSIBILITY_DEFAULTS.spacing;
  const motion = ["system", "reduce"].includes(value.motion)
    ? value.motion
    : ACCESSIBILITY_DEFAULTS.motion;
  const targetSize = ["default", "large"].includes(value.targetSize)
    ? value.targetSize
    : ACCESSIBILITY_DEFAULTS.targetSize;

  return {
    textSize,
    contrast,
    spacing,
    motion,
    targetSize,
    readableFont: value.readableFont === true
  };
}

function readAccessibilityPreferences() {
  if (typeof localStorage === "undefined") return normalizeAccessibilityPreferences();

  try {
    const raw = localStorage.getItem(ACCESSIBILITY_STORAGE_KEY);
    return normalizeAccessibilityPreferences(raw ? JSON.parse(raw) : {});
  } catch {
    return normalizeAccessibilityPreferences();
  }
}

function writeAccessibilityPreferences(preferences) {
  if (typeof localStorage === "undefined") return;

  try {
    localStorage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify(normalizeAccessibilityPreferences(preferences)));
  } catch {
    // The active session still uses the selected preferences when storage is blocked.
  }
}

function applyAccessibilityPreferences(preferences) {
  if (typeof document === "undefined") return;

  const normalized = normalizeAccessibilityPreferences(preferences);
  const root = document.documentElement;
  root.dataset.a11yText = normalized.textSize;
  root.dataset.a11yContrast = normalized.contrast;
  root.dataset.a11ySpacing = normalized.spacing;
  root.dataset.a11yMotion = normalized.motion;
  root.dataset.a11yTarget = normalized.targetSize;
  root.dataset.a11yFont = normalized.readableFont ? "readable" : "default";
}

function defaultSidebarOpen() {
  return !isSmallViewport();
}

function isSmallViewport() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 1024px)").matches
  );
}

function initialView(user) {
  if (typeof window === "undefined") return "dashboard";
  return normalizeView(new URL(window.location.href).searchParams.get("view"), user);
}

function normalizeView(view, user) {
  const value = APP_VIEWS.includes(view) ? view : "dashboard";
  if (value === "integrations" && !isDemoAdminUser(user)) return "dashboard";
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
  if (!user) return false;
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

function canExportInitiative(initiative) {
  return EXPORTABLE_INITIATIVE_STATUSES.includes(initiative?.status);
}

function exportStatusHint(initiative) {
  return `Izvoz za DZ je omogocen pri statusih ${statusLabel("signature_collection")} in ${statusLabel("submitted")}. Trenutni status: ${statusLabel(initiative?.status)}.`;
}

function openInitiativePrintExport(initiative, user) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return false;

  printWindow.opener = null;
  printWindow.document.open();
  printWindow.document.write(initiativePdfHtml(initiative, user));
  printWindow.document.close();
  printWindow.focus();

  window.setTimeout(() => {
    try {
      printWindow.focus();
      printWindow.print();
    } catch {
      // The export window remains open even if the browser blocks automatic printing.
    }
  }, 350);

  return true;
}

function downloadInitiativePdfExport(initiative, user) {
  const blob = buildInitiativePdfBlob(initiative, user);
  triggerBlobDownload(blob, `${pdfFileName(initiative)}.pdf`);
}

function downloadInitiativeDocxExport(initiative, user) {
  const blob = buildInitiativeDocxBlob(initiative, user);
  triggerBlobDownload(blob, initiativeDocxFileName(initiative));
}

function downloadInitiativeOdtExport(initiative, user) {
  const blob = buildInitiativeOdtBlob(initiative, user);
  triggerBlobDownload(blob, initiativeOdtFileName(initiative));
}

function triggerBlobDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const PDF_PAGE_WIDTH = 595;
const PDF_PAGE_HEIGHT = 842;
const PDF_MARGIN = 51;
const PDF_BOTTOM_MARGIN = 51;
const PDF_CONTENT_WIDTH = PDF_PAGE_WIDTH - PDF_MARGIN * 2;
const PDF_COLORS = {
  text: [0.067, 0.094, 0.153],
  muted: [0.294, 0.333, 0.388],
  green: [0.059, 0.463, 0.431],
  line: [0.82, 0.835, 0.859],
  tableHeader: [0.953, 0.956, 0.965],
  summaryBg: [0.925, 0.992, 0.961],
  summaryBorder: [0.6, 0.965, 0.894],
  white: [1, 1, 1]
};

function buildInitiativePdfBlob(initiative, user) {
  const pages = renderInitiativePdfPages(initiative, user);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"
  ];
  const pageRefs = [];

  for (const page of pages) {
    const content = page.join("");
    const contentObjectNumber = objects.length + 1;
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const pageObjectNumber = objects.length + 1;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`);
    pageRefs.push(`${pageObjectNumber} 0 R`);
  }

  objects[1] = `<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${pageRefs.length} >>`;

  let pdf = "%PDF-1.4\n%\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

function pdfSafeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapePdfString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function renderInitiativePdfPages(initiative, user) {
  const review = initiative.aiReview || { score: 0, risk: "low", findings: [], checks: {} };
  const generatedAt = new Date().toISOString();
  const renderer = createPdfRenderer();

  pdfRenderHeader(renderer, generatedAt);
  pdfRenderSectionTitle(renderer, "Identifikacija pobude");
  pdfRenderKeyValueTable(renderer, [
    ["ID pobude", initiative.id],
    ["Naslov", initiative.title],
    ["Kategorija", initiative.category],
    ["Status", statusLabel(initiative.status)],
    ["Avtor", `${initiative.author?.name || ""} (${initiative.author?.id || ""})`],
    ["Ustvarjeno", formatDate(initiative.createdAt)],
    ["Zadnja posodobitev", formatDate(initiative.updatedAt)]
  ]);

  pdfRenderSectionTitle(renderer, "Kratek povzetek");
  pdfRenderSummaryBox(renderer, initiative.summary);

  pdfRenderSectionTitle(renderer, "Uvod predloga zakona");
  pdfRenderKeyValueTable(renderer, [
    ["Pravna podlaga", initiative.legalReference || "Ni navedena."],
    ["Ocena stanja in razlogi", initiative.description || "Ni navedeno."],
    ["Cilji, nacela in poglavitne resitve", initiative.expectedImpact || "Ni navedeno."],
    ["Financne posledice", initiative.financialImpact || "Ni navedeno."],
    ["Zagotovitev sredstev", initiative.budgetFunding || "Ni navedeno."],
    ["Primerjalni prikaz in pravo EU", initiative.comparativeReview || "Ni navedeno."],
    ["Presoja posledic", initiative.impactAssessment || "Ni navedeno."],
    ["Sodelovanje javnosti", initiative.publicParticipation || "Ni navedeno."],
    ["Predstavniki predlagatelja", initiative.proposerRepresentatives || "Ni navedeno."]
  ]);

  pdfRenderSectionTitle(renderer, "Besedilo clenov");
  pdfRenderParagraph(renderer, initiative.legislativeText || "Ni navedeno.", { bottomGap: 8 });

  pdfRenderSectionTitle(renderer, "Obrazlozitev clenov");
  pdfRenderParagraph(renderer, initiative.articleExplanation || "Ni navedena.", { bottomGap: 8 });

  pdfRenderSectionTitle(renderer, "Dolocbe, ki se spreminjajo");
  pdfRenderParagraph(renderer, initiative.affectedProvisions || "Ni sprememb obstojecega zakona oziroma ni navedeno.", {
    bottomGap: 8
  });

  pdfRenderSectionTitle(renderer, "Podpora in evidenca");
  pdfRenderKeyValueTable(renderer, [
    ["Glasovi", String(initiative.votes.length)],
    ["Podpisi", String(initiative.signatures.length)],
    ["Komentarji", String(initiative.comments.length)],
    ["AI ocena", `${review.score || 0}% - ${riskLabel(review.risk)}`]
  ]);

  if (initiative.signatures.length) {
    pdfRenderGridTable(
      renderer,
      ["Podpisnik", "Identifikator", "Metoda", "Datum"],
      initiative.signatures.map((signature) => [
        signature.userName,
        signature.userId,
        signature.method || "demo",
        formatDate(signature.createdAt)
      ]),
      [130, 165, 80, 118]
    );
  } else {
    pdfRenderParagraph(renderer, "Podpisi niso evidentirani.", { color: PDF_COLORS.muted, size: 9.5, bottomGap: 6 });
  }

  pdfRenderSectionTitle(renderer, "AI predpregled");
  pdfRenderKeyValueTable(renderer, [
    ["Ustreznost", suitabilityLabel(review.checks?.suitability || "insufficient")],
    ["Popolnost", `${review.checks?.completeness?.score ?? 0}%`],
    ["Predlagana kategorija", review.checks?.categorySuggestion?.category || "Ni predloga"]
  ]);

  if ((review.findings || []).length) {
    pdfRenderList(renderer, review.findings);
  } else {
    pdfRenderParagraph(renderer, "Ni ugotovitev.", { color: PDF_COLORS.muted, size: 9.5, bottomGap: 6 });
  }

  pdfRenderSectionTitle(renderer, "Potrditev priprave");
  pdfRenderKeyValueTable(renderer, [
    ["Izvoz pripravil", user?.name || user?.id || "Uporabnik"],
    ["Namen izvoza", "Oddaja predloga zakona v zakonodajni postopek."]
  ]);
  pdfRenderSignatureLine(renderer);
  pdfRenderFooter(renderer);

  return renderer.pages;
}

function createPdfRenderer() {
  return {
    pages: [[]],
    y: PDF_PAGE_HEIGHT - PDF_MARGIN
  };
}

function pdfRenderHeader(renderer, generatedAt) {
  pdfDrawText(renderer, "Demokracija 2.0", PDF_MARGIN, renderer.y - 9, {
    size: 9,
    bold: true,
    color: PDF_COLORS.green
  });
  renderer.y -= 16;
  pdfRenderParagraph(renderer, "Izvoz predloga zakona za DZ", {
    size: 22,
    lineHeight: 25,
    bold: true,
    bottomGap: 2
  });
  pdfRenderParagraph(renderer, `Izvoz ustvarjen: ${formatDate(generatedAt)}`, {
    size: 9,
    lineHeight: 12,
    color: PDF_COLORS.muted,
    bottomGap: 10
  });
  pdfStrokeLine(renderer, PDF_MARGIN, renderer.y, PDF_MARGIN + PDF_CONTENT_WIDTH, renderer.y, PDF_COLORS.green, 2);
  renderer.y -= 18;
}

function pdfRenderSectionTitle(renderer, title) {
  const topGap = renderer.y < PDF_PAGE_HEIGHT - PDF_MARGIN ? 14 : 0;
  pdfEnsureSpace(renderer, topGap + 30);
  renderer.y -= topGap;
  pdfDrawText(renderer, title, PDF_MARGIN, renderer.y - 13, { size: 13, bold: true });
  renderer.y -= 18;
  pdfStrokeLine(renderer, PDF_MARGIN, renderer.y, PDF_MARGIN + PDF_CONTENT_WIDTH, renderer.y, PDF_COLORS.line, 0.75);
  renderer.y -= 8;
}

function pdfRenderSummaryBox(renderer, text) {
  const paddingX = 12;
  const paddingY = 10;
  const lines = pdfWrappedLines(text, PDF_CONTENT_WIDTH - paddingX * 2, 10.5);
  const lineHeight = 15;
  const height = paddingY * 2 + Math.max(1, lines.length) * lineHeight;
  pdfEnsureSpace(renderer, height + 12);
  const top = renderer.y;
  const bottom = top - height;
  pdfFillRect(renderer, PDF_MARGIN, bottom, PDF_CONTENT_WIDTH, height, PDF_COLORS.summaryBg);
  pdfStrokeRect(renderer, PDF_MARGIN, bottom, PDF_CONTENT_WIDTH, height, PDF_COLORS.summaryBorder, 0.75);
  pdfDrawWrappedLines(renderer, lines, PDF_MARGIN + paddingX, top - paddingY, {
    size: 10.5,
    lineHeight,
    maxY: bottom + paddingY
  });
  renderer.y = bottom - 12;
}

function pdfRenderKeyValueTable(renderer, rows) {
  const labelWidth = 158;
  const valueWidth = PDF_CONTENT_WIDTH - labelWidth;

  for (const [label, value] of rows) {
    const labelLines = pdfWrappedLines(label, labelWidth - 16, 10);
    const valueLines = pdfWrappedLines(value, valueWidth - 16, 10);
    const lineCount = Math.max(labelLines.length, valueLines.length, 1);
    const rowHeight = lineCount * 14 + 14;
    pdfEnsureSpace(renderer, rowHeight);
    const top = renderer.y;
    const bottom = top - rowHeight;
    pdfFillRect(renderer, PDF_MARGIN, bottom, labelWidth, rowHeight, PDF_COLORS.tableHeader);
    pdfStrokeRect(renderer, PDF_MARGIN, bottom, PDF_CONTENT_WIDTH, rowHeight, PDF_COLORS.line, 0.75);
    pdfStrokeLine(renderer, PDF_MARGIN + labelWidth, bottom, PDF_MARGIN + labelWidth, top, PDF_COLORS.line, 0.75);
    pdfDrawWrappedLines(renderer, labelLines, PDF_MARGIN + 8, top - 8, {
      size: 10,
      lineHeight: 14,
      bold: true,
      maxY: bottom + 7
    });
    pdfDrawWrappedLines(renderer, valueLines, PDF_MARGIN + labelWidth + 8, top - 8, {
      size: 10,
      lineHeight: 14,
      maxY: bottom + 7
    });
    renderer.y = bottom;
  }

  renderer.y -= 8;
}

function pdfRenderGridTable(renderer, headers, rows, columnWidths) {
  pdfRenderGridRow(renderer, headers, columnWidths, true);
  for (const row of rows) {
    pdfRenderGridRow(renderer, row, columnWidths, false);
  }
  renderer.y -= 8;
}

function pdfRenderGridRow(renderer, cells, columnWidths, header = false) {
  const size = header ? 9.5 : 9;
  const lineHeight = 13;
  const padding = 7;
  const wrappedCells = cells.map((cell, index) => pdfWrappedLines(cell, columnWidths[index] - padding * 2, size));
  const rowHeight = Math.max(...wrappedCells.map((lines) => Math.max(1, lines.length))) * lineHeight + padding * 2;
  pdfEnsureSpace(renderer, rowHeight);
  const top = renderer.y;
  const bottom = top - rowHeight;
  let x = PDF_MARGIN;

  if (header) {
    pdfFillRect(renderer, PDF_MARGIN, bottom, PDF_CONTENT_WIDTH, rowHeight, PDF_COLORS.tableHeader);
  }

  pdfStrokeRect(renderer, PDF_MARGIN, bottom, PDF_CONTENT_WIDTH, rowHeight, PDF_COLORS.line, 0.75);
  for (let index = 0; index < cells.length; index += 1) {
    if (index > 0) {
      pdfStrokeLine(renderer, x, bottom, x, top, PDF_COLORS.line, 0.75);
    }
    pdfDrawWrappedLines(renderer, wrappedCells[index], x + padding, top - padding, {
      size,
      lineHeight,
      bold: header,
      maxY: bottom + padding
    });
    x += columnWidths[index];
  }
  renderer.y = bottom;
}

function pdfRenderParagraph(renderer, text, options = {}) {
  const size = options.size || 10;
  const lineHeight = options.lineHeight || Math.round(size * 1.45);
  const lines = pdfWrappedLines(text, options.width || PDF_CONTENT_WIDTH, size);
  const x = options.x || PDF_MARGIN;

  for (const line of lines.length ? lines : [""]) {
    pdfEnsureSpace(renderer, lineHeight);
    pdfDrawText(renderer, line, x, renderer.y - size, options);
    renderer.y -= lineHeight;
  }

  renderer.y -= options.bottomGap ?? 0;
}

function pdfRenderList(renderer, items) {
  for (const item of items) {
    pdfRenderParagraph(renderer, `- ${item}`, { bottomGap: 1 });
  }
  renderer.y -= 5;
}

function pdfRenderSignatureLine(renderer) {
  pdfEnsureSpace(renderer, 62);
  const lineY = renderer.y - 28;
  pdfStrokeLine(renderer, PDF_MARGIN, lineY, PDF_MARGIN + 220, lineY, PDF_COLORS.text, 0.75);
  pdfDrawText(renderer, "Podpis odgovorne osebe", PDF_MARGIN, lineY - 15, { size: 9.5 });
  renderer.y -= 62;
}

function pdfRenderFooter(renderer) {
  pdfEnsureSpace(renderer, 72);
  pdfStrokeLine(renderer, PDF_MARGIN, renderer.y, PDF_MARGIN + PDF_CONTENT_WIDTH, renderer.y, PDF_COLORS.line, 0.75);
  renderer.y -= 12;
  pdfRenderParagraph(renderer, LEGAL_COMPLIANCE_CERTIFICATE, {
    size: 9,
    lineHeight: 12,
    color: PDF_COLORS.text,
    bold: true,
    bottomGap: 3
  });
  pdfRenderParagraph(
    renderer,
    "Dokument je ustvarjen iz podatkov aplikacije Demokracija 2.0. Za uradno oddajo preverite aktualna pravila in zahtevane priloge Drzavnega zbora.",
    { size: 9, lineHeight: 12, color: PDF_COLORS.muted }
  );
}

function pdfDrawWrappedLines(renderer, lines, x, top, options = {}) {
  const size = options.size || 10;
  const lineHeight = options.lineHeight || Math.round(size * 1.45);
  let y = top;

  for (const line of lines.length ? lines : [""]) {
    if (y - size < options.maxY) break;
    pdfDrawText(renderer, line, x, y - size, options);
    y -= lineHeight;
  }
}

function pdfEnsureSpace(renderer, height) {
  if (renderer.y - height >= PDF_BOTTOM_MARGIN) return;
  renderer.pages.push([]);
  renderer.y = PDF_PAGE_HEIGHT - PDF_MARGIN;
}

function pdfWrappedLines(value, width, size) {
  const maxChars = Math.max(12, Math.floor(width / (size * 0.52)));
  const output = [];
  const paragraphs = String(value ?? "").split(/\n+/);

  for (const paragraph of paragraphs) {
    const words = pdfSafeText(paragraph).split(/\s+/).filter(Boolean);
    let line = "";

    for (const word of words) {
      const parts = word.length > maxChars ? pdfSplitLongWord(word, maxChars) : [word];
      for (const part of parts) {
        const next = line ? `${line} ${part}` : part;
        if (next.length > maxChars && line) {
          output.push(line);
          line = part;
        } else {
          line = next;
        }
      }
    }

    if (line) output.push(line);
  }

  return output;
}

function pdfSplitLongWord(word, maxChars) {
  const parts = [];
  for (let index = 0; index < word.length; index += maxChars) {
    parts.push(word.slice(index, index + maxChars));
  }
  return parts;
}

function pdfDrawText(renderer, text, x, y, options = {}) {
  const font = options.bold ? "F2" : "F1";
  const size = options.size || 10;
  const color = pdfColor(options.color || PDF_COLORS.text, "rg");
  renderer.pages[renderer.pages.length - 1].push(
    `BT\n${color}\n/${font} ${pdfNum(size)} Tf\n1 0 0 1 ${pdfNum(x)} ${pdfNum(y)} Tm\n(${escapePdfString(pdfSafeText(text))}) Tj\nET\n`
  );
}

function pdfFillRect(renderer, x, y, width, height, color) {
  renderer.pages[renderer.pages.length - 1].push(
    `q\n${pdfColor(color, "rg")}\n${pdfNum(x)} ${pdfNum(y)} ${pdfNum(width)} ${pdfNum(height)} re f\nQ\n`
  );
}

function pdfStrokeRect(renderer, x, y, width, height, color, strokeWidth = 1) {
  renderer.pages[renderer.pages.length - 1].push(
    `q\n${pdfColor(color, "RG")}\n${pdfNum(strokeWidth)} w\n${pdfNum(x)} ${pdfNum(y)} ${pdfNum(width)} ${pdfNum(height)} re S\nQ\n`
  );
}

function pdfStrokeLine(renderer, x1, y1, x2, y2, color, strokeWidth = 1) {
  renderer.pages[renderer.pages.length - 1].push(
    `q\n${pdfColor(color, "RG")}\n${pdfNum(strokeWidth)} w\n${pdfNum(x1)} ${pdfNum(y1)} m ${pdfNum(x2)} ${pdfNum(y2)} l S\nQ\n`
  );
}

function pdfColor(color, operator) {
  return `${color.map((value) => pdfNum(value)).join(" ")} ${operator}`;
}

function pdfNum(value) {
  return Number(value).toFixed(3).replace(/\.?0+$/, "");
}

function initiativePdfHtml(initiative, user) {
  const review = initiative.aiReview || { score: 0, risk: "low", findings: [], checks: {} };
  const generatedAt = new Date().toISOString();

  return `<!doctype html>
<html lang="sl">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(pdfDocumentTitle(initiative))}</title>
  <style>
    @page { size: A4; margin: 18mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #111827;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11pt;
      line-height: 1.45;
    }
    header {
      border-bottom: 2px solid #0f766e;
      margin-bottom: 18px;
      padding-bottom: 14px;
    }
    h1 {
      margin: 4px 0 8px;
      font-size: 22pt;
      line-height: 1.15;
    }
    h2 {
      border-bottom: 1px solid #d1d5db;
      font-size: 13pt;
      margin: 22px 0 8px;
      padding-bottom: 4px;
    }
    p { margin: 0 0 9px; }
    table {
      border-collapse: collapse;
      margin: 8px 0 12px;
      width: 100%;
    }
    th, td {
      border: 1px solid #d1d5db;
      padding: 7px 8px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #f3f4f6;
      font-weight: 700;
      width: 32%;
    }
    .eyebrow {
      color: #0f766e;
      font-size: 9pt;
      font-weight: 700;
      letter-spacing: 0.06em;
      margin: 0;
      text-transform: uppercase;
    }
    .summary {
      background: #ecfdf5;
      border: 1px solid #99f6e4;
      border-radius: 6px;
      margin: 12px 0 16px;
      padding: 10px 12px;
    }
    .text-block {
      white-space: pre-wrap;
    }
    .muted {
      color: #4b5563;
      font-size: 9.5pt;
    }
    .signature-line {
      border-top: 1px solid #111827;
      display: inline-block;
      margin-top: 28px;
      padding-top: 6px;
      width: 220px;
    }
    footer {
      border-top: 1px solid #d1d5db;
      color: #4b5563;
      font-size: 9pt;
      margin-top: 28px;
      padding-top: 10px;
    }
    .certificate {
      color: #111827;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <header>
    <p class="eyebrow">Demokracija 2.0</p>
    <h1>Izvoz predloga zakona za DZ</h1>
    <p class="muted">Izvoz ustvarjen: ${escapeHtml(formatDate(generatedAt))}</p>
  </header>

  <section>
    <h2>Identifikacija pobude</h2>
    <table>
      <tr><th>ID pobude</th><td>${escapeHtml(initiative.id)}</td></tr>
      <tr><th>Naslov</th><td>${escapeHtml(initiative.title)}</td></tr>
      <tr><th>Kategorija</th><td>${escapeHtml(initiative.category)}</td></tr>
      <tr><th>Status</th><td>${escapeHtml(statusLabel(initiative.status))}</td></tr>
      <tr><th>Avtor</th><td>${escapeHtml(initiative.author?.name || "")} (${escapeHtml(initiative.author?.id || "")})</td></tr>
      <tr><th>Ustvarjeno</th><td>${escapeHtml(formatDate(initiative.createdAt))}</td></tr>
      <tr><th>Zadnja posodobitev</th><td>${escapeHtml(formatDate(initiative.updatedAt))}</td></tr>
    </table>
  </section>

  <section>
    <h2>Kratek povzetek</h2>
    <p class="summary">${escapeHtml(initiative.summary)}</p>
  </section>

  <section>
    <h2>Uvod predloga zakona</h2>
    <table>
      <tr><th>Pravna podlaga</th><td class="text-block">${escapeHtml(initiative.legalReference || "Ni navedena.")}</td></tr>
      <tr><th>Ocena stanja in razlogi</th><td class="text-block">${escapeHtml(initiative.description || "Ni navedeno.")}</td></tr>
      <tr><th>Cilji, nacela in poglavitne resitve</th><td class="text-block">${escapeHtml(initiative.expectedImpact || "Ni navedeno.")}</td></tr>
      <tr><th>Financne posledice</th><td class="text-block">${escapeHtml(initiative.financialImpact || "Ni navedeno.")}</td></tr>
      <tr><th>Zagotovitev sredstev</th><td class="text-block">${escapeHtml(initiative.budgetFunding || "Ni navedeno.")}</td></tr>
      <tr><th>Primerjalni prikaz in pravo EU</th><td class="text-block">${escapeHtml(initiative.comparativeReview || "Ni navedeno.")}</td></tr>
      <tr><th>Presoja posledic</th><td class="text-block">${escapeHtml(initiative.impactAssessment || "Ni navedena.")}</td></tr>
      <tr><th>Sodelovanje javnosti</th><td class="text-block">${escapeHtml(initiative.publicParticipation || "Ni navedeno.")}</td></tr>
      <tr><th>Predstavniki predlagatelja</th><td class="text-block">${escapeHtml(initiative.proposerRepresentatives || "Ni navedeno.")}</td></tr>
    </table>
  </section>

  <section>
    <h2>Besedilo clenov</h2>
    <p class="text-block">${escapeHtml(initiative.legislativeText || "Ni navedeno.")}</p>
  </section>

  <section>
    <h2>Obrazlozitev clenov</h2>
    <p class="text-block">${escapeHtml(initiative.articleExplanation || "Ni navedena.")}</p>
  </section>

  <section>
    <h2>Dolocbe, ki se spreminjajo</h2>
    <p class="text-block">${escapeHtml(initiative.affectedProvisions || "Ni sprememb obstojecega zakona oziroma ni navedeno.")}</p>
  </section>

  <section>
    <h2>Podpora in evidenca</h2>
    <table>
      <tr><th>Glasovi</th><td>${initiative.votes.length}</td></tr>
      <tr><th>Podpisi</th><td>${initiative.signatures.length}</td></tr>
      <tr><th>Komentarji</th><td>${initiative.comments.length}</td></tr>
      <tr><th>AI ocena</th><td>${review.score || 0}% - ${escapeHtml(riskLabel(review.risk))}</td></tr>
    </table>
    ${initiative.signatures.length ? initiativeSignaturesTable(initiative.signatures) : `<p class="muted">Podpisi niso evidentirani.</p>`}
  </section>

  <section>
    <h2>AI predpregled</h2>
    <table>
      <tr><th>Ustreznost</th><td>${escapeHtml(suitabilityLabel(review.checks?.suitability || "insufficient"))}</td></tr>
      <tr><th>Popolnost</th><td>${escapeHtml(String(review.checks?.completeness?.score ?? 0))}%</td></tr>
      <tr><th>Predlagana kategorija</th><td>${escapeHtml(review.checks?.categorySuggestion?.category || "Ni predloga")}</td></tr>
    </table>
    <ul>
      ${(review.findings || []).map((finding) => `<li>${escapeHtml(finding)}</li>`).join("")}
    </ul>
  </section>

  <section>
    <h2>Potrditev priprave</h2>
    <table>
      <tr><th>Izvoz pripravil</th><td>${escapeHtml(user?.name || user?.id || "Uporabnik")}</td></tr>
      <tr><th>Namen izvoza</th><td>Oddaja predloga zakona v zakonodajni postopek.</td></tr>
    </table>
    <p><span class="signature-line">Podpis odgovorne osebe</span></p>
  </section>

  <footer>
    <p class="certificate">${escapeHtml(LEGAL_COMPLIANCE_CERTIFICATE)}</p>
    <p>Dokument je ustvarjen iz podatkov aplikacije Demokracija 2.0. Za uradno oddajo preverite aktualna pravila in zahtevane priloge Drzavnega zbora.</p>
  </footer>
</body>
</html>`;
}

function initiativeSignaturesTable(signatures) {
  return `
    <table>
      <thead>
        <tr>
          <th>Podpisnik</th>
          <th>Identifikator</th>
          <th>Metoda</th>
          <th>Datum</th>
        </tr>
      </thead>
      <tbody>
        ${signatures
          .map(
            (signature) => `
              <tr>
                <td>${escapeHtml(signature.userName)}</td>
                <td>${escapeHtml(signature.userId)}</td>
                <td>${escapeHtml(signature.method || "demo")}</td>
                <td>${escapeHtml(formatDate(signature.createdAt))}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function pdfDocumentTitle(initiative) {
  const title = String(initiative?.title || "pobuda")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return `Demos - ${title}`;
}

function pdfFileName(initiative) {
  const title = String(initiative?.title || "pobuda")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-zA-Z0-9._ -]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .toLowerCase()
    .slice(0, 80);

  return `demos-${title || "pobuda"}-dz-izvoz`;
}

function printIcon() {
  return `
    <svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M6 9V3h12v6"></path>
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
      <path d="M6 14h12v7H6z"></path>
    </svg>
  `;
}

function downloadIcon() {
  return `
    <svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3v11"></path>
      <path d="m7 10 5 5 5-5"></path>
      <path d="M5 20h14"></path>
    </svg>
  `;
}

function wordIcon() {
  return `
    <svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <path d="M14 2v6h6"></path>
      <path d="M8 13l1.2 4 1.3-4 1.3 4L13 13"></path>
      <path d="M15 17h1"></path>
    </svg>
  `;
}

function chevronDownIcon() {
  return `
    <svg class="button-icon chevron-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="m6 9 6 6 6-6"></path>
    </svg>
  `;
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

function formatClarityMetric(value, unit = "") {
  const number = Number(value) || 0;
  const formatted = Number.isInteger(number) ? String(number) : String(Math.round(number * 10) / 10);
  return unit ? `${formatted} ${unit}` : formatted;
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
  clarityInsightsClient: new ClarityInsightsClient({ endpoint: config.CLARITY_ANALYTICS_ENDPOINT }),
  config
});

app.init();
