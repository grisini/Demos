import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { TextDecoder } from "node:util";

export const SIPASS_SESSION_COOKIE = "__Secure-demos_sipass";
export const SIPASS_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

const sessionVersion = "v1";
const cookiePath = "/";
const mojibakePattern = /(?:\u00c3.|\u00c2.|\u00c5.|\u00c4.|\u0139.|[\u0080-\u009f])/u;
const mojibakePairPattern = /(?:\u00c3.|\u00c2.|\u00c5.|\u00c4.|\u0139.)/gu;
const badUtf8Pattern = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\ufffd]/gu;
const mojibakeSourceEncodings = ["windows-1252", "windows-1250", "latin1"];
const reverseByteMaps = new Map();

export function createSipassSessionToken(user, secret, now = Date.now()) {
  const key = sessionKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const payload = Buffer.from(
    JSON.stringify({
      v: 1,
      iat: now,
      exp: now + SIPASS_SESSION_MAX_AGE_SECONDS * 1000,
      user: normalizeSessionUser(user)
    }),
    "utf8"
  );
  const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    sessionVersion,
    base64Url(iv),
    base64Url(tag),
    base64Url(ciphertext)
  ].join(".");
}

export function readSipassSessionToken(token, secret, now = Date.now()) {
  const [version, ivPart, tagPart, bodyPart] = String(token || "").split(".");
  if (version !== sessionVersion || !ivPart || !tagPart || !bodyPart) return null;

  try {
    const decipher = createDecipheriv("aes-256-gcm", sessionKey(secret), fromBase64Url(ivPart));
    decipher.setAuthTag(fromBase64Url(tagPart));
    const raw = Buffer.concat([decipher.update(fromBase64Url(bodyPart)), decipher.final()]).toString("utf8");
    const session = JSON.parse(raw);
    if (!session?.user?.id || Number(session.exp) <= now) return null;
    return normalizeSessionUser(session.user);
  } catch {
    return null;
  }
}

export function sessionUserFromRequest(request, env = process.env) {
  const secret = env.SIPASS_SESSION_SECRET;
  if (!secret) return null;
  const cookies = parseCookies(request.headers?.cookie || "");
  return readSipassSessionToken(cookies[SIPASS_SESSION_COOKIE], secret);
}

export function createSipassCookie(user, env = process.env) {
  const token = createSipassSessionToken(user, requiredSecret(env));
  return serializeCookie(SIPASS_SESSION_COOKIE, token, {
    domain: env.SIPASS_COOKIE_DOMAIN,
    secure: envFlag(env.SIPASS_COOKIE_SECURE, true),
    maxAge: SIPASS_SESSION_MAX_AGE_SECONDS
  });
}

export function clearSipassCookie(env = process.env) {
  return serializeCookie(SIPASS_SESSION_COOKIE, "", {
    domain: env.SIPASS_COOKIE_DOMAIN,
    secure: envFlag(env.SIPASS_COOKIE_SECURE, true),
    maxAge: 0
  });
}

export function sipassUserFromHeaders(headers, env = process.env) {
  const firstName = headerValue(headers, env.SIPASS_FIRST_NAME_HEADER, [
    "x-sipass-first-name",
    "sicas_ime",
    "sicas-ime"
  ]);
  const lastName = headerValue(headers, env.SIPASS_LAST_NAME_HEADER, [
    "x-sipass-last-name",
    "sicas_priimek",
    "sicas-priimek"
  ]);
  const emso = headerValue(headers, env.SIPASS_EMSO_HEADER, [
    "x-sipass-emso",
    "sicas_emso",
    "sicas-emso"
  ]);
  const taxNumber = headerValue(headers, env.SIPASS_TAX_NUMBER_HEADER, [
    "x-sipass-tax-number",
    "sicas_ds",
    "sicas-ds"
  ]);
  const token = headerValue(headers, env.SIPASS_TOKEN_HEADER, [
    "x-sipass-token",
    "sicas_token",
    "sicas-token",
    "remote_user"
  ]);
  const email = headerValue(headers, env.SIPASS_EMAIL_HEADER, [
    "x-sipass-email",
    "mail",
    "email"
  ]).toLowerCase();

  const stableIdentity = token || emso || taxNumber;
  if (!stableIdentity || (!firstName && !lastName)) return null;

  return normalizeSessionUser({
    id: sipassUserRef(stableIdentity, env.SIPASS_USER_REF_SALT || requiredSecret(env)),
    name: [firstName, lastName].filter(Boolean).join(" ") || "SI-PASS uporabnik",
    firstName,
    lastName,
    emso,
    taxNumber,
    email,
    role: "citizen",
    provider: "sipass",
    signedInAt: new Date().toISOString()
  });
}

