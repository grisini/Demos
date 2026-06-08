# CI/CD pipeline

Datum revizije: 2026-06-04

Krovni povzetek zadnje verzije je v `docs/stanje-zadnje-verzije.md`.

## Namen

GitHub Actions pipeline preverja, da je projekt pred zdruzevanjem in deployem skladen z zadnjo strukturo kode. Frontend nima posebnega build koraka, zato pipeline poudari teste, coverage, sintakso, prisotnost integracijskih datotek in varovanje skrivnosti.

Workflow je v:

```text
.github/workflows/pipeline_demos.yml
```

## Kaj se izvede

- `npm ci` namesti odvisnosti iz `package-lock.json`.
- `npm run test:coverage` zazene `tests/domain.test.mjs`, `tests/e2e.test.mjs`, `tests/performance.test.mjs` in pripravi coverage.
- SonarCloud scan uporabi `coverage/lcov.info`.
- `node --check` preveri vse JS/MJS datoteke v `src`, `api`, `server`, `scripts` in `tests`.
- `Check required project files` preveri kljucne frontend, API, server, Supabase, testne in dokumentacijske datoteke.
- `Validate deployment wiring` preveri runtime config, auth endpoint-e, Supabase config, hybrid search in varnostne SQL skripte.
- `Validate SI-CAS metadata archive` preveri staticni SP metadata za SI-CAS.
- `Check frontend does not read server-only secrets` preprecuje, da bi frontend bral `SUPABASE_SERVICE_ROLE_KEY`, `HF_TOKEN`, `CLARITY_API_TOKEN`, `SMTP_PASS`, `TURNSTILE_SECRET_KEY`, `SIPASS_SESSION_SECRET` ali podobne skrivnosti.
- `Check that local secrets are not committed` isce `.env.local`, private key-e in tipicne token vzorce.

## Ključne datoteke, ki jih pipeline zahteva

- `api/config.local.js`
- `api/ai/review-initiative.js`
- `api/initiatives.js`
- `api/signatures.js`
- `api/analytics/[...path].js`
- `api/auth/[...path].js`
- `api/notifications/[...path].js`
- `api/security/turnstile.js`
- `server/sipass-session.mjs`
- `server/sices.mjs`
- `server/analytics-clarity.mjs`
- `server/analytics-system.mjs`
- `server/daily-digest.mjs`
- `server/initiatives.mjs`
- `server/signatures.mjs`
- `server/turnstile.mjs`
- `supabase/schema.sql`
- `supabase/analytics.sql`
- `supabase/search.sql`
- `supabase/backend-write-security.sql`
- `supabase/signatures-security.sql`

## Kaj pipeline namenoma ne dela

- Ne deploya samodejno na Vercel ali VPS.
- Ne izvaja prave SI-PASS/SI-CAS prijave, ker zahteva zunanji testni IdP in registriran callback.
- Ne izvaja pravega SI-CeS podpisa v zunanjem drzavnem testnem okolju; testira pa helperje, konfiguracijo in parserje v `tests/domain.test.mjs`.
- Ne uporablja produkcijskih skrivnosti v CI.

## Kaj se doda kasneje

- preview smoke test za Vercel URL,
- locen deploy job za Vercel,
- locen VPS health-check za `demos-auth.service`,
- SI-CAS session test v registriranem testnem okolju,
- SI-CeS integracijski test z varnim mockom ali locenim testnim okoljem,
- preverjanje Supabase migracij prek CLI v locenem CI okolju.
