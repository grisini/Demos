# Analiticne plasti projekta

Datum revizije: 2026-06-04

Krovni povzetek zadnje verzije je v `docs/stanje-zadnje-verzije.md`.

Projekt ima tri locene analiticne plasti. Namenoma niso zdruzene, ker imajo razlicne uporabnike, podatke in pravice dostopa.

## 1. Vercel Web Analytics in Speed Insights

**Namen:** hosting, promet, SEO, obisk strani, Core Web Vitals in performance metrike.

**Kdo vidi:** lastnik oziroma upravljavec Vercel projekta v Vercel dashboardu.

**Implementacija v projektu:**

- dependency `@vercel/analytics` je dodan v `package.json`,
- dependency `@vercel/speed-insights` je dodan v `package.json`,
- ker je trenutna aplikacija staticen ES module frontend brez bundlerja, aplikacija uporablja lokalni loader `src/lib/vercel-analytics.js`,
- za Speed Insights aplikacija uporablja lokalni loader `src/lib/vercel-speed-insights.js`,
- loader vstavi Vercel script `/_vercel/insights/script.js` po deployu na Vercel,
- Speed Insights loader vstavi Vercel script `/_vercel/speed-insights/script.js` po deployu na Vercel,
- inicializacija se zgodi v `DemocracyApp.init()` v `src/main.js`.

**Navodila za vklop:**

1. Projekt deployajte na Vercel.
2. V Vercel dashboardu za projekt vklopite Web Analytics in Speed Insights.
3. Obiscite deployment in preklopite med pogledi aplikacije.
4. Podatki se prikazejo v Vercel Analytics oziroma Speed Insights dashboardu, ce jih ne blokira content blocker.

Vercel dokumentacija za Next.js omenja komponenti `<Analytics/>` in `<SpeedInsights/>`. V tem projektu nista uporabljeni, ker aplikacija ni Next.js. Uporabljena je enakovredna staticna injekcija scriptov, ker brskalnik brez bundlerja ne zna neposredno uvoziti paketov `@vercel/analytics` in `@vercel/speed-insights`.

Vir: https://vercel.com/docs/analytics/package
Vir: https://vercel.com/docs/speed-insights/quickstart

## 2. Notranja sistemska analitika

**Namen:** admin pogled za oceno obremenitve, AI klicev, ocenjene porabe tokenov, email dogodkov, stevila zapisov, frontend virov, uporabniskih sledi in javnega rezima aplikacije.

**Kdo vidi:** samo admin uporabnik.

**Implementacija v projektu:**

- `src/lib/telemetry.js` lokalno belezi sistemske dogodke v `localStorage`,
- `api/analytics/[...path].js` sprejema sistemske dogodke na Vercelu na poti `/api/analytics/system`,
- `server/analytics-system.mjs` vsebuje skupno backend logiko,
- ce sta nastavljena `SUPABASE_URL` in server-only `SUPABASE_SERVICE_ROLE_KEY`, funkcija dogodke zapise v tabelo `system_analytics_events`,
- ce service key ni nastavljen, funkcija dogodke samo sprejme in zabelezi v Vercel logs,
- `src/domain/analytics.js` racuna `calculateSystemAnalytics()`,
- `src/main.js` prikaze admin-only zavihek `Sistemska analitika`,
- dostop ima samo admin email, nastavljen v `ADMIN_EMAILS`.

**Kaj zavihek prikaze tudi brez Supabase povezave:**

