# Analiticne plasti projekta

Projekt ima tri locene analiticne plasti. Namenoma niso zdruzene, ker imajo razlicne uporabnike, podatke in pravice dostopa.

## 1. Vercel Web Analytics

**Namen:** hosting, promet, SEO in obisk strani.

**Kdo vidi:** lastnik oziroma upravljavec Vercel projekta v Vercel dashboardu.

**Implementacija v projektu:**

- dependency `@vercel/analytics` je dodan v `package.json`,
- ker je trenutna aplikacija staticen ES module frontend brez bundlerja, aplikacija uporablja lokalni loader `src/lib/vercel-analytics.js`,
- loader vstavi Vercel script `/_vercel/insights/script.js` po deployu na Vercel,
- inicializacija se zgodi v `DemocracyApp.init()` v `src/main.js`.

**Navodila za vklop:**

1. Projekt deployajte na Vercel.
2. V Vercel dashboardu za projekt vklopite Web Analytics.
3. Obiscite deployment in preklopite med pogledi aplikacije.
4. Podatki se prikazejo v Vercel Analytics dashboardu, ce jih ne blokira content blocker.

Vercel dokumentacija opisuje uporabo paketa `@vercel/analytics` in `inject()` za `main.js`; v tem projektu je uporabljena enakovredna staticna injekcija, ker brskalnik brez bundlerja ne zna neposredno uvoziti `@vercel/analytics`.

Vir: https://vercel.com/docs/analytics/package

## 2. Notranja sistemska analitika

**Namen:** admin pogled za oceno obremenitve, AI klicev, ocenjene porabe tokenov, email dogodkov, stevila zapisov in frontend virov.

**Kdo vidi:** samo admin uporabnik.

**Implementacija v projektu:**

- `src/lib/telemetry.js` lokalno belezi sistemske dogodke v `localStorage`,
- `api/analytics/system.js` sprejema sistemske dogodke na Vercelu,
- ce sta nastavljena `SUPABASE_URL` in server-only `SUPABASE_SERVICE_ROLE_KEY`, funkcija dogodke zapise v tabelo `system_analytics_events`,
- ce service key ni nastavljen, funkcija dogodke samo sprejme in zabelezi v Vercel logs,
- `src/domain/analytics.js` racuna `calculateSystemAnalytics()`,
- `src/main.js` prikaze admin-only zavihek `Sistemska analitika`,
- dostop ima samo demo admin `admin@demos.local`.

**Navodila za uporabo lokalno:**

```bash
SYSTEM_ANALYTICS_ENDPOINT=/api/analytics/system
npm run dev
```

Nato se v demo prijavi uporabite email `admin@demos.local`. V stranskem meniju se prikaze `Sistemska analitika`.

**Navodila za Vercel/Supabase skupni admin pogled:**

1. V Supabase SQL editorju izvedite zadnjo verzijo `supabase/schema.sql` oziroma vsaj del za `system_analytics_events`.
2. V Vercel dodajte server-only env:

```bash
SUPABASE_SERVICE_ROLE_KEY=...
```

3. Preverite, da `SUPABASE_SERVICE_ROLE_KEY` ni nastavljen kot `VITE_*`.
4. Po redeployu bo frontend posiljal dogodke na `/api/analytics/system`; admin pogled jih bo bral nazaj prek iste Vercel funkcije.

**Pomembna omejitev:** trenutni podatki o tokenih so ocena iz dolzine besedila, ne racun ponudnika. Za produkcijo morajo pravi podatki priti iz backend logov, AI provider usage podatkov, Vercel observability in Supabase metrik.

## 3. Analitika pobud za uporabnike in Microsoft Clarity

**Namen:** javna platforma mora uporabnikom pokazati splosno statistiko pobud in osebno prilagojeno statistiko njihove aktivnosti.

**Kdo vidi:** vsak uporabnik v zavihku `Analitika pobud`; neprijavljeni uporabnik vidi splosno statistiko, prijavljeni vidi se osebni del.

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

**Implementacija v projektu:**

- `src/lib/clarity.js` dinamicno nalozi `https://www.clarity.ms/tag/<PROJECT_ID>`,
- `src/main.js` ob prijavi poklice Clarity Identify API,
- aplikacija nastavlja custom tags: `app_view`, `data_source`, `auth_state`, `user_role`, `initiative_category`,
- aplikacija posilja events: `view_dashboard`, `view_analytics`, `initiative_selected`, `initiative_created`, `initiative_voted`, `initiative_signed`, `comment_created`, `ai_preview_requested`.

**Navodila za vklop Clarity:**

1. V Microsoft Clarity ustvarite projekt za domeno aplikacije.
2. V Settings -> Setup preberite Project ID.
3. V `.env.local` ali Vercel env nastavite:

```bash
MICROSOFT_CLARITY_PROJECT_ID=vas_project_id
```

4. Lokalno znova zazenite `npm run dev`; na Vercelu naredite redeploy.
5. Obiscite aplikacijo, se prijavite in uporabite pobude.
6. V Clarity dashboardu preverite sessions, heatmaps, recordings, custom tags in events.

Microsoftova dokumentacija pravi, da ima vsak Clarity projekt svojo tracking kodo, Identify API pa omogoca povezovanje sej z vasim internim uporabniskim identifikatorjem. Custom tags in events so namenjeni filtriranju sej in vedenjskih vzorcev.

Viri:

- https://learn.microsoft.com/en-au/clarity/setup-and-installation/clarity-setup
- https://learn.microsoft.com/en-us/clarity/setup-and-installation/identify-api
- https://learn.microsoft.com/en-ca/clarity/clarity-api
