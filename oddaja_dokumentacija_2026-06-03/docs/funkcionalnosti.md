# Register funkcionalnosti

Datum revizije: 2026-06-04

Krovni povzetek zadnje verzije je v `docs/stanje-zadnje-verzije.md`. Ta register spodaj razbije isto stanje na preverljive funkcionalnosti, dokaz v kodi in odprte produkcijske omejitve.

Ta dokument je zivi register funkcionalnosti projekta **Demokracija 2.0**. Namenjen je temu, da profesor ali mentor hitro vidi:

- kaj aplikacija ze podpira,
- kje je funkcionalnost implementirana,
- kako je preverjena,
- kateri kompromisi so zavestno ostali v prototipu.

Statusi v tabeli:

- **Implementirano**: funkcionalnost obstaja v kodi in jo je mogoce uporabiti.
- **Delno implementirano**: funkcionalnost deluje za demo ali razvoj, vendar potrebuje produkcijsko utrditev.
- **Pripravljeno**: obstaja zasnova, shema ali konfiguracijski nastavek, manjkajo pa realni zunanji podatki ali storitev.
- **Naslednji korak**: dokumentirano kot nacrt, izvedba se manjka.

## Funkcionalni register

| ID | Funkcionalnost | Status | Dokaz v kodi | Preverjanje | Opombe |
| --- | --- | --- | --- | --- | --- |
| F-01 | Demo prijava uporabnika | Implementirano | `src/lib/auth.js`, `src/main.js` | Rocni zagon aplikacije | Identiteta se hrani v `localStorage`; to ni produkcijski SI-PASS tok. |
| F-02 | Oddaja zakonodajne pobude | Implementirano | `src/main.js`, `src/domain/validation.js` | `tests/domain.test.mjs` | Obrazec zajame sestavine predloga zakona za DZ: uvod, besedilo clenov, obrazlozitev, financne posledice, primerjalni prikaz, presoje posledic, javnost in predstavnike. |
| F-03 | Validacija pobude | Implementirano | `src/domain/validation.js`, `supabase/schema.sql` | `npm test` | Minimalne dolzine so preverjene v domeni; SQL shema hrani tudi dodatna DZ polja. |
| F-04 | Lokalni AI predpregled | Implementirano | `evaluateInitiative()` v `src/domain/validation.js` | `npm test` | Uporablja pravila za obseg, pravne izraze, proracunska tveganja in kategorijo. |
| F-05 | Hugging Face AI predpregled | Delno implementirano | `scripts/dev-server.mjs`, `api/ai/review-initiative.js`, `src/main.js`, `src/domain/ai-review.js` | `npm test`, E2E smoke, rocni POST na `/api/ai/review-initiative` | Endpoint obstaja lokalno in na Vercelu; delno je zato, ker je odvisen od `HF_TOKEN` in zunanjega modela, fallback pa ostane lokalni. |
| F-06 | AI fallback ob napaki | Implementirano | `reviewInitiative()` v `src/main.js` | Rocni test brez `HF_TOKEN` | Ob nedosegljivem zunanjem modelu aplikacija uporabi lokalno presojo. |
| F-07 | Seznam pobud | Implementirano | `renderDashboardView()` v `src/main.js` | Rocni zagon aplikacije | Prikazuje pobude, osnovne metrike in izbran detail. |
| F-08 | Iskanje pobud | Implementirano | `filteredInitiatives()`, `loadRemoteSearch()` v `src/main.js`, `SupabaseInitiativeRepository.search()`, `supabase/search.sql` | Rocni zagon aplikacije, `npm test`, SQL primeri v `docs/hybrid-search.md` | Lokalno isce po ze nalozenih pobudah; pri `DATA_SOURCE=supabase` in queryju z vsaj 2 znaka uporabi RPC `search_initiatives`. |
| F-09 | Filtriranje po kategoriji in statusu | Implementirano | `filteredInitiatives()` v `src/main.js` | Rocni zagon aplikacije | Kategorije in statusi so enotni z domeno. |
| F-10 | Razvrscanje pobud | Implementirano | `filteredInitiatives()` v `src/main.js` | Rocni zagon aplikacije | Podprto po popularnosti, datumu in AI oceni. |
| F-11 | Detail pobude | Implementirano | `renderInitiativeDetail()` v `src/main.js` | Rocni zagon aplikacije | Vkljucuje opis, metrike, AI ugotovitve, glasove, podpise in komentarje. |
| F-12 | Glasovanje | Implementirano | `voteForInitiative()`, `src/lib/storage.js`, `src/lib/supabase.js` | `npm test` | Pravilo "en uporabnik, en glas" je v domeni in v bazi z `unique`. |
| F-13 | SI-PASS evidencni podpis pobude | Implementirano | `src/main.js`, `api/signatures.js`, `server/signatures.mjs`, `server/sipass-session.mjs`, `supabase/signatures-security.sql` | `npm test`, rocni SI-PASS tok | Frontend poslje samo `initiativeId`; backend iz `HttpOnly` SI-PASS seje sam doloci podpisnika in zapise `method = "sipass"`. |
| F-14 | Komentiranje pobud | Implementirano | `addComment()`, `src/main.js` | `npm test` | Komentar potrebuje prijavljenega uporabnika in vsaj 3 znake. |
| F-15 | Spreminjanje statusa pobude | Implementirano | `src/main.js`, `api/initiatives.js`, `server/initiatives.mjs`, `src/domain/validation.js` | `npm test` | UI je viden adminu, backend pa spremembo zavrne za navadnega uporabnika. Produkcijsko ostaja potreben trajnejsi IAM model. |
| F-16 | Osnovna in napredna analitika | Implementirano | `src/domain/analytics.js`, `src/main.js` | `npm test` | Vkljucuje glasove, podpise, komentarje, kategorije, porazdelitev in AI tveganja. |
| F-17 | SQL pogledi za analitiko | Implementirano | `supabase/schema.sql`, `supabase/analytics.sql` | Pregled SQL sheme, `npm test` | Poleg `initiative_analytics` in `category_analytics` obstajajo se `analytics_*` view-i za dogodke, AI, email, frontend, poslovne dogodke, pobude, kategorije in sistem. |
| F-18 | LocalStorage repozitorij | Implementirano | `src/lib/storage.js` | Rocni zagon aplikacije | Privzeti nacin za hitro lokalno predstavitev. |
| F-19 | Supabase repozitorij | Delno implementirano | `src/lib/supabase.js`, `api/initiatives.js`, `server/initiatives.mjs`, `supabase/schema.sql`, `supabase/backend-write-security.sql` | `npm test`, rocno z `.env.local` | Branje in del pisanja sta pripravljena; za produkcijo je treba izvesti utrditvene SQL skripte in glasovanje prestaviti na backend. |
| F-20 | Email obvestila o spremembah | Implementirano | `src/domain/notifications.js`, `src/lib/notifications.js`, `api/notifications/[...path].js`, `server/email.mjs`, `server/daily-digest.mjs`, `scripts/dev-server.mjs` | `npm test`, E2E smoke | Statusne spremembe in dnevni digest uporabljajo backend email logiko; brez SMTP se uporabi outbox/log nacin. |
| F-21 | Outbox email nacin | Implementirano | `server/email.mjs`, `scripts/dev-server.mjs` | Rocni zagon aplikacije | Brez SMTP podatkov se obvestila zabelezijo v log/outbox in ne ustavijo uporabniskega toka. |
| F-22 | SMTP email posiljanje | Delno implementirano | `server/email.mjs`, `api/notifications/[...path].js`, `scripts/dev-server.mjs` | `npm test`, rocno z realnimi SMTP nastavitvami | Podprti so `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`; delno zaradi odvisnosti od zunanjega SMTP okolja. |
| F-23 | Runtime konfiguracija | Implementirano | `src/config.js`, `scripts/dev-server.mjs` | Rocni zagon aplikacije | `config.local.js` v brskalnik poslje samo javne nastavitve. |
| F-24 | SI-PASS session prijava | Delno implementirano | `src/lib/auth.js`, `server/sipass-session.mjs`, `api/auth/[...path].js`, `scripts/dev-server.mjs`, `src/main.js` | `npm test`, rocni SI-PASS/VPS smoke | Session model, cookie, logout in UTF-8 popravljanje imen so implementirani; pravi zunanji SI-CAS test je odvisen od registriranega okolja. |
| F-25 | SI-CAS / SI-CeS priklop | Delno implementirano | `server/sices.mjs`, `scripts/dev-server.mjs`, `supabase/sices-signatures.sql`, `docs/sipass-sicas-ces-priklop.md`, `docs/sicas-vps-vzpostavitev.md` | `npm test`, rocni VPS/SI-CAS/SI-CeS test | SI-CAS bridge in SI-CeS helperji so pripravljeni; Vercel `api/sices/*` entrypointi se niso loceno dodani. |
| F-26 | Supabase RLS zascita | Delno implementirano | `supabase/schema.sql` | Pregled SQL sheme | RLS je vklopljen, politike so za demo odprte in niso produkcijske. |
| F-27 | Mermaid diagrami | Implementirano | `docs/diagrams.md`, `docs/*.mmd` | Pregled dokumentacije | Diagrami pokrivajo uporabniski tok, zaporedje, UML, ER in DevWork loop. |
| F-28 | Domenski testi | Implementirano | `tests/domain.test.mjs` | `npm test` | Pokrivajo validacijo, AI presojo, glasovanje, podpis, komentarje, analitiko, email domensko logiko, rate limiter in Turnstile server-side preverjanje. |
| F-29 | CI/CD pipeline | Implementirano | `.github/workflows/pipeline_demos.yml` | GitHub Actions ali lokalni pregled YAML | Pipeline namesti odvisnosti, zazene teste in preveri odsotnost lokalnih skrivnosti. |
| F-30 | Vercel Web Analytics | Implementirano | `src/lib/vercel-analytics.js`, `src/main.js`, `package.json` | Deploy na Vercel in obisk strani | Namenjeno je hostingu, prometu in SEO pogledu; vidi ga lastnik Vercel projekta. |
| F-31 | Vercel Speed Insights | Implementirano | `src/lib/vercel-speed-insights.js`, `src/main.js`, `package.json` | Deploy na Vercel in obisk strani | Namenjeno je Core Web Vitals in performance metrikam; route se posodobi pri SPA preklopu pogleda. |
| F-32 | Microsoft Clarity vedenjska analitika | Delno implementirano | `src/lib/clarity.js`, `src/lib/clarity-insights.js`, `src/domain/clarity-insights.js`, `api/analytics/[...path].js`, `server/analytics-clarity.mjs`, `src/main.js`, `src/config.js` | Nastavi `MICROSOFT_CLARITY_PROJECT_ID` in server-only `CLARITY_API_TOKEN`, nato preveri `Analitika pobud` in Clarity dashboard | Clarity belezi seje, tags in events; prijavljeni uporabniki vidijo agregirane grafe iz Data Export API. Heatmapi in posnetki sej ostanejo v Clarity dashboardu. |
| F-33 | Osebna analitika pobud | Implementirano | `calculateUserAnalytics()`, `renderAnalyticsView()` | `npm test` | Vsak prijavljen uporabnik vidi svoje pobude, glasove, podpise, komentarje, podporo in zadnjo aktivnost. |
| F-34 | Admin sistemska analitika | Delno implementirano | `calculateSystemAnalytics()`, `src/lib/telemetry.js`, `api/analytics/[...path].js`, `server/analytics-system.mjs`, `renderSystemAnalyticsView()` | `npm test`, prijava z emailom iz `ADMIN_EMAILS` | Dostop ima samo admin uporabnik. Na Vercelu sprejema dogodke prek API funkcije; s `SUPABASE_SERVICE_ROLE_KEY` jih zapise v `system_analytics_events`. Ocena tokenov ostaja priblizek. |
| F-35 | Javni pogled za neprijavljene | Implementirano | `visibleInitiatives()`, `renderDashboardView()`, `renderPublicInitiativeDetail()` | Rocni zagon aplikacije | Brez prijave so vidne samo pobude s statusom `active` ali `signature_collection`; oddaja pobude, komentarji, podpisi in analitike ostanejo zaklenjeni. |
| F-36 | Anonimno enkratno glasovanje | Delno implementirano | `anonymousActor()`, `voteForInitiative()`, `LocalInitiativeRepository.vote()` | `npm test`, rocni zagon aplikacije | Uporablja lokalni ID `demos.anonymousVoterId` in domensko pravilo en glas na pobudo. To je prototipna zascita; produkcijsko mora biti podprta z backend omejitvami. |
| F-37 | Admin-only integracije | Implementirano | `normalizeView()`, `render()` navigacija, `renderIntegrationsView()` | Rocni zagon aplikacije kot demo uporabnik in demo admin | Zavihek `Integracije` vidi samo demo admin; navaden uporabnik je preusmerjen na pregled. |
| F-38 | PDF izvoz pobude za DZ | Implementirano | `renderInitiativeDetail()`, `openInitiativePrintExport()`, `downloadInitiativePdfExport()` v `src/main.js` | Rocni zagon aplikacije, status `Zbiranje podpisov` ali `Oddana DZ` | Izvoz je omogocen pri `signature_collection` in `submitted`; PDF vsebuje formalne sklope predloga zakona. |
| F-39 | DOCX/ODT izvoz pobude za DZ | Implementirano | `src/lib/docx-export.js`, `downloadInitiativeDocxExport()`, `downloadInitiativeOdtExport()` in `renderInitiativeDetail()` v `src/main.js` | `npm test`, rocni zagon aplikacije, status `Zbiranje podpisov` ali `Oddana DZ` | Aplikacija ustvari `.docx` OpenXML ali `.odt` OpenDocument paket v brskalniku, z obveznimi vsebinskimi sklopi za DZ, podpisniki, AI predpregledom in metapodatki dokumenta. |
| F-40 | Cloudflare Turnstile za oddajo pobude | Delno implementirano | `src/lib/turnstile.js`, `api/security/turnstile.js`, `server/turnstile.mjs`, `src/main.js` | `npm test`, nastavljen `TURNSTILE_SITE_KEY` in `TURNSTILE_SECRET_KEY` | Oddaja pobude pred zapisom preveri Turnstile token na backendu. Za polno produkcijsko varnost je treba pisalne Supabase akcije prestaviti na backend. |
| F-41 | Aplikacijski rate limiting in varnostni headerji | Implementirano | `server/rate-limit.mjs`, `server/security-headers.mjs`, `api/*`, `scripts/dev-server.mjs`, `vercel.json` | `npm test` | Backend endpointi omejujejo stevilo zahtevkov po IP, lokalni in Vercel odzivi pa vracajo CSP, `nosniff`, `X-Frame-Options`, `Referrer-Policy` in `Permissions-Policy`. Cloudflare rate limiting ostaja priporocen robni sloj. |
| F-42 | Backend oddaja pobud in komentarjev | Delno implementirano | `api/initiatives.js`, `server/initiatives.mjs`, `src/lib/supabase.js`, `supabase/backend-write-security.sql` | `npm test` | Backend doloci actorja in uporablja service role. Glasovanje je se delno vezano na repozitorij/frontend tok in potrebuje produkcijsko utrditev. |
| F-43 | Dnevni email digest ustvarjalcu | Implementirano | `api/notifications/[...path].js`, `server/daily-digest.mjs`, `server/email.mjs`, `vercel.json` | `npm test`, Vercel cron | Cron `/api/notifications/daily-digest` enkrat dnevno zdruzi glasove, podpise in komentarje po pobudi. |
| F-44 | SI-CeS podpisni helperji | Delno implementirano | `server/sices.mjs`, `scripts/dev-server.mjs`, `supabase/sices-signatures.sql`, `tests/domain.test.mjs` | `npm test` | SOAP helperji, konfiguracija, start/complete/callback logika in podatkovna polja obstajajo; produkcijski Vercel/VPS routing mora biti zakljucen v ciljnem okolju. |
| F-45 | Dostopnostni pogled | Implementirano | `renderAccessibilityView()` v `src/main.js`, `src/styles.css`, `docs/dostopnost.md` | Rocni pregled, E2E smoke | Uporabnik lahko prilagodi velikost besedila, kontrast, razmik, gibanje, gumbe in pisavo. |
| F-46 | Performance budget | Implementirano | `tests/performance.test.mjs`, `src/main.js`, `src/lib/docx-export.js` | `npm run test:performance` | Preveri velikost zacetnega payload-a in lazy-load DOCX/ODT generatorja. |
| F-47 | Dokumentacijska in Mermaid uskladitev | Implementirano | `README.md`, `docs/diagrams.md`, `docs/*.mmd`, `docs/stanje-zadnje-verzije.md` | Mermaid render vseh diagramov, rocni pregled | Diagrami uporabljajo samo tri glavne vloge in ER model z realnimi tabelami zadnje sheme. |