- stevilo pobud, glasov, podpisov, komentarjev in AI zapisov iz trenutnega repozitorija,
- ocenjeno porabo AI tokenov in trajanje AI klicev iz telemetry dogodkov,
- email dogodke in stevilo obvestil,
- frontend vire iz brskalnika: stevilo virov, preneseni KB, skripte, slogi, fetch klici in cas nalaganja,
- unikatne udelezence iz avtorjev, glasovalcev, podpisnikov in komentarjev,
- locitev registriranih/demo in anonimnih akterjev,
- anonimne glasove iz podatkov pobud in telemetry dogodkov,
- javno vidne pobude po statusih `active` in `signature_collection`,
- porazdelitev pobud po statusih in temah,
- Microsoft Clarity sistemski povzetek: seje, uporabniki, bot seje, mrtvi kliki, rage kliki in JavaScript napake,
- zadnje sistemske dogodke v seji brskalnika oziroma iz Vercel/Supabase endpointa.

**Navodila za uporabo lokalno:**

```bash
SYSTEM_ANALYTICS_ENDPOINT=/api/analytics/system
npm run dev
```

Nato se v stranskem prijavnem obrazcu prijavite z emailom, ki je naveden v `ADMIN_EMAILS`. V stranskem meniju se prikaze `Sistemska analitika`.

**Navodila za Vercel/Supabase skupni admin pogled:**

1. V Supabase SQL editorju izvedite `supabase/schema.sql`.
2. Za razsirjen tok dogodkov, dnevne snapshot-e in SQL porocila izvedite se `supabase/analytics.sql`.
3. V Vercel dodajte server-only env:

```bash
SUPABASE_SERVICE_ROLE_KEY=...
```

4. Preverite, da `SUPABASE_SERVICE_ROLE_KEY` ni nastavljen kot `VITE_*`.
5. Po redeployu bo frontend posiljal dogodke na `/api/analytics/system`; admin pogled jih bo bral nazaj prek iste Vercel funkcije.

**Pomembna omejitev:** trenutni podatki o tokenih so ocena iz dolzine besedila, ne racun ponudnika. Anonimno glasovanje uporablja lokalni brskalniski ID, zato je to prototipna zascita in ne prava produkcijska identiteta. Za produkcijo morajo pravi podatki priti iz backend logov, AI provider usage podatkov, Vercel observability, Supabase metrik in server-side omejitev.

## 3. Analitika pobud za uporabnike in Microsoft Clarity

**Namen:** javna platforma mora uporabnikom pokazati splosno statistiko pobud in osebno prilagojeno statistiko njihove aktivnosti.

**Kdo vidi:** vsak prijavljen uporabnik v zavihku `Analitika pobud`; neprijavljen uporabnik vidi samo aktualne pobude na zacetnem pregledu.

Trenutna pravila dostopa v aplikaciji:

- neprijavljen uporabnik vidi samo zacetni pregled aktualnih pobud,
- aktualne so pobude s statusom `active` ali `signature_collection`,
- neprijavljen uporabnik lahko odda en anonimen glas na pobudo,
- za oddajo pobude, podpis, komentar, celoten detail in analitiko pobud je potrebna prijava,
- integracije in sistemska analitika dodatno zahtevajo admin email iz `ADMIN_EMAILS`.

**Kaj prikazuje aplikacija iz baze:**

- skupno stevilo pobud, glasov, podpisov in komentarjev,
- porazdelitev po statusih,
- kategorije/teme z glasovi, komentarji in AI povprecjem,
- tveganja AI presoje,
- napredno tabelo pobud,
- najbolj podprte pobude,
- osebno statistiko: moje pobude, moji glasovi, moji podpisi, moji komentarji, podpora mojim pobudam, moje teme in zadnja moja aktivnost.

**Vloga Microsoft Clarity:**

Clarity ne nadomesca baze pobud. Uporablja se za vedenjsko analitiko: seje, heatmape, posnetke uporabniske poti, custom tags in events. Podatki pobud ostanejo v Supabase/local repozitoriju, Clarity pa dobi oznake in dogodke, da je v Clarity dashboardu mogoce filtrirati obnasanje po pogledu, vlogi, viru podatkov in kategoriji pobude.

