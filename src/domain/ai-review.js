import { normalizeInput } from "./validation.js";

export const REMOTE_AI_REVIEW_MAX_CHARS = 4200;

const REMOTE_AI_REVIEW_SECTIONS = [
  { field: "title", label: "Naslov", maxChars: 180 },
  { field: "category", label: "Izbrana kategorija", maxChars: 80 },
  { field: "summary", label: "Kratek povzetek", maxChars: 700 },
  { field: "description", label: "Ocena stanja in razlogi", maxChars: 900 },
  { field: "legalReference", label: "Pravna podlaga", maxChars: 360 },
  { field: "expectedImpact", label: "Cilji in resitve", maxChars: 650 },
  { field: "legislativeText", label: "Besedilo clenov", maxChars: 620 },
  { field: "articleExplanation", label: "Obrazlozitev clenov", maxChars: 520 },
  { field: "financialImpact", label: "Financne posledice", maxChars: 320 },
  { field: "budgetFunding", label: "Zagotovitev sredstev", maxChars: 240 },
  { field: "comparativeReview", label: "Primerjalni prikaz in pravo EU", maxChars: 360 },
  { field: "impactAssessment", label: "Presoja posledic", maxChars: 360 },
  { field: "publicParticipation", label: "Sodelovanje javnosti", maxChars: 220 },
  { field: "proposerRepresentatives", label: "Predstavniki predlagatelja", maxChars: 160 },
  { field: "affectedProvisions", label: "Dolocbe, ki se spreminjajo", maxChars: 260 }
];

export function compactRemoteAiReviewPayload(input) {
  const values = normalizeInput(input);
  return Object.fromEntries(
    REMOTE_AI_REVIEW_SECTIONS.map((section) => [
      section.field,
      truncateText(normalizeWhitespace(values[section.field]), section.maxChars)
    ])
  );
}

export function buildRemoteAiReviewText(input, options = {}) {
  const values = normalizeInput(input);
  const maxChars = Math.max(1000, Number(options.maxChars) || REMOTE_AI_REVIEW_MAX_CHARS);
  const sections = [];
  let remaining = maxChars;

  for (const section of REMOTE_AI_REVIEW_SECTIONS) {
    const raw = normalizeWhitespace(values[section.field]);
    if (!raw) continue;

    const prefix = `${section.label}: `;
    const maxContentChars = Math.min(section.maxChars, remaining - prefix.length - 2);
    if (maxContentChars < 80) break;

    const block = `${prefix}${truncateText(raw, maxContentChars)}`;
    sections.push(block);
    remaining -= block.length + 2;
  }

  return sections.join("\n\n");
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function truncateText(value, maxChars) {
  const text = String(value || "");
  if (text.length <= maxChars) return text;
  if (maxChars <= 3) return text.slice(0, maxChars);
  return `${text.slice(0, maxChars - 3).trimEnd()}...`;
}
