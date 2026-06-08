# DevWork loop porocila

Datum revizije: 2026-06-04

Krovni povzetek zadnje verzije je v `docs/stanje-zadnje-verzije.md`. Ta dokument hrani razvojne cikle in pojasnjuje, kako se je projekt iterativno premikal od lokalnega prototipa do zadnjega stanja z Vercel, Supabase, SI-PASS, SI-CeS, Turnstile, analitiko, izvozom dokumentov in posodobljeno dokumentacijo.

Namen tega dokumenta je, da je po vsakem razvojnem ciklu viden napredek: kaj je bilo pregledano, kaj spremenjeno, kako je preverjeno in kaj ostaja odprto.

## DevWork koncept programiranja

DevWork loop je razvojni koncept projekta: vsaka sprememba mora imeti jasen cilj, omejen obseg, dokaz v kodi, preverjanje in zapis odprtih tveganj. Namen ni samo "dodajanje funkcij", ampak sledljiv razvoj, kjer je mogoce razloziti, zakaj je bila posamezna tehnicna odlocitev sprejeta.

Osnovni krog:

1. **Raziskava**: pregled zahtev, kode, dokumentacije in po potrebi git zgodovine.
2. **Omejitev obsega**: dolocitev, kaj se v ciklu spremeni in cesa se ne spreminja.
3. **Implementacija**: sprememba naj sledi obstojeci arhitekturi in locitvi UI, domene, adapterjev in podatkov.
4. **Preverjanje**: testi, rocni pregled ali dokumentiran kriterij sprejemljivosti.
5. **Dokumentiranje**: posodobitev README, registra funkcionalnosti, diagramov ali razvojnega dnevnika.
6. **Naslednji korak**: zapis odprtih tveganj in produkcijskih dolgov.

Kakovostna pravila tega koncepta:

- domenska pravila naj bodo v `src/domain`, ker jih je mogoce testirati,
- zunanji ponudniki morajo imeti fallback ali jasno dokumentirano napako,
- skrivnosti ne smejo biti v frontendu ali gitu,
- prototipne omejitve se dokumentirajo odkrito,
- vsaka funkcionalnost naj ima dokaz v kodi in po moznosti test ali sprejemni kriterij.

## Povzetek zadnjih iteracij

Do 2026-06-04 so zakljuceni ali delno zakljuceni naslednji vecji sklopi:

- osnovni prototip, pobude, validacija, lokalni repozitorij in Supabase nastavek,
- napredni AI predpregled in analitika,
- email, dnevni digest in Vercel cron,
- CI/CD, coverage in SonarCloud,
- Vercel runtime config in serverless endpointi,
- Vercel Analytics, Speed Insights, Microsoft Clarity, uporabniska in sistemska analitika,
- Supabase hybrid search,
- PDF/DOCX/ODT izvoz za DZ,
- SI-PASS session, backend SI-PASS podpis in UTF-8 popravljanje imen,
- backend oddaja pobud, komentarjev in admin statusov,
- Cloudflare Turnstile, rate limiting, CSP in varnostni headerji,
- SI-CeS helperji in dodatna podpisna SQL polja,
- Mermaid in splosna dokumentacijska uskladitev.

## Cikel: 2026-05-16

### Cilj

Raziskati projekt in git zgodovino ter dokumentacijo dopolniti tako, da so funkcionalnosti, arhitektura, razvojni koncept in odprte omejitve jasno razvidni za zahteven strokovni pregled.

### Izvedeno

- Pregledana struktura projekta, `README.md`, `src`, `scripts`, `supabase`, `tests`, `.github` in obstojeca dokumentacija.
- Pregledana git zgodovina z razvojem od zacetnega prototipa do Supabase, AI, email obvestil in CI/CD.
- Dodan register funkcionalnosti v `docs/funkcionalnosti.md`.
- Dodan tehnicni pregled projekta v `docs/pregled-projekta.md`.
- Dodan povzetek git zgodovine v `docs/git-zgodovina.md`.
- Dodan podrobnejsi dokument za SI-PASS, SI-CAS in SI-CeS priklop v `docs/sipass-sicas-ces-priklop.md`.
- V `docs/devwork-loop.md` je eksplicitno razlozen DevWork koncept programiranja.
- `README.md` je dopolnjen s potjo za hiter ocenjevalni pregled.
- CI dokumentacija in GitHub Actions workflow sta usklajena s kljucnimi dokumentacijskimi datotekami.

