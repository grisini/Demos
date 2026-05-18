# Git zgodovina projekta

Ta dokument povzema git zgodovino veje `main`. Povzetek je pripravljen iz lokalnih ukazov:

```bash
git log --date=short --pretty=format:"%h %ad %s" --reverse
git log --stat --oneline --reverse -- src docs supabase tests scripts package.json README.md .github
```

Zadnji pregledani commit je `ab343db` na veji `main`, ki sledi `origin/main`.

## Kronoloski pregled commitov

| Datum | Commit | Sporocilo | Vsebinski pomen |
| --- | --- | --- | --- |
| 2026-05-05 | `91d237e` | Initial commit | Zacetek repozitorija z osnovnim README. |
| 2026-05-08 | `7fd9cf2` | Prva verzija | Prva delujoca aplikacija: frontend, demo podatki, validacija, lokalni repozitorij, Supabase nastavek, testi in osnovni docs. |
| 2026-05-11 | `e26e5cc` | verzija z dokumentacijo in posodobitvami - AI API ni povezan | Dodan razvojni dnevnik, diagrami, iteracija 3, razsirjena analitika, AI fallback in dokumentirana smer za AI. |
| 2026-05-12 | `8fe5d1f` | implementacija supabase | Odstranjeni demo podatki, razsirjen Supabase adapter in shema, aplikacija bolj vezana na realno podatkovno plast. |
| 2026-05-12 | `740941e` | Dokumentacija za bazo | Dodano obsezno porocilo o podatkovnem modelu. |
| 2026-05-12 | `5cb386b` | posodobitev kaj kdo dela | Organizacijska posodobitev iz druge razvojne veje. |
| 2026-05-12 | `9f9887c` | Merge branch 'main' | Zdruzitev sprememb iz oddaljenega repozitorija. |
| 2026-05-13 | `e10aaf2` | dodan napreden ai pregled pobud z Hugging face | Implementiran razvojni AI endpoint, Hugging Face zero-shot pot in UI za napredni pregled. |
| 2026-05-13 | `e706709` | popravki in bolj podroben ai izpis pri pregledu pobud | Izboljsan prikaz AI dejstev v detail pogledu. |
| 2026-05-13 | `8cb03ee` | Popravek dokumentacije za to iteracijo | Usklajeni dokumenti z dejanskim stanjem AI in baze. |
| 2026-05-14 | `e5ae66b` | dokumentacija za mailing | README razsirjen z opisom email obvestil. |
| 2026-05-14 | `e67d80c` | testi za mailing | Dodani testi za domensko logiko email obvestil. |
| 2026-05-14 | `c038e75` | implementacija mailinga | Implementiran email modul, email odjemalec in endpoint v razvojnem strezniku. |
| 2026-05-14 | `8058118` | Osnovni CI/CD pipeline | Dodan GitHub Actions workflow. |
| 2026-05-14 | `9dd08c1` | CI/CD pipeline popravek #1 | Poenostavljen oziroma popravljen pipeline. |
| 2026-05-14 | `c4c2ecd` | pipeline docs in si pass checklist | Dodana CI/CD dokumentacija in SI-CAS/SI-CES VPS checklist. |
| 2026-05-14 | `ab343db` | Merge branch 'main' | Zadnja zdruzitev oddaljene veje v lokalni `main`. |

## Razvoj po fazah

### Faza 1: zacetni prototip

Commit `7fd9cf2` je najvecji funkcionalni preskok. V njem so nastali:

- `src/main.js` za uporabniski vmesnik,
- `src/domain/validation.js` za poslovna pravila,
- `src/domain/analytics.js` za osnovno analitiko,
- `src/lib/auth.js`, `src/lib/storage.js`, `src/lib/supabase.js`,
- `supabase/schema.sql`,
- `tests/domain.test.mjs`,
- osnovni dokumenti v `docs`.

To dokazuje, da je bil projekt od zacetka postavljen kot delujoc prototip, ne samo kot staticna predstavitev.

### Faza 2: dokumentacija in analitika

Commit `e26e5cc` je razsiril projekt z dokumentacijskim okvirom:

- `docs/devwork-loop.md`,
- `docs/diagrams.md`,
- `docs/iteracija-3-analitika-ai.md`.

Istoocasno so bili nadgrajeni analiticni izracuni, UI in testi. To je pomembno, ker dokumentacija ni nastala loceno od kode, ampak skupaj z razsirjeno funkcionalnostjo.

### Faza 3: Supabase in baza

Commita `8fe5d1f` in `740941e` sta premaknila projekt proti resnejsi podatkovni plasti:

- demo podatki so bili odstranjeni iz kode,
- Supabase adapter je bil razsirjen,
- SQL shema je dobila vec tabel, omejitev in pogledov,
- nastalo je porocilo `docs/baza-porocilo.md`.

Ta faza dokazuje razmislek o relacijskem modelu, integriteti podatkov in kasnejsi produkcijski nadgradnji.

### Faza 4: AI predpregled

Commita `e10aaf2` in `e706709` sta dodala napredno AI smer:

- razvojni endpoint `/api/ai/review-initiative`,
- Hugging Face zero-shot klasifikacijo,
- lokalni fallback,
- prikaz ponudnika, modela, zanesljivosti in dodatnih AI dejstev.

Pomemben arhitekturni argument je, da `HF_TOKEN` ostane na strezniski strani in se ne posilja v frontend.

### Faza 5: email obvestila

Commita `e5ae66b`, `e67d80c` in `c038e75` uvajata email funkcionalnost:

- domenska pravila za dogodke,
- odjemalec za posiljanje obvestil,
- razvojni email endpoint,
- SMTP in outbox nacin,
- testi za email domensko logiko.

To je dober primer DevWork kroga: najprej dokumentacija, nato testi, nato implementacija.

### Faza 6: CI/CD in integracijski checklist

Commita `8058118`, `9dd08c1` in `c4c2ecd` dodata:

- GitHub Actions workflow,
- preverjanje testov,
- preverjanje, da lokalne skrivnosti niso commitane,
- dokumentacijo CI/CD,
- checklist za SI-CAS/SI-CES postavitev na VPS.

## Kaj zgodovina dokazuje

- Projekt se razvija iterativno.
- Vecje funkcionalnosti imajo spremljajoco dokumentacijo.
- Testi so se sirili skupaj z domensko logiko.
- Integracije so dodane postopno in z jasnimi omejitvami.
- Arhitektura se premika od lokalnega prototipa proti Supabase, AI backendu, emailu in SI-PASS/SI-CAS/SI-CES integracijam.

## Stanje ob dokumentacijskem pregledu

Ob zacetku pregleda 2026-05-16 so bile v delovnem drevesu ze prisotne nekomitirane Mermaid datoteke:

- `docs/classDiagram.mmd`
- `docs/erDiagram.mmd`
- `docs/flowchart LR.mmd`
- `docs/sequenceDiagram.mmd`

Te datoteke niso bile spreminjane ali brisane v okviru dokumentacijskega pregleda. Vsebina se ujema z diagrami v `docs/diagrams.md` in je uporabna za locen izvoz diagramov.
