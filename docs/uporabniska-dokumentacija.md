# Uporabniska dokumentacija Demokracija 2.0

## Namen dokumenta

Ta dokument zdruzuje uporabniska, administratorska in operativna navodila za projekt **Demokracija 2.0**. Namenjen je temu, da lahko uporabnik, ocenjevalec ali upravljavec iz enega mesta razume:

- kaj aplikacija omogoca,
- kako se uporablja,
- katere vloge obstajajo,
- kako delujejo pobude, glasovi, komentarji in SI-PASS podpisi,
- kako so priklopljeni Supabase, VPS, SI-PASS, analitika, varnost in deployment,
- kaj je trenutno produkcijsko pripravljeno in kaj ostaja prototipna omejitev.

Projekt je delujoc prototip spletne platforme za oddajo, pregled, podporo in analitiko zakonodajnih pobud. Ni predstavljen kot zakljucen drzavni informacijski sistem, ampak kot dokaz koncepta z dokumentirano arhitekturo, podatkovnim modelom in integracijskimi nastavki.

## Hiter povzetek

Demokracija 2.0 omogoca:

- pregled aktualnih pobud,
- oddajo zakonodajne pobude,
- AI predpregled pobude,
- iskanje, filtriranje in razvrscanje,
- glasovanje,
- komentiranje,
- SI-PASS evidencni podpis pobude,
- izvoz pobude za nadaljnji postopek,
- osebno in sistemsko analitiko,
- integracijo s Supabase, Vercel, Microsoft Clarity, Cloudflare Turnstile in SI-PASS/SI-CAS VPS bridgeom.

Glavni produkcijski naslov aplikacije je:

```text
https://demokracija-20.si
```

SI-PASS/SI-CAS avtentikacijski bridge tece na:

```text
https://auth.demokracija-20.si
```

## Vloge uporabnikov

### Neprijavljen uporabnik

Neprijavljen uporabnik lahko:

- vidi samo javno aktualne pobude,
- vidi pobude s statusom `active` ali `signature_collection`,
- odda en anonimen glas na posamezno aktualno pobudo,
- uporablja osnovni pregled in javni detail pobude.

Neprijavljen uporabnik ne more:

- oddati nove pobude,
- komentirati,
- podpisati pobude,
- videti osebne analitike,
- uporabljati integracijskega ali sistemskega admin pogleda.

Anonimno glasovanje je prototipno omejeno na lokalni brskalniski ID. To ni produkcijsko mocna identifikacija.

### Demo uporabnik

Demo uporabnik je namenjen lokalnemu razvoju in predstavitvi brez prave SI-PASS prijave.

Demo uporabnik lahko:

- odda pobudo,
- glasuje,
- komentira,
- vidi osebno analitiko,
- uporablja vecino uporabniskih funkcij.

Demo uporabnik ne more opraviti SI-PASS podpisa pobude. Za podpis je zahtevana SI-PASS seja.

### SI-PASS uporabnik

SI-PASS uporabnik je uporabnik, ki se prijavi prek SI-PASS/SI-CAS toka. Aplikacija prejme stabilen anonimiziran identifikator oblike:

```text
sipass-...
```

Ta identifikator ni EMSO in ni davcna stevilka. Nastane iz dogovorjenega SI-CAS atributa, EMSO ali davcne stevilke s soljenim hashom.

SI-PASS uporabnik lahko:

- odda pobudo,
- glasuje,
- komentira,
- izvede SI-PASS evidencni podpis pobude,
- vidi osebno analitiko.

Komentarji SI-PASS uporabnika se v uporabniskem vmesniku prikazejo samo s prvim imenom. Podpisna evidenca v Supabase hrani ime podpisnika, ker je namen podpisov dokazljivost podpore.

### Demo admin

Demo admin je uporabnik:

```text
rene@demos.si,miha@demos.si,filip@demos.si 
```

Demo admin lahko:

- vidi integracijski pogled,
- vidi sistemsko analitiko,
- spreminja statuse pobud v aplikaciji.

Ta admin vloga je primerna za demo in ocenjevanje. Za produkcijo mora biti admin/moderatorski dostop prestavljen na backend z dejansko avtorizacijo.

## Osnovna uporaba aplikacije

### Pregled pobud

Glavni pogled prikazuje seznam pobud, osnovne metrike in detail izbrane pobude. Pobude je mogoce:

- iskati,
- filtrirati po kategoriji,
- filtrirati po statusu,
- razvrscati po popularnosti, datumu ali AI oceni.