### Preverjanje

- `npm test` - 9/9 testov uspesnih.
- Pregled git statusa je pokazal, da so bile pred ciklom ze prisotne nekomitirane Mermaid datoteke; niso bile brisane ali prepisane.

### Kontrolne tocke

- [x] Funkcionalnosti imajo enoten register s statusom in dokazom v kodi.
- [x] Arhitektura in datotecna karta sta dokumentirani.
- [x] Git zgodovina je povzeta po commitih in razvojnih fazah.
- [x] DevWork koncept je razlozen kot ponovljiv razvojni proces.
- [x] Znane omejitve prototipa so zapisane brez prikrivanja.
- [x] Testi po dokumentacijskih spremembah se vedno uspejo.

### Naslednji koraki

- Preveriti konfiguracijo email prejemnikov in dnevnega digest-a v realnem okolju.
- Dodati E2E test za tok oddaja pobude -> glasovanje -> podpis -> komentar.
- Produkcijsko utrditi SI-PASS/SI-CAS prijavo in SI-CeS podpisovanje.
- Ohraniti AI in pisalne poti na backendu oziroma jih po potrebi premakniti v namenski backend/Edge Function.

## Cikel: 2026-05-19

### Cilj

Vzpostaviti tri jasno locene analiticne plasti: Vercel za hosting/SEO, admin notranjo sistemsko analitiko in uporabnisko analitiko pobud z Microsoft Clarity oznakami.

### Izvedeno

- Dodan `@vercel/analytics` v odvisnosti projekta.
- Dodan staticni Vercel Web Analytics loader za trenutni frontend brez bundlerja.
- Dodan `@vercel/speed-insights` v odvisnosti projekta.
- Dodan staticni Vercel Speed Insights loader za Core Web Vitals in performance metrike brez Next.js komponente.
- Dodan Microsoft Clarity loader z runtime nastavitvijo `MICROSOFT_CLARITY_PROJECT_ID`.
- Dodan Clarity Data Export proxy in normalizator metrik, da prijavljeni uporabniki v aplikaciji vidijo agregirane Clarity grafe.
- Dodani Clarity `identify`, custom tags in events za poglede, prijavo, pobude, glasovanje, podpise, komentarje in AI predpregled.
- Razsirjena domenska analitika z `calculateUserAnalytics()` in `calculateSystemAnalytics()`.
- Zavihek `Analitika pobud` prikaze splosno statistiko iz baze in osebni del za prijavljenega uporabnika.
- Dodan admin-only zavihek `Sistemska analitika` z oceno AI klicev, tokenov, email dogodkov, podatkovnih zapisov in frontend virov.
- Dostop do interne sistemske analitike je omejen na admin email iz `ADMIN_EMAILS`.
- Sistemska analitika je razsirjena z uporabniskimi sledmi, anonimnimi glasovi, javno vidnimi pobudami, statusi, temami, telemetry sejami in dogodki po tipu.
- Neprijavljenim uporabnikom je omejen UI: vidijo samo aktualne pobude, javni detail in en anonimni glas na pobudo.
- Zavihek `Integracije` je omejen samo na demo admina.
- Dodana Vercel funkcija za sistemsko telemetrijo, danes zdruzena v `api/analytics/[...path].js` in `server/analytics-system.mjs`, da deploy ni odvisen samo od `localStorage`.
- Dodana Supabase tabela `system_analytics_events` za centralni zapis admin dogodkov prek server-only `SUPABASE_SERVICE_ROLE_KEY`.
- Dodana dokumenta `docs/analitika.md` in `docs/dnevnik-dopolnitev.md`.
- Posodobljena README in register funkcionalnosti.

### Preverjanje

