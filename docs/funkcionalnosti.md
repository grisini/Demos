# Register funkcionalnosti

Ta dokument je zivi register funkcionalnosti projekta **Demokracija 2.0**. Namenjen je temu, da profesor ali mentor hitro vidi:

- kaj aplikacija ze podpira,
- kje je funkcionalnost implementirana,
- kako je preverjena,
- kateri kompromisi so zavestno ostali v prototipu.

Statusi v tabeli:

- **Implementirano**: funkcionalnost obstaja v kodi in jo je mogoce uporabiti.
- **Delno implementirano**: funkcionalnost deluje za demo ali razvoj, vendar potrebuje produkcijsko utrditev.
- **Pripravljeno**: obstaja zasnova, shema ali konfiguracijski nastavek, manjkajo pa realni zunanji podatki ali storitev.
- **Naslednji korak**: dokumentirano kot nacrt, se ni implementirano.

## Funkcionalni register

| ID | Funkcionalnost | Status | Dokaz v kodi | Preverjanje | Opombe |
| --- | --- | --- | --- | --- | --- |
| F-01 | Demo prijava uporabnika | Implementirano | `src/lib/auth.js`, `src/main.js` | Rocni zagon aplikacije | Identiteta se hrani v `localStorage`; to ni produkcijski SI-PASS tok. |
| F-02 | Oddaja zakonodajne pobude | Implementirano | `src/main.js`, `src/domain/validation.js` | `tests/domain.test.mjs` | Pobuda zahteva naslov, kategorijo, povzetek in obrazlozitev. |
| F-03 | Validacija pobude | Implementirano | `src/domain/validation.js`, `supabase/schema.sql` | `npm test` | Minimalne dolzine so preverjene v domeni in delno v SQL `check` omejitvah. |
| F-04 | Lokalni AI predpregled | Implementirano | `evaluateInitiative()` v `src/domain/validation.js` | `npm test` | Uporablja pravila za obseg, pravne izraze, proracunska tveganja in kategorijo. |
| F-05 | Hugging Face AI predpregled | Delno implementirano | `scripts/dev-server.mjs`, `src/main.js` | Rocni POST na `/api/ai/review-initiative` | Deluje v razvojnem strezniku, produkcijsko mora v backend ali Supabase Edge Function. |
| F-06 | AI fallback ob napaki | Implementirano | `reviewInitiative()` v `src/main.js` | Rocni test brez `HF_TOKEN` | Ob nedosegljivem zunanjem modelu aplikacija uporabi lokalno presojo. |
| F-07 | Seznam pobud | Implementirano | `renderDashboardView()` v `src/main.js` | Rocni zagon aplikacije | Prikazuje pobude, osnovne metrike in izbran detail. |
| F-08 | Iskanje pobud | Implementirano | `filteredInitiatives()` v `src/main.js` | Rocni zagon aplikacije | Isce po naslovu, povzetku in kategoriji. |
| F-09 | Filtriranje po kategoriji in statusu | Implementirano | `filteredInitiatives()` v `src/main.js` | Rocni zagon aplikacije | Kategorije in statusi so enotni z domeno. |
| F-10 | Razvrscanje pobud | Implementirano | `filteredInitiatives()` v `src/main.js` | Rocni zagon aplikacije | Podprto po popularnosti, datumu in AI oceni. |
| F-11 | Detail pobude | Implementirano | `renderInitiativeDetail()` v `src/main.js` | Rocni zagon aplikacije | Vkljucuje opis, metrike, AI ugotovitve, glasove, podpise in komentarje. |
| F-12 | Glasovanje | Implementirano | `voteForInitiative()`, `src/lib/storage.js`, `src/lib/supabase.js` | `npm test` | Pravilo "en uporabnik, en glas" je v domeni in v bazi z `unique`. |
| F-13 | Demo podpis pobude | Delno implementirano | `signInitiative()`, `src/main.js` | `npm test` | To je evidencni demo podpis, ne pravno veljaven SI-CES podpis. |
| F-14 | Komentiranje pobud | Implementirano | `addComment()`, `src/main.js` | `npm test` | Komentar potrebuje prijavljenega uporabnika in vsaj 3 znake. |
| F-15 | Spreminjanje statusa pobude | Delno implementirano | `updateInitiativeStatus()`, `src/main.js`, `supabase/schema.sql` | Rocni zagon aplikacije | UI omogoca spremembo statusa; produkcijsko mora biti omejeno na moderatorje. |
| F-16 | Osnovna in napredna analitika | Implementirano | `src/domain/analytics.js`, `src/main.js` | `npm test` | Vkljucuje glasove, podpise, komentarje, kategorije, porazdelitev in AI tveganja. |
| F-17 | SQL pogledi za analitiko | Pripravljeno | `supabase/schema.sql` | Pregled SQL sheme | `initiative_analytics` in `category_analytics` sta pripravljena za podatkovno plast. |
| F-18 | LocalStorage repozitorij | Implementirano | `src/lib/storage.js` | Rocni zagon aplikacije | Privzeti nacin za hitro lokalno predstavitev. |
| F-19 | Supabase repozitorij | Delno implementirano | `src/lib/supabase.js`, `supabase/schema.sql` | Rocno z `.env.local` | REST adapter je pripravljen; produkcijsko pisanje mora iti prek backenda. |
| F-20 | Email obvestila o spremembah | Delno implementirano | `src/domain/notifications.js`, `src/lib/notifications.js`, `scripts/dev-server.mjs` | `npm test` | Demo vsebuje zacasnega testnega prejemnika; produkcijsko mora biti konfigurabilno. |
| F-21 | Outbox email nacin | Implementirano | `scripts/dev-server.mjs` | Rocni zagon aplikacije | Brez SMTP podatkov se obvestila zapisujejo v `demos-email-outbox.log`. |
| F-22 | SMTP email posiljanje | Delno implementirano | `scripts/dev-server.mjs` | Rocno z realnimi SMTP nastavitvami | Podprti so `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`. |
| F-23 | Runtime konfiguracija | Implementirano | `src/config.js`, `scripts/dev-server.mjs` | Rocni zagon aplikacije | `config.local.js` v brskalnik poslje samo javne nastavitve. |
| F-24 | SI-PASS nastavek | Pripravljeno | `src/config.js`, `docs/si-pass-testno-okolje.md` | Pregled dokumentacije | Prava prijava caka na registrirane testne podatke in backend callback. |
| F-25 | SI-CAS / SI-CES nacrt priklopa | Pripravljeno | `docs/sipass-sicas-ces-priklop.md`, `docs/sicas-sices-vps-checklist.md` | Pregled dokumentacije | Dokumentirana je pot za VPS, Shibboleth SP in podpisovanje. |
| F-26 | Supabase RLS zascita | Delno implementirano | `supabase/schema.sql` | Pregled SQL sheme | RLS je vklopljen, politike so za demo odprte in niso produkcijske. |
| F-27 | Mermaid diagrami | Implementirano | `docs/diagrams.md`, `docs/*.mmd` | Pregled dokumentacije | Diagrami pokrivajo uporabniski tok, zaporedje, UML, ER in DevWork loop. |
| F-28 | Domenski testi | Implementirano | `tests/domain.test.mjs` | `npm test` | Pokrivajo validacijo, AI presojo, glasovanje, podpis, komentarje, analitiko in email domensko logiko. |
| F-29 | CI/CD pipeline | Implementirano | `.github/workflows/pipeline_demos.yml` | GitHub Actions ali lokalni pregled YAML | Pipeline namesti odvisnosti, zazene teste in preveri odsotnost lokalnih skrivnosti. |
| F-30 | Vercel Web Analytics | Implementirano | `src/lib/vercel-analytics.js`, `src/main.js`, `package.json` | Deploy na Vercel in obisk strani | Namenjeno je hostingu, prometu in SEO pogledu; vidi ga lastnik Vercel projekta. |
| F-31 | Vercel Speed Insights | Implementirano | `src/lib/vercel-speed-insights.js`, `src/main.js`, `package.json` | Deploy na Vercel in obisk strani | Namenjeno je Core Web Vitals in performance metrikam; route se posodobi pri SPA preklopu pogleda. |
| F-32 | Microsoft Clarity vedenjska analitika | Delno implementirano | `src/lib/clarity.js`, `src/lib/clarity-insights.js`, `src/domain/clarity-insights.js`, `api/analytics/clarity.js`, `src/main.js`, `src/config.js` | Nastavi `MICROSOFT_CLARITY_PROJECT_ID` in server-only `CLARITY_API_TOKEN`, nato preveri `Analitika pobud` in Clarity dashboard | Clarity belezi seje, tags in events; prijavljeni uporabniki vidijo agregirane Clarity grafe iz Data Export API. Heatmapi in posnetki sej ostanejo v Clarity dashboardu. |
| F-33 | Osebna analitika pobud | Implementirano | `calculateUserAnalytics()`, `renderAnalyticsView()` | `npm test` | Vsak prijavljen uporabnik vidi svoje pobude, glasove, podpise, komentarje, podporo in zadnjo aktivnost. |
| F-34 | Admin sistemska analitika | Delno implementirano | `calculateSystemAnalytics()`, `src/lib/telemetry.js`, `api/analytics/system.js`, `renderSystemAnalyticsView()` | `npm test`, prijava kot `admin@demos.local` | Dostop ima samo demo admin. Na Vercelu sprejema dogodke prek API funkcije; s `SUPABASE_SERVICE_ROLE_KEY` jih zapise v `system_analytics_events`. Zajema tehnicne metrike, uporabniske sledi, javni rezim, statuse in teme. Ocena tokenov ostaja priblizek. |
| F-35 | Javni pogled za neprijavljene | Implementirano | `visibleInitiatives()`, `renderDashboardView()`, `renderPublicInitiativeDetail()` | Rocni zagon aplikacije | Brez prijave so vidne samo pobude s statusom `active` ali `signature_collection`; oddaja pobude, komentarji, podpisi in analitike ostanejo zaklenjeni. |
| F-36 | Anonimno enkratno glasovanje | Delno implementirano | `anonymousActor()`, `voteForInitiative()`, `LocalInitiativeRepository.vote()` | `npm test`, rocni zagon aplikacije | Uporablja lokalni ID `demos.anonymousVoterId` in domensko pravilo en glas na pobudo. To je prototipna zascita; produkcijsko mora biti podprta z backend omejitvami. |
| F-37 | Admin-only integracije | Implementirano | `normalizeView()`, `render()` navigacija, `renderIntegrationsView()` | Rocni zagon aplikacije kot demo uporabnik in demo admin | Zavihek `Integracije` vidi samo demo admin; navaden uporabnik je preusmerjen na pregled. |

## Sprejemni kriteriji po funkcionalnih sklopih

### Pobude

- Uporabnik se lahko prijavi z demo identiteto.
- Uporabnik lahko odda pobudo z naslovom, kategorijo, povzetkom, obrazlozitvijo, pravno podlago in pricakovanim ucinkom.
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
- SI-PASS, SI-CAS in SI-CES so dokumentirani kot naslednja produkcijska integracija.

## Pravila za vzdrzevanje registra

1. Ob vsaki novi funkcionalnosti dodaj novo vrstico z enolicnim ID-jem.
2. Ce se spremeni implementacija, popravi stolpec "Dokaz v kodi".
3. Ce se doda test, popravi stolpec "Preverjanje".
4. Ce funkcionalnost se ni produkcijsko varna, naj ostane oznacena kot "Delno implementirano" ali "Pripravljeno".
5. Vsak vecji cikel naj se zapise tudi v `docs/devwork-loop.md`.
