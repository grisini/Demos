# Hybrid search pobud

Ta dokument opisuje Supabase hybrid search za polje **Iskanje** v pregledu pobud.

## Namen

Prvotno iskanje je delovalo samo v brskalniku nad ze nalozenimi pobudami:

- naslov,
- povzetek,
- kategorija.

To je dovolj za majhen lokalni demo, pri vec podatkih pa je pocasno in ne podpira tipkarskih napak ali boljsih rangiranj. Zato je dodan Supabase RPC search, ki del iskanja premakne v PostgreSQL.

## Datoteke

- `supabase/search.sql` - PostgreSQL funkcije, indeksi in RPC pravice.
- `src/lib/supabase.js` - metoda `SupabaseInitiativeRepository.search()`, ki klice RPC.
- `src/main.js` - priklop search polja na remote search z debounce.
- `README.md` - kratko navodilo za vrstni red SQL skript.

## Vklop

V Supabase SQL Editorju izvedite skripte v tem vrstnem redu:

```sql
-- 1. osnovna shema
-- supabase/schema.sql

-- 2. hybrid search
-- supabase/search.sql
```

Za frontend mora biti runtime nastavljen na Supabase:

```env
DATA_SOURCE=supabase
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=PUBLIC_ANON_KEY
```

`SUPABASE_ANON_KEY` je javni kljuc za frontend. `SUPABASE_SERVICE_ROLE_KEY` se za search ne uporablja in ne sme biti v frontend konfiguraciji.

## SQL struktura

`supabase/search.sql` doda extension:

```sql
create extension if not exists pg_trgm;
```

Glavne helper funkcije:

- `search_normalize(value text)` normalizira tekst za primerjavo brez sumnikov in posebnih znakov.
- `initiative_search_text(...)` sestavi iskalni tekst pobude.
- `initiative_category_label(...)` varno pretvori enum kategorije v tekst za index expression.
- `initiative_status_label(...)` varno pretvori enum statusa v tekst.

Indeksi:

- `initiatives_search_tsv_idx` za PostgreSQL full-text search.
- `initiatives_search_trgm_idx` za trigram/fuzzy primerjave.

RPC funkciji:

- `search_initiatives(...)` vrne polne rezultate za seznam pobud.
- `search_initiative_suggestions(...)` vrne krajsi rezultat za morebiten autocomplete.

## Kako deluje iskanje

Search je kombinacija vec signalov:

- full-text match cez naslov, povzetek, kategorijo, opis, pravno podlago in pricakovani ucinek,
- substring match po naslovu, povzetku in kategoriji,
- fuzzy match predvsem po naslovu in kategoriji,
- dodatni boost po podpori in svezi aktivnosti.

Fuzzy match ni vec namenoma vezan na celoten opis pobude, ker bi to vracalo prevec rezultatov. Primer: query `javni` ne sme avtomatsko vrniti vsake pobude, ki ima v dolgem opisu ali pravni podlagi besedo `javni`.

## Frontend tok

V `src/main.js` je search priklopljen samo, kadar velja:

- `DATA_SOURCE=supabase`,
- `SUPABASE_URL` in `SUPABASE_ANON_KEY` sta nastavljena,
- repozitorij podpira metodo `search()`,
- query ima vsaj 2 znaka.

Ko uporabnik tipka:

1. `handleInput()` posodobi `state.query`.
2. `scheduleRemoteSearch()` pocaka `800 ms` po zadnjem vnosu.
3. Po premoru poklice `loadRemoteSearch()`.
4. `loadRemoteSearch()` poklice `repository.search()`.
5. `src/lib/supabase.js` naredi `POST /rest/v1/rpc/search_initiatives`.
6. Rezultati se zmapirajo nazaj v frontend obliko pobude.

Ce query ni vpisan ali je dolg samo 1 znak, aplikacija uporabi lokalno filtriranje ze nalozenih pobud. Ce RPC pade, aplikacija prikaze opozorilo in uporabi lokalni fallback.

## RPC parametri

`search_initiatives` podpira:

| Parameter | Namen |
| --- | --- |
| `p_query` | Iskalni niz uporabnika. |
| `p_category` | Kategorija ali `null` za vse. |
| `p_status` | Status ali `null` za vse. |
| `p_public_only` | Ce je `true`, vrne samo `active` in `signature_collection`. |
| `p_sort` | `relevance`, `popular`, `newest` ali `score`. |
| `p_limit` | Najvec rezultatov. V aplikaciji je trenutno 50. |
| `p_offset` | Odmik za paginacijo. |

## Primeri SQL klicev

Osnovno iskanje:

```sql
select *
from public.search_initiatives(
  p_query => 'javni',
  p_limit => 20
);
```

Iskanje z omejitvijo na kategorijo:

