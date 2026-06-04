# Demos - Demokracija 2.0

Prototip spletne platforme za oddajo, pregled, glasovanje, komentiranje, AI predpregled in analitiko zakonodajnih pobud.

## Zagon

```bash
npm run dev
```

Privzeti naslov je `http://localhost:5173`. Ce je port zaseden, razvojni streznik uporabi naslednji prosti port.

Za Render/Railway-style runtime zagon je na voljo tudi:

```bash
npm start
```

## Deployment env

Projekt uporablja runtime config skripto `/config.local.js`, ki v brskalnik poslje samo javne nastavitve. Lokalno jo generira `scripts/dev-server.mjs`, na Vercelu pa jo generira `api/config.local.js` prek pravila v `vercel.json`.

Za Vercel, Render ali Railway nastavite vsaj:

```bash
DATA_SOURCE=supabase
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=PUBLIC_ANON_KEY
AI_PROVIDER=huggingface
MICROSOFT_CLARITY_PROJECT_ID=...
SYSTEM_ANALYTICS_ENDPOINT=/api/analytics/system
CLARITY_ANALYTICS_ENDPOINT=/api/analytics/clarity
TURNSTILE_SITE_KEY=...
TURNSTILE_ENDPOINT=/api/security/turnstile
```

Koda podpira tudi `VITE_*` alias kljuce, ce deployment uporablja pravi Vite build:

```bash
VITE_DATA_SOURCE=supabase
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=PUBLIC_ANON_KEY
VITE_AI_PROVIDER=huggingface
```

Po spremembi env varov na hostingu je potreben nov deploy oziroma redeploy. `SUPABASE_SERVICE_ROLE_KEY`, `HF_TOKEN`, `CLARITY_API_TOKEN`, SMTP gesla in podobni privatni kljuci ne smejo biti `VITE_*` in ne smejo v frontend.

Za zascito oddaje pobud pred avtomatiziranimi oddajami nastavite Cloudflare Turnstile. Public `TURNSTILE_SITE_KEY` gre v runtime config, server-only `TURNSTILE_SECRET_KEY` pa ostane samo v Vercel oziroma strezniskem okolju. Dodatno lahko omejite dovoljene hoste z `TURNSTILE_ALLOWED_HOSTNAMES`.

Obstojeci backend endpointi imajo aplikacijski in-memory rate limiting in vracajo `429`, ko isti odjemalec preseze dovoljeno stevilo zahtevkov. V produkciji to dopolnite se s Cloudflare Rate Limiting pravili, ker serverless instance nimajo globalnega trajnega stevca.

Ce zelite, da admin sistemska analitika na Vercelu bere skupne dogodke vseh uporabnikov, dodajte tudi server-only `SUPABASE_SERVICE_ROLE_KEY` in v Supabase izvedite zadnjo verzijo `supabase/schema.sql`, ki vsebuje tabelo `system_analytics_events`.

SI-PASS podpis pobude uporablja backend endpoint `/api/signatures`, zato za produkcijski podpis dodajte server-only `SUPABASE_SERVICE_ROLE_KEY` in v Supabase izvedite `supabase/signatures-security.sql`, ki zapre direktno vstavljanje podpisov prek javnega anon kljuca.

Za razsirjeno shranjevanje vseh analiticnih dogodkov, dnevne snapshot-e in SQL porocila po `supabase/schema.sql` izvedite se `supabase/analytics.sql`.

Za Supabase RPC hybrid search funkciji, ki podpirata iskanje pobud prek full-text + fuzzy ujemanja, po `supabase/schema.sql` izvedite se `supabase/search.sql`. Ko je `DATA_SOURCE=supabase` in uporabnik vnese iskalni niz, aplikacija uporabi RPC `search_initiatives`; brez iskalnega niza ostane lokalno filtriranje ze nalozenih pobud.

Ce zelite, da uporabniki v aplikaciji vidijo agregirane Clarity grafe v zavihku `Analitika pobud`, v Vercel dodajte se server-only `CLARITY_API_TOKEN`. Ta token pridobi admin projekta v Microsoft Clarity pod Settings -> Data Export.

## Testi

```bash
npm test
```

Celoten ukaz zaporedno izvede domenske teste, E2E smoke test lokalnega streznika in performance budget test. Posamezne plasti lahko poganjate tudi loceno:

```bash
npm run test:domain
npm run test:e2e
npm run test:performance
```

E2E test zazene `scripts/dev-server.mjs`, preveri aplikacijsko lupino, runtime config, glavne statice, AI fallback endpoint, email endpoint brez obvestil, Turnstile fallback in 404 odziv. Performance test preverja velikost zacetnega HTML/JS/CSS payload-a, locene budgete za `main.js` in `styles.css` ter to, da se DOCX/ODT generator nalozi sele ob prenosu dokumenta.

## Trenutno pokrito

