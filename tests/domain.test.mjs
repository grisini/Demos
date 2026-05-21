import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateAnalytics,
  calculateSystemAnalytics,
  calculateUserAnalytics
} from "../src/domain/analytics.js";
import { normalizeClarityInsights } from "../src/domain/clarity-insights.js";
import {
  NOTIFICATION_EVENTS,
  buildCategoryMatchEmailNotifications,
  buildInitiativeChangeEmailNotifications
} from "../src/domain/notifications.js";
import {
  addComment,
  createInitiative,
  evaluateInitiative,
  signInitiative,
  validateInitiative,
  voteForInitiative
} from "../src/domain/validation.js";
import {
  createSipassSessionToken,
  readSipassSessionToken,
  sipassUserFromHeaders
} from "../server/sipass-session.mjs";

const validInput = {
  title: "Javna sledljivost zakonodajnih sprememb",
  category: "Digitalna drzava",
  summary: "Pobuda uvaja javen pregled sprememb zakonodajnih predlogov skozi celoten postopek.",
  description:
    "Predlog doloca, da mora biti vsaka sprememba zakonodajnega predloga objavljena v primerjalnem prikazu z navedbo predlagatelja, faze postopka in obrazlozitve. Uporabniki lahko primerjajo razlicice po clenu in izvozijo povzetek sprememb.",
  legalReference: "Zakon o dostopu do informacij javnega znacaja",
  expectedImpact: "Vecja preglednost zakonodajnih postopkov in lazje sodelovanje javnosti."
};

const actor = {
  id: "demo@demos.local",
  name: "Demo uporabnik"
};
const hardcodedNotificationRecipient = "janezpederka@gmail.com";
const sipassEnv = {
  SIPASS_SESSION_SECRET: "test-sipass-session-secret-with-more-than-32-chars",
  SIPASS_USER_REF_SALT: "test-sipass-user-ref-salt"
};

test("validateInitiative zavrne prekratko pobudo", () => {
  const result = validateInitiative({ title: "Test", category: "Drugo", summary: "", description: "" });

  assert.equal(result.valid, false);
  assert.ok(result.errors.title);
  assert.ok(result.errors.summary);
  assert.ok(result.errors.description);
});

test("evaluateInitiative oznaci proracunsko tveganje", () => {
  const review = evaluateInitiative({
    ...validInput,
    description: `${validInput.description} Pobuda vpliva na proracun, davek, subvencija in transfer.`
  });

  assert.equal(review.risk, "high");
  assert.ok(review.checks.budgetHits.length >= 3);
  assert.equal(review.checks.suitability, "needs_review");
});

test("evaluateInitiative pripravi predlog kategorije in popolnost", () => {
  const review = evaluateInitiative({
    ...validInput,
    category: "Drugo",
    title: "Register cakalnih dob za paciente",
    summary: "Pobuda ureja javni register, kjer je cakalna doba vidna za paciente po izvajalcih.",
    description: `${validInput.description} Register mora zajeti zdravstvo, pacient, zdravnik in ambulanta podatke.`
  });

  assert.equal(review.checks.categorySuggestion.category, "Zdravstvo");
  assert.equal(review.checks.completeness.score, 100);
  assert.ok(review.findings.some((finding) => finding.includes("AI predlaga kategorijo Zdravstvo")));
});

test("glasovanje in podpis ne podvajata istega uporabnika", () => {
  const initiative = createInitiative(validInput, actor);
  const voted = voteForInitiative(initiative, actor);
  const votedAgain = voteForInitiative(voted, actor);
  const signed = signInitiative(votedAgain, actor);
  const signedAgain = signInitiative(signed, actor);

  assert.equal(votedAgain.votes.length, 1);
  assert.equal(signedAgain.signatures.length, 1);
});

test("komentar zahteva prijavljenega uporabnika in veljavno besedilo", () => {
  const initiative = createInitiative(validInput, actor);
  const commented = addComment(initiative, actor, "Podpiram predlog.");

  assert.equal(commented.comments.length, 1);
  assert.throws(() => addComment(initiative, null, "Brez prijave"));
  assert.throws(() => addComment(initiative, actor, "x"));
});

test("analytics izracuna osnovne kazalnike", () => {
  const first = addComment(signInitiative(voteForInitiative(createInitiative(validInput, actor), actor), actor), actor, "Podpiram.");
  const second = createInitiative({ ...validInput, title: "Register javnih razpisov" }, actor);
  const analytics = calculateAnalytics([first, second]);

  assert.equal(analytics.initiativeCount, 2);
  assert.equal(analytics.totalVotes, 1);
  assert.equal(analytics.totalSignatures, 1);
  assert.equal(analytics.totalComments, 1);
  assert.equal(analytics.topInitiatives[0].id, first.id);
  assert.equal(analytics.initiativeStats[0].votes, 1);
  assert.equal(analytics.voteDistribution.maxVotes, 1);
  assert.equal(analytics.categoryStats[0].votes, 1);
});

test("uporabniska analitika locuje moje pobude in aktivnost", () => {
  const otherActor = { id: "ana@example.test", name: "Ana" };
  const first = addComment(signInitiative(voteForInitiative(createInitiative(validInput, actor), otherActor), actor), actor, "Podpiram.");
  const second = voteForInitiative(createInitiative({ ...validInput, title: "Register javnih razpisov" }, otherActor), actor);
  const analytics = calculateUserAnalytics([first, second], actor);

  assert.equal(analytics.authoredCount, 1);
  assert.equal(analytics.votedCount, 1);
  assert.equal(analytics.signedCount, 1);
  assert.equal(analytics.commentsWritten, 1);
  assert.equal(analytics.supportReceived, 2);
  assert.equal(analytics.authoredCategoryStats[0].category, validInput.category);
});

