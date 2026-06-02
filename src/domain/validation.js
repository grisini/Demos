import { isValidEmailAddress, normalizeEmailAddress } from "./email.js";

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
  description: 120,
  legalReference: 8,
  expectedImpact: 40,
  legislativeText: 40,
  articleExplanation: 80,
  financialImpact: 30,
  budgetFunding: 20,
  comparativeReview: 80,
  impactAssessment: 80,
  publicParticipation: 20,
  proposerRepresentatives: 3
};

const FIELD_LABELS = {
  title: "Naslov",
  summary: "Kratek povzetek",
  description: "Ocena stanja in razlogi",
  legalReference: "Pravna podlaga",
  expectedImpact: "Cilji, nacela in poglavitne resitve",
  legislativeText: "Besedilo clenov",
  articleExplanation: "Obrazlozitev clenov",
  financialImpact: "Financne posledice",
  budgetFunding: "Zagotovitev sredstev",
  comparativeReview: "Primerjalni prikaz in pravo EU",
  impactAssessment: "Presoja posledic",
  publicParticipation: "Sodelovanje javnosti",
  proposerRepresentatives: "Predstavniki predlagatelja",
  notificationEmail: "E-posta za obvestila"
};

const INITIATIVE_TEXT_FIELDS = [
  "title",
  "summary",
  "description",
  "legalReference",
  "expectedImpact",
  "legislativeText",
  "articleExplanation",
  "financialImpact",
  "budgetFunding",
  "comparativeReview",
  "impactAssessment",
  "publicParticipation",
  "proposerRepresentatives",
  "affectedProvisions"
];

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

const SCORE_BONUSES = [
  ["description", 500, 8],
  ["legalReference", 8, 9],
  ["expectedImpact", 40, 7],
  ["legislativeText", 80, 9],
  ["articleExplanation", 120, 7],
  ["comparativeReview", 120, 5],
  ["impactAssessment", 120, 5]
];

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
    errors.description = `Ocena stanja in razlogi naj imajo vsaj ${REQUIRED_MIN.description} znakov.`;
  }

  for (const [field, minLength] of Object.entries(REQUIRED_MIN)) {
    if (["title", "summary", "description"].includes(field)) continue;
    if (values[field].length < minLength) {
      errors[field] = `${FIELD_LABELS[field]} naj ima vsaj ${minLength} znakov.`;
    }
  }

  if (values.notificationEmail && !isValidEmailAddress(values.notificationEmail)) {
    errors.notificationEmail = "Vnesite veljaven e-postni naslov za obvestila.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    values
  };
}

