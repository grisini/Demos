import { CATEGORIES, evaluateInitiative, normalizeInput } from "../../src/domain/validation.js";
import { buildRemoteAiReviewText } from "../../src/domain/ai-review.js";
import { checkRateLimit, rateLimitHeaders } from "../../server/rate-limit.mjs";

const huggingFaceRouterBase = "https://router.huggingface.co/hf-inference/models";
const defaultHuggingFaceZeroShotModel = "facebook/bart-large-mnli";
const maxBodyBytes = 256 * 1024;
const rateLimit = { name: "ai-review", limit: 20, windowMs: 60 * 1000 };

export default async function handler(request, response) {
  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  const limit = checkRateLimit(request, rateLimit);
  if (limit.limited) {
    sendJson(response, 429, { error: "Too many AI review requests." }, rateLimitHeaders(limit));
    return;
  }

  try {
    const payload = await readJsonBody(request);
    const review = await reviewInitiativeWithHuggingFace(payload, process.env);
    sendJson(response, 200, review);
  } catch (error) {
    console.error("[Demokracija 2.0] AI review failed", error);
    sendJson(response, error.status || 500, {
      error: error.message || "AI review failed"
    });
  }
}

function sendJson(response, status, value, headers = {}) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  for (const [name, headerValue] of Object.entries(headers)) {
    response.setHeader(name, headerValue);
  }
  response.statusCode = status;
  response.end(JSON.stringify(value));
}

async function readJsonBody(request) {
  if (request.body && typeof request.body === "object") return request.body;
  if (typeof request.body === "string") return request.body ? JSON.parse(request.body) : {};

  const raw = await new Promise((resolveBody, rejectBody) => {
    let body = "";
    let tooLarge = false;

    request.on("data", (chunk) => {
      if (tooLarge) return;
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > maxBodyBytes) {
        tooLarge = true;
        const error = new Error("Request body is too large.");
        error.status = 413;
        rejectBody(error);
      }
    });
    request.on("end", () => {
      if (!tooLarge) resolveBody(body);
    });
    request.on("error", rejectBody);
  });

  return raw ? JSON.parse(raw) : {};
}

async function reviewInitiativeWithHuggingFace(payload, env) {
  const token = env.HF_TOKEN;
  const model = env.HUGGINGFACE_ZERO_SHOT_MODEL || defaultHuggingFaceZeroShotModel;
  const values = normalizeInput(payload);
  const localReview = evaluateInitiative(values);

  if (!token) {
    return remoteAiFallbackReview(localReview, {
      model,
      fallbackReason: "hf_token_missing"
    });
  }

  const text = buildRemoteAiReviewText(values);
  const models = uniqueValues([model, defaultHuggingFaceZeroShotModel]);
  let lastError = null;

  for (const candidateModel of models) {
    try {
      const [categoryResult, suitabilityResult] = await Promise.all([
        queryHuggingFaceZeroShot({
          token,
          model: candidateModel,
          inputs: text,
          candidateLabels: CATEGORIES,
          hypothesisTemplate: "Ta zakonodajna pobuda spada v kategorijo {}."
        }),
        queryHuggingFaceZeroShot({
          token,
          model: candidateModel,
          inputs: text,
          candidateLabels: ["primerna za objavo", "potreben uredniski pregled", "nezadostna za oddajo"],
          hypothesisTemplate: "Ta zakonodajna pobuda je {}."
        })
      ]);

      return normalizeHuggingFaceReview({
        categoryResult,
        suitabilityResult,
        fallback: localReview,
        model: candidateModel
      });
    } catch (error) {
      lastError = error;
      console.warn("[Demokracija 2.0] AI review model failed", {
        model: candidateModel,
        message: error.message,
        status: error.status || "unknown",
        details: abbreviateErrorDetails(error.details)
      });
    }
  }

  return remoteAiFallbackReview(localReview, {
    model,
    fallbackReason: lastError ? "huggingface_unavailable" : "huggingface_no_model"
  });
}

async function queryHuggingFaceZeroShot({ token, model, inputs, candidateLabels, hypothesisTemplate }) {
  const modelPath = model.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${huggingFaceRouterBase}/${modelPath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      inputs,
      parameters: {
        candidate_labels: candidateLabels,
        hypothesis_template: hypothesisTemplate,
        multi_label: false
      },
      options: {
        wait_for_model: true
      }
    })
  });

  const raw = await response.text();
  if (!response.ok) {
    const error = new Error(`Hugging Face request failed (${response.status}).`);
    error.status = 502;
    error.details = raw;
    throw error;
  }

  return raw ? JSON.parse(raw) : {};
}

