# Demos - Demokracija 2.0

Prototip spletne platforme za oddajo, pregled, glasovanje, komentiranje, AI predpregled in analitiko zakonodajnih pobud.

## Projektna dokumentacija za prevzem projekta

Ta README je namenjen tudi kot glavna projektna dokumentacija. Ideja je, da lahko nov razvijalec brez dodatnega Word dokumenta razume namen sistema, arhitekturo, podatkovne tokove, model baze, glavne use case-e, kakovostne kontrole in nacin dela na projektu.

### Namen sistema

Demokracija 2.0 je prototip platforme za pripravo zakonodajnih pobud. Uporabnik lahko pregleda pobude, odda novo pobudo, dobi AI predpregled skladnosti, glasuje, komentira in pobudo podpise s SI-PASS identiteto. Sistem enkrat letno pobude zapakira za posiljanje v Drzavni zbor, dnevno pa ustvarjalcem pobud posilja povzetek novih glasov, podpisov in komentarjev.

Sistem je zgrajen kot majhna web aplikacija brez klasicnega frameworka. Frontend je v `src/main.js`, domenska pravila so locena v `src/domain/*`, podatkovni dostop je v `src/lib/*`, backend endpointi pa so loceni v `api/*` in `server/*`. Produkcijski deployment cilja na Vercel + Supabase, lokalni razvoj pa uporablja `scripts/dev-server.mjs`.

### Glavni uporabniki in use case diagram

```mermaid
flowchart LR
  Citizen[Drzavljan / uporabnik]
  Anonymous[Neprijavljen obiskovalec]
  Creator[Ustvarjalec pobude]
  Admin[Demo admin]
  Sipass[SI-PASS uporabnik]

  Browse((Pregled pobud))
  Search((Iskanje in filtriranje))
  Vote((Anonimni ali prijavljeni glas))
  Submit((Oddaja pobude))
  AiReview((AI predpregled))
  Comment((Komentiranje))
  Sign((SI-PASS podpis))
  Export((PDF/DOCX/ODT izvoz za DZ))
  Analytics((Analitika pobud))
  SystemAnalytics((Sistemska analitika))
  DailyDigest((Dnevni email povzetek))

  Anonymous --> Browse
  Anonymous --> Search
  Anonymous --> Vote
  Citizen --> Browse
  Citizen --> Search
  Citizen --> Vote
  Citizen --> Submit
  Citizen --> AiReview
  Citizen --> Comment
  Creator --> DailyDigest
  Sipass --> Sign
  Admin --> Export
  Admin --> Analytics
  Admin --> SystemAnalytics
```

### Kontekstni diagram sistema

```mermaid
flowchart LR
  User[Uporabnik v brskalniku]
  Browser[Frontend app<br/>src/main.js]
  RuntimeConfig[/Runtime config<br/>config.local.js/]
  Vercel[Vercel serverless API<br/>api/*]
  ServerModules[Server moduli<br/>server/*]
  Supabase[(Supabase Postgres<br/>schema/search/analytics)]
  HF[Hugging Face AI]
  SMTP[SMTP streznik]
  Clarity[Microsoft Clarity]
  VercelAnalytics[Vercel Analytics<br/>Speed Insights]
  Turnstile[Cloudflare Turnstile]
  Sipass[SI-PASS / SI-CAS bridge]

  User --> Browser
  Browser --> RuntimeConfig
  Browser --> Vercel
  Browser --> VercelAnalytics
  Browser --> Clarity
  Browser --> Turnstile
  Browser --> Sipass
  Vercel --> ServerModules
  ServerModules --> Supabase
  ServerModules --> HF
  ServerModules --> SMTP
  ServerModules --> Clarity
```

### Arhitektura po plasteh

