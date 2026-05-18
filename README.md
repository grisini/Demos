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
- email obvestila za glasovalce ob spremembah pobude in novih pobudah v isti kategoriji,
- napredna statistika glasov na pobudo, kategorije, komentarje in AI tveganja,
- Supabase SQL shema in konfiguracijski nastavki,
- povzetek SI-PASS testnega okolja.

## Dokumentacija

- `docs/pregled-projekta.md` - celovit tehnicni in funkcionalni pregled projekta,
- `docs/funkcionalnosti.md` - zivi register funkcionalnosti, statusov, dokazov v kodi in preverjanja,
- `docs/git-zgodovina.md` - kronoloski povzetek razvoja iz git zgodovine,
- `docs/roadmap.md` - izvedba po iteracijah,
- `docs/devwork-loop.md` - sprotna porocila in kontrolne tocke,
- `docs/iteracija-3-analitika-ai.md` - analitika, AI predpregled, shema in Hugging Face pot,
- `docs/diagrams.md` - Mermaid uporabniski, UML, ER in zaporedni diagrami,
- `docs/classDiagram.mmd` - izvor UML class diagrama,
- `docs/erDiagram.mmd` - izvor ER diagrama,
- `docs/sequenceDiagram.mmd` - izvor zaporednega diagrama,
- `docs/flowchart LR.mmd` - izvor uporabniskega flow diagrama,
- `docs/ci-cd-pipeline.md` - predlagan GitHub Actions pipeline,
- `docs/supabase.md` - Supabase povezava,
- `docs/baza-porocilo.md` - porocilo o zasnovi baze in razlogih za podatkovni model,
- `docs/si-pass-testno-okolje.md` - razvojne opombe za SI-PASS,
- `docs/sipass-sicas-ces-priklop.md` - podrobnejsi opis SI-PASS, SI-CAS in SI-CES priklopa,
- `docs/sicas-vps-vzpostavitev.md` - zapisnik izvedene VPS/Shibboleth vzpostavitve,
- `docs/sicas-sices-vps-checklist.md` - kratek VPS checklist za SI-CAS/SI-CES,
- `docs/sicas-sp-metadata.xml` - staticni SI-CAS SP metadata izvoz brez Shibboleth opozorilnega komentarja.

## Hitri pregled za ocenjevanje

1. Preberite `docs/pregled-projekta.md` za arhitekturo, DevWork koncept in znane omejitve.
2. Preverite `docs/funkcionalnosti.md` za seznam implementiranih, delnih in pripravljenih funkcionalnosti.
3. Preverite `docs/git-zgodovina.md` za dokaz iterativnega razvoja.
4. Zazenite `npm test`.
5. Zazenite `npm run dev` in rocno preverite oddajo pobude, glasovanje, podpis, komentar, AI predpregled in analitiko.

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

## Email obvestila

Frontend poklice `POST /api/notifications/email`, kadar se spremeni pobuda, za katero je uporabnik glasoval, ali kadar nastane nova pobuda v kategoriji, kjer je uporabnik ze glasoval.

Privzeto razvojni streznik obvestila zapise v `demos-email-outbox.log`. Za dejansko posiljanje nastavite SMTP podatke v `.env.local`:

```bash
EMAIL_NOTIFICATIONS_ENDPOINT=/api/notifications/email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_STARTTLS=true
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM="Demokracija 2.0 <no-reply@example.com>"
```

Za testiranje vseh obvestil na en naslov in tudi dogodkov, ki jih sprozi isti uporabnik, lahko dodate:

```bash
EMAIL_TEST_RECIPIENT=test@example.com
EMAIL_NOTIFY_ACTOR=true
```
