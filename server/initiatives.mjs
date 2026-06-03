import { sessionUserFromRequest } from "./sipass-session.mjs";
import { adminEmails } from "./demo-login.mjs";
import {
  createInitiative,
  evaluateInitiative,
  STATUSES,
  validateInitiative
} from "../src/domain/validation.js";

export async function createServerInitiative(request, payload = {}, env = process.env, fetchImpl = fetch) {
  const actor = requestActor(request, payload, env);
  if (!actor?.id) {
    throwHttp(401, "Za oddajo pobude je potrebna prijava.");
  }

  const input = payload?.initiative || payload?.values || payload;
  const validation = validateInitiative(input);
  if (!validation.valid) {
    const error = new Error("Pobuda potrebuje nekaj popravkov.");
    error.status = 400;
    error.errors = validation.errors;
    throw error;
  }

  const review = evaluateInitiative(validation.values);
  const initiative = createInitiative(validation.values, actor, review);
  const client = supabaseServerClient(env, fetchImpl);
  const [row] = await requestJson(client, "/rest/v1/initiatives?select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(toInitiativeRow(initiative))
  });

  return mapInitiative(row, [], [], []);
}

export async function createServerComment(request, payload = {}, env = process.env, fetchImpl = fetch) {
  const actor = requestActor(request, payload, env);
  if (!actor?.id) {
    throwHttp(401, "Za komentiranje je potrebna prijava.");
  }

  const initiativeId = clean(payload?.initiativeId || payload?.id, 80);
  const body = clean(payload?.body, 2000);
  if (!initiativeId) throwHttp(400, "Manjka ID pobude.");
  if (body.length < 3) throwHttp(400, "Komentar je prekratek.");

  const client = supabaseServerClient(env, fetchImpl);
  const initiative = await fetchInitiative(client, initiativeId);
  if (!initiative) throwHttp(404, "Pobuda ne obstaja.");

  await requestJson(client, "/rest/v1/comments", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      initiative_id: initiativeId,
      author_ref: actor.id,
      author_name: actor.name,
      body
    })
  });

  return fetchInitiativeDetail(client, initiativeId);
}

