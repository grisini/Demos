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

const categoryKeywords = {
  "Javne finance": ["proracun", "prora\u010dun", "davek", "davki", "subvencija", "prispevek", "transfer", "razpis"],
  Zdravstvo: ["zdravstvo", "pacient", "cakalna", "\u010dakalna", "zdravnik", "bolnisnica", "ambulanta"],
  Okolje: ["okolje", "odpadki", "voda", "zrak", "emisije", "podnebje", "narava"],
  Izobrazevanje: ["sola", "\u0161ola", "vrtec", "ucitelj", "u\u010ditelj", "student", "\u0161tudent", "ucni", "u\u010dni"],
  Pravosodje: ["sodisce", "sodi\u0161\u010de", "tozilstvo", "to\u017eilstvo", "pravica", "postopek", "kazenski"],
  "Digitalna drzava": ["digital", "podatki", "portal", "register", "strojno", "e-uprava", "splet"],
  Drugo: []
};

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
  const text = [
    values.title,
    values.summary,
    values.description,
    values.legalReference,
    values.expectedImpact
  ]
    .join(" ")
    .toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);

  const budgetHits = findHits(text, budgetKeywords);
  const legalHits = findHits(text, legalKeywords);
  const vagueHits = findHits(text, vagueKeywords);
  const categorySuggestion = suggestCategory(text, values.category);
  const completeness = completenessChecks(values);

  let score = 42;
  score += Math.min(words.length, 220) / 6;
  score += legalHits.length * 8;
  score -= budgetHits.length * 7;
  score -= vagueHits.length * 4;
  score += completeness.score / 8;
  score += categorySuggestion.confidence >= 60 ? 4 : 0;

  if (values.description.length >= 500) score += 8;
  if (values.legalReference.length >= 8) score += 9;
  if (values.expectedImpact.length >= 40) score += 7;

  const boundedScore = Math.max(0, Math.min(100, Math.round(score)));
  const risk = budgetHits.length >= 3 || boundedScore < 45 ? "high" : budgetHits.length > 0 || vagueHits.length > 1 ? "medium" : "low";
  const suitability = boundedScore >= 72 && risk === "low" ? "ready" : boundedScore >= 50 ? "needs_review" : "insufficient";

  return {
    score: boundedScore,
    risk,
    findings: [
      `Ustreznost: ${suitabilityLabel(suitability)} (${completeness.score}% popolnosti podatkov).`,
      categorySuggestion.category && categorySuggestion.category !== values.category
        ? `AI predlaga kategorijo ${categorySuggestion.category} z ${categorySuggestion.confidence}% ujemanjem.`
        : "Izbrana kategorija je skladna z zaznanimi izrazi.",
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
      vagueHits,
      completeness,
      categorySuggestion,
      suitability
    }
  };
}

export function createInitiative(input, actor, review = evaluateInitiative(input)) {
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

export function suitabilityLabel(value) {
  return {
    ready: "primerna za objavo",
    needs_review: "potreben uredniski pregled",
    insufficient: "nezadostna za oddajo"
  }[value] || "ni ocene";
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

function completenessChecks(values) {
  const checks = {
    title: values.title.length >= REQUIRED_MIN.title,
    summary: values.summary.length >= REQUIRED_MIN.summary,
    description: values.description.length >= REQUIRED_MIN.description,
    legalReference: values.legalReference.length >= 8,
    expectedImpact: values.expectedImpact.length >= 40
  };
  const passed = Object.values(checks).filter(Boolean).length;

  return {
    ...checks,
    score: Math.round((passed / Object.keys(checks).length) * 100),
    missing: Object.entries(checks)
      .filter(([, value]) => !value)
      .map(([key]) => key)
  };
}

function suggestCategory(text, selectedCategory) {
  const scored = Object.entries(categoryKeywords).map(([category, keywords]) => ({
    category,
    hits: findHits(text, keywords),
    selected: category === selectedCategory
  }));
  const best = scored.sort((a, b) => b.hits.length - a.hits.length || Number(b.selected) - Number(a.selected))[0];

  if (!best || best.hits.length === 0) {
    return {
      category: selectedCategory || "Drugo",
      confidence: selectedCategory ? 50 : 0,
      hits: []
    };
  }

  return {
    category: best.category,
    confidence: Math.min(95, 45 + best.hits.length * 15),
    hits: best.hits
  };
}

function cryptoId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