Ce aplikacija uporablja lokalni nacin, se iskanje izvaja v brskalniku nad nalozenimi pobudami. Ce je vklopljen Supabase in je izveden `supabase/search.sql`, se pri iskalnem nizu z vsaj dvema znakoma uporabi Supabase RPC `search_initiatives`.

### Oddaja pobude

Prijavljen uporabnik lahko odda novo zakonodajno pobudo. Obrazec zajema vsebinske sklope, ki so pripravljeni za predlog zakona:

- naslov,
- kategorija,
- kratek povzetek,
- pravna podlaga,
- ocena stanja in razlogi,
- cilji, nacela in poglavitne resitve,
- besedilo clenov,
- obrazlozitev clenov,
- financne posledice,
- zagotovitev sredstev,
- primerjalni prikaz in pravo EU,
- presoja posledic,
- sodelovanje javnosti,
- predstavniki predlagatelja,
- dolocbe, ki se spreminjajo.

Ob oddaji aplikacija:

1. preveri minimalne dolzine in obvezna polja,
2. izvede lokalni ali zunanji AI predpregled,
3. pobudi dodeli zacetni status,
4. shrani pobudo v izbrani repozitorij,
5. uporabnika vrne na pregled pobud.

Ce je vklopljen Cloudflare Turnstile, mora uporabnik pred oddajo opraviti varnostno preverjanje.

### AI predpregled

Aplikacija podpira dva nacina AI predpregleda:

- lokalni rule-based pregled,
- Hugging Face predpregled prek backend endpointa.

Lokalni pregled vedno deluje in sluzi kot fallback. Hugging Face pregled se uporabi, kadar je nastavljen:

```env
AI_PROVIDER=huggingface
AI_REVIEW_ENDPOINT=/api/ai/review-initiative
HF_TOKEN=...
```

`HF_TOKEN` mora ostati samo na strezniku. Frontend vidi samo javni endpoint.

AI predpregled vrne:

- oceno `score`,
- tveganje `risk`,
- ugotovitve `findings`,
- popolnost podatkov,
- predlagano kategorijo,
- oceno ustreznosti.

AI predpregled ni pravna presoja. Namenjen je prvemu vsebinskemu pregledu in opozorilom.

### Glasovanje

Uporabnik lahko glasuje za pobudo. Pravilo je:

```text
en uporabnik, en glas na pobudo
```

V lokalnem nacinu to zagotavlja domenska logika. V Supabase shemi to dodatno zagotavlja unikatna omejitev:

```sql
unique (initiative_id, voter_ref)
```

Neprijavljen uporabnik lahko glasuje anonimno samo za javno aktualne pobude. Anonimni glas je vezan na lokalni brskalniski ID.

### Komentarji

Prijavljen uporabnik lahko doda komentar k pobudi. Komentar mora imeti vsaj tri znake.

Pri SI-PASS uporabniku se v uporabniskem vmesniku prikaze samo prvo ime. To je prikazna anonimizacija. Ce je cilj mocnejsa zasebnost, je treba komentarje premakniti na backend endpoint in omejiti neposredno pisanje v Supabase.

### SI-PASS podpis pobude

SI-PASS podpis je evidencni podpis podpore pobudi. Ne gre za SI-CES kvalificiran elektronski podpis dokumenta.

Tok je:

1. uporabnik se prijavi prek SI-PASS,
2. aplikacija prikaze gumb `SI-PASS podpis`,
3. frontend poklice `POST /api/signatures`,
4. backend prebere SI-PASS `HttpOnly` cookie,
5. backend sam doloci podpisnika,
6. backend zapise podpis v Supabase z `method = sipass`,
7. pobuda se po potrebi prestavi v status `signature_collection`.

Frontend pri podpisu ne posilja:

- `signer_ref`,
- `signer_name`,
- `method`.

To je pomembno, ker uporabnik ne more vec prek brskalnika ponarediti identitete podpisnika.

Za produkcijski SI-PASS podpis morajo biti na strezniku nastavljeni:

```env
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SIPASS_SESSION_SECRET=...
SIPASS_USER_REF_SALT=...
SIGNATURES_ENDPOINT=/api/signatures
```

V Supabase je treba po osnovni shemi izvesti tudi:

```sql
supabase/signatures-security.sql
```

Ta skripta zapre direktno vstavljanje podpisov prek javnega anon kljuca.

### Razlika med SI-PASS podpisom in SI-CES podpisom