export function evaluateInitiative(input) {
  const values = normalizeInput(input);
  const text = INITIATIVE_TEXT_FIELDS.map((field) => values[field])
    .join(" ")
    .toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);

  const budgetHits = findHits(text, budgetKeywords);
  const legalHits = findHits(text, legalKeywords);
  const vagueHits = findHits(text, vagueKeywords);
  const categorySuggestion = suggestCategory(text, values.category);
  const completeness = completenessChecks(values);
  const reviewContext = { budgetHits, legalHits, vagueHits, completeness, categorySuggestion };
  const boundedScore = initiativeScore(values, words, reviewContext);
  const risk = initiativeRisk(budgetHits, vagueHits, boundedScore);
  const suitability = initiativeSuitability(boundedScore, risk);

  return {
    score: boundedScore,
    risk,
    findings: initiativeFindings(reviewContext, values.category, suitability),
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

function initiativeScore(values, words, reviewContext) {
  const score =
    42 +
    Math.min(words.length, 220) / 6 +
    reviewContext.legalHits.length * 8 -
    reviewContext.budgetHits.length * 7 -
    reviewContext.vagueHits.length * 4 +
    reviewContext.completeness.score / 8 +
    categoryConfidenceBonus(reviewContext.categorySuggestion) +
    fieldScoreBonus(values);
  return Math.max(0, Math.min(100, Math.round(score)));
}

function categoryConfidenceBonus(categorySuggestion) {
  return categorySuggestion.confidence >= 60 ? 4 : 0;
}

function fieldScoreBonus(values) {
  return SCORE_BONUSES.reduce((total, [field, minLength, bonus]) => {
    return total + (values[field].length >= minLength ? bonus : 0);
  }, 0);
}

function initiativeRisk(budgetHits, vagueHits, boundedScore) {
  if (budgetHits.length >= 3 || boundedScore < 45) return "high";
  if (budgetHits.length > 0 || vagueHits.length > 1) return "medium";
  return "low";
}

function initiativeSuitability(boundedScore, risk) {
  if (boundedScore >= 72 && risk === "low") return "ready";
  if (boundedScore >= 50) return "needs_review";
  return "insufficient";
}

function initiativeFindings(reviewContext, selectedCategory, suitability) {
  const { budgetHits, legalHits, vagueHits, completeness, categorySuggestion } = reviewContext;
  return [
    `Ustreznost: ${suitabilityLabel(suitability)} (${completeness.score}% popolnosti podatkov).`,
    categoryFinding(categorySuggestion, selectedCategory),
    legalFinding(legalHits),
    completenessFinding(completeness),
    budgetFinding(budgetHits),
    vagueFinding(vagueHits)
  ];
}

function categoryFinding(categorySuggestion, selectedCategory) {
  if (categorySuggestion.category && categorySuggestion.category !== selectedCategory) {
    return `AI predlaga kategorijo ${categorySuggestion.category} z ${categorySuggestion.confidence}% ujemanjem.`;
  }
  return "Izbrana kategorija je skladna z zaznanimi izrazi.";
}

function legalFinding(legalHits) {
  return legalHits.length
    ? `Zaznane pravne oporne tocke: ${legalHits.join(", ")}.`
    : "Dodajte jasnejso pravno podlago ali navedbo zakona.";
}

function completenessFinding(completeness) {
  return completeness.missing.length
    ? `Za DZ manjkajo ali so prekratka polja: ${completeness.missing.map((field) => FIELD_LABELS[field] || field).join(", ")}.`
    : "Predlog vsebuje obvezne vsebinske sklope za predlog zakona.";
}

function budgetFinding(budgetHits) {
  return budgetHits.length
    ? `Pobuda omenja proracunsko obcutljive pojme: ${budgetHits.join(", ")}.`
    : "Ni ocitnih proracunskih opozoril v osnovnem pregledu.";
}

function vagueFinding(vagueHits) {
  return vagueHits.length
    ? "Besedilo vsebuje nekaj splosnih izrazov; predlog naj bo bolj merljiv."
    : "Besedilo je dovolj konkretno za prvi pregled.";
}

export function createInitiative(input, actor, review = evaluateInitiative(input)) {
  const values = normalizeInput(input);
  const now = new Date().toISOString();
  const actorEmail = validEmail(actor?.email);
  const notificationEmail = firstValidEmail(values.notificationEmail, actorEmail, actor?.id);

  return {
    id: cryptoId(),
    title: values.title,
    summary: values.summary,
    description: values.description,
    category: values.category,
    legalReference: values.legalReference,
    expectedImpact: values.expectedImpact,
    legislativeText: values.legislativeText,
    articleExplanation: values.articleExplanation,
    financialImpact: values.financialImpact,
    budgetFunding: values.budgetFunding,
    comparativeReview: values.comparativeReview,
    impactAssessment: values.impactAssessment,
    publicParticipation: values.publicParticipation,
    proposerRepresentatives: values.proposerRepresentatives,
    affectedProvisions: values.affectedProvisions,
    notificationEmail,
    status: review.risk === "high" ? "review" : "active",
    createdAt: now,
    updatedAt: now,
    author: {
      id: actor?.id || "anonymous",
      name: actor?.name || "Anonimni uporabnik",
      email: actorEmail
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
    expectedImpact: String(input?.expectedImpact || "").trim(),
    legislativeText: String(input?.legislativeText || "").trim(),
    articleExplanation: String(input?.articleExplanation || "").trim(),
    financialImpact: String(input?.financialImpact || "").trim(),
    budgetFunding: String(input?.budgetFunding || "").trim(),
    comparativeReview: String(input?.comparativeReview || "").trim(),
    impactAssessment: String(input?.impactAssessment || "").trim(),
    publicParticipation: String(input?.publicParticipation || "").trim(),
    proposerRepresentatives: String(input?.proposerRepresentatives || "").trim(),
    affectedProvisions: String(input?.affectedProvisions || "").trim(),
    notificationEmail: normalizeEmail(input?.notificationEmail)
  };
}

function normalizeEmail(value) {
  return normalizeEmailAddress(value);
}

function validEmail(value) {
  const email = normalizeEmailAddress(value);
  return isValidEmailAddress(email) ? email : "";
}

function firstValidEmail(...values) {
  return values.map(validEmail).find(Boolean) || "";
}

function findHits(text, keywords) {
  return keywords.filter((keyword) => text.includes(keyword));
}

function completenessChecks(values) {
  const checks = Object.fromEntries(
    Object.entries(REQUIRED_MIN).map(([field, minLength]) => [field, values[field].length >= minLength])
  );
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