test("sistemska analitika povzame ocenjeno porabo in dogodke", () => {
  const initiative = voteForInitiative(createInitiative(validInput, actor), {
    id: "anon-browser-1",
    name: "Anonimni glasovalec"
  });
  const analytics = calculateSystemAnalytics(
    [initiative],
    [
      { type: "ai_review", estimatedTokens: 120, durationMs: 320, provider: "huggingface" },
      { type: "email_notifications", count: 2, mode: "outbox" },
      { type: "vote", anonymous: true, sessionId: "session-1" }
    ],
    { resourceCount: 4, transferKb: 12.5, scriptCount: 2, stylesheetCount: 1, fetchCount: 1, loadMs: 80 }
  );

  assert.equal(analytics.initiativeRows, 1);
  assert.equal(analytics.voteRows, 1);
  assert.equal(analytics.aiRequestCount, 1);
  assert.equal(analytics.aiEstimatedTokens, 120);
  assert.equal(analytics.emailNotificationItems, 2);
  assert.equal(analytics.anonymousVoteRows, 1);
  assert.equal(analytics.anonymousVoteEvents, 1);
  assert.equal(analytics.uniqueSessionCount, 1);
  assert.equal(analytics.resourceSnapshot.transferKb, 12.5);
});

test("clarity insights normalizirajo grafe iz export API odziva", () => {
  const insights = normalizeClarityInsights(
    [
      {
        metricName: "Traffic",
        information: [
          { URL: "/?view=dashboard", totalSessionCount: "10", distantUserCount: "6", totalBotSessionCount: "1" },
          { URL: "/?view=analytics", totalSessionCount: "4", distantUserCount: "3" }
        ]
      },
      {
        metricName: "Dead Click Count",
        information: [{ URL: "/?view=dashboard", deadClickCount: "2" }]
      }
    ],
    { days: 1, dimension: "URL" }
  );

  assert.equal(insights.configured, true);
  assert.equal(insights.summary.sessions, 14);
  assert.equal(insights.summary.users, 9);
  assert.equal(insights.summary.deadClicks, 2);
  assert.equal(insights.charts[0].title, "Obiski po URL");
  assert.equal(insights.charts[0].rows[0].label, "/?view=dashboard");
});

test("obvestila o spremembi pobude ciljajo glasovalce brez akterja", () => {
  const otherActor = { id: "ana@example.test", name: "Ana" };
  const initiative = voteForInitiative(voteForInitiative(createInitiative(validInput, actor), actor), otherActor);
  const notifications = buildInitiativeChangeEmailNotifications({
    initiative,
    actor,
    eventType: NOTIFICATION_EVENTS.COMMENT_ADDED,
    commentBody: "Dodana je nova razlaga predloga."
  });

  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].to, hardcodedNotificationRecipient);
  assert.match(notifications[0].subject, /Nov komentar/);
  assert.match(notifications[0].text, /Javna sledljivost/);
});

test("hardcodan prejemnik dobi spremembo tudi brez glasov", () => {
  const initiative = createInitiative(validInput, actor);
  const notifications = buildInitiativeChangeEmailNotifications({
    initiative,
    actor,
    eventType: NOTIFICATION_EVENTS.STATUS_CHANGED,
    previousStatus: "review"
  });

  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].to, hardcodedNotificationRecipient);
});

test("nova pobuda obvesti glasovalce pobud iste kategorije", () => {
  const firstVoter = { id: "ana@example.test", name: "Ana" };
  const secondVoter = { id: "bor@example.test", name: "Bor" };
  const related = voteForInitiative(voteForInitiative(createInitiative(validInput, actor), firstVoter), secondVoter);
  const unrelated = voteForInitiative(
    createInitiative({ ...validInput, title: "Cistejsi zrak v mestih", category: "Okolje" }, firstVoter),
    firstVoter
  );
  const newInitiative = createInitiative({ ...validInput, title: "Odprti podatki javnih storitev" }, actor);
  const notifications = buildCategoryMatchEmailNotifications({
    newInitiative,
    initiatives: [related, unrelated],
    actor: firstVoter
  });

  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].to, hardcodedNotificationRecipient);
  assert.equal(notifications[0].metadata.category, validInput.category);
  assert.match(notifications[0].subject, /Nova pobuda/);
});

test("SI-PASS session mapira atribute in obnovi sifriranega uporabnika", () => {
  const user = sipassUserFromHeaders(
    {
      "x-sipass-first-name": "Ana",
      "x-sipass-last-name": "Novak",
      "x-sipass-emso": "0101006500006",
      "x-sipass-tax-number": "12345678",
      "x-sipass-token": "stable-sicas-token"
    },
    sipassEnv
  );

  assert.equal(user.name, "Ana Novak");
  assert.match(user.id, /^sipass-/);
  assert.notEqual(user.id, user.emso);
  assert.notEqual(user.id, user.taxNumber);
  assert.equal(user.email, "");

  const restored = readSipassSessionToken(
    createSipassSessionToken(user, sipassEnv.SIPASS_SESSION_SECRET),
    sipassEnv.SIPASS_SESSION_SECRET
  );

  assert.deepEqual(restored, user);
});