- razvojna prijava za lokalno preverjanje SI-PASS in admin scenarijev,
- oddaja pobude z osnovno validacijo,
- Hugging Face AI predpregled besedila pobude s score, risk, suitability, completeness in categorySuggestion,
- lokalni AI predpregled kot fallback, kadar Hugging Face ni nastavljen ali ni dosegljiv,
- pregled, iskanje, filtriranje in razvrscanje pobud,
- javni pregled aktualnih pobud za neprijavljene uporabnike,
- anonimno glasovanje z omejitvijo enega glasu na pobudo na lokalni brskalniski ID,
- glasovanje, SI-PASS evidencni podpis, komentarji in statusi,
- PDF tiskanje, PDF prenos in DOCX/Word prenos pobude za DZ pri statusih `signature_collection` in `submitted`, tudi za SI-PASS prijavljenega uporabnika,
- email obvestila ustvarjalcu pobude ob spremembi statusa in dnevni povzetek novih glasov, podpisov ter komentarjev,
- napredna statistika glasov na pobudo, kategorije, komentarje in AI tveganja,
- osebna analitika pobud za prijavljenega uporabnika,
- admin sistemska analitika za oceno AI klicev, tokenov, email dogodkov in frontend virov,
- Vercel Web Analytics za hosting/SEO statistiko,
- Vercel Speed Insights za Core Web Vitals in performance metrike,
- Microsoft Clarity za vedenjsko analitiko sej, custom tags in events,
- Cloudflare Turnstile server-side preverjanje za oddajo pobude,
- aplikacijski rate limiting za obstojece backend endpoint-e,
- varnostni HTTP headerji in CSP za Vercel ter lokalni razvojni streznik,
- Supabase SQL shema in konfiguracijski nastavki,
- povzetek SI-PASS testnega okolja,
- celostni E2E smoke test lokalnega streznika in osnovnih API tokov,
- performance budget test za zacetni payload in lazy-loading DOCX/ODT izvoza.

## Glavni uporabniki in pravice

Glavne vloge aplikacije so:

- **Neprijavljen uporabnik**: pregleda javno vidne aktualne pobude, isce in filtrira javni seznam ter odda en anonimen glas na pobudo.
- **SI-PASS prijavljen uporabnik**: uporablja vse javne funkcije, odda pobudo, glasuje, komentira, izvede SI-PASS evidencni podpis, vidi osebno analitiko ter izvozi PDF/DOCX/ODT dokument pri statusih `signature_collection` in `submitted`.
- **Admin**: uporablja administrativne funkcije za urejanje statusov, pregled integracij in sistemsko analitiko. Admin pravica je locena od SI-PASS podpisa; SI-PASS podpis se izvede samo s SI-PASS sejo.

Razvojna demo prijava ni locena glavna vloga. Uporablja se samo za lokalno preverjanje zgornjih scenarijev, kadar prava SI-PASS seja ali admin prijava nista na voljo.

## Dokumentacija

- `docs/pregled-projekta.md` - celovit tehnicni in funkcionalni pregled projekta,
- `docs/funkcionalnosti.md` - zivi register funkcionalnosti, statusov, dokazov v kodi in preverjanja,
- `docs/analitika.md` - tri analiticne plasti in navodila za Vercel, Clarity in admin pogled,
- `docs/varnost.md` - Turnstile, WAF/CDN, ZAP in produkcijske varnostne omejitve,
- `docs/hybrid-search.md` - Supabase RPC hybrid search, SQL funkcije, frontend tok in troubleshooting,
- `docs/dnevnik-dopolnitev.md` - sprotni dnevnik dopolnitev in kronologija commitov,
- `docs/git-zgodovina.md` - kronoloski povzetek razvoja iz git zgodovine,
- `docs/roadmap.md` - izvedba po iteracijah,
- `docs/devwork-loop.md` - sprotna porocila in kontrolne tocke,
- `docs/iteracija-3-analitika-ai.md` - analitika, AI predpregled, shema in Hugging Face pot,
- `docs/diagrams.md` - Mermaid use-case, UML, ER in zaporedni diagrami,
- `docs/classDiagram.mmd` - izvor UML class diagrama,
- `docs/erDiagram.mmd` - izvor ER diagrama,
- `docs/sequenceDiagram.mmd` - izvor zaporednega diagrama,
- `docs/flowchart LR.mmd` - izvor Mermaid use-case diagrama glavnih uporabnikov,
- `docs/ci-cd-pipeline.md` - predlagan GitHub Actions pipeline,
- `docs/supabase.md` - Supabase povezava,
- `docs/baza-porocilo.md` - porocilo o zasnovi baze in razlogih za podatkovni model,
- `docs/si-pass-testno-okolje.md` - razvojne opombe za SI-PASS,
- `docs/sipass-podpisi.md` - SI-PASS evidencni podpis pobude prek backend endpointa,
- `docs/sipass-sicas-ces-priklop.md` - podrobnejsi opis SI-PASS, SI-CAS in SI-CES priklopa,
- `docs/sicas-vps-vzpostavitev.md` - zapisnik izvedene VPS/Shibboleth vzpostavitve,
- `docs/sicas-sices-vps-checklist.md` - kratek VPS checklist za SI-CAS/SI-CES,
- `docs/sicas-sp-metadata.xml` - staticni SI-CAS SP metadata izvoz brez Shibboleth opozorilnega komentarja.

