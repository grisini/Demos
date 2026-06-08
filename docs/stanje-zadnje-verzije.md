# Stanje zadnje verzije projekta

Datum revizije: 2026-06-04

Ta dokument je krovni povzetek trenutnega stanja projekta **Demokracija 2.0**. Uporablja se kot referenca pri usklajevanju README-ja, registra funkcionalnosti, DevWork dnevnika, uporabniske dokumentacije, Supabase dokumentacije in oddajne kopije dokumentacije.

## Namen aplikacije

Demokracija 2.0 je prototip platforme za zakonodajne pobude. Aplikacija podpira javni pregled aktualnih pobud, oddajo pobude, AI predpregled, glasovanje, komentiranje, SI-PASS evidencni podpis, pripravo dokumentov za nadaljnji postopek in analitiko.

Projekt ni produkcijsko zakljucen drzavni informacijski sistem. Je delujoc prototip z jasno loceno domensko logiko, lokalnim in Supabase podatkovnim nacinom, backend endpointi, dokumentiranimi varnostnimi omejitvami in pripravo za SI-PASS/SI-CAS/SI-CeS okolje.

## Glavne vloge

V dokumentaciji in diagramih so glavne vloge samo:

- **Neprijavljen uporabnik**: vidi javno aktualne pobude, uporablja iskanje/filtre in odda en anonimen glas na pobudo.
- **SI-PASS prijavljen uporabnik**: uporablja javne funkcije, odda pobudo, glasuje, komentira, izvede SI-PASS podpis, vidi osebno analitiko in izvozi PDF/DOCX/ODT pri statusih `signature_collection` in `submitted`.
- **Admin**: vidi integracije, sistemsko analitiko in ureja statuse pobud. V prototipu se admin pravica preverja prek `ADMIN_EMAILS`.

Demo prijava je razvojni pripomocek, ne locena glavna vloga produkcijskega modela.

## Aktualne funkcionalnosti

- javni dashboard z aktualnimi pobudami,
- javni detail pobude z anonimnim glasovanjem,
- prijavljena oddaja zakonodajne pobude z DZ vsebinskimi sklopi,
- Cloudflare Turnstile varnostno preverjanje oddaje pobude,
- lokalni AI predpregled in server-side Hugging Face endpoint,
- iskanje, filtriranje, razvrscanje in Supabase hybrid search RPC,
- glasovanje z deduplikacijo,
- SI-PASS evidencni podpis prek backend endpointa `/api/signatures`,
- komentarji prek backend poti za Supabase nacin,
- statusni tok pobude z admin-only spremembami,
- PDF tisk, PDF prenos, DOCX in ODT izvoz za DZ,
- osebna analitika prijavljenega uporabnika,
- admin sistemska analitika,
- Vercel Web Analytics in Speed Insights,
- Microsoft Clarity tracking, tags, events in Data Export agregati,
- dnevni email digest ustvarjalcu pobude prek Vercel cron poti,
- statusna email obvestila ustvarjalcu pobude,
- runtime config prek `/config.local.js`,
- lokalni dev server, Vercel serverless API in Supabase REST adapter,
- CI pipeline s testi, coverage, SonarCloud scanom, syntax checkom in preverjanjem skrivnosti.

## Backend/API stanje

Vercel API poti:

- `api/config.local.js` - javna runtime konfiguracija,
- `api/ai/review-initiative.js` - AI predpregled pobude,
- `api/initiatives.js` - backend zapis pobud, komentarjev in admin statusov,
- `api/signatures.js` - SI-PASS evidencni podpis,
- `api/auth/[...path].js` - SI-PASS session/logout in demo login,
- `api/analytics/[...path].js` - `system` in `clarity` analitika,
- `api/notifications/[...path].js` - email obvestila in dnevni digest,
- `api/security/turnstile.js` - Turnstile server-side preverjanje.

Lokalni `scripts/dev-server.mjs` posnema produkcijske endpoint-e in dodatno vsebuje razvojne poti za SI-CeS:

- `POST /api/sices/start`,
- `GET /api/sices/callback`,
- `GET /api/sices/complete`.

V repozitoriju obstaja skupna SI-CeS logika v `server/sices.mjs`, vendar Vercel `api/sices/*` entrypointi se niso loceno dodani. Zato je SI-CeS oznacen kot **delno implementiran/pripravljen**, ne kot poln produkcijski tok.

## Podatkovni model

