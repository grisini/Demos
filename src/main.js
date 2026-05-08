import { config, isSupabaseEnabled } from "./config.js";
import { calculateAnalytics } from "./domain/analytics.js";
import {
  CATEGORIES,
  STATUSES,
  createInitiative,
  evaluateInitiative,
  riskLabel,
  statusLabel,
  validateInitiative
} from "./domain/validation.js";
import { DemoAuth } from "./lib/auth.js";
import { createRepository } from "./lib/supabase.js";

class DemocracyApp {
  constructor({ root, repository, auth, config: appConfig }) {
    this.root = root;
    this.repository = repository;
    this.auth = auth;
    this.config = appConfig;
    this.state = {
      initiatives: [],
      selectedId: null,
      activeView: "dashboard",
      query: "",
      category: "all",
      status: "all",
      sort: "popular",
      draft: emptyDraft(),
      errors: {},
      toast: "",
      loading: true
    };

    this.root.addEventListener("click", (event) => this.handleClick(event));
    this.root.addEventListener("submit", (event) => this.handleSubmit(event));
    this.root.addEventListener("input", (event) => this.handleInput(event));
    this.root.addEventListener("change", (event) => this.handleChange(event));
  }

  async init() {
    await this.refresh();
  }

  async refresh() {
    this.state.loading = true;
    this.render();
    try {
      this.state.initiatives = await this.repository.list();
      this.state.selectedId ||= this.state.initiatives[0]?.id || null;
      this.state.loading = false;
      this.render();
    } catch (error) {
      this.state.loading = false;
      this.toast(error.message || "Podatkov ni bilo mogoce naloziti.");
      this.render();
    }
  }

  currentUser() {
    return this.auth.currentUser();
  }