```mermaid
flowchart TB
  subgraph UI["Frontend UI"]
    Main[src/main.js<br/>DemocracyApp]
    Styles[src/styles.css]
    Config[src/config.js]
  end

  subgraph Domain["Domenska pravila"]
    Validation[src/domain/validation.js<br/>validacija, statusi, AI scoring]
    Notifications[src/domain/notifications.js<br/>email dogodki]
    Analytics[src/domain/analytics.js<br/>metrike in statistika]
    AiReview[src/domain/ai-review.js<br/>remote AI payload]
    Email[src/domain/email.js<br/>email normalizacija]
  end

  subgraph Repositories["Podatkovni dostop"]
    LocalRepo[src/lib/storage.js<br/>LocalInitiativeRepository]
    SupabaseRepo[src/lib/supabase.js<br/>SupabaseInitiativeRepository]
    Auth[src/lib/auth.js<br/>DemoAuth]
    Telemetry[src/lib/telemetry.js]
  end

  subgraph Api["HTTP endpointi"]
    ApiConfig[api/config.local.js]
    ApiInitiatives[api/initiatives.js]
    ApiSignatures[api/signatures.js]
    ApiNotifications["api/notifications/[...path].js"]
    ApiAnalytics["api/analytics/[...path].js"]
    ApiAuth["api/auth/[...path].js"]
    ApiAi[api/ai/review-initiative.js]
  end

  subgraph Server["Server logika"]
    ServerInitiatives[server/initiatives.mjs]
    ServerSignatures[server/signatures.mjs]
    ServerDigest[server/daily-digest.mjs]
    ServerEmail[server/email.mjs]
    ServerTurnstile[server/turnstile.mjs]
    ServerSipass[server/sipass-session.mjs]
  end

  Main --> Validation
  Main --> Notifications
  Main --> Analytics
  Main --> LocalRepo
  Main --> SupabaseRepo
  SupabaseRepo --> ApiInitiatives
  ApiInitiatives --> ServerInitiatives
  ApiSignatures --> ServerSignatures
  ApiNotifications --> ServerDigest
  ApiNotifications --> ServerEmail
  ServerInitiatives --> Validation
  ServerDigest --> Notifications
```

### Zakaj je arhitektura taka

- Frontend ostane preprost in pregleden, ker ni build koraka, ki bi skrival runtime nastavitve.
- Domenska pravila so v `src/domain`, da se ista validacija uporablja v UI, backendu in testih.
- Varnostno obcutljive operacije, kot so zapis pobude s service role kljucem, SI-PASS podpis, email posiljanje in Turnstile preverjanje, gredo prek backend endpointov.
- Supabase anon kljuc je javen in se uporablja samo za branje oziroma dovoljene javne RPC operacije; `SUPABASE_SERVICE_ROLE_KEY` ostane server-only.
- Lokalni development server posnema produkcijske endpoint-e, zato E2E smoke test preverja realno obliko aplikacije.

### Repozitorij in odgovornost datotek

| Pot | Namen |
| --- | --- |
| `src/main.js` | Glavna browser aplikacija, render pogledi, UI dogodki, izvoz PDF, povezava domene z repozitorijem. |
| `src/domain/validation.js` | Validacija pobude, statusi, lokalni AI scoring, glasovanje, podpisovanje, komentarji. |
| `src/domain/analytics.js` | Izracun metrik pobud, uporabnika in sistema. |
| `src/domain/notifications.js` | Gradnja email obvestil za statusne spremembe in dnevni digest. |
| `src/lib/supabase.js` | Supabase repozitorij, mapiranje SQL vrstic v domenski model, backend write endpointi. |
| `src/lib/storage.js` | Lokalni repozitorij za prototip in fallback. |
| `api/*` | Vercel entrypointi. Tanke HTTP plasti, ki delegirajo v `server/*`. |
| `server/*` | Server-only logika: service role Supabase requesti, SMTP, SI-PASS session, Turnstile, cron digest. |
| `supabase/schema.sql` | Osnovna shema, RLS, view-i in indeksi. |
| `supabase/search.sql` | Hybrid search RPC funkcije za full-text + fuzzy iskanje. |
| `tests/*` | Domain, E2E smoke in performance budget testi. |
| `.github/workflows/pipeline_demos.yml` | CI, testi, coverage in SonarCloud scan. |

### Podatkovni model in ER diagram

```mermaid
erDiagram
  INITIATIVES ||--o{ VOTES : receives
  INITIATIVES ||--o{ SIGNATURES : receives
  INITIATIVES ||--o{ COMMENTS : receives
  INITIATIVES ||--o{ INITIATIVE_AI_REVIEWS : has

  INITIATIVES {
    uuid id PK
    text title
    text summary
    text description
    initiative_category category
    initiative_status status
    text author_ref
    text author_name
    text notification_email
    int ai_score
    ai_risk_level ai_risk
    jsonb ai_findings
    jsonb ai_checks
    timestamptz created_at
    timestamptz updated_at
  }

  VOTES {
    uuid id PK
    uuid initiative_id FK
    text voter_ref
    text voter_name
    timestamptz created_at
  }

  SIGNATURES {
    uuid id PK
    uuid initiative_id FK
    text signer_ref
    text signer_name
    text method
    timestamptz created_at
  }

  COMMENTS {
    uuid id PK
    uuid initiative_id FK
    text author_ref
    text author_name
    text body
    timestamptz created_at
  }

  INITIATIVE_AI_REVIEWS {
    uuid id PK
    uuid initiative_id FK
    text provider
    text model
    int score
    ai_risk_level risk
    ai_suitability suitability
    jsonb findings
    jsonb checks
    timestamptz created_at
  }
```