function remoteAiFallbackReview(fallback, options = {}) {
  return {
    ...fallback,
    checks: {
      ...fallback.checks,
      provider: "local",
      model: "local-rule-engine-v1",
      remoteModel: options.model || defaultHuggingFaceZeroShotModel,
      fallbackReason: options.fallbackReason || "huggingface_unavailable",
      reviewedAt: new Date().toISOString()
    }
  };
}

function abbreviateErrorDetails(value) {
  const details = String(value || "").replace(/\s+/g, " ").trim();
  return details.length > 240 ? `${details.slice(0, 237)}...` : details;
}

function uniqueValues(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function normalizeHuggingFaceReview({ categoryResult, suitabilityResult, fallback, model }) {
  const categoryTop = topZeroShotLabel(categoryResult);
  const suitabilityTop = topZeroShotLabel(suitabilityResult);
  const suitability = mapSuitabilityLabel(suitabilityTop.label) || fallback.checks.suitability;
  const category = CATEGORIES.includes(categoryTop.label) ? categoryTop.label : fallback.checks.categorySuggestion.category;
  const categoryConfidence = clampInteger(categoryTop.score * 100, fallback.checks.categorySuggestion.confidence);
  const suitabilityConfidence = clampInteger(suitabilityTop.score * 100, 0);
  const score = clampInteger(
    fallback.score * 0.7 + categoryConfidence * 0.15 + suitabilityScore(suitability, suitabilityConfidence) * 0.15,
    fallback.score
  );
  const risk = suitability === "insufficient" || fallback.risk === "high"
    ? "high"
    : suitability === "needs_review" || fallback.risk === "medium"
      ? "medium"
      : "low";

  return {
    provider: "huggingface",
    model,
    score,
    risk,
    findings: [
      `Napredno preverjanje ocenjuje: ${suitabilityLabelForFinding(suitability)} (${suitabilityConfidence}% zanesljivost).`,
      category && category !== fallback.checks.categorySuggestion.category
        ? `Napredno preverjanje predlaga kategorijo ${category} z ${categoryConfidence}% ujemanjem.`
        : `Napredno preverjanje potrjuje kategorijo ${category} z ${categoryConfidence}% ujemanjem.`,
      ...fallback.findings.slice(2)
    ],
    checks: {
      ...fallback.checks,
      suitability,
      categorySuggestion: {
        category,
        confidence: categoryConfidence,
        labels: zeroShotLabels(categoryResult),
        scores: zeroShotScores(categoryResult)
      },
      huggingFaceSuitability: {
        label: suitabilityTop.label,
        confidence: suitabilityConfidence,
        labels: zeroShotLabels(suitabilityResult),
        scores: zeroShotScores(suitabilityResult)
      },
      provider: "huggingface",
      model,
      reviewedAt: new Date().toISOString(),
      rawResponse: {
        category: categoryResult,
        suitability: suitabilityResult
      }
    }
  };
}

function topZeroShotLabel(result) {
  if (Array.isArray(result)) {
    const [top] = [...result].sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
    return {
      label: top?.label || "",
      score: Number(top?.score) || 0
    };
  }

  const labels = Array.isArray(result?.labels) ? result.labels : [];
  const scores = Array.isArray(result?.scores) ? result.scores : [];
  return {
    label: labels[0] || "",
    score: Number(scores[0]) || 0
  };
}

function zeroShotLabels(result) {
  if (Array.isArray(result)) return result.map((item) => item.label).filter(Boolean);
  return Array.isArray(result?.labels) ? result.labels : [];
}

function zeroShotScores(result) {
  if (Array.isArray(result)) return result.map((item) => Number(item.score) || 0);
  return Array.isArray(result?.scores) ? result.scores : [];
}

function mapSuitabilityLabel(label) {
  return {
    "primerna za objavo": "ready",
    "potreben uredniski pregled": "needs_review",
    "nezadostna za oddajo": "insufficient"
  }[label];
}

function suitabilityScore(suitability, confidence) {
  if (suitability === "ready") return confidence;
  if (suitability === "needs_review") return Math.round(confidence * 0.65);
  return Math.round(confidence * 0.25);
}

function suitabilityLabelForFinding(value) {
  return {
    ready: "primerna za objavo",
    needs_review: "potreben uredniski pregled",
    insufficient: "nezadostna za oddajo"
  }[value] || "ni ocene";
}

function clampInteger(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}