  filteredInitiatives() {
    const query = this.state.query.toLowerCase();
    const filtered = this.state.initiatives.filter((initiative) => {
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
      this.state.initiatives.find((initiative) => initiative.id === this.state.selectedId) ||
      this.filteredInitiatives()[0] ||
      null
    );
  }

  render() {
    const user = this.currentUser();
    const analytics = calculateAnalytics(this.state.initiatives);
    const selected = this.selectedInitiative();
    const dataMode = isSupabaseEnabled(this.config) ? "Supabase" : "Lokalni prototip";

    this.root.innerHTML = `
      <aside class="sidebar">
        <a class="brand" href="#" data-action="view" data-view="dashboard" aria-label="Demokracija 2.0">
          <span class="brand-mark" aria-hidden="true">D2</span>
          <span>
            <strong>Demokracija 2.0</strong>
            <small>${dataMode}</small>
          </span>
        </a>
        <nav class="nav-list" aria-label="Glavna navigacija">
          ${this.navButton("dashboard", "Pregled", "01")}
          ${this.navButton("submit", "Nova pobuda", "02")}
          ${this.navButton("analytics", "Analitika", "03")}
          ${this.navButton("integrations", "Integracije", "04")}
        </nav>
        <div class="user-panel">
          ${user ? this.renderUser(user) : this.renderLogin()}
        </div>
      </aside>

      <main class="content">
        <header class="topbar">
          <div>
            <p class="eyebrow">Projekt Demos</p>
            <h1>${this.pageTitle()}</h1>
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
  }

  renderView(analytics, selected) {
    if (this.state.activeView === "submit") return this.renderSubmitView();
    if (this.state.activeView === "analytics") return this.renderAnalyticsView(analytics);
    if (this.state.activeView === "integrations") return this.renderIntegrationsView();
    return this.renderDashboardView(analytics, selected);
  }

  renderDashboardView(analytics, selected) {
    const initiatives = this.filteredInitiatives();
    return `
      <section class="metric-grid" aria-label="Povzetek">
        ${this.metric("Pobude", analytics.initiativeCount, "Vse oddane pobude")}
        ${this.metric("Glasovi", analytics.totalVotes, "Podpora uporabnikov")}
        ${this.metric("Podpisi", analytics.totalSignatures, "Demo zbiranje podpisov")}
        ${this.metric("AI ocena", `${analytics.averageScore}%`, "Povprecje skladnosti")}
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
              <select data-filter="status">
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
                : `<div class="empty-state">Ni pobud za izbrane filtre.</div>`
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
    const review = evaluateInitiative(this.state.draft);
    return `
      <section class="submit-grid">
        <form class="panel form-panel" data-form="initiative">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Iteraciji 1-3</p>
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
          ${this.renderReviewContent(review)}
        </aside>
      </section>
    `;
  }

  renderAnalyticsView(analytics) {
    const maxCategory = Math.max(1, ...Object.values(analytics.byCategory));
    return `
      <section class="analytics-grid">
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
                    <strong>${item.count}</strong>
                  </div>
                `
              )
              .join("")}
          </div>
        </div>
        <div class="panel">
          <p class="eyebrow">Kategorije</p>
          <h2>Razporeditev</h2>
          <div class="category-grid">
            ${Object.entries(analytics.byCategory)
              .map(
                ([category, count]) => `
                  <div class="category-chip">
                    <span>${escapeHtml(category)}</span>
                    <strong>${count}</strong>
                    <div style="width:${(count / maxCategory) * 100}%"></div>
                  </div>
                `
              )
              .join("")}
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
      </section>
    `;
  }

  renderInitiativeCard(initiative) {
    const active = initiative.id === this.state.selectedId ? "active" : "";
    return `
      <article class="initiative-card ${active}">
        <button class="card-button" data-action="select" data-id="${initiative.id}">
          <span class="status-dot ${initiative.status}"></span>
          <span>
            <strong>${escapeHtml(initiative.title)}</strong>
            <small>${escapeHtml(initiative.category)} - ${statusLabel(initiative.status)}</small>
          </span>
          <span class="support-count">${initiative.votes.length + initiative.signatures.length}</span>
        </button>
      </article>
    `;
  }

  renderInitiativeDetail(initiative) {
    const user = this.currentUser();
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

  renderReviewContent(review) {
    return `
      <p class="eyebrow">AI predpregled</p>
      <div class="score-ring" style="--score: ${review.score}">
        <strong>${review.score}%</strong>
        <span>${riskLabel(review.risk)}</span>
      </div>
      <ul class="check-list">
        ${review.findings.map((finding) => `<li>${escapeHtml(finding)}</li>`).join("")}
      </ul>
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
        <button class="button primary compact" type="submit">Demo prijava</button>
      </form>
    `;
  }

  renderUser(user) {
    return `
      <div class="signed-user">
        <span>${escapeHtml(user.name)}</span>
        <small>${escapeHtml(user.provider === "demo" ? "Demo identiteta" : user.provider)}</small>
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
      analytics: "Statistika in analitika",
      integrations: "Nastavitve integracij"
    }[this.state.activeView];
  }

  async handleClick(event) {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;

    if (action === "view") {
      event.preventDefault();
      this.state.activeView = target.dataset.view;
      this.render();
      return;
    }

    if (action === "refresh") {
      await this.refresh();
      return;
    }

    if (action === "select") {
      this.state.selectedId = target.dataset.id;
      this.render();
      return;
    }

    if (action === "clear-draft") {
      this.state.draft = emptyDraft();
      this.state.errors = {};
      this.render();
      return;
    }

    if (action === "logout") {
      this.auth.signOut();
      this.toast("Odjavljeni ste.");
      this.render();
      return;
    }

    if (action === "sipass-placeholder") {
      this.toast("SI-PASS je pripravljen kot integracijski nastavek; za realen tok so potrebni registrirani testni podatki.");
      this.render();
      return;
    }

    if (action === "vote" || action === "sign") {
      await this.withActor(async (actor) => {
        const id = target.dataset.id;
        if (action === "vote") await this.repository.vote(id, actor);
        if (action === "sign") await this.repository.sign(id, actor, this.config.AUTH_MODE === "sipass" ? "sipass" : "demo");
        await this.refresh();
        this.toast(action === "vote" ? "Glas je zabelezen." : "Podpis je evidentiran.");
      });
    }
  }

  async handleSubmit(event) {
    const form = event.target.closest("[data-form]");
    if (!form) return;
    event.preventDefault();

    if (form.dataset.form === "login") {
      const data = Object.fromEntries(new FormData(form));
      this.auth.signIn(data);
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

        const initiative = createInitiative(validation.values, actor);
        await this.repository.create(initiative);
        this.state.draft = emptyDraft();
        this.state.errors = {};
        this.state.activeView = "dashboard";
        this.state.selectedId = initiative.id;
        await this.refresh();
        this.toast("Pobuda je oddana.");
      });
      return;
    }

    if (form.dataset.form === "comment") {
      await this.withActor(async (actor) => {
        const body = new FormData(form).get("body");
        await this.repository.comment(form.dataset.id, actor, body);
        await this.refresh();
        this.toast("Komentar je objavljen.");
      });
    }
  }

  handleInput(event) {
    const draftField = event.target.dataset.draft;
    const filterField = event.target.dataset.filter;

    if (draftField) {
      this.state.draft[draftField] = event.target.value;
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
      await this.repository.updateStatus(statusId, event.target.value);
      await this.refresh();
      this.toast("Status pobude je posodobljen.");
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
      this.toast(error.message || "Dejanje ni uspelo.");
      this.render();
    }
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
    panel.innerHTML = this.renderReviewContent(evaluateInitiative(this.state.draft));
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

function option(value, label, selected) {
  return `<option value="${escapeAttribute(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
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

const app = new DemocracyApp({
  root: document.querySelector("#app"),
  repository: createRepository(config),
  auth: new DemoAuth(),
  config
});

app.init();
