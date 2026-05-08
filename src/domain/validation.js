export const CATEGORIES = [
  "Javne finance",
  "Zdravstvo",
  "Okolje",
  "Izobrazevanje",
  "Pravosodje",
  "Digitalna drzava",
  "Drugo"
];

export const STATUSES = [
  { value: "draft", label: "Osnutek" },
  { value: "review", label: "V pregledu" },
  { value: "active", label: "Aktivna" },
  { value: "signature_collection", label: "Zbiranje podpisov" },
  { value: "submitted", label: "Oddana DZ" },
  { value: "rejected", label: "Zavrnjena" }
];

const REQUIRED_MIN = {
  title: 8,
  summary: 40,
  description: 120
};

const budgetKeywords = [
  "proracun",
  "prora\u010dun",
  "davek",
  "davki",
  "placa",
  "pla\u010da",
  "subvencija",
  "pokojnina",
  "prispevek",
  "transfer",
  "milijon",
  "mrd",
  "eur"
];

const legalKeywords = [
  "zakon",
  "clen",
  "\u010dlen",
  "uredba",
  "referendum",
  "pravica",
  "obveznost",
  "postopek"
];

const vagueKeywords = ["boljse", "bolj\u0161e", "urediti", "nekako", "problem", "slabo"];

export function validateInitiative(input) {
  const values = normalizeInput(input);
  const errors = {};

  if (values.title.length < REQUIRED_MIN.title) {
    errors.title = `Naslov naj ima vsaj ${REQUIRED_MIN.title} znakov.`;
  }

  if (!CATEGORIES.includes(values.category)) {
    errors.category = "Izbrana kategorija ni veljavna.";
  }

  if (values.summary.length < REQUIRED_MIN.summary) {
    errors.summary = `Povzetek naj ima vsaj ${REQUIRED_MIN.summary} znakov.`;
  }

  if (values.description.length < REQUIRED_MIN.description) {
    errors.description = `Obrazlozitev naj ima vsaj ${REQUIRED_MIN.description} znakov.`;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    values
  };
}

export function evaluateInitiative(input) {
  const values = normalizeInput(input);
  const text = [values.title, values.summary, values.description].join(" ").toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);

  const budgetHits = findHits(text, budgetKeywords);
  const legalHits = findHits(text, legalKeywords);
  const vagueHits = findHits(text, vagueKeywords);

  let score = 45;
  score += Math.min(words.length, 220) / 6;
  score += legalHits.length * 8;
  score -= budgetHits.length * 7;
  score -= vagueHits.length * 4;

  if (values.description.length >= 500) score += 8;
  if (values.legalReference.length >= 8) score += 9;
  if (values.expectedImpact.length >= 40) score += 7;

  const boundedScore = Math.max(0, Math.min(100, Math.round(score)));
  const risk = budgetHits.length >= 3 || boundedScore < 45 ? "high" : budgetHits.length > 0 ? "medium" : "low";

  return {
    score: boundedScore,
    risk,
    findings: [
      legalHits.length
        ? `Zaznane pravne oporne tocke: ${legalHits.join(", ")}.`
        : "Dodajte jasnejso pravno podlago ali navedbo zakona.",
      budgetHits.length
        ? `Pobuda omenja proracunsko obcutljive pojme: ${budgetHits.join(", ")}.`
        : "Ni ocitnih proracunskih opozoril v osnovnem pregledu.",
      vagueHits.length
        ? "Besedilo vsebuje nekaj splosnih izrazov; predlog naj bo bolj merljiv."
        : "Besedilo je dovolj konkretno za prvi pregled."
    ],
    checks: {
      length: words.length,
      budgetHits,
      legalHits,
      vagueHits
    }
  };
}

export function createInitiative(input, actor) {
  const review = evaluateInitiative(input);
  const values = normalizeInput(input);
  const now = new Date().toISOString();

  return {
    id: cryptoId(),
    title: values.title,
    summary: values.summary,
    description: values.description,
    category: values.category,
    legalReference: values.legalReference,
    expectedImpact: values.expectedImpact,
    status: review.risk === "high" ? "review" : "active",
    createdAt: now,
    updatedAt: now,
    author: {
      id: actor?.id || "anonymous",
      name: actor?.name || "Anonimni uporabnik"
    },
    aiReview: review,
    votes: [],
    signatures: [],
    comments: []
  };
}

export function voteForInitiative(initiative, actor) {
  if (!actor?.id) {
    throw new Error("Za glasovanje je potrebna prijava.");
  }

  if (initiative.votes.some((vote) => vote.userId === actor.id)) {
    return initiative;
  }

  return {
    ...initiative,
    updatedAt: new Date().toISOString(),
    votes: [
      ...initiative.votes,
      {
        userId: actor.id,
        userName: actor.name,
        createdAt: new Date().toISOString()
      }
    ]
  };
}

export function signInitiative(initiative, actor, method = "demo") {
  if (!actor?.id) {
    throw new Error("Za podpis je potrebna prijava.");
  }

  if (initiative.signatures.some((signature) => signature.userId === actor.id)) {
    return initiative;
  }

  return {
    ...initiative,
    status: initiative.status === "active" ? "signature_collection" : initiative.status,
    updatedAt: new Date().toISOString(),
    signatures: [
      ...initiative.signatures,
      {
        userId: actor.id,
        userName: actor.name,
        method,
        createdAt: new Date().toISOString()
      }
    ]
  };
}

export function addComment(initiative, actor, body) {
  const cleanBody = String(body || "").trim();
  if (!actor?.id) {
    throw new Error("Za komentiranje je potrebna prijava.");
  }
  if (cleanBody.length < 3) {
    throw new Error("Komentar je prekratek.");
  }

  return {
    ...initiative,
    updatedAt: new Date().toISOString(),
    comments: [
      ...initiative.comments,
      {
        id: cryptoId(),
        userId: actor.id,
        userName: actor.name,
        body: cleanBody,
        createdAt: new Date().toISOString()
      }
    ]
  };
}

export function updateInitiativeStatus(initiative, status) {
  const validStatus = STATUSES.some((item) => item.value === status);
  if (!validStatus) {
    throw new Error("Status ni veljaven.");
  }

  return {
    ...initiative,
    status,
    updatedAt: new Date().toISOString()
  };
}

export function statusLabel(value) {
  return STATUSES.find((status) => status.value === value)?.label || value;
}

export function riskLabel(value) {
  return {
    low: "Nizko tveganje",
    medium: "Srednje tveganje",
    high: "Visoko tveganje"
  }[value] || "Ni ocene";
}

export function normalizeInput(input) {
  return {
    title: String(input?.title || "").trim(),
    category: String(input?.category || "").trim(),
    summary: String(input?.summary || "").trim(),
    description: String(input?.description || "").trim(),
    legalReference: String(input?.legalReference || "").trim(),
    expectedImpact: String(input?.expectedImpact || "").trim()
  };
}

function findHits(text, keywords) {
  return keywords.filter((keyword) => text.includes(keyword));
}

function cryptoId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
