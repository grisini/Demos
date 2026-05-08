# Supabase povezava

Projekt trenutno deluje lokalno z `localStorage`. Za Supabase preklop je pripravljen REST adapter v `src/lib/supabase.js` in SQL shema v `supabase/schema.sql`.

## Lokalni zagon s Supabase

1. V Supabase projektu izvedite SQL iz `supabase/schema.sql`.
2. V `.env.local` nastavite:

```env
DATA_SOURCE=supabase
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=PUBLIC_ANON_KEY
```

3. Zazenite `npm run dev`.

## Varnostna opomba

Shema vsebuje prototipne RLS politike, ki dovolijo javno branje in pisanje z anon kljucem. To je primerno za razvojni demo, ne za produkcijo.

Za produkcijo je treba:

- pisanje premakniti v backend ali edge funkcije,
- vezati uporabnika na SI-PASS preverjeno identiteto,
- prepreciti spremembo statusov navadnim uporabnikom,
- hraniti samo minimalne osebne podatke oziroma anonimizirane identifikatorje,
- dodati rate limiting in revizijsko sled.
