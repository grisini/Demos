# Pregled projekta

## Povzetek

**Demokracija 2.0** je prototip spletne platforme za oddajo, pregled, podporo in analitiko zakonodajnih pobud. Projekt je zasnovan kot dokaz koncepta, ki ze prikaze glavne uporabniske tokove:

- demo prijavo,
- oddajo zakonodajne pobude,
- validacijo in AI predpregled,
- pregled, iskanje, filtriranje in razvrscanje pobud,
- glasovanje, demo podpisovanje in komentiranje,
- email obvestila,
- analitiko pobud,
- pripravo na Supabase, SI-PASS, SI-CAS in SI-CES.

Projekt ni predstavljen kot produkcijsko zakljucen drzavni informacijski sistem. Pravilna interpretacija je: delujoc prototip z jasno loceno domensko logiko, podatkovnim modelom, integracijskimi nastavki in dokumentiranimi produkcijskimi tveganji.

## Tehnoloski sklad

| Podrocje | Resitev | Namen |
| --- | --- | --- |
| Frontend | HTML, CSS, JavaScript modules | Enostaven prototip brez build orodja. |
| Razvojni streznik | `scripts/dev-server.mjs` | Static serving, runtime konfiguracija, AI endpoint in email endpoint. |
| Domenska logika | `src/domain/*.js` | Validacija, AI fallback, analitika in email pravila brez odvisnosti od UI. |
| Lokalni podatki | `localStorage` | Hiter demo brez zunanjih storitev. |
| Zunanja baza | Supabase PostgreSQL | Relacijska shema, REST dostop, RLS nastavki in SQL pogledi. |
| AI integracija | Hugging Face Inference Providers | Napredni predpregled pobude prek backend/dev endpointa. |
| Testi | Node `node:test` | Domensko preverjanje brez brskalnika. |
| CI/CD | GitHub Actions | Namestitev odvisnosti, testi in preverjanje skrivnosti. |

## Arhitekturni koncept

Koda je organizirana po plasteh, da je jasno, kje nastaja poslovna vrednost in kje so tehnicne integracije.

### 1. Uporabniski vmesnik

Glavna datoteka je `src/main.js`. V njej je razred `DemocracyApp`, ki skrbi za:

- stanje aplikacije,
- renderiranje pogledov,
- dogodke uporabnika,
- klice repozitorija,
- klice AI predpregleda,
- klice email odjemalca.

Vmesnik je namerno enostranska aplikacija brez frameworka, ker projekt prikazuje koncept in poslovno logiko, ne kompleksnega frontend stacka.

### 2. Domenska logika

Domenska logika je locena od UI:

- `src/domain/validation.js` vsebuje kategorije, statuse, validacijo, ustvarjanje pobud, glasovanje, podpise, komentarje in AI fallback.
- `src/domain/analytics.js` racuna metrike za dashboard in analitiko.
- `src/domain/notifications.js` gradi email obvestila glede na dogodke.

Ta locitev je pomembna za ocenjevanje, ker se glavna pravila lahko testirajo brez brskalnika in brez Supabase.

### 3. Podatkovni dostop

Podatkovna plast uporablja repozitorijski vzorec:

- `LocalInitiativeRepository` v `src/lib/storage.js` hrani podatke v `localStorage`.
- `SupabaseInitiativeRepository` v `src/lib/supabase.js` preslika frontend objekte v PostgreSQL REST strukturo.
- `createRepository()` izbere repozitorij glede na konfiguracijo.

S tem aplikacija ohrani isti UI in domensko logiko, ne glede na to, ali tece lokalno ali nad Supabase.

### 4. Razvojni backend

`scripts/dev-server.mjs` ima vec vlog:

- streze `index.html`, CSS in JavaScript module,
- generira `config.local.js` iz `.env`, `.env.local` in okolja,
- izpostavi `POST /api/ai/review-initiative`,
- izpostavi `POST /api/notifications/email`,
- v odsotnosti SMTP zapisuje email sporocila v outbox log.

To je dovolj za razvojni demo. Za produkcijo morajo AI, email in zapisovanje v bazo v namenski backend ali Supabase Edge Functions.

### 5. Podatkovna baza

`supabase/schema.sql` definira:

- enum tipe za statuse, kategorije in AI ocene,
- tabele `initiatives`, `votes`, `signatures`, `comments`, `initiative_ai_reviews`,
- unikatne omejitve za glasove in podpise,
- indekse za filtriranje in agregacije,
- RLS politike za prototip,
- poglede `initiative_detail`, `initiative_analytics` in `category_analytics`.

Podrobna razlaga je v `docs/baza-porocilo.md`.

## DevWork koncept programiranja

DevWork koncept v tem projektu pomeni discipliniran razvojni krog, kjer se vsaka sprememba obravnava kot majhna preverljiva iteracija.

Krog je:

1. **Razumevanje zahteve**: najprej se prebere obstojeca koda, dokumentacija in git zgodovina.
2. **Omejitev obsega**: sprememba se omeji na funkcionalnost, ki je potrebna za cilj.
3. **Domenska pravila najprej**: poslovna pravila se zapisejo v `src/domain`, kjer jih je najlazje testirati.
4. **Adapterji in UI zatem**: repozitoriji, API klici in vmesnik uporabljajo domensko logiko, namesto da jo podvajajo.
5. **Fallback in odpornost**: zunanje storitve, kot sta Hugging Face in SMTP, ne smejo podreti osnovnega toka aplikacije.
6. **Preverjanje**: sprememba se potrdi z `npm test`, rocnim pregledom ali dokumentiranim kriterijem.
7. **Dokumentiranje**: vsaka vecja sprememba dobi zapis v `docs` in po potrebi v `docs/devwork-loop.md`.
8. **Naslednji korak**: odprta tveganja se ne skrivajo, ampak se zapisejo kot nadaljevanje.

Ta pristop je viden v git zgodovini: projekt se je razvijal od osnovnega prototipa, prek dokumentacije in Supabase sheme, do AI, email obvestil in CI/CD.

## Glavni uporabniski tokovi

### Oddaja pobude

1. Uporabnik se prijavi z demo identiteto.
2. Izpolni naslov, kategorijo, povzetek in vsebinske sklope za predlog zakona: uvod, besedilo clenov, obrazlozitev clenov, financne posledice, primerjalni prikaz, presojo posledic, sodelovanje javnosti in predstavnike predlagatelja.
3. Aplikacija izvede validacijo.
4. Lokalni ali Hugging Face AI predpregled pripravi oceno.
5. Pobuda se shrani v izbrani repozitorij.
6. Uporabnik se vrne na dashboard, kjer vidi novo pobudo.

### Glasovanje, podpis in komentar

1. Uporabnik izbere pobudo.
2. Odda glas ali demo podpis.
3. Domenska logika prepreci podvajanje istega uporabnika.
4. Uporabnik lahko doda komentar.
5. Aplikacija pripravi email obvestila za povezane prejemnike.

### Analitika

1. Aplikacija nalozi pobude.
2. `calculateAnalytics()` izracuna agregate.
3. UI prikaze statusne, kategorijske, glasovalne in AI metrike.
4. Supabase shema vsebuje tudi SQL poglede za isto smer razvoja na podatkovni plasti.

## Datotecna karta

| Pot | Vloga |
| --- | --- |
| `index.html` | Vstopna HTML datoteka aplikacije. |
| `src/main.js` | Glavni UI, stanje aplikacije in dogodki. |
| `src/styles.css` | Vizualna predstavitev dashboarda, form in analitike. |
| `src/config.js` | Privzeta runtime konfiguracija. |
| `src/domain/validation.js` | Poslovna pravila pobud, AI fallback in interakcije. |
| `src/domain/analytics.js` | Izracun analiticnih metrik. |
| `src/domain/notifications.js` | Pravila za email obvestila. |
| `src/lib/storage.js` | Lokalni repozitorij na `localStorage`. |
| `src/lib/supabase.js` | Supabase REST repozitorij. |
| `src/lib/auth.js` | Demo avtentikacija. |
| `src/lib/notifications.js` | Email HTTP odjemalec. |
| `scripts/dev-server.mjs` | Razvojni streznik, AI endpoint in email endpoint. |
| `supabase/schema.sql` | PostgreSQL shema, omejitve, RLS in pogledi. |
| `tests/domain.test.mjs` | Domenski testi. |
| `.github/workflows/pipeline_demos.yml` | CI/CD preverjanje. |
| `docs/funkcionalnosti.md` | Register funkcionalnosti. |
| `docs/git-zgodovina.md` | Razvojna zgodovina po commitih. |
| `docs/devwork-loop.md` | Iterativni razvojni dnevnik. |

## Kakovostni argumenti za ocenjevanje

- Domenska pravila niso skrita v HTML dogodkih, ampak so v locenih funkcijah.
- Aplikacija ima lokalni nacin, zato je demonstracija mozna brez placljivih ali zaprtih storitev.
- Supabase model je normaliziran in vsebuje omejitve za integriteto podatkov.
- AI token ni poslan v brskalnik, ampak se bere na razvojni streznik.
- Zunanje integracije imajo fallback ali jasno dokumentiran status.
- Testi pokrivajo glavna domenska pravila.
- Git zgodovina prikaze postopno nadgradnjo, ne enkratnega nepreglednega preskoka.

## Znane omejitve

- Demo prijava ni realen SI-PASS tok.
- Demo podpis ni pravno veljaven SI-CES podpis.
- Supabase RLS politike so odprte za prototip in niso produkcijsko primerne.
- Email modul ima zacasno demo logiko prejemnikov in potrebuje konfigurabilen produkcijski model.
- AI endpoint je razvojni in mora v produkciji teci na backendu ali Edge Function.
- Manjkajo brskalniski E2E testi za celoten tok oddaja-podpora-komentar.
- Ni posebne uporabniske tabele ali polnega upravljanja administratorskih racunov v aplikaciji.

## Kako profesor preveri projekt

1. Pregleda `README.md` za zagon in obseg.
2. Zazene `npm test`.
3. Zazene `npm run dev` in odpre prikazani lokalni URL.
4. Odda testno pobudo, glasuje, podpise in komentira.
5. Pregleda `docs/funkcionalnosti.md` za seznam funkcij.
6. Pregleda `docs/baza-porocilo.md` in `supabase/schema.sql` za podatkovni model.
7. Pregleda `docs/git-zgodovina.md` za razvojno sled.
8. Pregleda `docs/devwork-loop.md` za razvojni koncept in kontrolne tocke.
