# Iteracija 3: analitika in AI presoja pobud

Datum revizije: 2026-06-04

Ta dokument ostaja opis Iteracije 3, vendar je spodaj dodana opomba o trenutnem stanju zadnje verzije. Krovni povzetek je v `docs/stanje-zadnje-verzije.md`.

## Trenutno stanje po kasnejsih iteracijah

Po Iteraciji 3 je projekt napredoval. Danes AI in analitika nista vec samo razvojni nastavek:

- `/api/ai/review-initiative` obstaja v lokalnem `scripts/dev-server.mjs` in kot Vercel entrypoint `api/ai/review-initiative.js`,
- endpoint ima rate limiting in uporablja lokalni fallback, ce `HF_TOKEN` ali zunanji model nista dosegljiva,
- `supabase/analytics.sql` razsiri osnovno analitiko z `analytics_events`, `analytics_clarity_snapshots`, `analytics_daily_snapshots` in `analytics_*` SQL view-i,
- `api/analytics/[...path].js` usmerja sistemsko in Clarity analitiko,
- admin sistemska analitika, osebna analitika in Clarity agregati so loceni pogledi z locenimi pravicami.

Zgodovinski opis Iteracije 3 spodaj je zato treba brati kot zacetni obseg, ne kot celoten trenutni obseg projekta.

Ta dokument opisuje omejen obseg Iteracije 3: oddaja pobud, pregled/iskanje/filtriranje, glasovanje, komentiranje, napredna analitika in AI predpregled ustreznosti. Ostali moduli naj ostanejo nespremenjeni.

## Funkcionalni obseg

- Oddaja pobude z validacijo obveznih polj.
- Pregled, iskanje, filtriranje po kategoriji/statusu in razvrscanje pobud.
- Glasovanje po pravilu en uporabnik, en glas.
- Komentiranje pobud z minimalno validacijo vsebine.
- Hugging Face AI predpregled prek varnega backend/dev-server endpointa.
- Lokalni AI predpregled kot fallback.
- Napredna analitika stevila glasov na pobudo, kategorijo, status in AI tveganje.

## Napredna analitika

Ze smiselni kazalniki za ta projekt:

- `vote_count`: stevilo glasov na pobudo.
- `vote_share_percent`: delez vseh glasov, ki jih ima pobuda.
- `signature_count`: stevilo evidentiranih podpisov.
- `signature_conversion_percent`: koliko glasovalcev se pretvori v podpisnike.
- `comment_count`: intenzivnost razprave.
- `support_count`: glasovi + podpisi.
- `engagement_score`: glasovi + podpisi + delna utezenost komentarjev.
- `max_votes`, `average_votes`, `median_votes`: porazdelitev glasov med pobudami.
- `zero_vote_initiatives`: pobude, ki se niso dobile podpore.
- `category_stats`: pobude, glasovi, podpisi, komentarji in povprecna AI ocena po kategoriji.
- `status_stats`: koliko pobud je v posamezni fazi in koliko glasov ima faza.
- `risk_summary`: stevilo pobud po AI tveganju.

Poznejse nadgradnje, ko bo vec podatkov:

- casovna vrsta glasov po dnevih/tednih,
- stopnja rasti pobude v prvih 24/72 urah,
- primerjava podobnih pobud z embeddingi,
- analiza sentimenta komentarjev,
- zaznava nenavadnih vzorcev glasovanja,
- segmentacija po obcini/regiji, ce bo to dovoljeno z GDPR in SI-PASS pravili.

## Podatkovna shema

Osnovna shema ostaja normalizirana:

- `initiatives`: jedro pobude in zadnja AI ocena,
- `votes`: glasovi z unikatno omejitvijo `(initiative_id, voter_ref)`,
- `signatures`: SI-PASS/SI-CeS podpisi z metodo podpisa,
- `comments`: javna razprava,
- `initiative_ai_reviews`: zgodovina AI presoj in surov odgovor ponudnika,
- `initiative_analytics`: pogled za glasove, podpise, komentarje in delez glasov,
- `category_analytics`: pogled za agregacijo po kategorijah.

Za produkcijo naj zapisovanje v tabele ne gre neposredno iz frontenda. Frontend naj klice backend/edge funkcije, ki preverijo identiteto, pravice, rate limit in integriteto podatkov.

## AI arhitektura

Priporocen tok:

1. Frontend pri pisanju pobude prikaze lokalni fallback `evaluateInitiative`.
2. Ob rocnem predpregledu ali oddaji frontend poklice `/api/ai/review-initiative`.
3. Razvojni streznik `scripts/dev-server.mjs` poklice Hugging Face Inference Providers z zascitenim `HF_TOKEN`.
4. Rezultat se normalizira v isti format kot lokalni review: `score`, `risk`, `findings`, `checks`, `categorySuggestion`, `suitability`.
5. V `initiatives` se shrani zadnja ocena, v `initiative_ai_reviews` pa celoten audit zapis.
6. Ce Hugging Face klic odpove, frontend/backend uporabi lokalni fallback in oznaci `provider = local`.

Tokena za Hugging Face se ne sme poslati v brskalnik. Prava vrednost `HF_TOKEN` spada v `.env.local` ali sistemsko okolje.

Endpoint je zdaj implementiran v razvojnem strezniku in kot Vercel serverless funkcija. Za polno produkcijo ostaja odprto predvsem merjenje dejanske porabe pri AI ponudniku, stroga audit politika in morebitna selitev v namenski backend/Supabase Edge Function, ce bo to zahtevalo produkcijsko okolje.

## Hugging Face uporaba

Prakticna izbira za zacetek:

- Zero-shot klasifikacija za kategorijo in ustreznost prek `/api/ai/review-initiative`.
- Kandidatne kategorije: `Javne finance`, `Zdravstvo`, `Okolje`, `Izobrazevanje`, `Pravosodje`, `Digitalna drzava`, `Drugo`.
- Kandidatne oznake ustreznosti: `primerna za objavo`, `potreben uredniski pregled`, `nezadostna za oddajo`.
- Lokalni fallback `local-rule-engine-v1`, ce Hugging Face ni nastavljen, ni dosegljiv ali vrne neveljaven odgovor.
- Model se nastavi z `HUGGINGFACE_ZERO_SHOT_MODEL`, privzeto `facebook/bart-large-mnli`.

Razvojna konfiguracija:

```bash
AI_PROVIDER=huggingface
AI_REVIEW_ENDPOINT=/api/ai/review-initiative
HUGGINGFACE_ZERO_SHOT_MODEL=facebook/bart-large-mnli
HUGGINGFACE_EMBEDDING_MODEL=intfloat/multilingual-e5-small
HF_TOKEN=hf_...
```

## Primer backend pogodbe

```http
POST /api/ai/review-initiative
Content-Type: application/json
```

```json
{
  "title": "Register cakalnih dob",
  "category": "Zdravstvo",
  "summary": "Kratek opis pobude",
  "description": "Daljsa obrazlozitev",
  "legalReference": "Zakon ...",
  "expectedImpact": "Merljiv pricakovani ucinek"
}
```

```json
{
  "provider": "huggingface",
  "model": "facebook/bart-large-mnli",
  "score": 81,
  "risk": "low",
  "suitability": "ready",
  "categorySuggestion": {
    "category": "Zdravstvo",
    "confidence": 91
  },
  "findings": [
    "Napredno preverjanje ocenjuje: primerna za objavo (88% zanesljivost).",
    "Napredno preverjanje potrjuje kategorijo Zdravstvo z 91% ujemanjem."
  ],
  "checks": {
    "completeness": 100,
    "budgetRisk": false,
    "legalReferenceDetected": true
  }
}
```

## Sprejemni kriteriji

- Uporabnik lahko odda pobudo in dobi AI predpregled pred oddajo.
- Seznam podpira iskanje, filtriranje, kategorije in razvrscanje.
- Vsaka pobuda prikaze stevilo glasov in komentarjev.
- Analitika prikaze glasove na pobudo, porazdelitev glasov, kategorije in AI tveganja.
- Supabase shema vsebuje poglede za analitiko in audit tabelo za AI presoje.
- Mermaid diagrami dokumentirajo uporabniski tok, UML in ER shemo.

## Viri

- Hugging Face Inference Providers: https://huggingface.co/docs/inference-providers/index
- Hugging Face Zero-Shot Classification: https://huggingface.co/docs/inference-providers/tasks/zero-shot-classification
- Hugging Face Inference API: https://huggingface.co/docs/api-inference/index
- Hugging Face JavaScript InferenceClient: https://huggingface.co/docs/huggingface.js/en/inference/classes/InferenceClient