Fizicne Supabase tabele trenutne zadnje sheme in dodatnih skript:

- `initiatives`,
- `votes`,
- `signatures`,
- `comments`,
- `initiative_ai_reviews`,
- `system_analytics_events`,
- `analytics_events`,
- `analytics_clarity_snapshots`,
- `analytics_daily_snapshots`.

Pomembne skripte:

1. `supabase/schema.sql` - osnovne tabele, enum tipi, RLS prototipne politike in osnovni view-i.
2. `supabase/search.sql` - hybrid search RPC.
3. `supabase/analytics.sql` - centralni tok analiticnih dogodkov, Clarity snapshot-i, dnevni snapshot-i, SQL view-i in service-role pravice.
4. `supabase/sices-signatures.sql` - dodatna SI-CeS polja v `signatures`.
5. `supabase/signatures-security.sql` - zapre direktni insert podpisov za anon/authenticated.
6. `supabase/backend-write-security.sql` - zapre direktno pisanje pobud in komentarjev za anon/authenticated.
7. `supabase/seed.sql` - demo podatki.

`USER_IDENTITY` v diagramih ni fizicna tabela. Je konceptualni stabilni identifikator uporabnika ali seje, ki se hrani kot `author_ref`, `voter_ref`, `signer_ref` ali `user_ref`.

## Iteracije

| Iteracija | Obseg | Trenutni rezultat |
| --- | --- | --- |
| 1 | Osnovni prototip | Frontend, lokalni repozitorij, validacija, demo prijava, osnovna Supabase shema. |
| 2 | Pobude in sodelovanje | Oddaja, pregled, iskanje, filtriranje, glasovanje, statusi in osnovna analitika. |
| 3 | AI in analitika | Lokalni AI fallback, Hugging Face endpoint, komentarji, AI audit tabela in osnovni SQL view-i. |
| 4 | Email in CI/CD | Email/outbox/SMTP, GitHub Actions, dokumentacija pipeline-a. |
| 5 | Vercel deployment | Runtime config endpoint, AI/email API poti, responsive UI in Vercel priprava. |
| 6 | Analiticne plasti | Vercel Analytics, Speed Insights, Clarity, uporabniska in admin analitika, `system_analytics_events`. |
| 7 | Search in dokumentni izvoz | Supabase hybrid search, PDF tisk/prenos, DOCX/ODT izvoz. |
| 8 | SI-PASS in backend pisanje | SI-PASS session bridge, backend podpisi, backend oddaja/komentarji/statusi, podpisna varnost. |
| 9 | Dostopnost, varnost in performance | Dostopnostni pogled, Turnstile, rate limiting, CSP/headerji, E2E smoke in performance budgeti. |
| 10 | SI-CeS priprava in dokumentacija | SI-CeS helperji, SOAP/TLS popravki, dodatna `signatures` polja, posodobljeni diagrami in Vercel config brez BOM. |

## Testiranje in preverjanje

Aktualni ukazi:

```bash
npm test
npm run test:domain
npm run test:e2e
npm run test:performance
npm run test:coverage
```

Kaj preverjajo:

- domenska pravila pobud, glasov, podpisov, komentarjev in AI,
- DOCX/ODT izvoz,
- uporabniska in sistemska analitika,
- Clarity normalizacija,
- email obvestila in dnevni digest,
- SI-PASS session in UTF-8 popravljanje imen iz proxy headerjev,
- SI-PASS podpis backend,
- admin statusne pravice,
- SI-CeS helperji,
- Turnstile in rate limiting,
- lokalni E2E smoke test API endpointov,
- performance budget zacetnega payloada.

## Odprte produkcijske omejitve

- SI-CeS ima skupno backend logiko in lokalne dev poti, nima pa se locenih Vercel `api/sices/*` entrypointov.
- Prototipne RLS politike v `supabase/schema.sql` niso produkcijsko zakljucene.
- Anonimni glas je vezan na lokalni brskalniski ID in ni pravno zanesljiva identiteta.
- Glasovanje mora za produkcijo v celoti skozi backend in SI-PASS ali drugo preverjeno identiteto.
- Admin pravice prek `ADMIN_EMAILS` so primerne za prototip, ne za poln produkcijski IAM.
- Clarity in drugi zunanji analiticni sistemi zahtevajo GDPR/consent ureditev pred javno produkcijo.
- PDF izvoz je namenjen tiskanju in ni oznacen kot popolnoma dostopen PDF.
