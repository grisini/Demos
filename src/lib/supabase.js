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
  }

  async list() {
    const initiatives = await this.request(
      "/rest/v1/initiatives?select=*&order=created_at.desc"
    );
    const ids = initiatives.map((initiative) => initiative.id);
    if (!ids.length) return [];

    const filter = `initiative_id=in.(${ids.join(",")})`;
    const [votes, signatures, comments] = await Promise.all([
      this.request(`/rest/v1/votes?select=*&${filter}`),
      this.request(`/rest/v1/signatures?select=*&${filter}`),
      this.request(`/rest/v1/comments?select=*&${filter}&order=created_at.asc`)
    ]);

    return initiatives.map((row) => mapInitiative(row, votes, signatures, comments));
  }

  async create(initiative) {
    const [row] = await this.request("/rest/v1/initiatives?select=*", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(toInitiativeRow(initiative))
    });
    return mapInitiative(row, [], [], []);
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
    await this.request("/rest/v1/comments", {
      method: "POST",
      body: JSON.stringify({
        initiative_id: id,
        author_ref: actor.id,
        author_name: actor.name,
        body
      })
    });
    return this.find(id);
  }

  async updateStatus(id, status) {
    await this.request(`/rest/v1/initiatives?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        status,
        updated_at: new Date().toISOString()
      })
    });
    return this.find(id);
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
      const message = await response.text();
      throw new Error(message || `Supabase request failed (${response.status})`);
    }

    if (response.status === 204) return null;
    return response.json();
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
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: {
      id: row.author_ref,
      name: row.author_name
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
      .map((signature) => ({
        userId: signature.signer_ref,
        userName: signature.signer_name,
        method: signature.method,
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
    status: initiative.status,
    author_ref: initiative.author.id,
    author_name: initiative.author.name,
    ai_score: initiative.aiReview.score,
    ai_risk: initiative.aiReview.risk,
    ai_findings: initiative.aiReview.findings,
    ai_checks: initiative.aiReview.checks
  };
}