export async function updateServerInitiativeStatus(request, payload = {}, env = process.env, fetchImpl = fetch) {
  const actor = requestActor(request, payload, env);
  if (!isAdmin(actor, env)) {
    throwHttp(403, "Status pobude lahko spremeni samo administrator.");
  }

  const initiativeId = clean(payload?.initiativeId || payload?.id, 80);
  const status = clean(payload?.status, 40);
  if (!initiativeId) throwHttp(400, "Manjka ID pobude.");
  if (!STATUSES.some((item) => item.value === status)) throwHttp(400, "Status ni veljaven.");

  const client = supabaseServerClient(env, fetchImpl);
  const initiative = await fetchInitiative(client, initiativeId);
  if (!initiative) throwHttp(404, "Pobuda ne obstaja.");

  await requestJson(client, `/rest/v1/initiatives?id=eq.${encodeURIComponent(initiativeId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      status,
      updated_at: new Date().toISOString()
    })
  });

  return fetchInitiativeDetail(client, initiativeId);
}

export function requestActor(request, payload = {}, env = process.env) {
  const sessionUser = sessionUserFromRequest(request, env);
  if (sessionUser?.id) return withAdminRole(sessionUser, env, true);

  if (!allowDemoActor(env)) return null;
  const actor = payload?.actor || null;
  if (!actor?.id) return null;

  return withAdminRole({
    id: clean(actor.id, 160),
    name: clean(actor.name, 200) || "Demo uporabnik",
    email: clean(actor.email, 320).toLowerCase(),
    provider: clean(actor.provider, 40) || "demo",
    role: "citizen"
  }, env, false);
}

export function sessionUserWithAdminRole(request, env = process.env) {
  const user = sessionUserFromRequest(request, env);
  return user?.id ? withAdminRole(user, env, true) : null;
}

export function isAdmin(user, env = process.env) {
  if (!user?.id) return false;
  if (String(user.role || "").toLowerCase() === "admin") return true;
  return adminRefs(env).has(userRef(user));
}

export function supabaseServerClient(env, fetchImpl) {
  const url = firstValue(env.SUPABASE_URL, env.VITE_SUPABASE_URL).replace(/\/$/, "");
  const serviceKey = firstValue(env.SUPABASE_SERVICE_ROLE_KEY, env.SUPABASE_SERVICE_KEY);

  if (!url || !serviceKey) {
    throwHttp(503, "SUPABASE_URL in SUPABASE_SERVICE_ROLE_KEY morata biti nastavljena na strezniku.");
  }

  return { url, serviceKey, fetchImpl };
}

export async function fetchInitiativeDetail(client, id) {
  const initiative = await fetchInitiative(client, id);
  if (!initiative) throwHttp(404, "Pobuda ne obstaja.");

  const filter = `initiative_id=eq.${encodeURIComponent(id)}`;
  const [votes, signatures, comments] = await Promise.all([
    requestJson(client, `/rest/v1/votes?select=*&${filter}`),
    requestJson(client, `/rest/v1/signatures?select=*&${filter}`),
    requestJson(client, `/rest/v1/comments?select=*&${filter}&order=created_at.asc`)
  ]);

  return mapInitiative(initiative, votes, signatures, comments);
}

export async function requestJson(client, path, options = {}) {
  const response = await client.fetchImpl(`${client.url}${path}`, {
    ...options,
    headers: {
      apikey: client.serviceKey,
      Authorization: `Bearer ${client.serviceKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const details = await response.text();
    const error = new Error(`Supabase server request failed (${response.status}).`);
    error.status = response.status;
    error.details = details;
    throw error;
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function fetchInitiative(client, id) {
  const rows = await requestJson(
    client,
    `/rest/v1/initiatives?select=*&id=eq.${encodeURIComponent(id)}&limit=1`
  );
  return rows[0] || null;
}

function withAdminRole(user, env, trustSessionRole) {
  const refs = adminRefs(env);
  const ref = userRef(user);
  let role = "citizen";
  if (refs.has(ref) || (trustSessionRole && String(user.role || "").toLowerCase() === "admin")) role = "admin";

  return {
    id: clean(user.id, 160),
    name: clean(user.name, 200) || "Uporabnik",
    email: clean(user.email, 320).toLowerCase(),
    provider: clean(user.provider, 40) || "sipass",
    role
  };
}

function allowDemoActor(env) {
  const authMode = String(firstValue(env.AUTH_MODE, env.VITE_AUTH_MODE)).toLowerCase();
  if (["demo", "local", "development"].includes(authMode)) return true;
  return String(env.NODE_ENV || "").toLowerCase() !== "production" && !authMode;
}

function adminRefs(env) {
  return adminEmails(env);
}

function userRef(user) {
  return normalizeRef(user.email || user.id);
}

function normalizeRef(value) {
  return String(value || "").trim().toLowerCase();
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

function mapInitiative(row, votes = [], signatures = [], comments = []) {
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
    votes: votes.map((vote) => ({
      userId: vote.voter_ref,
      userName: vote.voter_name,
      createdAt: vote.created_at
    })),
    signatures: signatures
      .filter((signature) => String(signature.signature_status || "SIGNED").toUpperCase() !== "NOTSIGNED")
      .map((signature) => ({
        userId: signature.signer_ref,
        userName: signature.signer_name,
        method: signature.method,
        signatureStatus: signature.signature_status || "SIGNED",
        createdAt: signature.created_at
      })),
    comments: comments.map((comment) => ({
      id: comment.id,
      userId: comment.author_ref,
      userName: comment.author_name,
      body: comment.body,
      createdAt: comment.created_at
    }))
  };
}

function firstValue(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function clean(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function throwHttp(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