Ključni view-i:

- `initiative_detail`: pobuda skupaj z agregiranimi `votes`, `signatures` in `comments` JSON seznami.
- `initiative_analytics`: izracun stevila glasov, podpisov, komentarjev, support score in AI podatkov.
- `category_analytics`: agregacija po kategorijah.

### Stanja pobude

```mermaid
stateDiagram-v2
  [*] --> review: oddaja pobude z visokim tveganjem
  [*] --> active: oddaja pobude z nizkim/srednjim tveganjem
  review --> active: admin potrdi
  review --> rejected: admin zavrne
  active --> signature_collection: prvi podpis
  signature_collection --> submitted: izvoz/oddaja DZ
  submitted --> [*]
  rejected --> [*]
```

Pomen statusov:

| Status | Pomen |
| --- | --- |
| `draft` | Lokalni osnutek, ni namenjen bazi kot javna pobuda. |
| `review` | Pobuda potrebuje uredniski/admin pregled. |
| `active` | Pobuda je javno aktivna, mozno je glasovanje in komentiranje. |
| `signature_collection` | Pobuda zbira podpise, omogočen je izvoz za DZ. |
| `submitted` | Pobuda je pripravljena oziroma oddana DZ. |
| `rejected` | Pobuda je zavrnjena. |

### Tok oddaje pobude

```mermaid
sequenceDiagram
  actor U as Uporabnik
  participant UI as DemocracyApp
  participant V as validateInitiative/evaluateInitiative
  participant T as Turnstile
  participant API as api/initiatives.js
  participant S as server/initiatives.mjs
  participant DB as Supabase
  participant N as Email notifications

  U->>UI: izpolni obrazec pobude
  UI->>V: validacija obveznih polj
  V-->>UI: errors ali normalized values
  UI->>T: preverjanje anti-bot tokena
  T-->>UI: verified
  UI->>U: zahteva email za obvestila
  U->>UI: potrdi notification email
  UI->>V: AI predpregled / score
  UI->>API: POST /api/initiatives
  API->>S: createServerInitiative
  S->>V: ponovno doloci actorja in domenski model
  S->>DB: insert initiatives s service role
  DB-->>S: shranjena pobuda
  S-->>API: initiative DTO
  API-->>UI: created initiative
  UI->>N: po potrebi statusna obvestila
```

Zakaj se validacija ponovi na serverju: frontend validacija je za uporabnisko izkusnjo, server validacija pa je meja zaupanja. Actor, author, status in `notification_email` se na koncu zapisujejo prek backenda, da frontend ne more samovoljno zapisati tujih avtorjev ali obiti pravil.

### Tok glasovanja, komentarjev in podpisov

```mermaid
flowchart TD
  Start[Uporabnik klikne akcijo] --> AuthCheck{Je potrebna prijava?}
  AuthCheck -->|Anonimni glas| PublicCheck{Je pobuda javno aktivna?}
  PublicCheck -->|Da| Vote[Zapis glasu]
  PublicCheck -->|Ne| Stop[Zavrni in prikazi sporocilo]
  AuthCheck -->|Komentar| LoggedIn{Je prijavljen?}
  LoggedIn -->|Da| Comment[Zapis komentarja]
  LoggedIn -->|Ne| Stop
  AuthCheck -->|SI-PASS podpis| SipassCheck{Je SI-PASS user?}
  SipassCheck -->|Da| Signature[POST /api/signatures]
  SipassCheck -->|Ne| Stop
  Vote --> Refresh[Osvezi pobude]
  Comment --> Refresh
  Signature --> Refresh
```

### Tok dnevnega email digest-a