- `npm test` - 11/11 testov uspesnih.
- `node --check src/main.js` - uspesno.
- `node --check src/lib/clarity.js` - uspesno.
- `node --check src/lib/clarity-insights.js` - uspesno.
- `node --check src/domain/clarity-insights.js` - uspesno.
- `node --check api/analytics/[...path].js` - uspesno.
- `node --check src/lib/vercel-analytics.js` - uspesno.
- `node --check src/lib/vercel-speed-insights.js` - uspesno.
- `node --check src/lib/telemetry.js` - uspesno.
- `node --check server/analytics-system.mjs` - uspesno.

### Tveganja

- Sistemska poraba tokenov je ocena iz besedila, ne uradni racun AI ponudnika.
- Clarity dashboard je zunanji Microsoftov pogled; aplikacijska analitika pobud se se vedno racuna iz baze.
- Clarity grafi v aplikaciji so odvisni od server-only `CLARITY_API_TOKEN`; Data Export API ima dnevne omejitve in ne vraca heatmap/recording UI-ja.
- Anonimni glas je omejen z lokalnim brskalniskim ID, zato ni produkcijsko trdna varnostna meja.
- Admin pravica prek `ADMIN_EMAILS` je primerna za prototip, produkcijsko mora biti vezana na SI-PASS/backend avtorizacijo.

### Naslednji koraki

- Produkcijsko zapisovati AI usage in sistemske metrike v backend audit tabelo.
- Dodati consent/GDPR tok za Clarity pred javno produkcijo.
- Uskladiti admin vloge s SI-PASS identiteto in Supabase RLS.

## Cikel: 2026-05-11

### Cilj

Omejeno izboljsati projekt na podrocju pobud, pregleda/iskanja, glasovanja, komentiranja, napredne analitike, AI presoje, sheme in dokumentacije. Nepovezanih funkcionalnosti se ne spreminja.

### Izvedeno

- Pregledana struktura projekta in obstojece datoteke v `src`, `supabase`, `docs` in `tests`.
- Razsirjena analitika v `src/domain/analytics.js`.
- Razsirjen AI predpregled v `src/domain/validation.js`.
- Posodobljen UI za analitiko, glasove na pobudo, komentarje in AI dejstva v `src/main.js`.
- Dodani CSS slogi za napredno analitiko in AI povzetke v `src/styles.css`.
- Dopolnjena Supabase shema z `initiative_ai_reviews`, `initiative_analytics` in `category_analytics`.
- Dodana dokumentacija za analitiko/AI in Mermaid diagrame.
- Razsirjeni domenski testi za AI kategorijo in napredne analiticne kazalnike.
- Implementiran razvojni AI endpoint `POST /api/ai/review-initiative` v `scripts/dev-server.mjs`.
- Endpoint uporablja Hugging Face Inference Providers z `HF_TOKEN` iz `.env.local` ali okolja.
- Frontend ob oddaji pobude in rocnem kliku "Preglej bolj podrobno z AI" poklice endpoint, ob napaki pa uporabi lokalni fallback.

### Artefakti

- `docs/iteracija-3-analitika-ai.md`
- `docs/diagrams.md`
- `docs/devwork-loop.md`
- `supabase/schema.sql`
- `src/domain/analytics.js`
- `src/domain/validation.js`
- `src/main.js`
- `src/styles.css`
- `tests/domain.test.mjs`

### Kontrolne tocke

- [x] Oddaja pobude ostane na obstojecem toku.
- [x] Pregled, iskanje, filtriranje in kategorizacija ostanejo v glavnem pogledu.
- [x] Glasovanje prikazuje stevilo glasov na pobudo.
- [x] Komentarji so vkljuceni v detail in analitiko.
- [x] AI predpregled vraca score, risk, suitability, categorySuggestion in completeness.
- [x] Hugging Face AI predpregled je implementiran v razvojnem strezniku brez posiljanja tokena v brskalnik.
- [x] Shema vsebuje tabelo za AI audit in poglede za analitiko.
- [x] Mermaid diagrami so pripravljeni v dokumentaciji.
- [ ] Produkcijska Supabase Edge Function ali backend namestitev za AI endpoint ostaja naslednji korak.
- [ ] SI-PASS produkcijska integracija ostaja zunaj tega cikla.

