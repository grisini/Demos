# CI/CD pipeline

Ta dokument opisuje predlagan GitHub Actions pipeline za trenutno stanje projekta. Pipeline je namenjen preverjanju kode pred zdruzevanjem in pred deployem.

## Namen

Projekt trenutno ne potrebuje kompleksnega build koraka, ker je frontend statičen, domenska logika pa se preverja z Node testi. Zato pipeline pokriva:

- namestitev odvisnosti,
- zagon domenskih testov,
- preverjanje osnovnih projektnih datotek,
- osnovno preverjanje, da skrivnosti niso bile commitane v repozitorij.

SI-CAS in SI-CES se trenutno se ne izvajata v pipeline-u, ker prava integracija se ni implementirana. Ko bo dodan backend ali Shibboleth/SAML del, se pipeline razsiri z dodatnimi preverjanji.

## Datoteka

Workflow naj bo v:

```text
.github/workflows/pipeline_demos.yml
```

## Predlagana konfiguracija

```yaml
name: Demos CI

on:
  push:
    branches:
      - main
      - master
  pull_request:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  test:
    name: Test project
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Check required files
        run: |
          test -f index.html
          test -f package.json
          test -f package-lock.json
          test -f src/main.js
          test -f src/config.js
          test -f src/domain/validation.js
          test -f src/domain/analytics.js
          test -f docs/pregled-projekta.md
          test -f docs/funkcionalnosti.md
          test -f docs/git-zgodovina.md
          test -f docs/roadmap.md
          test -f docs/iteracija-3-analitika-ai.md
          test -f docs/sipass-sicas-ces-priklop.md

      - name: Check that local secrets are not committed
        shell: bash
        run: |
          set -euo pipefail

          if [ -f ".env.local" ]; then
            echo ".env.local must not be committed."
            exit 1
          fi

          if grep -RInE "(hf_[A-Za-z0-9]{20,}|sk-or-v1-[A-Za-z0-9]{20,}|BEGIN (RSA |EC |)PRIVATE KEY)" \
            --exclude-dir=.git \
            --exclude-dir=node_modules \
            --exclude-dir=.codex_extracts \
            --exclude="*.log" \
            .; then
            echo "Potential secret found in repository files."
            exit 1
          fi
```

## Kaj pipeline preveri

- `npm ci` preveri, da se odvisnosti namestijo iz `package-lock.json`.
- `npm test` zazene teste v `tests/domain.test.mjs`.
- `Check required files` ujame nenamerno brisanje kljucnih datotek.
- `Check that local secrets are not committed` ustavi pipeline, ce se v repozitoriju pojavi `.env.local`, Hugging Face token, OpenRouter token ali private key.

## Kaj se doda kasneje

Ko bo dodan SI-CAS ali SI-CES backend:

- preverjanje, da produkcijski `sicas-sp-metadata.xml` nima placeholderjev,
- preverjanje, da SAML private key ni v repozitoriju,
- test SAML metadata XML strukture,
- E2E test za osnovni login flow,
- deploy korak za Vercel, VPS ali Supabase Edge Functions.

Ko bo AI endpoint premaknjen iz razvojnega streznika v gostovano okolje:

- preverjanje, da je endpoint konfiguriran prek environment variables,
- smoke test za `/api/ai/review-initiative` na preview okolju,
- loceno preverjanje, da `HF_TOKEN` obstaja samo v GitHub/Vercel/Supabase secrets.

