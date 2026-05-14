import { statusLabel } from "./validation.js";

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const HARDCODED_NOTIFICATION_RECIPIENT = "janezpederka@gmail.com";

export const NOTIFICATION_EVENTS = {
  STATUS_CHANGED: "status_changed",
  COMMENT_ADDED: "comment_added",
  VOTE_ADDED: "vote_added",
  SIGNATURE_ADDED: "signature_added",
  CATEGORY_MATCH_CREATED: "category_match_created"
};

export function buildInitiativeChangeEmailNotifications({
  initiative,
  actor,
  eventType,
  previousStatus,
  commentBody,
  siteUrl,
  includeActor = false
} = {}) {
  if (!initiative) return [];

  const recipients = initiativeVoteRecipients([initiative], actor, { includeActor });
  console.info("[Demokracija 2.0] Email domain: sprememba pobude", {
    initiativeId: initiative.id,
    eventType: eventType || "initiative_changed",
    category: initiative.category,
    recipientCount: recipients.length,
    recipients: recipients.map((recipient) => maskEmail(recipient.email)),
    actor: maskEmail(actor?.email || actor?.id)
  });

  const message = initiativeChangeMessage({ initiative, eventType, previousStatus, commentBody, siteUrl });

  return recipients.map((recipient) =>
    emailNotification({
      type: eventType || "initiative_changed",
      recipient,
      subject: message.subject,
      text: greeting(recipient) + message.text,
      metadata: {
        initiativeId: initiative.id,
        category: initiative.category,
        eventType: eventType || "initiative_changed"
      }
    })
  );
}

export function buildCategoryMatchEmailNotifications({
  newInitiative,
  initiatives = [],
  actor,
  siteUrl,
  includeActor = false
} = {}) {
  if (!newInitiative?.category) return [];

  const relatedInitiatives = initiatives.filter(
    (initiative) => initiative.id !== newInitiative.id && initiative.category === newInitiative.category
  );
  const recipients = initiativeVoteRecipients(relatedInitiatives, actor, { includeActor });
  console.info("[Demokracija 2.0] Email domain: nova pobuda v isti kategoriji", {
    initiativeId: newInitiative.id,
    category: newInitiative.category,
    relatedInitiatives: relatedInitiatives.length,
    recipientCount: recipients.length,
    recipients: recipients.map((recipient) => maskEmail(recipient.email)),
    actor: maskEmail(actor?.email || actor?.id)
  });

  const appUrl = cleanSiteUrl(siteUrl);

  return recipients.map((recipient) =>
    emailNotification({
      type: NOTIFICATION_EVENTS.CATEGORY_MATCH_CREATED,
      recipient,
      subject: `Nova pobuda v kategoriji ${newInitiative.category}`,
      text:
        greeting(recipient) +
        [
          `Ker ste glasovali za pobudo v kategoriji "${newInitiative.category}", vas obvescamo o novi pobudi v isti kategoriji.`,
          "",
          `Nova pobuda: ${newInitiative.title}`,
          `Status: ${statusLabel(newInitiative.status)}`,
          `Povzetek: ${newInitiative.summary}`,
          "",
          `Odprite aplikacijo: ${appUrl}`
        ].join("\n"),
      metadata: {
        initiativeId: newInitiative.id,
        category: newInitiative.category,
        eventType: NOTIFICATION_EVENTS.CATEGORY_MATCH_CREATED
      }
    })
  );
}

export function initiativeVoteRecipients(initiatives = [], actor, { includeActor = false } = {}) {
  const recipients = new Map();
  addHardcodedRecipient(recipients);

  for (const initiative of initiatives) {
    const votes = Array.isArray(initiative?.votes) ? initiative.votes : [];
    for (const vote of votes) {
      const recipient = recipientFromInteraction(vote);
      if (!recipient) continue;
      if (!includeActor && isSameActor(recipient, vote, actor)) {
        console.info("[Demokracija 2.0] Email domain: prejemnik izlocen, ker je akter dogodka", {
          recipient: maskEmail(recipient.email),
          interactionUserId: maskEmail(vote?.userId || vote?.id),
          actor: maskEmail(actor?.email || actor?.id)
        });
        continue;
      }
      recipients.set(recipient.email.toLowerCase(), recipient);
    }
  }

  return [...recipients.values()];
}

