# CI/CD pipeline

Ta dokument opisuje GitHub Actions pipeline za trenutno stanje projekta. Pipeline je namenjen preverjanju kode pred zdruzevanjem in pred deployem.

## Namen

Projekt trenutno ne potrebuje kompleksnega build koraka, ker je frontend staticen, domenska logika pa se preverja z Node testi. Zato pipeline pokriva:

- namestitev odvisnosti,
- zagon domenskih testov,
- preverjanje JavaScript sintakse,
- preverjanje osnovnih projektnih datotek,
- preverjanje Vercel, Supabase in SI-PASS/VPS povezovalnih datotek,
- preverjanje, da frontend ne bere server-only skrivnosti,
- osnovno preverjanje, da skrivnosti niso bile commitane v repozitorij,
- kratek povzetek rezultata v GitHub Actions summary.

SI-CAS in SI-CES se trenutno ne izvajata v pipeline-u kot pravi integracijski test, ker testni zunanji sistemi niso del CI okolja. Pipeline zato preverja staticni SP metadata arhiv, auth datoteke in varnostne omejitve, pravi end-to-end SI-PASS/SI-CES test pa ostane rocna oziroma okoljsko locena validacija.

## Datoteka

Workflow je v:

```text
.github/workflows/pipeline_demos.yml
```

## Kaj pipeline preveri

- `npm ci` preveri, da se odvisnosti namestijo iz `package-lock.json`.
- `npm test` zazene teste v `tests/domain.test.mjs`.
- `Check JavaScript syntax` preveri, da so JS/MJS datoteke sintakticno veljavne.
- `Check required project files` ujame nenamerno brisanje kljucnih datotek za frontend, API, Supabase in VPS bridge.
- `Validate deployment wiring` preveri osnovne povezave za `/config.local.js`, auth endpointa, Supabase config, hybrid search in unique glasovanje.
- `Validate SI-CAS metadata archive` preveri, da staticni SP metadata vsebuje entityID, ACS endpoint ter signing/encryption certifikata.
- `Check frontend does not read server-only secrets` ustavi pipeline, ce frontend koda zacne brati server-only env vrednosti prek `process.env`, `import.meta.env` ali javnega runtime configa. Navadna omemba imena spremenljivke v opozorilnem besedilu je dovoljena.
- `Check that local secrets are not committed` ustavi pipeline, ce se v repozitoriju pojavi `.env.local`, Hugging Face token, OpenRouter token ali private key.

## Kaj pipeline namenoma ne dela

- Ne deploya samodejno na Vercel ali VPS.
- Ne izvaja prave SI-PASS/SI-CAS prijave, ker zahteva zunanji testni IdP in registriran callback.
- Ne izvaja SI-CES podpisa, ker ta del se nima produkcijskega backend toka.
- Ne uporablja produkcijskih skrivnosti v CI.

## Kaj se doda kasneje

Ko bo dodan poln produkcijski backend ali SI-CES tok:

- preview smoke test za Vercel URL,
- locen deploy job za Vercel,
- locen VPS health-check za `demos-auth.service`,
- test SAML session atributov v testnem okolju,
- test SI-CES podpisnega zahtevka z varnim mockom,
- preverjanje Supabase migracij prek CLI v locenem CI okolju.
