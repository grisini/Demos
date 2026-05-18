# Supabase povezava

Projekt trenutno deluje lokalno z `localStorage`. Za Supabase preklop je pripravljen REST adapter v `src/lib/supabase.js` in SQL shema v `supabase/schema.sql`.

AI predpregled je v razvojnem okolju ze povezan prek `POST /api/ai/review-initiative` v `scripts/dev-server.mjs`. Endpoint uporablja `HF_TOKEN` na strani streznika in zato tokena ne razkrije brskalniku.

Shema vsebuje tudi pripravo za Iteracijo 3:

- `initiative_ai_reviews` za zgodovino AI presoj in audit surovih odgovorov,
- `initiative_analytics` za stevilo glasov, podpisov, komentarjev in delez glasov na pobudo,
- `category_analytics` za agregacijo pobud po kategorijah.

## Lokalni zagon s Supabase

1. V Supabase projektu izvedite SQL iz `supabase/schema.sql`.
2. V `.env.local` nastavite:

```env
DATA_SOURCE=supabase
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=PUBLIC_ANON_KEY
```

3. Zazenite `npm run dev`.

## Deployment

Frontend vedno najprej nalozi `/config.local.js`. Lokalno to pot generira `scripts/dev-server.mjs`; na Vercelu jo `vercel.json` preusmeri na `api/config.local.js`, ki iz env varov sestavi samo javni config.

Za Vercel, Render ali Railway nastavite:

```env
DATA_SOURCE=supabase
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=PUBLIC_ANON_KEY
```

Podprti so tudi `VITE_*` aliasi, ce deployment uporablja pravi Vite build:

```env
VITE_DATA_SOURCE=supabase
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=PUBLIC_ANON_KEY
```

Po spremembi env varov na hostingu je potreben redeploy. Ce je v integracijskem pogledu `URL nastavljen` ali `Anon kljuc nastavljen` se vedno `ne`, najprej preverite Network odziv za `/config.local.js`.

## Varnostna opomba

Shema vsebuje prototipne RLS politike, ki dovolijo javno branje in pisanje z anon kljucem. To je primerno za razvojni demo, ne za produkcijo.

Za produkcijo je treba:

- pisanje premakniti v backend ali edge funkcije,
- vezati uporabnika na SI-PASS preverjeno identiteto,
- prepreciti spremembo statusov navadnim uporabnikom,
- hraniti samo minimalne osebne podatke oziroma anonimizirane identifikatorje,
- dodati rate limiting in revizijsko sled.
- razvojni Hugging Face endpoint premakniti v backend ali Supabase Edge Function in token hraniti izkljucno tam, ne v brskalniku.