```mermaid
sequenceDiagram
  participant Cron as Vercel cron
  participant API as /api/notifications/daily-digest
  participant Digest as server/daily-digest.mjs
  participant DB as Supabase
  participant Domain as buildInitiativeDailyDigestEmailNotifications
  participant SMTP as server/email.mjs

  Cron->>API: GET daily-digest
  API->>Digest: sendDailyCreatorDigest
  Digest->>DB: preberi votes/signatures/comments za dan
  Digest->>DB: preberi initiatives z notification_email
  Digest->>Digest: izracun novih dogodkov po pobudi
  Digest->>Domain: sestavi email povzetke
  Domain-->>Digest: notifications[]
  Digest->>SMTP: deliverEmailNotifications
  SMTP-->>Digest: accepted/sent/outbox
  Digest-->>API: JSON rezultat
```

Pomembno: glasovi, komentarji in podpisi se ne posiljajo sproti, ampak se zdruzijo v en dnevni email po pobudi. Statusna sprememba pa se poslje takoj.

### AI predpregled

AI pregled ima dve plasti:

- Lokalni rule engine v `src/domain/validation.js`, ki vedno deluje in izracuna `score`, `risk`, `suitability`, `completeness`, `categorySuggestion` in `findings`.
- Remote AI endpoint `/api/ai/review-initiative`, ki uporablja Hugging Face, ce je nastavljen `HF_TOKEN`. Ce remote endpoint pade ali token ni nastavljen, frontend uporabi lokalni fallback.

```mermaid
flowchart LR
  Form[Pobuda] --> Compact[src/domain/ai-review.js<br/>compact payload]
  Compact --> Endpoint["/api/ai/review-initiative"]
  Endpoint --> HF{HF_TOKEN nastavljen?}
  HF -->|Da| HuggingFace[Hugging Face model]
  HF -->|Ne| Local[local rule engine]
  HuggingFace --> Review[AI review DTO]
  Local --> Review
  Review --> UI[AI predpregled v UI]
```

### Razredni oziroma modulni diagram

```mermaid
classDiagram
  class DemocracyApp {
    +render()
    +handleClick(event)
    +handleSubmit(event)
    +refresh()
    +reviewInitiative(values)
  }

  class LocalInitiativeRepository {
    +list()
    +create(initiative)
    +vote(id, actor)
    +comment(id, body, actor)
  }

  class SupabaseInitiativeRepository {
    +list()
    +create(initiative)
    +vote(id, actor)
    +comment(id, body, actor)
    +request(path, options)
  }

  class DemoAuth {
    +currentUser()
    +signIn(user)
    +signOut()
  }

  class SystemTelemetry {
    +record(type, data)
    +flush()
  }

  class DomainValidation {
    +validateInitiative(input)
    +evaluateInitiative(input)
    +createInitiative(input, actor, review)
    +voteForInitiative(initiative, actor)
    +signInitiative(initiative, actor, method)
    +addComment(initiative, actor, body)
  }

  DemocracyApp --> LocalInitiativeRepository
  DemocracyApp --> SupabaseInitiativeRepository
  DemocracyApp --> DemoAuth
  DemocracyApp --> SystemTelemetry
  DemocracyApp --> DomainValidation
  SupabaseInitiativeRepository --> ServerInitiatives
  ServerInitiatives --> DomainValidation
```

### Deployment diagram

```mermaid
flowchart TB
  GitHub[GitHub repo] --> Actions[GitHub Actions CI]
  Actions --> Sonar[SonarCloud]
  Actions --> VercelDeploy[Vercel deploy]
  VercelDeploy --> Browser[Browser]
  VercelDeploy --> Api[Vercel API functions]
  Api --> Supabase[(Supabase)]
  Api --> SMTP[SMTP]
  Api --> HF[Hugging Face]
  Api --> ClarityAPI[Clarity Data Export API]
  Browser --> Clarity[Microsoft Clarity script]
  Browser --> VercelAnalytics[Vercel Analytics]
  Browser --> Turnstile[Cloudflare Turnstile]
```

### Runtime konfiguracija in skrivnosti

Frontend dobi samo javne nastavitve prek `/config.local.js`. To pomeni, da so v browserju dovoljeni `SUPABASE_URL`, `SUPABASE_ANON_KEY`, public endpointi, Clarity project id in Turnstile site key. Vse skrivnosti ostanejo server-only:

- `SUPABASE_SERVICE_ROLE_KEY`
- `HF_TOKEN`
- `SMTP_PASS`
- `CLARITY_API_TOKEN`
- `TURNSTILE_SECRET_KEY`
- `SIPASS_SESSION_SECRET`
- `SIPASS_USER_REF_SALT`
- `CRON_SECRET`

