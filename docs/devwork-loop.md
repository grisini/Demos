# DevWork loop porocila

Namen tega dokumenta je, da je po vsakem razvojnem ciklu viden napredek: kaj je bilo pregledano, kaj spremenjeno, kako je preverjeno in kaj ostaja odprto.

## Trenutni cikel: 2026-05-11

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
