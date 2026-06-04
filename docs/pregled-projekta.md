# Pregled projekta

Datum revizije: 2026-06-04

Krovni povzetek zadnje verzije je v `docs/stanje-zadnje-verzije.md`.

## Povzetek

**Demokracija 2.0** je prototip spletne platforme za oddajo, pregled, podporo, podpisovanje in analitiko zakonodajnih pobud. Projekt prikazuje delujoc tok od javnega pregleda pobud do priprave dokumentov za nadaljnji postopek.

Glavni tokovi:

- javni pregled aktualnih pobud,
- anonimno glasovanje neprijavljenega uporabnika,
- SI-PASS prijava in evidencni podpis,
- oddaja zakonodajne pobude z DZ vsebinskimi sklopi,
- validacija in AI predpregled,
- iskanje, filtriranje in razvrscanje,
- komentiranje,
- PDF/DOCX/ODT izvoz,
- osebna in sistemska analitika,
- email obvestila in dnevni digest,
- Supabase, Vercel, Clarity, Turnstile, SI-PASS/SI-CAS in SI-CeS priprava.

Projekt ni produkcijsko zakljucen drzavni informacijski sistem. Pravilna interpretacija je: delujoc prototip z jasno loceno domensko logiko, backend endpointi, podatkovno shemo, testi in dokumentiranimi produkcijskimi omejitvami.

## Tehnoloski sklad

| Podrocje | Resitev | Namen |
| --- | --- | --- |
| Frontend | HTML, CSS, JavaScript modules | Enostranska aplikacija brez build orodja. |
| UI aplikacija | `src/main.js` | Stanje, pogledi, obrazci, dogodki, izvoz in integracije. |
| Domenska logika | `src/domain/*.js` | Validacija, AI fallback, analitika, email pravila in Clarity normalizacija. |
| Lokalni podatki | `localStorage` | Hiter demo brez zunanjih storitev. |
| Zunanja baza | Supabase PostgreSQL | Relacijski model, REST dostop, RLS, search, analitika in snapshot-i. |
| Backend | `api/*`, `server/*`, `scripts/dev-server.mjs` | Vercel funkcije, skupna server logika in lokalni API posnetek. |
| AI | Hugging Face + lokalni fallback | Server-side predpregled pobude brez razkritja tokena. |
| Podpisi | SI-PASS, SI-CAS, SI-CeS priprava | Session, evidencni podpis in helperji za podpisni tok. |
| Varnost | Turnstile, CSP, rate limiting | Zascita oddaje in backend endpointov. |
| Analitika | Vercel, Clarity, Supabase, domena | Hosting metrike, vedenjska analitika, osebna in sistemska analitika. |
| Testi | Node `node:test` | Domenski, E2E smoke, performance in coverage testi. |
| CI/CD | GitHub Actions, SonarCloud | Testi, coverage, syntax check, wiring in secret checks. |

## Arhitektura po plasteh

### Frontend

`src/main.js` vsebuje `DemocracyApp`, ki skrbi za:

- navigacijo med pogledi,
- javni in prijavljeni dashboard,
- obrazec oddaje pobude,
- AI predpregled,
- glasovanje, komentiranje in podpisovanje,
- export PDF/DOCX/ODT,
- osebno in sistemsko analitiko,
- integracijski in dostopnostni pogled.

### Domenska pravila

Domenska logika je izlocena iz UI:

- `src/domain/validation.js` - kategorije, statusi, validacija, ustvarjanje pobude, glasovi, podpisi, komentarji in lokalni AI fallback.
- `src/domain/analytics.js` - osnovna, osebna in sistemska analitika.
- `src/domain/notifications.js` - statusna email obvestila in dnevni digest vsebina.
- `src/domain/ai-review.js` - kompakten payload za remote AI endpoint.
- `src/domain/clarity-insights.js` - normalizacija Microsoft Clarity agregatov.

Ta locitev omogoca testiranje brez brskalnika in brez Supabase.

### Podatkovni dostop

- `src/lib/storage.js` hrani lokalne podatke v `localStorage`.
- `src/lib/supabase.js` uporablja Supabase REST in backend endpoint-e.
- `src/lib/auth.js` hrani demo uporabnika in bere SI-PASS session.
- `src/lib/telemetry.js` zapisuje sistemske dogodke lokalno in na backend.
- `src/lib/docx-export.js` zgradi DOCX/ODT paket sele ob izvozu.

### Backend in integracije

Vercel entrypointi:

- `api/config.local.js`,
- `api/ai/review-initiative.js`,
- `api/initiatives.js`,
- `api/signatures.js`,
- `api/auth/[...path].js`,
- `api/analytics/[...path].js`,
- `api/notifications/[...path].js`,
- `api/security/turnstile.js`.

Skupna server logika je v `server/*`: Supabase service role dostop, SI-PASS session, SI-CeS helperji, email, daily digest, Turnstile, analytics in rate limiting.

Lokalni `scripts/dev-server.mjs` posnema produkcijske poti in dodatno vsebuje razvojne SI-CeS poti `/api/sices/start`, `/api/sices/callback` in `/api/sices/complete`.

## Podatkovni model

Osnovna shema je v `supabase/schema.sql`, razsiritve pa v dodatnih SQL skriptah.

Fizicne tabele zadnje verzije:

