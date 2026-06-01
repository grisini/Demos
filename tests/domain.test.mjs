import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateAnalytics,
  calculateSystemAnalytics,
  calculateUserAnalytics
} from "../src/domain/analytics.js";
import { normalizeClarityInsights } from "../src/domain/clarity-insights.js";
import {
  REMOTE_AI_REVIEW_MAX_CHARS,
  buildRemoteAiReviewText,
  compactRemoteAiReviewPayload
} from "../src/domain/ai-review.js";
import {
  NOTIFICATION_EVENTS,
  buildCategoryMatchEmailNotifications,
  buildInitiativeChangeEmailNotifications
} from "../src/domain/notifications.js";
import {
  DOCX_MIME_TYPE,
  ODT_MIME_TYPE,
  buildInitiativeDocxBlob,
  buildInitiativeDocxPackage,
  buildInitiativeOdtBlob,
  buildInitiativeOdtPackage,
  initiativeDocxFileName,
  initiativeOdtFileName
} from "../src/lib/docx-export.js";
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
import { verifyTurnstileToken } from "../server/turnstile.mjs";

const validInput = {
  title: "Javna sledljivost zakonodajnih sprememb",
  category: "Digitalna drzava",
  summary: "Pobuda uvaja javen pregled sprememb zakonodajnih predlogov skozi celoten postopek.",
  description:
    "Predlog doloca, da mora biti vsaka sprememba zakonodajnega predloga objavljena v primerjalnem prikazu z navedbo predlagatelja, faze postopka in obrazlozitve. Uporabniki lahko primerjajo razlicice po clenu in izvozijo povzetek sprememb.",
  legalReference: "Zakon o dostopu do informacij javnega znacaja",
  expectedImpact:
    "Cilj je zagotoviti sledljivost zakonodajnih sprememb, nacelo javnosti postopka in enoten digitalen prikaz poglavitnih resitev.",
  legislativeText:
    "1. clen\nPredlagatelj spremembe zakonodajnega predloga mora navesti besedilo spremembe, razlog zanjo in fazo postopka.\n\n2. clen\nDrzavni organ objavi primerjalni prikaz sprememb v strojno berljivi obliki.",
  articleExplanation:
    "K 1. clenu: clen doloca obvezne podatke pri vsaki spremembi predloga zakona.\n\nK 2. clenu: clen doloca javno objavo primerjalnega prikaza in tehnicno obliko objave.",
  financialImpact:
    "Predlog ne predvideva pomembnih dodatnih izdatkov drzavnega proracuna; izvedba se zagotovi z nadgradnjo obstojecih informacijskih resitev.",
  budgetFunding:
    "Sredstva za izvedbo se zagotovijo v okviru ze sprejetih postavk za digitalizacijo zakonodajnih postopkov.",
  comparativeReview:
    "Primerljive resitve poznajo Estonija, Finska in Avstrija, kjer so zakonodajna gradiva javno dostopna z elektronskimi sledmi sprememb. Predlog je skladen s pravom Evropske unije, ker krepi transparentnost in dostop do informacij.",
  impactAssessment:
    "Administrativne posledice so omejene na dopolnitev objav. Okoljskih ali prostorskih posledic ni. Gospodarski in socialni ucinki so pozitivni zaradi lazjega spremljanja pravil. Predlog podpira razvojno nacrtovanje digitalne drzave.",
  publicParticipation:
    "Javnost je sodelovala prek komentarjev v aplikaciji, evidentiranih glasov podpore in demo podpisov pobude.",
  proposerRepresentatives: "Demo uporabnik, predstavnik predlagateljev",
  affectedProvisions:
    "Ce bi se predlog vlozil kot novela, se prilozi besedilo dolocb zakona, ki urejajo objavo zakonodajnih gradiv."
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
  assert.ok(result.errors.legislativeText);
  assert.ok(result.errors.articleExplanation);
  assert.ok(result.errors.comparativeReview);
});