### Naslednji cikel

- Premakniti razvojni `POST /api/ai/review-initiative` v produkcijsko backend ali Supabase Edge Function okolje.
- Dodati dnevne agregate glasovanja, ko bo obstajal casovni volumen podatkov.
- Dodati E2E test za oddajo pobude, glasovanje in komentar.
- Uvesti produkcijske RLS politike po SI-PASS identiteti.

## Cikel: 2026-05-13

### Cilj

Povezati Iteracijo 3 z zunanjim AI ponudnikom in posodobiti uporabniski prikaz AI presoje.

### Izvedeno

- Dodan Hugging Face zero-shot review prek varnega razvojnega endpointa `/api/ai/review-initiative`.
- `HF_TOKEN` je bran samo na strani razvojnega streznika; `config.local.js` v frontend posreduje samo javne nastavitve.
- AI presoja kombinira Hugging Face kategorijo/ustreznost z lokalnim fallbackom za score, risk, completeness, pravne signale in proracunska opozorila.
- UI prikaze bolj uporabniska besedila: "Preglej bolj podrobno z AI", "Napredno preverjanje" in "Vir ocene: Hugging Face / model".
- Detail pobude prikaze dodatna AI dejstva: risk level, zanesljivost kategorije, pravne oporne tocke, proracunska opozorila in obseg besedila.
- Dokumentacija je usklajena s trenutno implementacijo.

### Preverjanje

- `npm.cmd test` - 6/6 testov uspesnih.
- Rocni POST na `/api/ai/review-initiative` - vrne `provider: "huggingface"`, model, score, risk, suitability in categorySuggestion.

### Tveganja

- Razvojni endpoint je primeren za demo, ne za produkcijsko javno namestitev.
- Zero-shot model `facebook/bart-large-mnli` lahko pri slovenskih besedilih vrne nizke confidence vrednosti; zato lokalni fallback ostaja del koncne ocene.

### Naslednji koraki

- Prenesti AI endpoint v Supabase Edge Function ali namenski backend.
- Dodati audit zapis v `initiative_ai_reviews` za vsako zunanjo presojo.
- Dodati E2E test, ki preveri rocen AI predpregled in oddajo pobude.

## Cikel: 2026-05-21

### Cilj

Premakniti projekt iz lokalnega prototipa proti realnejsemu deploymentu: Supabase hybrid search, izvoz dokumentov, SI-PASS session in VPS bridge.

### Izvedeno

- Dodan Supabase hybrid search v `supabase/search.sql`.
- `SupabaseInitiativeRepository.search()` uporablja RPC, kadar je `DATA_SOURCE=supabase`.
- Dodan PDF tisk/prenos pobude za DZ.
- Pripravljen SI-PASS session tok prek VPS/Shibboleth bridgea.
- Dodani auth endpointi za session/logout/demo login.
- Posodobljeni SI-PASS/VPS dokumenti.

### Preverjanje

- Rocni lokalni zagon aplikacije.
- Pregled runtime configa `/config.local.js`.
- Pregled Supabase RPC pogodbe.

### Tveganja

- SI-CAS je odvisen od zunanjega testnega okolja in registriranih callback URL-jev.
- Hybrid search potrebuje izveden `supabase/search.sql` v Supabase projektu.

## Cikel: 2026-05-22 do 2026-05-26

### Cilj

Dopolniti varnost, dostopnost in izvoz dokumentov.

### Izvedeno

- Dodan Cloudflare Turnstile na oddajo pobude.
- Dodan dostopnostni pogled in uporabniske prilagoditve.
- Dodan DOCX/ODT izvoz v `src/lib/docx-export.js`.
- DOCX/ODT generator se nalaga dinamicno, sele ob prenosu.
- Posodobljeni diagrami in dokumentacija za statusne pravice.

### Preverjanje

- `npm test`
- Rocni pregled UI in izvoza.

### Tveganja

- PDF izvoz je namenjen tiskanju in ni oznacen kot popolnoma dostopen PDF.
- DOCX/ODT dokumenta pred uradno objavo potrebujeta rocni pregled.