CI ima dodatno preverjanje, da frontend ne bere server-only secretov.

### Kakovost, testi in SonarCloud

```mermaid
flowchart LR
  Commit[Commit / PR] --> CI[GitHub Actions]
  CI --> NpmCi[npm ci]
  NpmCi --> Coverage[npm run test:coverage]
  Coverage --> Domain[Domain tests]
  Coverage --> E2E[E2E smoke tests]
  Coverage --> Perf[Performance budget tests]
  Coverage --> LCOV[coverage/lcov.info]
  LCOV --> Sonar[SonarCloud scan]
  CI --> Syntax[node --check]
  CI --> Wiring[deployment wiring checks]
  CI --> SecretScan[secret exposure checks]
```

Kakovostne plasti:

| Plast | Kaj preverja |
| --- | --- |
| `tests/domain.test.mjs` | Validacija, AI scoring, analitika, email obvestila, SI-PASS session, backend servisne funkcije. |
| `tests/e2e.test.mjs` | Lokalni dev server, statični asseti, runtime config, osnovni API endpointi, 404. |
| `tests/performance.test.mjs` | Velikost zacetnega payload-a in lazy-loading DOCX/ODT generatorja. |
| `scripts/run-coverage.mjs` | Ustvari `coverage/lcov.info` za SonarCloud brez dodatnih dependencyjev. |
| SonarCloud | Reliability, maintainability, security hotspots, coverage in duplication. |
| GitHub Actions | Avtomatski pipeline za teste, syntax check, wiring check in secret check. |

### Projektno vodenje in nacin dela

Projekt je voden iterativno. Vsaka vecja funkcionalnost ima:

1. domensko pravilo ali helper v `src/domain`,
2. UI integracijo v `src/main.js`,
3. backend pot v `api/*` oziroma `server/*`, ce zahteva skrivnosti ali service role,
4. SQL spremembo v `supabase/*`, ce gre za trajne podatke,
5. test v `tests/domain.test.mjs`, `tests/e2e.test.mjs` ali `tests/performance.test.mjs`,
6. dokumentacijsko sled v README ali `docs/*`.

Pri spremembah velja pravilo: najprej se doloci podatkovni tok in meja zaupanja, potem se implementira UI. Varnostno obcutljive operacije ne ostanejo samo v browserju.

### Kako naj nov razvijalec zacne

1. Preberi ta README do konca, posebej diagrame arhitekture, ER in data flow.
2. Zazeni `npm test`, da dobis baseline.
3. Zazeni `npm run dev` in odpri lokalni URL.
4. Preglej `src/main.js` za UI tokove in `src/domain/validation.js` za poslovna pravila.
5. Preglej `server/initiatives.mjs`, `server/signatures.mjs`, `server/daily-digest.mjs` za backend meje zaupanja.
6. Preglej `supabase/schema.sql` in `supabase/search.sql`, ce delas na podatkih ali iskanju.
7. Pred spremembo naredi majhen test ali vsaj opredeli, kateri obstojeci test dokazuje, da vedenje ostaja pravilno.

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

Za Supabase RPC hybrid search funkciji, ki podpirata iskanje pobud prek full-text + fuzzy ujemanja, po `supabase/schema.sql` izvedite se `supabase/search.sql`. Ta dva SQL skripta morata biti posodobljena tudi zaradi stolpca `notification_email`, ki ga uporablja dnevni email povzetek ustvarjalcu pobude. Ko je `DATA_SOURCE=supabase` in uporabnik vnese iskalni niz, aplikacija uporabi RPC `search_initiatives`; brez iskalnega niza ostane lokalno filtriranje ze nalozenih pobud.

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
npm run test:coverage
```

E2E test zazene `scripts/dev-server.mjs`, preveri aplikacijsko lupino, runtime config, glavne statice, AI fallback endpoint, email endpoint brez obvestil, Turnstile fallback in 404 odziv. Performance test preverja velikost zacetnega HTML/JS/CSS payload-a, locene budgete za `main.js` in `styles.css` ter to, da se DOCX/ODT generator nalozi sele ob prenosu dokumenta.
Coverage ukaz ustvari `coverage/lcov.info`, ki ga GitHub workflow poslje v SonarCloud.

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

## Hitri pregled po konceptih

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