export function isValidEmail(value) {
  return EMAIL_PATTERN.test(String(value || "").trim());
}

function initiativeChangeMessage({ initiative, eventType, previousStatus, commentBody, siteUrl }) {
  const appUrl = cleanSiteUrl(siteUrl);
  const lines = [
    `Pobuda: ${initiative.title}`,
    `Kategorija: ${initiative.category}`,
    `Status: ${statusLabel(initiative.status)}`
  ];

  if (eventType === NOTIFICATION_EVENTS.STATUS_CHANGED) {
    lines.unshift(
      `Status pobude, za katero ste glasovali, se je spremenil iz "${statusLabel(previousStatus)}" v "${statusLabel(
        initiative.status
      )}".`
    );
  } else if (eventType === NOTIFICATION_EVENTS.COMMENT_ADDED) {
    lines.unshift(`Pri pobudi, za katero ste glasovali, je bil objavljen nov komentar: "${truncate(commentBody, 180)}"`);
  } else if (eventType === NOTIFICATION_EVENTS.VOTE_ADDED) {
    lines.unshift(`Pobuda, za katero ste glasovali, ima nov glas. Trenutno stevilo glasov: ${initiative.votes?.length || 0}.`);
  } else if (eventType === NOTIFICATION_EVENTS.SIGNATURE_ADDED) {
    lines.unshift(
      `Pobuda, za katero ste glasovali, ima nov podpis. Trenutno stevilo podpisov: ${initiative.signatures?.length || 0}.`
    );
  } else {
    lines.unshift("Pobuda, za katero ste glasovali, je bila posodobljena.");
  }

  lines.push("", `Odprite aplikacijo: ${appUrl}`);

  return {
    subject: initiativeChangeSubject(initiative, eventType),
    text: lines.join("\n")
  };
}

function initiativeChangeSubject(initiative, eventType) {
  if (eventType === NOTIFICATION_EVENTS.STATUS_CHANGED) return `Sprememba statusa: ${initiative.title}`;
  if (eventType === NOTIFICATION_EVENTS.COMMENT_ADDED) return `Nov komentar: ${initiative.title}`;
  if (eventType === NOTIFICATION_EVENTS.VOTE_ADDED) return `Nov glas: ${initiative.title}`;
  if (eventType === NOTIFICATION_EVENTS.SIGNATURE_ADDED) return `Nov podpis: ${initiative.title}`;
  return `Posodobitev pobude: ${initiative.title}`;
}

function recipientFromInteraction(interaction) {
  const email = firstValidEmail(
    HARDCODED_NOTIFICATION_RECIPIENT,
    interaction?.userEmail,
    interaction?.email,
    interaction?.userId,
    interaction?.id
  );
  console.info("[Demokracija 2.0] Email domain: prejemnik iz interakcije", {
    derivedEmail: maskEmail(email),
    interactionUserId: maskEmail(interaction?.userId || interaction?.id),
    interactionUserName: interaction?.userName || interaction?.name || "",
    hardcodedRecipient: maskEmail(HARDCODED_NOTIFICATION_RECIPIENT)
  });
  if (!email) return null;

  return {
    email,
    name: String(interaction?.userName || interaction?.name || email).trim()
  };
}

function addHardcodedRecipient(recipients) {
  const email = firstValidEmail(HARDCODED_NOTIFICATION_RECIPIENT);
  if (!email) return;

  recipients.set(email, {
    email,
    name: email
  });

  console.info("[Demokracija 2.0] Email domain: dodan hardcodan prejemnik", {
    hardcodedRecipient: maskEmail(email)
  });
}

function firstValidEmail(...values) {
  return values.map((value) => String(value || "").trim().toLowerCase()).find(isValidEmail) || "";
}

function isSameActor(recipient, interaction, actor) {
  if (!actor) return false;
  const actorEmail = firstValidEmail(actor.email, actor.id);
  const actorId = String(actor.id || "").trim();

  return (
    (actorEmail && recipient.email.toLowerCase() === actorEmail) ||
    (actorId && String(interaction?.userId || interaction?.id || "").trim() === actorId)
  );
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

function truncate(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
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