Aplikacija dodatno bere agregirane Clarity metrike prek Clarity Data Export API in jih prijavljenim uporabnikom prikaze kot grafe v zavihku `Analitika pobud`, administratorju pa kot sistemski povzetek v zavihku `Sistemska analitika`. To niso heatmapi ali posnetki sej, ampak agregati, kot so seje po URL, uporabniki, bot seje, mrtvi kliki, rage kliki in JavaScript napake.

**Implementacija v projektu:**

- `src/lib/clarity.js` dinamicno nalozi `https://www.clarity.ms/tag/<PROJECT_ID>`,
- `api/analytics/[...path].js` na Vercelu varno usmeri `/api/analytics/clarity`,
- `server/analytics-clarity.mjs` klice Clarity Data Export API,
- `src/lib/clarity-insights.js` iz frontenda bere agregate prek `/api/analytics/clarity`,
- `src/domain/clarity-insights.js` normalizira Clarity odziv v grafe za UI,
- `src/main.js` ob prijavi poklice Clarity Identify API,
- aplikacija nastavlja custom tags: `app_view`, `data_source`, `auth_state`, `user_role`, `initiative_category`,
- aplikacija posilja events: `view_dashboard`, `view_analytics`, `initiative_selected`, `initiative_created`, `initiative_voted`, `initiative_voted_anonymous`, `initiative_signed`, `sices_signature_started`, `sices_signature_completed`, `comment_created`, `ai_preview_requested`, `initiative_pdf_printed`, `initiative_pdf_downloaded`, `initiative_docx_downloaded`, `initiative_odt_downloaded`.

**Navodila za vklop Clarity:**

1. V Microsoft Clarity ustvarite projekt za domeno aplikacije.
2. V Settings -> Setup preberite Project ID.
3. V `.env.local` ali Vercel env nastavite:

```bash
MICROSOFT_CLARITY_PROJECT_ID=vas_project_id
```

4. Za grafe v aplikaciji v Clarity Settings -> Data Export ustvarite API token in ga nastavite samo na strezniku:

```bash
CLARITY_API_TOKEN=vas_data_export_token
CLARITY_ANALYTICS_ENDPOINT=/api/analytics/clarity
```

5. Lokalno znova zazenite `npm run dev`; na Vercelu naredite redeploy.
6. Obiscite aplikacijo, se prijavite in uporabite pobude.
7. V zavihkih `Analitika pobud` in `Sistemska analitika` preverite blok `Microsoft Clarity`.
8. V Clarity dashboardu preverite sessions, heatmaps, recordings, custom tags in events.

Admin lahko runtime stanje preveri tudi v zavihku `Integracije`, kjer Microsoft Clarity prikaze:

- ali je `Project ID` prisoten v `/config.local.js`,
- ali je `window.clarity` inicializiran,
- ali je Clarity script tag vstavljen v dokument.

Ker je aplikacija enostranska, frontend pri preklopu pogleda posodobi URL z `?view=dashboard`, `?view=analytics`, `?view=integrations`, `?view=submit` oziroma `?view=systemAnalytics`. To Clarityju pomaga lociti heatmape in posnetke po glavnih pogledih aplikacije.

Microsoftova dokumentacija pravi, da ima vsak Clarity projekt svojo tracking kodo, Identify API pa omogoca povezovanje sej z vasim internim uporabniskim identifikatorjem. Custom tags in events so namenjeni filtriranju sej in vedenjskih vzorcev. Data Export API vrne agregirane dashboard podatke za zadnjih 1 do 3 dni, z omejitvijo do 10 API klicev na projekt na dan, zato endpoint uporablja strezniski cache.

Viri:

- https://learn.microsoft.com/en-au/clarity/setup-and-installation/clarity-setup
- https://learn.microsoft.com/en-us/clarity/setup-and-installation/identify-api
- https://learn.microsoft.com/en-ca/clarity/clarity-api
- https://learn.microsoft.com/ja-jp/clarity/setup-and-installation/clarity-data-export-api
