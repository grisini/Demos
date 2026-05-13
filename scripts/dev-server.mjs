import { createServer } from "node:http";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { CATEGORIES, evaluateInitiative, normalizeInput } from "../src/domain/validation.js";

const root = resolve(process.cwd());
const defaultPort = Number(process.env.PORT || 5173);
const huggingFaceRouterBase = "https://router.huggingface.co/hf-inference/models";
const defaultHuggingFaceZeroShotModel = "facebook/bart-large-mnli";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

function parseEnvFile(fileName) {
  const file = join(root, fileName);
  if (!existsSync(file)) return {};

  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trimStart().startsWith("#"))
    .reduce((acc, line) => {
      const index = line.indexOf("=");
      if (index === -1) return acc;
      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
      acc[key] = value;
      return acc;
    }, {});
}

function runtimeConfig() {
  const env = {
    ...parseEnvFile(".env"),
    ...parseEnvFile(".env.local"),
    ...process.env
  };

  return {
    DATA_SOURCE: env.DATA_SOURCE || "local",
    AUTH_MODE: env.AUTH_MODE || "demo",
    SUPABASE_URL: env.SUPABASE_URL || "",
    SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY || "",
    SIPASS_ENV: env.SIPASS_ENV || "test",
    SIPASS_AUTHORITY: env.SIPASS_AUTHORITY || "https://sicas-test.sigov.si/",
    SIPASS_CLIENT_ID: env.SIPASS_CLIENT_ID || "",
    SIPASS_REDIRECT_URI:
      env.SIPASS_REDIRECT_URI || `http://localhost:${env.PORT || defaultPort}/auth/sipass/callback`,
    AI_PROVIDER: env.AI_PROVIDER || (env.HF_TOKEN ? "huggingface" : "local"),
    AI_REVIEW_ENDPOINT: env.AI_REVIEW_ENDPOINT || (env.HF_TOKEN ? "/api/ai/review-initiative" : ""),
    HUGGINGFACE_ZERO_SHOT_MODEL: env.HUGGINGFACE_ZERO_SHOT_MODEL || defaultHuggingFaceZeroShotModel,
    HUGGINGFACE_EMBEDDING_MODEL: env.HUGGINGFACE_EMBEDDING_MODEL || "intfloat/multilingual-e5-small"
  };
}

function serverEnv() {
  return {
    ...parseEnvFile(".env"),
    ...parseEnvFile(".env.local"),
    ...process.env
  };
}

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function readJsonBody(req, maxBytes = 64 * 1024) {
  return new Promise((resolveBody, rejectBody) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > maxBytes) {
        rejectBody(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolveBody(raw ? JSON.parse(raw) : {});
      } catch {
        rejectBody(new Error("Request body is not valid JSON."));
      }
    });
    req.on("error", rejectBody);
  });
}

function json(res, status, value) {
  send(res, status, JSON.stringify(value), "application/json; charset=utf-8");
}

async function reviewInitiativeWithHuggingFace(payload) {
  const env = serverEnv();
  const token = env.HF_TOKEN;
  const model = env.HUGGINGFACE_ZERO_SHOT_MODEL || defaultHuggingFaceZeroShotModel;

  if (!token) {
    const error = new Error("HF_TOKEN is not configured.");
    error.status = 503;
    throw error;
  }

  const values = normalizeInput(payload);
  const localReview = evaluateInitiative(values);
  const text = [
    values.title,
    values.summary,
    values.description,
    values.legalReference,
    values.expectedImpact
  ].join("\n\n");

  const [categoryResult, suitabilityResult] = await Promise.all([
    queryHuggingFaceZeroShot({
      token,
      model,
      inputs: text,
      candidateLabels: CATEGORIES,
      hypothesisTemplate: "Ta zakonodajna pobuda spada v kategorijo {}."
    }),
    queryHuggingFaceZeroShot({
      token,
      model,
      inputs: text,
      candidateLabels: ["primerna za objavo", "potreben uredniski pregled", "nezadostna za oddajo"],
      hypothesisTemplate: "Ta zakonodajna pobuda je {}."
    })
  ]);

  return normalizeHuggingFaceReview({
    categoryResult,
    suitabilityResult,
    fallback: localReview,
    model
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

function createAppServer() {
  return createServer(async (req, res) => {
    const requestedUrl = new URL(req.url || "/", `http://${req.headers.host}`);
    const pathname = decodeURIComponent(requestedUrl.pathname);

    if (pathname === "/api/ai/review-initiative") {
      if (req.method !== "POST") {
        json(res, 405, { error: "Method not allowed" });
        return;
      }

      try {
        const payload = await readJsonBody(req);
        const review = await reviewInitiativeWithHuggingFace(payload);
        json(res, 200, review);
      } catch (error) {
        console.error("[Demokracija 2.0] AI review failed", error);
        json(res, error.status || 500, {
          error: error.message || "AI review failed"
        });
      }
      return;
    }

    if (pathname === "/config.local.js") {
      const body = `window.DEMOS_CONFIG = ${JSON.stringify(runtimeConfig(), null, 2)};\n`;
      send(res, 200, body, "text/javascript; charset=utf-8");
      return;
    }

    const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const filePath = normalize(resolve(join(root, relative)));

    if (!filePath.startsWith(root)) {
      send(res, 403, "Forbidden");
      return;
    }

    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      send(res, 404, "Not found");
      return;
    }

    const type = contentTypes[extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    createReadStream(filePath).pipe(res);
  });
}

function listenOnAvailablePort(port) {
  const server = createAppServer();

  server.once("error", (error) => {
    if (error.code === "EADDRINUSE") {
      listenOnAvailablePort(port + 1);
      return;
    }
    throw error;
  });

  server.listen(port, () => {
    console.log(`Demokracija 2.0 dev server: http://localhost:${port}`);
  });
}

listenOnAvailablePort(defaultPort);