## Hitri pregled za ocenjevanje

1. Preberite `docs/pregled-projekta.md` za arhitekturo, DevWork koncept in znane omejitve.
2. Preverite `docs/funkcionalnosti.md` za seznam implementiranih, delnih in pripravljenih funkcionalnosti.
3. Preverite `docs/git-zgodovina.md` za dokaz iterativnega razvoja.
4. Zazenite `npm test`.
5. Zazenite `npm run dev` in rocno preverite oddajo pobude, glasovanje, podpis, komentar, AI predpregled in analitiko.

## Hugging Face

Kljuc naj bo samo v `.env.local` ali okolju, ne v `src` datotekah:

```bash
AI_PROVIDER=huggingface
AI_REVIEW_ENDPOINT=/api/ai/review-initiative
HUGGINGFACE_ZERO_SHOT_MODEL=facebook/bart-large-mnli
HUGGINGFACE_EMBEDDING_MODEL=intfloat/multilingual-e5-small
HF_TOKEN=hf_...
```

Lokalno endpoint `/api/ai/review-initiative` zagotovi `scripts/dev-server.mjs`, na Vercelu pa `api/ai/review-initiative.js`. Frontend vidi samo endpoint, `HF_TOKEN` ostane server-only. Ob napaki aplikacija samodejno pade nazaj na lokalno presojo.

## SI-PASS prijava

Gumb `SI-PASS prijava` odpira VPS bridge na `auth.demokracija-20.si`. Bridge mora biti za pot `/auth/sipass/complete` zasciten s Shibbolethom, nato pa Vercel aplikaciji izda sifrirano sejo prek `HttpOnly` cookieja za domeno `.demokracija-20.si`.

Potrebni skrivni nastavitvi na VPS in Vercelu sta isti:

```env
SIPASS_SESSION_SECRET=...
SIPASS_USER_REF_SALT=...
```

Apache proxy, `attribute-map.xml` in ostale VPS spremenljivke so opisane v `docs/sipass-sicas-ces-priklop.md`.

## Analitike

Projekt uporablja tri locene analiticne plasti:

- **Vercel Web Analytics**: promet, strani in SEO pogled v Vercel dashboardu; vidi ga lastnik hostinga.
- **Vercel Speed Insights**: Core Web Vitals in hitrost strani v Vercel dashboardu; vidi ga lastnik hostinga.
- **Sistemska analitika**: pogled samo za admin email, nastavljen v `ADMIN_EMAILS`; namenjen je oceni obremenitev, AI klicev, tokenov, email dogodkov, uporabniskih sledi in javne vidnosti pobud.
- **Analitika pobud**: aplikacijski pogled za splosne metrike pobud, osebno statistiko prijavljenega uporabnika in agregirane Clarity grafe prek server-side Data Export API. Microsoft Clarity dodatno belezi seje, custom tags in dogodke.

Brez prijave je vidna samo zacetna stran z aktualnimi pobudami. Neprijavljen uporabnik lahko odda en anonimen glas na pobudo, ne vidi pa oddaje pobude, podpisovanja, komentarjev, osebne analitike, integracij ali sistemske analitike.

Za interni pogled v `.env` ali Vercel nastavite `ADMIN_EMAILS`, nato se z istim emailom prijavite prek gumba `Demo prijava`.

Za Clarity nastavite:

```bash
MICROSOFT_CLARITY_PROJECT_ID=...
CLARITY_API_TOKEN=...
```

Podrobna navodila so v `docs/analitika.md`.

## Email obvestila

Statusna sprememba pobude takoj pošlje email ustvarjalcu pobude. Glasovi, SI-PASS podpisi in komentarji se ne pošiljajo sproti; Vercel cron enkrat dnevno pokliče `GET /api/notifications/daily-digest` in ustvarjalcu pošlje en dnevni povzetek po pobudi, npr. `Število novih glasov: +2134`.

Lokalno endpoint zagotovi `scripts/dev-server.mjs`, na Vercelu pa `api/notifications/[...path].js`. Brez SMTP nastavitev se obvestila samo zabelezijo v log; za dejansko posiljanje nastavite SMTP podatke v `.env.local` ali v deployment env:

```bash
EMAIL_NOTIFICATIONS_ENDPOINT=/api/notifications/email
PUBLIC_SITE_URL=https://demokracija-20.si
DAILY_DIGEST_TIME_ZONE=Europe/Ljubljana
CRON_SECRET= ....
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_STARTTLS=true
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM="Demokracija 2.0 <no-reply@example.com>"
```

Za testiranje vseh obvestil na en naslov in tudi dogodkov, ki jih sprozi isti uporabnik, lahko dodate:

```bash
EMAIL_TEST_RECIPIENT=test@example.com
EMAIL_NOTIFY_ACTOR=true
```
