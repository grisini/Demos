import test from "node:test";
import assert from "node:assert/strict";
import { calculateAnalytics } from "../src/domain/analytics.js";
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
