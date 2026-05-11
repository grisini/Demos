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
- lokalni AI predpregled besedila pobude s predlogom kategorije in oceno ustreznosti,
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
- `docs/si-pass-testno-okolje.md` - razvojne opombe za SI-PASS.
