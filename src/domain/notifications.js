import { statusLabel } from "./validation.js";

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const HARDCODED_NOTIFICATION_RECIPIENT = "janezpederka@gmail.com";

export const NOTIFICATION_EVENTS = {
  STATUS_CHANGED: "status_changed",
  COMMENT_ADDED: "comment_added",
  VOTE_ADDED: "vote_added",
  SIGNATURE_ADDED: "signature_added",
  CATEGORY_MATCH_CREATED: "category_match_created",
  DAILY_CREATOR_DIGEST: "daily_creator_digest"
};

export function buildInitiativeChangeEmailNotifications({
  initiative,
  actor,
  eventType,
  previousStatus,
  siteUrl
} = {}) {
  if (!initiative || eventType !== NOTIFICATION_EVENTS.STATUS_CHANGED) return [];

  const recipients = notificationRecipients(initiativeAuthorRecipient(initiative));
  console.info("[Demokracija 2.0] Email domain: sprememba pobude", {
    initiativeId: initiative.id,
    eventType,
    category: initiative.category,
    recipientCount: recipients.length,
    recipients: recipients.map((item) => maskEmail(item.email)),
    actor: maskEmail(actor?.email || actor?.id)
  });

  const message = initiativeStatusChangeMessage({ initiative, previousStatus, siteUrl });

  return recipients.map((item) =>
    emailNotification({
      type: eventType,
      recipient: item,
      subject: message.subject,
      text: greeting(item) + message.text,
      metadata: {
        initiativeId: initiative.id,
        category: initiative.category,
        eventType
      }
    })
  );
}

export function buildCategoryMatchEmailNotifications({
  newInitiative,
  actor
} = {}) {
  console.info("[Demokracija 2.0] Email domain: obvestilo o novi sorodni pobudi preskočeno", {
    initiativeId: newInitiative?.id,
    category: newInitiative?.category,
    actor: maskEmail(actor?.email || actor?.id)
  });
  return [];
}

export function buildInitiativeDailyDigestEmailNotifications({ initiative, dateKey, counts = {}, siteUrl } = {}) {
  if (!initiative) return [];
  const recipients = notificationRecipients(initiativeAuthorRecipient(initiative));
  if (!recipients.length) return [];

  const normalizedCounts = {
    votes: Math.max(0, Number(counts.votes) || 0),
    signatures: Math.max(0, Number(counts.signatures) || 0),
    comments: Math.max(0, Number(counts.comments) || 0)
  };
  const total = normalizedCounts.votes + normalizedCounts.signatures + normalizedCounts.comments;
  if (!total) return [];

  console.info("[Demokracija 2.0] Email domain: dnevni povzetek ustvarjalcu pobude", {
    initiativeId: initiative.id,
    dateKey,
    recipients: recipients.map((item) => maskEmail(item.email)),
    counts: normalizedCounts
  });

  const appUrl = cleanSiteUrl(siteUrl);

  return recipients.map((recipient) =>
    emailNotification({
      type: NOTIFICATION_EVENTS.DAILY_CREATOR_DIGEST,
      recipient,
      subject: `Dnevni povzetek pobude: ${initiative.title}`,
      text:
        greeting(recipient) +
        [
          `Dnevni povzetek aktivnosti za pobudo "${initiative.title}"${dateKey ? ` (${dateKey})` : ""}.`,
          "",
          `Število novih glasov: +${normalizedCounts.votes}`,
          `Število novih podpisov: +${normalizedCounts.signatures}`,
          `Število novih komentarjev: +${normalizedCounts.comments}`,
          "",
          `Status: ${statusLabel(initiative.status)}`,
          `Odprite aplikacijo: ${appUrl}`
        ].join("\n"),
      metadata: {
        initiativeId: initiative.id,
        category: initiative.category,
        eventType: NOTIFICATION_EVENTS.DAILY_CREATOR_DIGEST,
        dateKey,
        counts: normalizedCounts
      }
    })
  );
}

export function isValidEmail(value) {
  return EMAIL_PATTERN.test(String(value || "").trim());
}

function initiativeStatusChangeMessage({ initiative, previousStatus, siteUrl }) {
  const appUrl = cleanSiteUrl(siteUrl);
  return {
    subject: `Sprememba statusa pobude: ${initiative.title}`,
    text: [
      `Status vaše pobude se je spremenil iz "${statusLabel(previousStatus)}" v "${statusLabel(initiative.status)}".`,
      `Pobuda: ${initiative.title}`,
      `Kategorija: ${initiative.category}`,
      `Status: ${statusLabel(initiative.status)}`,
      "",
      `Odprite aplikacijo: ${appUrl}`
    ].join("\n")
  };
}

function initiativeAuthorRecipient(initiative) {
  const email = firstValidEmail(initiative?.author?.email, initiative?.author?.id);
  if (!email) return null;
  return {
    email,
    name: String(initiative?.author?.name || email).trim()
  };
}

function notificationRecipients(primaryRecipient) {
  const recipients = new Map();
  addRecipient(recipients, primaryRecipient);
  const hardcodedEmail = firstValidEmail(HARDCODED_NOTIFICATION_RECIPIENT);
  if (hardcodedEmail) {
    addRecipient(recipients, {
      email: hardcodedEmail,
      name: "Demo prejemnik"
    });
  }
  return [...recipients.values()];
}

function addRecipient(recipients, recipient) {
  const email = firstValidEmail(recipient?.email);
  if (!email) return;
  recipients.set(email, {
    email,
    name: String(recipient?.name || email).trim()
  });
}

function firstValidEmail(...values) {
  return values.map((value) => String(value || "").trim().toLowerCase()).find(isValidEmail) || "";
}

function emailNotification({ type, recipient, subject, text, metadata }) {
  return {
    id: notificationId(),
    type,
    to: recipient.email,
    toName: recipient.name,
    subject,
    text,
    metadata: {
      ...metadata,
      createdAt: new Date().toISOString()
    }
  };
}

function greeting(recipient) {
  return `Pozdravljeni ${recipient.name},\n\n`;
}

function cleanSiteUrl(siteUrl) {
  return String(siteUrl || "http://localhost:5173").replace(/\/$/, "");
}

function notificationId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `notification-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function maskEmail(value) {
  const email = String(value || "");
  const [name, domain] = email.split("@");
  if (!name || !domain) return email || "(brez)";
  return `${name.slice(0, 2)}***@${domain}`;
}