```sql
select *
from public.search_initiatives(
  p_query => 'portal',
  p_category => 'Digitalna drzava',
  p_status => null,
  p_public_only => false,
  p_sort => 'relevance',
  p_limit => 20,
  p_offset => 0
);
```

Javni pogled za neprijavljenega uporabnika:

```sql
select id, title, category, status, search_score, match_type
from public.search_initiatives(
  p_query => 'wifi',
  p_public_only => true
);
```

Preverjanje, da nakljucen query ne vrne vseh pobud:

```sql
select count(*)
from public.search_initiatives(p_query => 'asdfasdfasdf');
```

## Primer REST RPC klica

Frontend uporablja Supabase REST RPC:

```http
POST https://PROJECT_REF.supabase.co/rest/v1/rpc/search_initiatives
apikey: PUBLIC_ANON_KEY
Authorization: Bearer PUBLIC_ANON_KEY
Content-Type: application/json
```

Body:

```json
{
  "p_query": "javni",
  "p_category": null,
  "p_status": null,
  "p_public_only": false,
  "p_sort": "relevance",
  "p_limit": 50,
  "p_offset": 0
}
```

## Rezultat

RPC vrne podatke pobude in dodatna search polja:

- `vote_count`,
- `signature_count`,
- `comment_count`,
- `support_count`,
- `latest_activity_at`,
- `text_rank`,
- `fuzzy_rank`,
- `support_rank`,
- `recency_rank`,
- `search_score`,
- `match_type`.

Frontend nato dodatno nalozi povezane glasove, podpise in komentarje za vrnjene pobude, ker UI detail pogled potrebuje sezname, ne samo stevcev.

## Rangiranje

Glavna formula je v `search_initiatives()`:

```sql
text_rank * 0.58
+ fuzzy_rank * 0.28
+ support_rank * 0.10
+ recency_rank * 0.04
```

Dodatni boost dobi exact/prefix naslov:

- exact title: `+0.30`,
- title prefix: `+0.18`.

To pomeni, da je vsebinsko ujemanje pomembnejse od popularnosti, popularnost pa pomaga razvrstiti podobno relevantne pobude.

## Performancne odlocitve

Frontend uporablja debounce:

```js
const REMOTE_SEARCH_DEBOUNCE_MS = 800;
const REMOTE_SEARCH_MIN_LENGTH = 2;
```

To pomeni:

- search se ne klice po vsaki tipki,
- klic se zgodi sele po 800 ms brez tipkanja,
- 1 znak se ne posilja na RPC,
- med re-renderjem se ohrani fokus in pozicija cursorja v search inputu.

## Fallback

Fallback scenariji:

- `DATA_SOURCE` ni `supabase`: uporabi se lokalni `LocalInitiativeRepository`.
- Supabase config manjka: uporabi se lokalni repozitorij.
- query ima manj kot 2 znaka: lokalno filtriranje.
- RPC vrne napako: prikaze se opozorilo in uporabi lokalni rezultat.

To je namenoma, da demo ostane uporaben tudi brez pravilno pripravljene Supabase funkcije.

## Troubleshooting

### Supabase javi `functions in index expression must be marked IMMUTABLE`

To se zgodi, ce index uporablja neposreden cast enum vrednosti, na primer `category::text`. Skripta zato uporablja helper:

```sql
public.initiative_category_label(category)
```

Ponovno izvedite celoten `supabase/search.sql`.

### Iskanje vraca skoraj vse pobude

Najpogostejsi vzrok je, da v Supabase se ni nalozena zadnja verzija `search_initiatives()`.

Preverite z:

```sql
select count(*)
from public.search_initiatives(p_query => 'asdfasdfasdf');
```

Ce vrne vse pobude, ponovno izvedite `supabase/search.sql`.

### Iskanje v aplikaciji dela lokalno, ne prek RPC

Preverite:

- `DATA_SOURCE=supabase`,
- `SUPABASE_URL` je nastavljen,
- `SUPABASE_ANON_KEY` je nastavljen,
- query ima vsaj 2 znaka,
- v Network tabu obstaja `POST /rest/v1/rpc/search_initiatives`.

### Fokus izgine iz search inputa

`src/main.js` pred renderjem shrani fokus iskalnega inputa in ga po renderju obnovi. Ce se fokus se vedno izgubi, preverite ali se search input dejansko renderira z `data-filter="query"`.

## Znane omejitve

- Search ni semanticni embedding search; gre za PostgreSQL full-text + trigram fuzzy search.
- Slovenscina je obdelana s preprosto normalizacijo znakov, ne z jezikovnim lematizatorjem.
- Opis, pravna podlaga in pricakovani ucinek sodelujejo pri full-text searchu, ne pa pri sirokem fuzzy matchu.
- Frontend trenutno nima paginacije rezultatov; RPC podpira `p_limit` in `p_offset`, UI pa uporablja limit 50.