V projektu trenutno obstaja SI-PASS evidencni podpis. To pomeni:

```text
preverjen SI-PASS uporabnik je podprl to pobudo
```

SI-CES podpis bi pomenil kriptografski podpis dokumenta ali podpisnega zahtevka prek drzavne podpisne storitve. To bi zahtevalo:

- pripravo podpisnega dokumenta ali zahtevka,
- klic SI-CES storitve,
- klient certifikat in zasebni kljuc na strezniku,
- shranjen rezultat podpisa, hash dokumenta, status in cas podpisa.

SI-CES del v tem projektu se ni implementiran.

### Izvoz pobude

Pri statusih:

- `signature_collection`,
- `submitted`,

aplikacija omogoca izvoz pobude za nadaljnji postopek:

- tiskanje PDF,
- prenos PDF,
- prenos DOCX,
- prenos ODT.

Izvoz vsebuje formalne sklope pobude, podporo, podpisnike, AI predpregled in osnovne metapodatke. Brskalniski PDF je namenjen tiskanju in ni oznacen kot popolnoma dostopen PDF.

## Analitika

Projekt uporablja vec analiticnih plasti, ki imajo razlicne namene.

### Analitika pobud

Prijavljen uporabnik vidi:

- skupno stevilo pobud,
- glasove,
- podpise,
- komentarje,
- porazdelitev po statusih,
- kategorije,
- AI tveganja,
- najbolj podprte pobude,
- osebno statistiko svojih pobud in aktivnosti.

Osebna analitika prikaze:

- moje pobude,
- moje glasove,
- moje podpise,
- moje komentarje,
- podporo mojim pobudam,
- zadnjo aktivnost.

### Sistemska analitika

Sistemska analitika je namenjena adminu. Prikazuje:

- stevilo podatkovnih vrstic,
- AI dogodke,
- ocenjeno porabo tokenov,
- email dogodke,
- frontend vire,
- stevilo udelezenih uporabnikov,
- anonimne glasove,
- javno vidne pobude,
- Clarity povzetek,
- zadnje sistemske dogodke.

Na Vercelu lahko sistemska analitika zapisuje dogodke v Supabase, ce je nastavljen:

```env
SUPABASE_SERVICE_ROLE_KEY=...
```

### Vercel Analytics in Speed Insights

Vercel Web Analytics in Speed Insights sta namenjena lastniku hostinga. Prikazujeta promet, SEO pogled, Core Web Vitals in performance metrike.

Vklopita se v Vercel dashboardu. Aplikacija sama nalozi ustrezne Vercel skripte po deployu.

### Microsoft Clarity

Microsoft Clarity se uporablja za vedenjsko analitiko:

- seje,
- heatmape,
- posnetke sej,
- custom tags,
- dogodke,
- agregirane grafe prek Data Export API.

Za osnovno sledenje nastavite:

```env
MICROSOFT_CLARITY_PROJECT_ID=...
```

Za prikaz agregiranih Clarity grafov v aplikaciji nastavite se server-only:

```env
CLARITY_API_TOKEN=...
CLARITY_ANALYTICS_ENDPOINT=/api/analytics/clarity
```

## Dostopnost

Projekt cilja na EN 301 549 v3.2.1 oziroma WCAG 2.1 AA za spletni del.

Aplikacija podpira:

- preskok na glavno vsebino,
- semanticno navigacijo,
- dostopna imena za gumbe in kontrole,
- povezane napake obrazcev,
- `role="status"` in `role="alert"` obvestila,
- vidno tipkovnicno fokusno oznako,
- forced-colors nacin,
- zmanjsano gibanje,
- prilagoditve velikosti besedila, kontrasta, razmika, gibanja, velikosti gumbov in pisave.

Znane omejitve:

- Turnstile je zunanji gradnik,
- brskalniski PDF izvoz ni popolnoma dostopen PDF,
- DOCX/ODT izvoz potrebuje rocni pregled pred uradno objavo.

## Tehnicna arhitektura

### Frontend

Frontend je staticna enostranska aplikacija brez frameworka:

- `index.html`,
- `src/main.js`,
- `src/styles.css`,
- `src/config.js`.

`src/main.js` vsebuje razred `DemocracyApp`, ki upravlja stanje, renderiranje, dogodke, navigacijo in klice repozitorija/API endpointov.

### Domenska logika

Domenska pravila so locena v:

- `src/domain/validation.js`,
- `src/domain/analytics.js`,
- `src/domain/notifications.js`,
- `src/domain/clarity-insights.js`.