export function normalizeSessionUser(value) {
  return {
    id: clean(value?.id, 160),
    name: cleanPersonName(value?.name, 200) || "SI-PASS uporabnik",
    firstName: cleanPersonName(value?.firstName, 120),
    lastName: cleanPersonName(value?.lastName, 120),
    emso: clean(value?.emso, 32),
    taxNumber: clean(value?.taxNumber, 32),
    email: clean(value?.email, 320).toLowerCase(),
    role: clean(value?.role, 40) || "citizen",
    provider: "sipass",
    signedInAt: clean(value?.signedInAt, 64) || new Date().toISOString()
  };
}

export function sanitizedReturnUrl(value, appOrigin) {
  const fallback = new URL("/", requiredOrigin(appOrigin));
  if (!value) return fallback.toString();

  try {
    const requested = new URL(value, fallback);
    return requested.origin === fallback.origin ? requested.toString() : fallback.toString();
  } catch {
    return fallback.toString();
  }
}

function sessionKey(secret) {
  return createHash("sha256").update(requiredSecret({ SIPASS_SESSION_SECRET: secret })).digest();
}

function requiredSecret(env) {
  const secret = String(env?.SIPASS_SESSION_SECRET || "").trim();
  if (secret.length < 32) {
    throw new Error("SIPASS_SESSION_SECRET must contain at least 32 characters.");
  }
  return secret;
}

function sipassUserRef(value, salt) {
  const digest = createHash("sha256")
    .update(String(salt || ""))
    .update("\0")
    .update(String(value || ""))
    .digest("hex");
  return `sipass-${digest.slice(0, 32)}`;
}

function serializeCookie(name, value, options) {
  const parts = [
    `${name}=${value}`,
    `Path=${cookiePath}`,
    `Max-Age=${options.maxAge}`,
    "HttpOnly",
    "SameSite=Lax"
  ];
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

function parseCookies(value) {
  return String(value || "")
    .split(";")
    .reduce((cookies, item) => {
      const index = item.indexOf("=");
      if (index <= 0) return cookies;
      cookies[item.slice(0, index).trim()] = item.slice(index + 1).trim();
      return cookies;
    }, {});
}

function headerValue(headers = {}, configuredName, fallbacks) {
  const names = [configuredName, ...fallbacks].filter(Boolean);
  for (const name of names) {
    const value = headers[String(name).toLowerCase()] ?? headers[name];
    const text = Array.isArray(value) ? value[0] : value;
    if (String(text || "").trim()) return cleanHeaderText(text, 512);
  }
  return "";
}

function cleanPersonName(value, maxLength) {
  return clean(repairMisdecodedUtf8(value), maxLength);
}

function cleanHeaderText(value, maxLength) {
  return clean(repairMisdecodedUtf8(value), maxLength);
}

function clean(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function repairMisdecodedUtf8(value) {
  const text = String(value || "").trim();
  if (!text || !mojibakePattern.test(text)) return text;

  const originalScore = textQuality(text);
  let best = text;
  let bestScore = originalScore;

  for (const encoding of mojibakeSourceEncodings) {
    const decoded = decodeMisdecodedUtf8(text, encoding);
    if (!decoded || decoded === text) continue;

    const score = textQuality(decoded);
    if (score < bestScore) {
      best = decoded;
      bestScore = score;
    }
  }

  return best;
}

function decodeMisdecodedUtf8(text, sourceEncoding) {
  const bytes = sourceEncoding === "latin1"
    ? latin1Bytes(text)
    : bytesFromSingleByteEncoding(text, sourceEncoding);
  if (!bytes) return "";
  return Buffer.from(bytes).toString("utf8");
}

function latin1Bytes(text) {
  const bytes = [];
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code > 0xff) return null;
    bytes.push(code);
  }
  return bytes;
}

function bytesFromSingleByteEncoding(text, encoding) {
  const reverse = reverseByteMap(encoding);
  const bytes = [];
  for (const char of text) {
    if (!reverse.has(char)) return null;
    bytes.push(reverse.get(char));
  }
  return bytes;
}

function reverseByteMap(encoding) {
  if (reverseByteMaps.has(encoding)) return reverseByteMaps.get(encoding);

  const decoder = new TextDecoder(encoding);
  const map = new Map();
  for (let byte = 0; byte <= 0xff; byte += 1) {
    const char = decoder.decode(Uint8Array.of(byte));
    if (char && char !== "\ufffd" && !map.has(char)) {
      map.set(char, byte);
    }
  }

  reverseByteMaps.set(encoding, map);
  return map;
}

function textQuality(value) {
  return (
    countMatches(value, badUtf8Pattern) * 100 +
    countMatches(value, mojibakePairPattern) * 5
  );
}

function countMatches(value, pattern) {
  return [...String(value || "").matchAll(pattern)].length;
}

function requiredOrigin(value) {
  const origin = String(value || "").trim();
  return origin || "https://demokracija-20.si";
}

function envFlag(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value) {
  return Buffer.from(value, "base64url");
}
