import { LocalInitiativeRepository } from "./storage.js";

export function createRepository(appConfig) {
  if (appConfig.DATA_SOURCE === "supabase" && appConfig.SUPABASE_URL && appConfig.SUPABASE_ANON_KEY) {
    return new SupabaseInitiativeRepository(appConfig);
  }

  return new LocalInitiativeRepository();
}

export class SupabaseInitiativeRepository {
  constructor(appConfig) {
    this.url = appConfig.SUPABASE_URL.replace(/\/$/, "");
    this.anonKey = appConfig.SUPABASE_ANON_KEY;
    this.initiativesEndpoint = String(appConfig.INITIATIVES_ENDPOINT || "/api/initiatives").replace(/\/$/, "");
  }

  async list() {
    const initiatives = await this.requestAll(
      "/rest/v1/initiatives?select=*&order=created_at.desc"
    );
    const ids = initiatives.map((initiative) => initiative.id);
    if (!ids.length) return [];

    const filter = `initiative_id=in.(${ids.join(",")})`;
    const [votes, signatures, comments] = await Promise.all([
      this.requestAll(`/rest/v1/votes?select=*&${filter}`),
      this.requestAll(`/rest/v1/signatures?select=*&${filter}`),
      this.requestAll(`/rest/v1/comments?select=*&${filter}&order=created_at.asc`)
    ]);

    return initiatives.map((row) => mapInitiative(row, votes, signatures, comments));
  }

  async search(options = {}) {
    const rows = await this.request("/rest/v1/rpc/search_initiatives", {
      method: "POST",
      body: JSON.stringify({
        p_query: options.query || "",
        p_category: filterValue(options.category),
        p_status: filterValue(options.status),
        p_public_only: options.publicOnly === true,
        p_sort: options.sort || "relevance",
        p_limit: options.limit || 50,
        p_offset: options.offset || 0
      })
    }) || [];

    const ids = rows.map((initiative) => initiative.id);
    if (!ids.length) return [];

    const filter = `initiative_id=in.(${ids.join(",")})`;
    const [votes, signatures, comments] = await Promise.all([
      this.requestAll(`/rest/v1/votes?select=*&${filter}`),
      this.requestAll(`/rest/v1/signatures?select=*&${filter}`),
      this.requestAll(`/rest/v1/comments?select=*&${filter}&order=created_at.asc`)
    ]);

    return rows.map((row) => ({
      ...mapInitiative(row, votes, signatures, comments),
      search: {
        score: Number(row.search_score) || 0,
        matchType: row.match_type || "unknown",
        textRank: Number(row.text_rank) || 0,
        fuzzyRank: Number(row.fuzzy_rank) || 0
      }
    }));
  }

  async create(initiative) {
    const payload = await this.backendRequest(this.initiativesEndpoint, {
      method: "POST",
      body: JSON.stringify({
        initiative,
        actor: initiative.author
      })
    });
    return payload.initiative;
  }

  async vote(id, actor) {
    await this.request("/rest/v1/votes", {
      method: "POST",
      body: JSON.stringify({
        initiative_id: id,
        voter_ref: actor.id,
        voter_name: actor.name
      })
    });
    return this.find(id);
  }

  async sign(id, actor, method = "demo") {
    await this.request("/rest/v1/signatures", {
      method: "POST",
      body: JSON.stringify({
        initiative_id: id,
        signer_ref: actor.id,
        signer_name: actor.name,
        method
      })
    });
    return this.find(id);
  }

  async comment(id, actor, body) {
    const payload = await this.backendRequest(this.initiativesEndpoint, {
      method: "POST",
      body: JSON.stringify({
        action: "comment",
        initiativeId: id,
        actor,
        body
      })
    });
    return payload.initiative;
  }

  async updateStatus(id, status, actor = null) {
    const payload = await this.backendRequest(this.initiativesEndpoint, {
      method: "PATCH",
      body: JSON.stringify({
        action: "status",
        initiativeId: id,
        actor,
        status
      })
    });
    return payload.initiative;
  }

  async find(id) {
    const initiatives = await this.list();
    const initiative = initiatives.find((item) => item.id === id);
    if (!initiative) throw new Error("Pobuda ne obstaja.");
    return initiative;
  }

