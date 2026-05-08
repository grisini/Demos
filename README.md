# Demos - Demokracija 2.0

Prototip spletne platforme za oddajo, pregled, glasovanje in osnovno analitiko zakonodajnih pobud.

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
- lokalni AI predpregled besedila pobude,
- pregled, iskanje, filtriranje in razvrscanje pobud,
- glasovanje, demo podpisovanje, komentarji in statusi,
- osnovna statistika in analitika,
- Supabase SQL shema in konfiguracijski nastavki,
- povzetek SI-PASS testnega okolja.

## Dokumentacija

- `docs/roadmap.md` - izvedba po iteracijah,
- `docs/supabase.md` - Supabase povezava,
- `docs/si-pass-testno-okolje.md` - razvojne opombe za SI-PASS.