Ta plast omogoca testiranje glavnih pravil brez brskalnika.

### Podatkovni dostop

Aplikacija podpira dva podatkovna nacina:

- `localStorage`,
- Supabase PostgreSQL.

Repozitoriji:

- `src/lib/storage.js` za lokalni demo,
- `src/lib/supabase.js` za Supabase REST.

Izbira je odvisna od runtime konfiguracije:

```env
DATA_SOURCE=local
```

ali:

```env
DATA_SOURCE=supabase
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=PUBLIC_ANON_KEY
```

### Backend/API

Lokalni razvojni backend je:

```text
scripts/dev-server.mjs
```

Na Vercelu so endpointi v:

```text
api/
```

Pomembni endpointi:

- `/config.local.js` - javni runtime config,
- `/api/auth/session` - branje SI-PASS seje,
- `/api/auth/logout` - odjava,
- `/api/signatures` - SI-PASS podpis pobude,
- `/api/ai/review-initiative` - Hugging Face AI predpregled,
- `/api/notifications/email` - email obvestila,
- `/api/analytics/system` - sistemska analitika,
- `/api/analytics/clarity` - Clarity agregati,
- `/api/security/turnstile` - server-side Turnstile preverjanje.

## Supabase

### Osnovna shema

Osnovna shema je:

```text
supabase/schema.sql
```

Definira:

- `initiatives`,
- `votes`,
- `signatures`,
- `comments`,
- `initiative_ai_reviews`,
- `system_analytics_events`,
- enum tipe,
- indekse,
- RLS politike,
- SQL poglede za analitiko.

### Dodatne skripte

Po potrebi izvedite:

```text
supabase/search.sql
supabase/analytics.sql
supabase/signatures-security.sql
supabase/seed.sql
```

Priporocen vrstni red:

1. `supabase/schema.sql`,
2. `supabase/search.sql`,
3. `supabase/analytics.sql`,
4. `supabase/signatures-security.sql`,
5. `supabase/seed.sql`, ce zelite demo podatke.

`signatures-security.sql` izvedite v okoljih, kjer mora podpis nastajati samo prek backend endpointa.

### Podatkovni model

Glavna tabela je `initiatives`. Nanjo so vezane:

- `votes`,
- `signatures`,
- `comments`,
- `initiative_ai_reviews`.

Glavne omejitve:

```sql
unique (initiative_id, voter_ref)
unique (initiative_id, signer_ref)
```

To zagotavlja en glas in en podpis istega uporabnika na posamezno pobudo.

### RLS in varnost

Osnovni `schema.sql` vsebuje prototipno odprte RLS politike, da lahko frontend neposredno bere in pise z anon kljucem. To je uporabno za razvoj, ni pa polna produkcijska varnost.

Trenutno je podpisni tok ze utrjen z backend endpointom in `signatures-security.sql`. Za produkcijo je treba podobno utrditi se:

- glasove,
- komentarje,
- oddajo pobud,
- spremembe statusov.

## SI-PASS, SI-CAS in VPS

### Pomen kratic

- SI-PASS: uporabniska prijava oziroma drzavna e-identiteta.
- SI-CAS: tehnicna avtentikacijska pot prek SAML/Shibboleth.
- SI-CES: elektronsko podpisovanje dokumentov ali zahtevkov.

### Trenutni SI-PASS/SI-CAS tok

1. Uporabnik klikne `SI-PASS prijava`.
2. Aplikacija ga preusmeri na `https://auth.demokracija-20.si/auth/sipass/login`.
3. VPS bridge sprozi Shibboleth login proti SI-CAS testnemu IdP `SICAS`.
4. Po prijavi SI-CAS vrne uporabnika na zasciteno pot `/auth/sipass/complete`.
5. Apache/Shibboleth preda atribute Node bridgeu.
6. Bridge izda sifriran `HttpOnly` cookie.
7. Frontend na glavni domeni poklice `/api/auth/session`.
8. Vercel endpoint prebere cookie in vrne uporabnika.

### VPS podatki

Trenutno dokumentirani podatki:

- domena: `demokracija-20.si`,
- auth subdomena: `auth.demokracija-20.si`,
- VPS IPv4: `67.221.249.29`,
- SP entityID: `https://auth.demokracija-20.si/shibboleth`,
- SI-CAS IdP entityID: `SICAS`,
- metadata URL: `https://auth.demokracija-20.si/Shibboleth.sso/Metadata`,
- ACS endpoint: `https://auth.demokracija-20.si/Shibboleth.sso/SAML2/POST`.

