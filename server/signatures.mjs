import { sessionUserFromRequest } from "./sipass-session.mjs";

export async function createSipassSignature(request, payload = {}, env = process.env, fetchImpl = fetch) {
  const user = sessionUserFromRequest(request, env);
  if (!user?.id || !String(user.id).startsWith("sipass-")) {
    const error = new Error("Za SI-PASS podpis je potrebna prijava s SI-PASS identiteto.");
    error.status = 401;
    throw error;
  }

  const initiativeId = String(payload?.initiativeId || payload?.id || "").trim();
  if (!initiativeId) {
    const error = new Error("Manjka ID pobude.");
    error.status = 400;
    throw error;
  }

  const client = supabaseServerClient(env, fetchImpl);
  const existingInitiative = await fetchInitiative(client, initiativeId);
  if (!existingInitiative) {
    const error = new Error("Pobuda ne obstaja.");
    error.status = 404;
    throw error;
  }

  await ensureSignature(client, {
    initiativeId,
    signerRef: user.id,
    signerName: user.name || "SI-PASS uporabnik"
  });

  if (existingInitiative.status === "active") {
    await patchInitiativeStatus(client, initiativeId, "signature_collection");
  }

  return fetchInitiativeDetail(client, initiativeId);
}

function supabaseServerClient(env, fetchImpl) {
  const url = firstValue(env.SUPABASE_URL, env.VITE_SUPABASE_URL).replace(/\/$/, "");
  const serviceKey = firstValue(env.SUPABASE_SERVICE_ROLE_KEY, env.SUPABASE_SERVICE_KEY);

  if (!url || !serviceKey) {
    const error = new Error("SUPABASE_URL in SUPABASE_SERVICE_ROLE_KEY morata biti nastavljena na strezniku.");
    error.status = 503;
    throw error;
  }

  return {
    url,
    serviceKey,
    fetchImpl
  };
}

async function ensureSignature(client, signature) {
  const existing = await requestJson(
    client,
    `/rest/v1/signatures?select=id&initiative_id=eq.${encodeURIComponent(signature.initiativeId)}&signer_ref=eq.${encodeURIComponent(signature.signerRef)}&limit=1`
  );

  if (existing.length) return;

  try {
    await requestJson(client, "/rest/v1/signatures", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        initiative_id: signature.initiativeId,
        signer_ref: signature.signerRef,
        signer_name: signature.signerName,
        method: "sipass"
      })
    });
  } catch (error) {
    if (String(error.details || error.message || "").includes("23505")) return;
    throw error;
  }
}

async function fetchInitiative(client, id) {
  const rows = await requestJson(
    client,
    `/rest/v1/initiatives?select=*&id=eq.${encodeURIComponent(id)}&limit=1`
  );
  return rows[0] || null;
}

async function patchInitiativeStatus(client, id, status) {
  await requestJson(client, `/rest/v1/initiatives?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      status,
      updated_at: new Date().toISOString()
    })
  });
}

async function fetchInitiativeDetail(client, id) {
  const initiative = await fetchInitiative(client, id);
  if (!initiative) {
    const error = new Error("Pobuda ne obstaja.");
    error.status = 404;
    throw error;
  }

  const filter = `initiative_id=eq.${encodeURIComponent(id)}`;
  const [votes, signatures, comments] = await Promise.all([
    requestJson(client, `/rest/v1/votes?select=*&${filter}`),
    requestJson(client, `/rest/v1/signatures?select=*&${filter}`),
    requestJson(client, `/rest/v1/comments?select=*&${filter}&order=created_at.asc`)
  ]);

  return mapInitiative(initiative, votes, signatures, comments);
}

async function requestJson(client, path, options = {}) {
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
    votes: (votes || []).map((vote) => ({
      userId: vote.voter_ref,
      userName: vote.voter_name,
      createdAt: vote.created_at
    })),
    signatures: (signatures || []).map((signature) => ({
      userId: signature.signer_ref,
      userName: signature.signer_name,
      method: signature.method,
      createdAt: signature.created_at
    })),
    comments: (comments || []).map((comment) => ({
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
