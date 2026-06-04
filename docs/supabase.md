# Supabase povezava

Datum revizije: 2026-06-04

Krovni povzetek zadnje verzije je v `docs/stanje-zadnje-verzije.md`.

## Namen Supabase sloja

Projekt lahko deluje v dveh podatkovnih nacinih:

- `DATA_SOURCE=local` uporablja `localStorage` in je primeren za hiter lokalni prikaz.
- `DATA_SOURCE=supabase` uporablja Supabase PostgreSQL prek `src/lib/supabase.js`, backend endpointov in SQL skript v `supabase/`.

Supabase sloj podpira pobude, glasove, podpise, komentarje, AI audit, sistemsko analitiko, centralni tok analiticnih dogodkov, Clarity snapshot-e, dnevne agregate in hybrid search.

## Tabele zadnje verzije

Fizicne tabele:

- `initiatives` - pobude, DZ vsebinski sklopi, avtor, status in zadnja AI ocena.
- `votes` - glasovi z `unique (initiative_id, voter_ref)`.
- `signatures` - SI-PASS/SI-CeS podpisi z `unique (initiative_id, signer_ref)`.
- `comments` - komentarji z dolzinsko omejitvijo.
- `initiative_ai_reviews` - zgodovina AI presoj.
- `system_analytics_events` - sistemski/admin dogodki iz backend endpointa.
- `analytics_events` - centralni tok analiticnih dogodkov.
- `analytics_clarity_snapshots` - Microsoft Clarity snapshot-i iz Data Export API.
- `analytics_daily_snapshots` - dnevni agregati pobud, glasov, podpisov, komentarjev in dogodkov.

`USER_IDENTITY` iz ER diagramov ni tabela. Vrednost je shranjena kot `author_ref`, `voter_ref`, `signer_ref` ali `user_ref`.

## Priporocen vrstni red SQL skript

V Supabase SQL editorju izvedite:

1. `supabase/schema.sql`
2. `supabase/search.sql`
3. `supabase/analytics.sql`
4. `supabase/sices-signatures.sql`, ce uporabljate SI-CeS polja
5. `supabase/signatures-security.sql`, ce mora podpis nastati samo prek backend endpointa
6. `supabase/backend-write-security.sql`, ce oddaja pobud in komentarji potekajo prek backenda
7. `supabase/seed.sql`, ce zelite demo podatke

Osnovni `schema.sql` vsebuje prototipne RLS politike, zato utrditveni skripti niso opcijski za produkcijo.

## Lokalni zagon s Supabase

1. V Supabase projektu izvedite SQL skripte.
2. V `.env.local` nastavite:

```env
DATA_SOURCE=supabase
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=PUBLIC_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=SERVER_ONLY_SERVICE_ROLE_KEY
```

3. Zazenite:

```bash
npm run dev
```

`SUPABASE_SERVICE_ROLE_KEY` je potreben za backend pisanje, SI-PASS podpise, admin sistemsko analitiko in dnevni digest. Ne sme biti `VITE_*`.

## Deployment

Frontend vedno nalozi `/config.local.js`. Lokalno to pot generira `scripts/dev-server.mjs`, na Vercelu pa `api/config.local.js` prek pravila v `vercel.json`.

Za Vercel nastavite javne vrednosti:

```env
DATA_SOURCE=supabase
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=PUBLIC_ANON_KEY
```

Server-only vrednosti:

```env
SUPABASE_SERVICE_ROLE_KEY=...
HF_TOKEN=...
CLARITY_API_TOKEN=...
TURNSTILE_SECRET_KEY=...
SIPASS_SESSION_SECRET=...
SIPASS_USER_REF_SALT=...
SMTP_PASS=...
```

Po spremembi env varov je potreben redeploy. Ce v integracijskem pogledu `URL nastavljen` ali `Anon kljuc nastavljen` se vedno kaze `ne`, preverite Network odziv za `/config.local.js`.

## Hybrid search

`supabase/search.sql` doda RPC:

- `search_initiatives(...)`,
- `search_initiative_suggestions(...)`.

Ko je `DATA_SOURCE=supabase` in iskalni niz vsebuje vsaj 2 znaka, `SupabaseInitiativeRepository.search()` uporabi RPC. Brez Supabase ali ob napaki RPC aplikacija pade nazaj na lokalno filtriranje.

## Analitika

`supabase/analytics.sql` doda:

- `analytics_events`,
- `analytics_clarity_snapshots`,
- `analytics_daily_snapshots`,
- triggerje, ki iz pobud, glasov, podpisov, komentarjev in AI pregledov zapisujejo dogodke,
- view-e `analytics_event_daily`, `analytics_ai_daily`, `analytics_email_daily`, `analytics_frontend_daily`, `analytics_business_event_daily`, `analytics_initiative_summary`, `analytics_category_summary`, `analytics_system_summary`,
- funkcijo `refresh_analytics_daily_snapshots(date, date)`.

Te tabele in view-i so zaklenjeni za `anon`/`authenticated` in namenjeni `service_role` dostopu.

## SI-PASS in SI-CeS podpisi

`signatures` hrani:

- `method = 'sipass'` za SI-PASS evidencni podpis,
- `method = 'sices'` za SI-CeS podpisni tok,
- `sices_request_id`,
- `sices_ces_id`,
- `signed_document_path`,
- `signed_document_hash`,
- `certificate_chain`,
- `signature_status`.

Ta dodatna polja doda `supabase/sices-signatures.sql`.

## Varnostna opomba

Za produkcijo je treba:

- zapreti prototipne RLS politike,
- pisanje pobud, komentarjev, podpisov in statusov voditi prek backend endpointov,
- glasovanje premakniti na backend z realno preverjeno ali strogo anonimizirano identiteto,
- vezati admin pravice na produkcijski IAM/SI-PASS model,
- hraniti samo minimalne osebne podatke,
- uporabljati `SUPABASE_SERVICE_ROLE_KEY` samo na serverju,
- ohraniti rate limiting, Turnstile in Cloudflare/WAF sloj.
