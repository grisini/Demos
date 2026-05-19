# Dnevnik dopolnitev

Ta dnevnik je namenjen sprotnemu vodenju sprememb. Vkljucuje povzetek dosedanjih commitov na veji `main` in zadnji nezakljuceni razvojni cikel.

## Nezakljucen cikel: analitike

Datum: 2026-05-19

Izvedeno:

- Dodana tri-delna zasnova analitike: Vercel Web Analytics, admin sistemska analitika in uporabniska analitika pobud.
- Dodan paket `@vercel/analytics` v `package.json` in `package-lock.json`.
- Dodan staticni Vercel loader v `src/lib/vercel-analytics.js`, ker projekt trenutno ne uporablja bundlerja.
- Dodan paket `@vercel/speed-insights` v `package.json` in `package-lock.json`.
- Dodan staticni Vercel Speed Insights loader v `src/lib/vercel-speed-insights.js`, ker projekt trenutno ne uporablja Next.js komponente.
- Integracije prikazejo runtime stanje Vercel Speed Insights loaderja, script taga in trenutnega SPA route.
- Dodan Microsoft Clarity loader v `src/lib/clarity.js`.
- Dodana runtime nastavitev `MICROSOFT_CLARITY_PROJECT_ID`.
- Dostop do interne sistemske analitike je omejen na demo admina `admin@demos.local`.
- Dodana lokalna sistemska telemetrija v `src/lib/telemetry.js`.
- Dodana Vercel serverless funkcija `api/analytics/system.js` za sistemske dogodke.
- Dodana Supabase tabela `system_analytics_events` za skupni admin pregled na Vercelu.
- Frontend sistemsko telemetrijo posilja na `SYSTEM_ANALYTICS_ENDPOINT`, lokalni `localStorage` ostane fallback.
- Razsirjen `src/domain/analytics.js` z uporabnisko in sistemsko analitiko.
- Zavihek `Analitika pobud` zdaj prikazuje splosno statistiko in osebni del za prijavljenega uporabnika.
- Dodan admin-only pogled `Sistemska analitika`.
- Sistemska analitika je razsirjena s tehnicnimi in uporabniskimi podatki: udelezenci, anonimni akterji, anonimni glasovi, telemetry seje, javno vidne pobude, statusi, teme in dogodki po tipu.
- Neprijavljen uporabnik vidi samo aktualne pobude in javni detail brez komentarjev, podpisov, AI podrobnosti in osebne analitike.
- Dodano anonimno glasovanje z lokalnim ID `demos.anonymousVoterId`, zato isti brskalnik ne more dvakrat glasovati za isto pobudo.
- Clarity dobi `identify`, custom tags in events za poglede, prijavo, pobude, glasove, podpise, komentarje in AI predpregled.
- Glavni pogledi aplikacije posodabljajo URL prek `?view=...`, da Clarity lazje locuje heatmape enostranske aplikacije.
- README in dokumentacija sta dopolnjena z navodili za analitike.
- Testi so razsirjeni za uporabnisko in sistemsko analitiko.

Preverjanje:

- `npm test` - 11/11 testov uspesnih.
- `node --check src/main.js`
- `node --check src/lib/clarity.js`
- `node --check src/lib/vercel-analytics.js`
- `node --check src/lib/vercel-speed-insights.js`
- `node --check src/lib/telemetry.js`

Opombe:

- Sistemska poraba tokenov je trenutno ocena, ker Hugging Face endpoint ne vraca racunskega usage polja.
- Anonimno glasovanje je prototipna zascita na lokalni ID; za produkcijo potrebuje backend omejitve, rate-limit in po moznosti povezavo z realno identiteto ali podpisom.
- Prava produkcijska sistemska analitika naj se kasneje poveze z backend audit tabelo, Vercel logs, Supabase metrikami in AI provider usage podatki.

## Kronologija commitov