- `initiatives`,
- `votes`,
- `signatures`,
- `comments`,
- `initiative_ai_reviews`,
- `system_analytics_events`,
- `analytics_events`,
- `analytics_clarity_snapshots`,
- `analytics_daily_snapshots`.

Pomembne dodatne skripte:

- `supabase/search.sql` - hybrid search RPC,
- `supabase/analytics.sql` - centralna analitika, triggerji, view-i in dnevni snapshot-i,
- `supabase/sices-signatures.sql` - SI-CeS polja v `signatures`,
- `supabase/signatures-security.sql` - zapiranje direktnega insert podpisa,
- `supabase/backend-write-security.sql` - zapiranje direktnega pisanja pobud in komentarjev.

## Glavni uporabniski tokovi

### Neprijavljen uporabnik

1. Odpre aplikacijo.
2. Vidi samo aktualne pobude s statusom `active` ali `signature_collection`.
3. Uporablja iskanje in filtre.
4. Odda en anonimen glas na pobudo, vezan na lokalni brskalniski ID.

### SI-PASS prijavljen uporabnik

1. Prijavi se prek SI-PASS/SI-CAS bridgea.
2. Aplikacija prejme `sipass-*` stabilni anonimiziran identifikator.
3. Odda pobudo, glasuje, komentira in podpise pobudo.
4. Vidi osebno analitiko.
5. Pri statusih `signature_collection` in `submitted` izvozi PDF/DOCX/ODT dokument.

### Admin

1. Prijavi se z identiteto, ki ima admin pravico.
2. V prototipu se admin preveri prek `ADMIN_EMAILS`.
3. Vidi integracije in sistemsko analitiko.
4. Spreminja status pobude; backend zavrne statusno spremembo za navadnega uporabnika.

## DevWork koncept

DevWork v projektu pomeni ponovljiv razvojni krog:

1. preberi zahtevo, kodo in dokumentacijo,
2. omeji obseg,
3. spremeni domensko logiko in adapterje skladno z obstojecim vzorcem,
4. preveri s testi ali jasnim rocnim kriterijem,
5. posodobi dokumentacijo,
6. zabelezi odprta tveganja.

Podrobni cikli so v `docs/devwork-loop.md`.

## Datotecna karta

| Pot | Vloga |
| --- | --- |
| `index.html` | Vstopna HTML datoteka. |
| `src/main.js` | Glavna UI aplikacija. |
| `src/styles.css` | Vizualni slog, responsive UI in dostopnostne prilagoditve. |
| `src/config.js` | Privzeta runtime konfiguracija. |
| `src/domain/*` | Domenska pravila, AI, analitika, email in Clarity normalizacija. |
| `src/lib/*` | Repozitoriji, auth, telemetry, export, Turnstile, Vercel in Clarity odjemalci. |
| `api/*` | Vercel serverless entrypointi. |
| `server/*` | Skupna backend logika. |
| `scripts/dev-server.mjs` | Lokalni razvojni server in API posnetek. |
| `scripts/run-coverage.mjs` | Coverage runner. |
| `supabase/*.sql` | Osnovna shema, search, analitika, varnost in SI-CeS razsiritve. |
| `tests/domain.test.mjs` | Domenski in backend servisni testi. |
| `tests/e2e.test.mjs` | Lokalni E2E smoke test. |
| `tests/performance.test.mjs` | Performance budget. |
| `.github/workflows/pipeline_demos.yml` | CI/CD pipeline. |
| `docs/stanje-zadnje-verzije.md` | Krovni aktualni povzetek. |
| `docs/funkcionalnosti.md` | Register funkcionalnosti. |
| `docs/devwork-loop.md` | Razvojni dnevnik iteracij. |

## Kakovostni argumenti

- Domenska pravila so locena in testirana.
- Aplikacija deluje lokalno brez zunanjih storitev.
- Supabase model ima relacije, omejitve, search in analiticne razsiritve.
- Server-only skrivnosti se ne posiljajo v frontend runtime config.
- Backend poti uporabljajo rate limiting in velikostne omejitve.
- Vercel in lokalni server nastavljata varnostne headerje in CSP.
- Zunanje integracije imajo fallback ali dokumentirano delno stanje.
- Testi pokrivajo domensko logiko, SI-PASS, SI-CeS helperje, Turnstile, E2E smoke in performance budget.

## Znane omejitve

- Demo prijava je razvojni pripomocek, ne produkcijski IAM.
- SI-PASS evidencni podpis ni isto kot kvalificiran SI-CeS podpis dokumenta.
- SI-CeS helperji obstajajo, Vercel `api/sices/*` entrypointi pa se niso loceno dodani.
- Supabase RLS politike iz osnovne sheme so prototipne.
- Anonimno glasovanje je vezano na lokalni brskalniski ID.
- Za Clarity in druge analiticne storitve je pred produkcijo potreben GDPR/consent tok.
- PDF izvoz je namenjen tiskanju in ni oznacen kot popolnoma dostopen PDF.

## Kako preveriti projekt

```bash
npm test
npm run dev
```

Za poglobljen pregled:

1. preberite `README.md`,
2. preberite `docs/stanje-zadnje-verzije.md`,
3. preverite `docs/funkcionalnosti.md`,
4. preverite `docs/supabase.md` in `docs/baza-porocilo.md`,
5. preverite `docs/devwork-loop.md` in `docs/git-zgodovina.md`,
6. odprite aplikacijo lokalno in preverite javni pregled, prijavo, oddajo, glas, komentar, podpis in izvoz.