Na VPS so dokumentirano namesceni Apache, Shibboleth SP, Node.js in auth bridge kot `demos-auth.service`.

## Deployment in konfiguracija

### Lokalni zagon

```bash
npm run dev
```

Privzeti naslov:

```text
http://localhost:5173
```

Ce je port zaseden, razvojni streznik uporabi naslednji prosti port.

### Testi

```bash
npm test
```

Testi preverjajo domensko logiko, AI fallback, glasovanje, podpise, komentarje, analitiko, email pravila, SI-PASS session, SI-PASS podpisni backend in Turnstile.

### Vercel deployment

Projekt uporablja runtime konfiguracijo:

```text
/config.local.js
```

Lokalno jo generira `scripts/dev-server.mjs`, na Vercelu pa `api/config.local.js` prek `vercel.json`.

Minimalne javne nastavitve:

```env
DATA_SOURCE=supabase
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=PUBLIC_ANON_KEY
AI_PROVIDER=huggingface
MICROSOFT_CLARITY_PROJECT_ID=...
SYSTEM_ANALYTICS_ENDPOINT=/api/analytics/system
CLARITY_ANALYTICS_ENDPOINT=/api/analytics/clarity
TURNSTILE_SITE_KEY=...
TURNSTILE_ENDPOINT=/api/security/turnstile
SIGNATURES_ENDPOINT=/api/signatures
```

Server-only nastavitve:

```env
SUPABASE_SERVICE_ROLE_KEY=...
HF_TOKEN=...
CLARITY_API_TOKEN=...
TURNSTILE_SECRET_KEY=...
SIPASS_SESSION_SECRET=...
SIPASS_USER_REF_SALT=...
SMTP_HOST=...
SMTP_USER=...
SMTP_PASS=...
```

Server-only nastavitve ne smejo biti `VITE_*`.

Po spremembi env spremenljivk na Vercelu je potreben redeploy.

### Email obvestila

Frontend pripravi obvestila ob:

- novem glasu,
- novem podpisu,
- novem komentarju,
- spremembi statusa,
- novi pobudi v kategoriji, kjer je uporabnik ze sodeloval.

Endpoint:

```text
POST /api/notifications/email
```

Brez SMTP nastavitev se lokalno obvestila zapisujejo v outbox/log. Za dejansko posiljanje nastavite:

```env
EMAIL_NOTIFICATIONS_ENDPOINT=/api/notifications/email
SMTP_HOST=...
SMTP_PORT=587
SMTP_STARTTLS=true
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM="Demokracija 2.0 <no-reply@example.com>"
```

V trenutnem prototipu obstaja demo/hardcoded logika prejemnika, ki jo je treba pred produkcijo odstraniti ali nadomestiti s pravim modelom uporabniskih email nastavitev.

## Varnost

### Kaj je ze narejeno

- `HF_TOKEN` ostaja na strezniku.
- `TURNSTILE_SECRET_KEY` ostaja na strezniku.
- `SUPABASE_SERVICE_ROLE_KEY` se uporablja samo v backend endpointih.
- SI-PASS seja je sifrirana v `HttpOnly` cookieju.
- SI-PASS podpis ne zaupa frontendu.
- `signatures-security.sql` zapre direktni insert podpisov.
- CI preverja, da se lokalne skrivnosti ne commitajo.

### Kaj ostaja prototipno

- demo admin je client-side demo vloga,
- glasovi se se vedno lahko zapisujejo direktno iz frontenda,
- komentarji se se vedno lahko zapisujejo direktno iz frontenda,
- oddaja pobud se se vedno zapisuje prek frontend/Supabase adapterja,
- osnovne Supabase RLS politike so se vedno razvojno odprte,
- ni polnega rate limitinga na vseh pisalnih akcijah,
- ni produkcijskega moderatorskega modela.

### Priporoceni naslednji varnostni koraki

1. Premakniti glasove na backend endpoint.
2. Premakniti komentarje na backend endpoint.
3. Premakniti oddajo pobud na backend endpoint.
4. Zapreti `insert` pravice za `votes`, `comments` in po potrebi `initiatives`.
5. Uvesti moderatorske vloge na backendu.
6. Dodati rate limiting.
7. Odstraniti hardcoded demo email prejemnika.
8. Dodati audit log za statusne spremembe.

## CI/CD

GitHub Actions workflow je:

```text
.github/workflows/pipeline_demos.yml
```

Pipeline preverja:

- `npm ci`,
- `npm test`,
- JavaScript sintakso,
- prisotnost kljucnih frontend/API/Supabase/VPS datotek,
- Vercel in Supabase wiring,
- SI-CAS metadata arhiv,
- odsotnost ocitnih skrivnosti v repozitoriju,
- da frontend ne bere server-only skrivnosti.

Pipeline ne deploya samodejno in ne izvaja prave SI-PASS/SI-CAS prijave, ker ta zahteva zunanje testno okolje.

## Troubleshooting

### `/api/signatures` vrne 503

Vzrok je skoraj vedno manjkajoca server-side nastavitev:

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Dodajte ju v Vercel Environment Variables in naredite redeploy. `SUPABASE_SERVICE_ROLE_KEY` ne sme biti `VITE_*`.

### SI-PASS prijava ne vrne uporabnika

Preverite:

- ali `auth.demokracija-20.si/auth/sipass/login` vrne 302 na Shibboleth login,
- ali je `/auth/sipass/complete` zasciten s Shibboleth sessionom,
- ali Apache posreduje `X-SIPASS-*` headerje,
- ali imata VPS in Vercel isti `SIPASS_SESSION_SECRET`,
- ali je `SIPASS_COOKIE_DOMAIN=.demokracija-20.si`.

### Supabase ni povezan

Preverite:

- `DATA_SOURCE=supabase`,
- `SUPABASE_URL`,
- `SUPABASE_ANON_KEY`,
- Network odziv za `/config.local.js`.

Po spremembi env spremenljivk naredite redeploy.

### Hybrid search ne deluje

Preverite:

- ali je izveden `supabase/search.sql`,
- ali ima query vsaj 2 znaka,
- ali Network prikaze klic `/rest/v1/rpc/search_initiatives`,
- ali RPC v SQL editorju vrne rezultate.

### Oddaja pobude pade zaradi Turnstile

Preverite:

- `TURNSTILE_SITE_KEY`,
- `TURNSTILE_SECRET_KEY`,
- `TURNSTILE_ALLOWED_HOSTNAMES`,
- ali hostname v Cloudflare Siteverify odzivu ustreza dovoljeni domeni.

### Clarity grafi niso vidni

Preverite:

- `MICROSOFT_CLARITY_PROJECT_ID`,
- server-only `CLARITY_API_TOKEN`,
- `CLARITY_ANALYTICS_ENDPOINT=/api/analytics/clarity`,
- dnevno omejitev Clarity Data Export API.

## Znane omejitve

- Projekt je prototip, ne zakljucen produkcijski drzavni sistem.
- SI-CES podpis dokumenta se ni implementiran.
- Demo prijava ni nadomestilo za SI-PASS.
- Demo admin ni produkcijski model avtorizacije.
- Nekateri zapisi se vedno nastajajo neposredno iz frontenda.
- RLS je delno prototipno odprt.
- Email prejemniki potrebujejo produkcijski model.
- Ni E2E testov za celoten brskalniski tok.

## Priporocen vrstni red preverjanja

1. Preberite ta dokument.
2. Zazenite:

```bash
npm test
```

3. Zazenite:

```bash
npm run dev
```

4. Rocno preverite:

- demo prijavo,
- pregled pobud,
- oddajo pobude,
- glasovanje,
- komentiranje,
- SI-PASS podpis, ce je okolje pripravljeno,
- izvoz dokumenta,
- analitiko,
- admin sistemsko analitiko.

5. V Supabase preverite:

- `initiatives`,
- `votes`,
- `signatures`,
- `comments`,
- `system_analytics_events`.

6. Na Vercelu preverite:

- `/config.local.js`,
- env spremenljivke,
- serverless funkcije,
- analytics/speed insights.

## Povezani dokumenti

Ta dokument zdruzuje vsebino in navodila iz:

- `README.md`,
- `docs/pregled-projekta.md`,
- `docs/funkcionalnosti.md`,
- `docs/analitika.md`,
- `docs/supabase.md`,
- `docs/baza-porocilo.md`,
- `docs/hybrid-search.md`,
- `docs/varnost.md`,
- `docs/dostopnost.md`,
- `docs/sipass-sicas-ces-priklop.md`,
- `docs/sipass-podpisi.md`,
- `docs/sicas-vps-vzpostavitev.md`,
- `docs/si-pass-testno-okolje.md`,
- `docs/ci-cd-pipeline.md`,
- `docs/roadmap.md`,
- `docs/diagrams.md`.