test("validateInitiative sprejme DZ popoln predlog zakona", () => {
  const result = validateInitiative(validInput);

  assert.equal(result.valid, true);
  assert.equal(result.values.legislativeText, validInput.legislativeText);
  assert.equal(result.values.articleExplanation, validInput.articleExplanation);
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

test("remote AI pregled skrajsa razsirjen DZ template", () => {
  const longSection = "Dolgo besedilo za predlog zakona z obrazlozitvijo in pravnimi posledicami. ".repeat(220);
  const longInput = {
    ...validInput,
    description: longSection,
    legislativeText: longSection,
    articleExplanation: longSection,
    comparativeReview: longSection,
    impactAssessment: longSection
  };
  const text = buildRemoteAiReviewText(longInput);
  const payload = compactRemoteAiReviewPayload(longInput);

  assert.ok(text.length <= REMOTE_AI_REVIEW_MAX_CHARS);
  assert.match(text, /Naslov:/);
  assert.match(text, /Besedilo clenov:/);
  assert.ok(payload.description.length < longInput.description.length);
  assert.ok(JSON.stringify(payload).length < JSON.stringify(longInput).length);
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

test("DOCX izvoz ustvari OpenXML paket za Word", () => {
  const initiative = {
    ...addComment(signInitiative(createInitiative(validInput, actor), actor), actor, "Podpiram predlog."),
    status: "submitted"
  };
  const bytes = buildInitiativeDocxPackage(initiative, actor, {
    generatedAt: "2026-05-22T10:00:00.000Z"
  });
  const decoded = new TextDecoder().decode(bytes);
  const blob = buildInitiativeDocxBlob(initiative, actor, {
    generatedAt: "2026-05-22T10:00:00.000Z"
  });

  assert.deepEqual([...bytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  assert.match(decoded, /\[Content_Types\]\.xml/);
  assert.match(decoded, /word\/document\.xml/);
  assert.match(decoded, /Javna sledljivost zakonodajnih sprememb/);
  assert.match(decoded, /Besedilo clenov/);
  assert.match(decoded, /Primerjalni prikaz in pravo EU/);
  assert.match(decoded, /Certifikat skladnosti s slovensko zakonodajo/);
  assert.equal(blob.type, DOCX_MIME_TYPE);
  assert.ok(blob.size > 4000);
  assert.equal(
    initiativeDocxFileName(initiative),
    "demos-javna-sledljivost-zakonodajnih-sprememb-dz-izvoz.docx"
  );
});

test("ODT izvoz ustvari OpenDocument paket", () => {
  const initiative = {
    ...addComment(signInitiative(createInitiative(validInput, actor), actor), actor, "Podpiram predlog."),
    status: "submitted"
  };
  const bytes = buildInitiativeOdtPackage(initiative, actor, {
    generatedAt: "2026-05-22T10:00:00.000Z"
  });
  const decoded = new TextDecoder().decode(bytes);
  const blob = buildInitiativeOdtBlob(initiative, actor, {
    generatedAt: "2026-05-22T10:00:00.000Z"
  });

  assert.deepEqual([...bytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  assert.match(decoded, /application\/vnd\.oasis\.opendocument\.text/);
  assert.match(decoded, /content\.xml/);
  assert.match(decoded, /Javna sledljivost zakonodajnih sprememb/);
  assert.match(decoded, /Besedilo clenov/);
  assert.match(decoded, /Primerjalni prikaz in pravo EU/);
  assert.match(decoded, /Certifikat skladnosti s slovensko zakonodajo/);
  assert.equal(blob.type, ODT_MIME_TYPE);
  assert.ok(blob.size > 4000);
  assert.equal(
    initiativeOdtFileName(initiative),
    "demos-javna-sledljivost-zakonodajnih-sprememb-dz-izvoz.odt"
  );
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
    { resourceCount: 4, transferKb: 12.5, scriptCount: 2, stylesheetCount: 1, fetchCount: 1, loadMs: 80 },
    {
      configured: true,
      days: 1,
      rawMetricCount: 3,
      summary: {
        sessions: 7,
        users: 4,
        botSessions: 1,
        deadClicks: 2,
        rageClicks: 1,
        scriptErrors: 3
      },
      charts: [{ key: "traffic" }]
    }
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
  assert.equal(analytics.clarity.configured, true);
  assert.equal(analytics.clarity.sessions, 7);
  assert.equal(analytics.clarity.deadClicks + analytics.clarity.rageClicks + analytics.clarity.scriptErrors, 6);
  assert.equal(analytics.clarity.chartCount, 1);
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

test("Turnstile zavrne preverjanje brez server secret kljuca", async () => {
  const result = await verifyTurnstileToken(
    { token: "token", action: "initiative_submit" },
    {
      env: {},
      fetchImpl: async () => {
        throw new Error("fetch ne sme biti klican");
      }
    }
  );

  assert.equal(result.configured, false);
  assert.equal(result.verified, false);
});

test("Turnstile potrdi uspesen Siteverify odziv", async () => {
  const result = await verifyTurnstileToken(
    { token: "valid-token", action: "initiative_submit" },
    {
      env: {
        TURNSTILE_SECRET_KEY: "secret",
        TURNSTILE_ALLOWED_HOSTNAMES: "localhost"
      },
      remoteIp: "127.0.0.1",
      fetchImpl: async (url, options) => {
        assert.equal(url, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
        const body = new URLSearchParams(String(options.body));
        assert.equal(body.get("secret"), "secret");
        assert.equal(body.get("response"), "valid-token");
        assert.equal(body.get("remoteip"), "127.0.0.1");
        return {
          ok: true,
          async json() {
            return {
              success: true,
              action: "initiative_submit",
              hostname: "localhost"
            };
          }
        };
      }
    }
  );

  assert.equal(result.configured, true);
  assert.equal(result.verified, true);
  assert.equal(result.hostname, "localhost");
});

test("Turnstile zavrne nepricakovan hostname", async () => {
  const result = await verifyTurnstileToken(
    { token: "valid-token", action: "initiative_submit" },
    {
      env: {
        TURNSTILE_SECRET_KEY: "secret",
        TURNSTILE_ALLOWED_HOSTNAMES: "demos.example"
      },
      fetchImpl: async () => ({
        ok: true,
        async json() {
          return {
            success: true,
            action: "initiative_submit",
            hostname: "attacker.example"
          };
        }
      })
    }
  );

  assert.equal(result.configured, true);
  assert.equal(result.verified, false);
  assert.match(result.error, /hostname/);
});
