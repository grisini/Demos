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
- [x] Shema vsebuje tabelo za AI audit in poglede za analitiko.
- [x] Mermaid diagrami so pripravljeni v dokumentaciji.
- [ ] Produkcijski Hugging Face endpoint je se nacrt, ne implementirana skrivnost v frontend.
- [ ] SI-PASS produkcijska integracija ostaja zunaj tega cikla.

### Naslednji cikel

- Implementirati backend ali Supabase Edge Function za `POST /api/ai/review-initiative`.
- Dodati dnevne agregate glasovanja, ko bo obstajal casovni volumen podatkov.
- Dodati E2E test za oddajo pobude, glasovanje in komentar.
- Uvesti produkcijske RLS politike po SI-PASS identiteti.

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
