const MAX_EMAIL_LENGTH = 254;
const MAX_LOCAL_PART_LENGTH = 64;

export function normalizeEmailAddress(value) {
  return String(value || "").trim().toLowerCase();
}

export function isValidEmailAddress(value) {
  const email = normalizeEmailAddress(value);
  if (!email || email.length > MAX_EMAIL_LENGTH) return false;
  if (hasForbiddenEmailChar(email)) return false;

  const atIndex = email.indexOf("@");
  if (atIndex <= 0 || atIndex !== email.lastIndexOf("@") || atIndex === email.length - 1) return false;

  const localPart = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  if (!localPart || localPart.length > MAX_LOCAL_PART_LENGTH) return false;
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".") || domain.includes("..")) return false;

  return domain.split(".").every(Boolean);
}

function hasForbiddenEmailChar(email) {
  for (const char of email) {
    const code = char.codePointAt(0);
    if (code <= 32 || code === 127 || char === "<" || char === ">") return true;
  }
  return false;
}
