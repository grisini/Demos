# Iteracija 3: analitika in AI presoja pobud

Ta dokument opisuje omejen obseg Iteracije 3: oddaja pobud, pregled/iskanje/filtriranje, glasovanje, komentiranje, napredna analitika in AI predpregled ustreznosti. Ostali moduli naj ostanejo nespremenjeni.

## Funkcionalni obseg

- Oddaja pobude z validacijo obveznih polj.
- Pregled, iskanje, filtriranje po kategoriji/statusu in razvrscanje pobud.
- Glasovanje po pravilu en uporabnik, en glas.
- Komentiranje pobud z minimalno validacijo vsebine.
- Lokalni AI predpregled kot fallback.
- Pripravljena pot za Hugging Face presojo prek varnega backend/edge endpointa.
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
- `signatures`: demo podpisi z metodo podpisa,
- `comments`: javna razprava,
- `initiative_ai_reviews`: zgodovina AI presoj in surov odgovor ponudnika,
- `initiative_analytics`: pogled za glasove, podpise, komentarje in delez glasov,
- `category_analytics`: pogled za agregacijo po kategorijah.

Za produkcijo naj zapisovanje v tabele ne gre neposredno iz frontenda. Frontend naj klice backend/edge funkcije, ki preverijo identiteto, pravice, rate limit in integriteto podatkov.

## AI arhitektura

Priporocen tok:

1. Frontend pri pisanju pobude prikaze lokalni fallback `evaluateInitiative`.
2. Ob oddaji backend/edge funkcija prejme naslov, povzetek, opis, pravno podlago, pricakovani ucinek in izbrano kategorijo.
3. Backend poklice Hugging Face z zascitenim `HF_TOKEN`.
4. Rezultat se normalizira v isti format kot lokalni review: `score`, `risk`, `findings`, `checks`, `categorySuggestion`, `suitability`.
5. V `initiatives` se shrani zadnja ocena, v `initiative_ai_reviews` pa celoten audit zapis.
6. Ce HF klic odpove, backend vrne lokalni fallback in oznaci `provider = local`.

Tokena za Hugging Face se ne sme poslati v brskalnik. V `.env.example` je zato samo `AI_REVIEW_ENDPOINT`, ne pa `HF_TOKEN`.

## Hugging Face uporaba

Prakticna izbira za zacetek:

- Zero-shot klasifikacija za kategorijo in ustreznost. Kandidatne oznake: `Javne finance`, `Zdravstvo`, `Okolje`, `Izobrazevanje`, `Pravosodje`, `Digitalna drzava`, `Drugo`, `primerna`, `potreben pregled`, `nezadostna`.
- Feature extraction za semantiko: zaznava podobnih pobud, naprednejse iskanje in gručenje pobud.
- Opcijsko LLM/chat completion za strukturiran povzetek ugotovitev, vendar samo z jasno JSON shemo in validacijo odziva.

Predlagani modeli za prototip:

- `MoritzLaurer/ModernBERT-large-zeroshot-v2.0` za vecjezicno zero-shot klasifikacijo.
- `intfloat/multilingual-e5-small` za embeddinge in semantiko.
- Lokalni fallback `local-rule-engine-v1`, ki je ze implementiran v `src/domain/validation.js`.

## Primer backend pogodbe

```http
POST /api/ai/review-initiative
Content-Type: application/json
Authorization: Bearer <aplikacijski-token>
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
  "model": "MoritzLaurer/ModernBERT-large-zeroshot-v2.0",
  "score": 81,
  "risk": "low",
  "suitability": "ready",
  "categorySuggestion": {
    "category": "Zdravstvo",
    "confidence": 91
  },
  "findings": [
    "Pobuda je dovolj konkretna za objavo.",
    "Predlagana kategorija se ujema z vsebino."
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

- Hugging Face Inference Providers: https://huggingface.co/docs/hub/models-inference
- Hugging Face Zero-Shot Classification: https://huggingface.co/docs/inference-providers/en/tasks/zero-shot-classification
- Hugging Face JavaScript InferenceClient: https://huggingface.co/docs/huggingface.js/en/inference/classes/InferenceClient
- Transformers.js: https://huggingface.co/docs/transformers.js/en/index