| Datum | Commit | Sporocilo | Kaj se je naredilo |
| --- | --- | --- | --- |
| 2026-05-05 | `91d237e` | Initial commit | Zacetek repozitorija z osnovnim README. |
| 2026-05-08 | `7fd9cf2` | Prva verzija | Dodan delujoc prototip: frontend, demo prijava, pobude, lokalni repozitorij, Supabase nastavek, validacija, testi in osnovna dokumentacija. |
| 2026-05-11 | `e26e5cc` | verzija z dokumentacijo in posodobitvami - AI API ni povezan | Dodani DevWork loop, diagrami, iteracija 3, razsirjena analitika, AI fallback in razsirjeni testi. |
| 2026-05-12 | `8fe5d1f` | implementacija supabase | Odstranjeni demo podatki iz kode, razsirjen Supabase adapter in SQL shema. |
| 2026-05-12 | `740941e` | Dokumentacija za bazo | Dodano porocilo o podatkovnem modelu in razlogih za zasnovo baze. |
| 2026-05-12 | `5cb386b` | posodobitev kaj kdo dela | Organizacijska posodobitev dela na projektu. |
| 2026-05-12 | `9f9887c` | Merge branch 'main' of https://github.com/rotmiha/Demos | Zdruzitev oddaljene veje `main`. |
| 2026-05-13 | `e10aaf2` | dodan napreden ai pregled pobud z Hugging face | Dodan razvojni AI endpoint, Hugging Face zero-shot pregled in UI za napredno presojo. |
| 2026-05-13 | `e706709` | popravki in bolj podroben ai izpis pri pregledu pobud | Detail pobude prikaze bolj podrobna AI dejstva in vir ocene. |
| 2026-05-13 | `8cb03ee` | Popravek dokumentacije za to iteracijo | Usklajeni dokumenti z dejansko AI in bazo. |
| 2026-05-14 | `e5ae66b` | dokumentacija za mailing | README dopolnjen z email obvestili. |
| 2026-05-14 | `e67d80c` | testi za mailing | Dodani testi za domensko logiko email obvestil. |
| 2026-05-14 | `c038e75` | implementacija mailinga | Dodani email modul, odjemalec in razvojni endpoint s SMTP/outbox podporo. |
| 2026-05-14 | `8058118` | Osnovni CI/CD pipeline | Dodan GitHub Actions workflow. |
| 2026-05-14 | `9dd08c1` | CI/CD pipeline popravek #1 | Popravljena oziroma poenostavljena pipeline konfiguracija. |
| 2026-05-14 | `c4c2ecd` | pipeline docs in si pass checklist | Dodana CI/CD dokumentacija in SI-CAS/SI-CES checklist. |
| 2026-05-14 | `ab343db` | Merge branch 'main' | Zdruzitev oddaljene veje v lokalni `main`. |
| 2026-05-16 | `01f87e8` | Dodana dokumentacija in diagrami projekta | Dodani register funkcionalnosti, pregled projekta, git zgodovina, Mermaid datoteke in SI-PASS/SI-CAS/SI-CES dokumentacija. |
| 2026-05-16 | `96b29a5` | docs za vzpostavitev vps in Shibboleth/certfikati metadata za poslat za SI-PASS | Dodani VPS/Shibboleth zapisnik in staticni SI-CAS SP metadata. |
| 2026-05-16 | `d94d816` | resolved conflict | Razresen merge konflikt. |
| 2026-05-18 | `68f69e1` | kompletna izboljsava vmesnika, responsive, dodan gumb za meni | Prenovljen responsive UI, stranski meni in slog aplikacije. |
| 2026-05-18 | `8586c7a` | Merge branch 'main' of https://github.com/rotmiha/Demos | Zdruzitev oddaljenih sprememb. |
| 2026-05-18 | `ab4eb72` | poravek glede povezave na bazo | Popravljena runtime konfiguracija za povezavo na bazo. |
| 2026-05-18 | `1231a97` | test | Testni commit brez vsebinskega povzetka v trenutni dokumentaciji. |
| 2026-05-18 | `0b6c6e8` | odstranil config.local | Odstranjen lokalni `config.local` iz verzioniranega toka. |
| 2026-05-18 | `c0a59ff` | testing | Dodatna konfiguracijska sprememba med testiranjem. |
| 2026-05-18 | `f70b367` | nevermind tole more bit | Popravek/testni commit brez vsebinskega povzetka v trenutni dokumentaciji. |
| 2026-05-18 | `e7c1614` | k | Sprememba razvojnega streznika med urejanjem runtime konfiguracije. |
| 2026-05-18 | `9bea6d2` | testing | README, Supabase dokumentacija, package script in config spremembe. |
| 2026-05-18 | `a3e5be8` | nepotrebno | Ciscenje oziroma odstranitev nepotrebnega dela. |
| 2026-05-18 | `c123733` | Merge branch 'main' of https://github.com/rotmiha/Demos | Zdruzitev oddaljenih sprememb. |
| 2026-05-18 | `a95c24b` | upam | Dodan Vercel `api/config.local.js`, `vercel.json` rewrite in dokumentacija deployment env. |
| 2026-05-18 | `a8462ab` | Merge branch 'main' of https://github.com/rotmiha/Demos | Zdruzitev oddaljenih sprememb. |
| 2026-05-18 | `df8b9e2` | yy | Dopolnjen Vercel runtime config. |
| 2026-05-18 | `60e84bf` | yyyyy | Dopolnjen frontend config. |
| 2026-05-18 | `8e70329` | odstranjen log | Odstranjen nepotreben log iz runtime configa. |
| 2026-05-18 | `f0d56bc` | yyy | Odstranjene nepotrebne config vrstice. |
| 2026-05-18 | `18f3b6b` | config | Popravljeni config kljuci med deployment pripravo. |
| 2026-05-18 | `ded8be4` | log | Dodan zacasni log v config. |
| 2026-05-18 | `0b9479c` | mailing deployment | Dodan Vercel endpoint za email obvestila in dopolnjen runtime config. |
| 2026-05-18 | `fa8352e` | popravek ai | Dodan Vercel endpoint za AI review in popravljena AI runtime konfiguracija. |

## Pravilo za nadaljevanje dnevnika

Ob vsakem naslednjem pushu dodajte novo vrstico v kronologijo in nov kratek zapis cikla, ce je sprememba vsebinska. Pri zapisu naj bo vedno navedeno:

- kaj je bil cilj,
- katere datoteke ali sklopi so bili spremenjeni,
- kako je bilo preverjeno,
- katera tveganja ali produkcijski dolgovi ostajajo.