## Sprejemni kriteriji po funkcionalnih sklopih

### Pobude

- Uporabnik se lahko prijavi z demo identiteto.
- Uporabnik lahko odda pobudo z naslovom, kategorijo, povzetkom, pravno podlago, oceno stanja, cilji in resitvami, besedilom clenov, obrazlozitvijo clenov, financnimi posledicami, primerjalnim prikazom, presojo posledic, sodelovanjem javnosti in predstavniki predlagatelja.
- Prekratka ali nepopolna pobuda se zavrne z razumljivimi napakami.
- Pobuda dobi zacetni status glede na AI tveganje.

### Pregled in sodelovanje

- Dashboard prikaze seznam pobud in osnovne metrike.
- Neprijavljen uporabnik vidi samo aktualne pobude in javni detail brez komentarjev, podpisov, AI podrobnosti in osebne analitike.
- Neprijavljen uporabnik lahko odda najvec en anonimen glas na posamezno aktualno pobudo.
- Iskanje in filtri delujejo brez ponovnega nalaganja strani.
- Glasovanje istega uporabnika se ne podvoji.
- Podpis istega uporabnika se ne podvoji.
- Komentarji so vezani na pobudo in prikazani v detail pogledu.

### AI in analitika

- Lokalni AI predpregled vedno vrne `score`, `risk`, `findings` in `checks`.
- Hugging Face endpoint se uporabi samo, kadar je konfiguriran.
- Ob napaki zunanjega AI modela aplikacija ostane uporabna.
- Analitika prikaze skupne glasove, komentarje, podpise, porazdelitev glasov, kategorije in AI tveganja.
- Prijavljen uporabnik vidi osebno analitiko svojih pobud in aktivnosti.
- Prijavljen uporabnik vidi agregirane Clarity grafe, ce je nastavljen server-only `CLARITY_API_TOKEN`.
- Admin vidi locen sistemski pogled za AI klice, oceno tokenov, email dogodke in frontend vire.
- Clarity prejme custom tags in events za vedenjsko analitiko sej.

### Podatki in integracije

- Lokalni nacin deluje brez zunanjih storitev.
- Supabase nacin ima pripravljeno SQL shemo in REST adapter.
- Email obvestila se v razvoju lahko zapisejo v outbox ali posljejo prek SMTP.
- SI-PASS session in evidencni podpis sta implementirana; SI-CAS/SI-CeS sta pripravljena za okoljsko validacijo in imata dokumentiran VPS tok.
- Supabase analiticna shema vsebuje tudi `analytics_events`, Clarity snapshot-e in dnevne snapshot-e.
- Vercel deployment uporablja veljaven `vercel.json` brez BOM, runtime config in dnevni cron.

## Pravila za vzdrzevanje registra

1. Ob vsaki novi funkcionalnosti dodaj novo vrstico z enolicnim ID-jem.
2. Ce se spremeni implementacija, popravi stolpec "Dokaz v kodi".
3. Ce se doda test, popravi stolpec "Preverjanje".
4. Ce funkcionalnost se ni produkcijsko varna, naj ostane oznacena kot "Delno implementirano" ali "Pripravljeno".
5. Vsak vecji cikel naj se zapise tudi v `docs/devwork-loop.md`.
