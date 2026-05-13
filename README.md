# Demos - Demokracija 2.0

Prototip spletne platforme za oddajo, pregled, glasovanje, komentiranje, AI predpregled in analitiko zakonodajnih pobud.

## Zagon

```bash
npm run dev
```

Privzeti naslov je `http://localhost:5173`. Ce je port zaseden, razvojni streznik uporabi naslednji prosti port.

## Testi

```bash
npm test
```

## Trenutno pokrito

- demo prijava brez SI-PASS,
- oddaja pobude z osnovno validacijo,
- Hugging Face AI predpregled besedila pobude s score, risk, suitability, completeness in categorySuggestion,
- lokalni AI predpregled kot fallback, kadar Hugging Face ni nastavljen ali ni dosegljiv,
- pregled, iskanje, filtriranje in razvrscanje pobud,
- glasovanje, demo podpisovanje, komentarji in statusi,
- napredna statistika glasov na pobudo, kategorije, komentarje in AI tveganja,
- Supabase SQL shema in konfiguracijski nastavki,
- povzetek SI-PASS testnega okolja.

## Dokumentacija

- `docs/roadmap.md` - izvedba po iteracijah,
- `docs/iteracija-3-analitika-ai.md` - analitika, AI predpregled, shema in Hugging Face pot,
- `docs/diagrams.md` - Mermaid uporabniski, UML, ER in zaporedni diagrami,
- `docs/devwork-loop.md` - sprotna porocila in kontrolne tocke,
- `docs/supabase.md` - Supabase povezava,
- `docs/baza-porocilo.md` - porocilo o zasnovi baze in razlogih za podatkovni model,
- `docs/si-pass-testno-okolje.md` - razvojne opombe za SI-PASS.

## Hugging Face

Kljuc naj bo samo v `.env.local` ali okolju, ne v `src` datotekah:

```bash
AI_PROVIDER=huggingface
AI_REVIEW_ENDPOINT=/api/ai/review-initiative
HUGGINGFACE_ZERO_SHOT_MODEL=facebook/bart-large-mnli
HUGGINGFACE_EMBEDDING_MODEL=intfloat/multilingual-e5-small
HF_TOKEN=hf_...
```

Dev streznik izpostavi varen endpoint `/api/ai/review-initiative`, frontend pa ob oddaji pobude uporabi Hugging Face in ob napaki samodejno pade nazaj na lokalno presojo.
