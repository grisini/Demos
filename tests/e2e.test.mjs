import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";

const server = await startDevServer();

test.after(async () => {
  server.process.kill();
  await Promise.race([
    once(server.process, "exit"),
    delay(1500)
  ]).catch(() => {});
});

test("E2E: aplikacijska lupina in javni asseti se nalozijo", async () => {
  const htmlResponse = await request("/");
  assert.equal(htmlResponse.status, 200);
  assert.match(htmlResponse.headers.get("content-type") || "", /text\/html/);

  const html = await htmlResponse.text();
  assert.match(html, /<div id="app"/);
  assert.match(html, /\/config\.local\.js/);
  assert.match(html, /\/src\/main\.js/);

  const [configResponse, mainResponse, stylesResponse] = await Promise.all([
    request("/config.local.js"),
    request("/src/main.js"),
    request("/src/styles.css")
  ]);

  assert.equal(configResponse.status, 200);
  assert.match(configResponse.headers.get("content-type") || "", /text\/javascript/);
  const configText = await configResponse.text();
  assert.match(configText, /window\.DEMOS_CONFIG/);
  assert.doesNotMatch(configText, /HF_TOKEN|SMTP_PASS|SUPABASE_SERVICE|CRON_SECRET/);

  assert.equal(mainResponse.status, 200);
  assert.match(mainResponse.headers.get("content-type") || "", /text\/javascript/);
  assert.match(await mainResponse.text(), /class DemocracyApp/);

  assert.equal(stylesResponse.status, 200);
  assert.match(stylesResponse.headers.get("content-type") || "", /text\/css/);
  assert.match(await stylesResponse.text(), /\.dashboard-layout/);
});

test("E2E: API endpointi vrnejo predvidljive odzive brez zunanjih storitev", async () => {
  const aiResponse = await request("/api/ai/review-initiative", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(validInitiativePayload())
  });
  assert.equal(aiResponse.status, 200);
  const aiReview = await aiResponse.json();
  assert.equal(aiReview.checks.provider, "local");
  assert.equal(typeof aiReview.score, "number");
  assert.ok(Array.isArray(aiReview.findings));

  const emailResponse = await request("/api/notifications/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notifications: [] })
  });
  assert.equal(emailResponse.status, 202);
  assert.deepEqual(await emailResponse.json(), { accepted: 0, mode: "none" });

  const turnstileResponse = await request("/api/security/turnstile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "", action: "initiative_submit" })
  });
  assert.equal(turnstileResponse.status, 503);
  const turnstile = await turnstileResponse.json();
  assert.equal(turnstile.configured, false);
  assert.equal(turnstile.verified, false);
});

test("E2E: neobstojeca pot vrne 404", async () => {
  const response = await request("/__missing-route__");
  assert.equal(response.status, 404);
});

async function request(path, options) {
  return fetch(new URL(path, server.url), options);
}

async function startDevServer() {
  const requestedPort = String(5700 + Math.floor(Math.random() * 700));
  const child = spawn(process.execPath, ["scripts/dev-server.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: requestedPort,
      DATA_SOURCE: "local",
      VITE_DATA_SOURCE: "local",
      AI_PROVIDER: "local",
      HF_TOKEN: "",
      SMTP_HOST: "",
      SMTP_USER: "",
      SMTP_PASS: "",
      EMAIL_TEST_RECIPIENT: "",
      TURNSTILE_SECRET_KEY: "",
      CLOUDFLARE_TURNSTILE_SECRET_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      SUPABASE_SERVICE_KEY: "",
      CRON_SECRET: ""
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let output = "";
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Dev server se ni zagnal dovolj hitro. Izhod:\n${output}`));
    }, 10000);
    timeoutId.unref?.();
  });
  const ready = new Promise((resolve, reject) => {
    child.once("exit", (code) => reject(new Error(`Dev server se je koncal s kodo ${code}. Izhod:\n${output}`)));
    child.stdout.on("data", (chunk) => {
      output += chunk;
      const match = output.match(/http:\/\/localhost:(\d+)/);
      if (match) {
        resolve({
          process: child,
          url: `http://localhost:${match[1]}`
        });
      }
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
  });

  const result = await Promise.race([ready, timeout]);
  clearTimeout(timeoutId);
  return result;
}

function validInitiativePayload() {
  return {
    title: "Javna sledljivost zakonodajnih sprememb",
    category: "Digitalna drzava",
    summary: "Pobuda uvaja javen pregled sprememb zakonodajnih predlogov skozi celoten postopek.",
    description:
      "Predlog doloca, da mora biti vsaka sprememba zakonodajnega predloga objavljena v primerjalnem prikazu z navedbo predlagatelja, faze postopka in obrazlozitve.",
    legalReference: "Zakon o dostopu do informacij javnega znacaja",
    expectedImpact: "Cilj je zagotoviti sledljivost zakonodajnih sprememb in enoten digitalen prikaz resitev.",
    legislativeText:
      "1. clen\nPredlagatelj spremembe zakonodajnega predloga mora navesti besedilo spremembe in razlog zanjo.",
    articleExplanation:
      "K 1. clenu: clen doloca obvezne podatke pri vsaki spremembi predloga zakona in nacin objave.",
    financialImpact: "Predlog ne predvideva pomembnih dodatnih izdatkov drzavnega proracuna.",
    budgetFunding: "Sredstva se zagotovijo v okviru obstojecih postavk za digitalizacijo.",
    comparativeReview:
      "Primerljive resitve poznajo Estonija, Finska in Avstrija, kjer so zakonodajna gradiva javno dostopna z elektronskimi sledmi sprememb.",
    impactAssessment:
      "Administrativne posledice so omejene na dopolnitev objav. Gospodarski in socialni ucinki so pozitivni zaradi lazjega spremljanja pravil.",
    publicParticipation: "Javnost je sodelovala prek komentarjev in evidentiranih glasov podpore.",
    proposerRepresentatives: "Demo uporabnik",
    affectedProvisions: ""
  };
}