## Cikel: 2026-05-30 do 2026-06-01

### Cilj

Utrditi backend, varnost in uporabnisko dokumentacijo.

### Izvedeno

- Dodani backend endpointi za oddajo pobud, komentarje in admin statusne spremembe.
- Dodan backend SI-PASS podpis prek `/api/signatures`.
- Dodan `supabase/signatures-security.sql`.
- Dodan `supabase/backend-write-security.sql`.
- Dodan dnevni email digest ustvarjalcu pobude.
- Dodani E2E smoke in performance testi.
- Dodani rate limiting, CSP in varnostni headerji.
- Dodana obsezna uporabniska dokumentacija.

### Preverjanje

- `npm test`
- `npm run test:e2e`
- `npm run test:performance`

### Tveganja

- Glasovanje je za produkcijo se treba v celoti premakniti na backend.
- `ADMIN_EMAILS` ostaja prototipni admin model.

## Cikel: 2026-06-02

### Cilj

Izboljsati kakovost, CI in podatkovne razsiritve.

### Izvedeno

- Dodan oziroma posodobljen SonarCloud scan.
- Razsirjen CI pipeline z coverage in syntax checkom.
- Dodan email kot atribut za obvestila.
- Posodobljena dokumentacija glavnega stanja.
- Dodane analiticne SQL razsiritve v `supabase/analytics.sql`.

### Preverjanje

- `npm run test:coverage`
- GitHub Actions pipeline.

### Tveganja

- Analiticne view-e in snapshot-e mora v realnem Supabase okolju izvajati `service_role`.

## Cikel: 2026-06-03

### Cilj

Pripraviti SI-CeS podpisni tok in utrditi CSP/VPS povezave.

### Izvedeno

- Dodan `server/sices.mjs` s konfiguracijo, SOAP helperji, start/complete/callback logiko in parserji.
- Lokalni dev-server izpostavi `/api/sices/start`, `/api/sices/callback` in `/api/sices/complete`.
- Dodan `supabase/sices-signatures.sql` za SI-CeS polja v `signatures`.
- Popravljena CSP pravila za auth domeno.
- Popravljeni SOAP/TLS detajli.
- Dodani testi SI-CeS konfiguracije in helperjev.

### Preverjanje

- `npm test`
- Rocni pregled SI-CeS env spremenljivk in dokumentacije.

### Tveganja

- Vercel `api/sices/*` entrypointi se niso loceno dodani.
- Pravi SI-CeS E2E test zahteva zunanje testno okolje, certifikate in callback.

## Cikel: 2026-06-04

### Cilj

Uskladiti dokumentacijo, Mermaid diagrame, glavne uporabnike in Vercel konfiguracijo z zadnjo verzijo projekta.

### Izvedeno

- Use-case diagrami uporabljajo samo neprijavljenega uporabnika, SI-PASS prijavljenega uporabnika in admina.
- ER diagrami vkljucujejo realne Supabase tabele zadnje sheme, tudi `analytics_*` in SI-CeS podpisna polja.
- Dokumentacija jasno pove, da demo prijava ni locena glavna vloga.
- SI-PASS uporabnik ima v dokumentaciji izvoz PDF/DOCX/ODT.
- Dodan krovni dokument `docs/stanje-zadnje-verzije.md`.
- Odstranjen UTF-8 BOM iz `vercel.json` in dodan `$schema`.

### Preverjanje

- Render vseh Mermaid diagramov.
- `npm run test:domain`
- `node` JSON parse `vercel.json`.
- Lokalni `npx vercel build --yes` ni vec padel zaradi `vercel.json`.

### Tveganja

- Oddajna arhivska kopija dokumentacije mora biti ob vsaki vecji spremembi znova sinhronizirana z `docs`.

## Predloga za naslednja porocila

```md
## Cikel: YYYY-MM-DD

### Cilj

Kratek opis omejenega obsega.

### Izvedeno

- ...

### Preverjanje

- `npm test` - rezultat
- rocni pregled - rezultat

### Tveganja

- ...

### Naslednji koraki

- ...
```