  async request(path, options = {}) {
    const response = await fetch(`${this.url}${path}`, {
      ...options,
      headers: {
        apikey: this.anonKey,
        Authorization: `Bearer ${this.anonKey}`,
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      const rawMessage = await response.text();
      const error = new Error(`Supabase request failed (${response.status})`);
      error.status = response.status;
      error.path = path;
      error.details = rawMessage;
      throw error;
    }

    if (response.status === 204) return null;

    const contentLength = response.headers.get("content-length");
    const contentType = response.headers.get("content-type") || "";

    if (contentLength === "0") return null;
    if (!contentType.includes("application/json")) {
      const text = await response.text();
      return text ? text : null;
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  async requestAll(path, options = {}) {
    const pageSize = 1000;
    const rows = [];

    for (let offset = 0; ; offset += pageSize) {
      const page = await this.request(path, {
        ...options,
        headers: {
          ...(options.headers || {}),
          Range: `${offset}-${offset + pageSize - 1}`
        }
      });

      if (!Array.isArray(page)) return page;
      rows.push(...page);
      if (page.length < pageSize) return rows;
    }
  }

  async backendRequest(endpoint, options = {}) {
    const response = await fetch(endpoint, {
      ...options,
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload?.error || `Backend request failed (${response.status})`);
      error.status = response.status;
      error.details = payload;
      throw error;
    }
    return payload;
  }
}

function mapInitiative(row, votes, signatures, comments) {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    description: row.description,
    category: row.category,
    legalReference: row.legal_reference || "",
    expectedImpact: row.expected_impact || "",
    legislativeText: row.legislative_text || "",
    articleExplanation: row.article_explanation || "",
    financialImpact: row.financial_impact || "",
    budgetFunding: row.budget_funding || "",
    comparativeReview: row.comparative_review || "",
    impactAssessment: row.impact_assessment || "",
    publicParticipation: row.public_participation || "",
    proposerRepresentatives: row.proposer_representatives || "",
    affectedProvisions: row.affected_provisions || "",
    notificationEmail: row.notification_email || "",
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: {
      id: row.author_ref,
      name: row.author_name,
      email: row.notification_email || ""
    },
    aiReview: {
      score: row.ai_score || 0,
      risk: row.ai_risk || "low",
      findings: row.ai_findings || [],
      checks: row.ai_checks || {}
    },
    votes: votes
      .filter((vote) => vote.initiative_id === row.id)
      .map((vote) => ({
        userId: vote.voter_ref,
        userName: vote.voter_name,
        createdAt: vote.created_at
      })),
    signatures: signatures
      .filter((signature) => signature.initiative_id === row.id)
      .filter((signature) => String(signature.signature_status || "SIGNED").toUpperCase() !== "NOTSIGNED")
      .map((signature) => ({
        userId: signature.signer_ref,
        userName: signature.signer_name,
        method: signature.method,
        signatureStatus: signature.signature_status || "SIGNED",
        createdAt: signature.created_at
      })),
    comments: comments
      .filter((comment) => comment.initiative_id === row.id)
      .map((comment) => ({
        id: comment.id,
        userId: comment.author_ref,
        userName: comment.author_name,
        body: comment.body,
        createdAt: comment.created_at
      }))
  };
}

function toInitiativeRow(initiative) {
  return {
    id: initiative.id,
    title: initiative.title,
    summary: initiative.summary,
    description: initiative.description,
    category: initiative.category,
    legal_reference: initiative.legalReference,
    expected_impact: initiative.expectedImpact,
    legislative_text: initiative.legislativeText,
    article_explanation: initiative.articleExplanation,
    financial_impact: initiative.financialImpact,
    budget_funding: initiative.budgetFunding,
    comparative_review: initiative.comparativeReview,
    impact_assessment: initiative.impactAssessment,
    public_participation: initiative.publicParticipation,
    proposer_representatives: initiative.proposerRepresentatives,
    affected_provisions: initiative.affectedProvisions,
    notification_email: initiative.notificationEmail || initiative.author?.email || "",
    status: initiative.status,
    author_ref: initiative.author.id,
    author_name: initiative.author.name,
    ai_score: initiative.aiReview.score,
    ai_risk: initiative.aiReview.risk,
    ai_findings: initiative.aiReview.findings,
    ai_checks: initiative.aiReview.checks
  };
}

function filterValue(value) {
  const text = String(value || "").trim();
  return !text || text === "all" ? null : text;
}


