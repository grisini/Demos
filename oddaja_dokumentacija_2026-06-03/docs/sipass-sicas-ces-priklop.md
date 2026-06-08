# SI-PASS, SI-CAS in SI-CeS priklop

Datum revizije: 2026-06-04

Krovni povzetek zadnje verzije je v `docs/stanje-zadnje-verzije.md`.

Ta dokument razloci tri povezane, vendar razlicne sklope integracije:

- **SI-PASS**: uporabniska prijava oziroma drzavna e-identiteta.
- **SI-CAS**: tehnicna avtentikacijska pot prek SAML/Shibboleth okolja.
- **SI-CeS**: elektronsko podpisovanje dokumentov oziroma zahtevkov.

Trenutno stanje projekta: aplikacija ima demo prijavo in SI-PASS gumb. SI-CAS redirect tece prek Shibboleth SP na `auth.demokracija-20.si`, aplikacijska seja pa je pripravljena prek VPS auth bridge endpointa in Vercel session endpointa.

## Trenutno stanje v kodi

| Sklop | Trenutna izvedba | Datoteke |
| --- | --- | --- |
| Prijava | Demo uporabnik in SI-PASS session adapter | `src/lib/auth.js`, `src/main.js` |
| SI-PASS konfiguracija | Javni login/session endpointi in VPS auth bridge | `src/config.js`, `api/auth`, `scripts/dev-server.mjs`, `server/sipass-session.mjs` |
| Podpis | SI-PASS evidencni podpis prek backend endpointa | `src/main.js`, `api/signatures.js`, `server/signatures.mjs`, `supabase/signatures-security.sql` |
| SI-CeS helper | Delno pripravljen strezniski tok za podpisni zahtevek, callback in zakljucek podpisa | `server/sices.mjs`, `scripts/dev-server.mjs`, `supabase/sices-signatures.sql`, `tests/domain.test.mjs` |
| Podatkovni model | `signatures.method` in dodatna SI-CeS polja podpirajo nacin podpisa | `supabase/schema.sql`, `supabase/sices-signatures.sql` |
| Dokumentacija | Testno okolje, podpisi, VPS zapisnik in zdruzena navodila | `docs/si-pass-testno-okolje.md`, `docs/sipass-podpisi.md`, `docs/sicas-vps-vzpostavitev.md`, `docs/uporabniska-dokumentacija.md` |

## Ciljna produkcijska arhitektura

Priporocena pot za produkcijo:

1. Frontend ostane odjemalec za prikaz pobud.
2. Prijava prek SI-PASS/SI-CAS tece na backendu ali VPS reverse proxyju.
3. Backend po uspesni prijavi izda aplikacijsko sejo.
4. Backend v bazo zapisuje anonimiziran stabilni identifikator uporabnika.
5. Glasovi in podpisi se ne zapisujejo neposredno iz brskalnika z javnim anon kljucem.
6. SI-CeS podpisovanje se izvaja samo na strezniku, kjer so certifikati in zasebni kljuci.

## SI-PASS / SI-CAS prijavni tok

Predlagan tok:

1. Uporabnik klikne prijavo.
2. Aplikacija ga preusmeri na zasciteno backend pot, npr. `/auth/sipass/login`.
3. Backend ali Shibboleth SP sprozi SI-CAS prijavo.
4. SI-CAS po uspesni avtentikaciji vrne uporabnika na registriran ACS/callback URL.
5. Backend prebere dogovorjene atribute.
6. Backend izdela interno sejo in anonimiziran `user_ref`.
7. Frontend uporablja sejo za oddajo pobud, glasovanje, podpise in komentarje.

Minimalni atributi:

- stabilni identifikator uporabnika,
- ime za prikaz, ce je dovoljeno,
- email samo, ce je potreben in pravno utemeljen.

Trenutni auth bridge zna prebrati `sicas_ime`, `sicas_priimek`, `sicas_emso`, `sicas_ds` in `sicas_token`. Email je v session modelu ze pripravljen kot prazno polje, dokler ga SI-CAS politika ne posreduje.

## Trenutni SI-PASS session tok

1. Gumb `SI-PASS prijava` odpre `https://auth.demokracija-20.si/auth/sipass/login`.
2. VPS bridge preusmeri na Shibboleth handler `/Shibboleth.sso/Login` z IdP `SICAS`.
3. Po SI-CAS prijavi se uporabnik vrne na zasciteno pot `/auth/sipass/complete`.
4. Apache/Shibboleth preda dogovorjene atribute VPS bridge endpointu.
5. Bridge ustvari sifriran `HttpOnly` cookie za domeno `.demokracija-20.si`.
6. Frontend na `demokracija-20.si` poklice Vercel endpoint `/api/auth/session`.
7. Endpoint prebere cookie in vrne uporabnika z `id`, imenom, priimkom, EMSO, davcno stevilko in pripravljenim `email` poljem.

`id` ni EMSO ali davcna stevilka. Bridge iz `sicas_token`, EMSO ali davcne stevilke izdela salted hash `sipass-*`, ki ga aplikacija uporablja kot `author_ref`, `voter_ref` in `signer_ref`.

## Potrebna VPS nastavitev za bridge

Na VPS tece Node endpoint iz tega projekta na `127.0.0.1:5173`, Apache pa proxyja `/auth/sipass/` nanj. Pot `/auth/sipass/complete` je Shibboleth protected path.

Izvedeni VPS koraki:

1. Namesceni so `nodejs`, `npm` in `git`.
2. Projekt je namescen v `/opt/demos`.
3. `/opt/demos/.env.local` vsebuje VPS SI-PASS env spremenljivke.
4. `demos-auth.service` zaganja `npm start` iz `/opt/demos`.
5. Apache moduli `proxy`, `proxy_http` in `headers` so vklopljeni.
6. SSL virtual host za `auth.demokracija-20.si` vsebuje `ProxyPass` in `Location /auth/sipass/complete`.
7. `/etc/shibboleth/attribute-map.xml` vsebuje SI-CAS atribute za trenutni session tok.

`systemd` service:

```ini
[Unit]
Description=Demokracija 2.0 SI-PASS auth bridge
After=network.target

[Service]
Type=simple
User=demos
Group=demos
WorkingDirectory=/opt/demos
Environment=NODE_ENV=production
Environment=PORT=5173
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Primer Apache konfiguracije za virtual host `auth.demokracija-20.si`:

```apache
ProxyPass /auth/sipass/ http://127.0.0.1:5173/auth/sipass/
ProxyPassReverse /auth/sipass/ http://127.0.0.1:5173/auth/sipass/

<Location /auth/sipass/complete>
  AuthType shibboleth
  ShibRequestSetting requireSession 1
  Require valid-user

  RequestHeader unset X-SIPASS-Token
  RequestHeader unset X-SIPASS-EMSO
  RequestHeader unset X-SIPASS-Tax-Number
  RequestHeader unset X-SIPASS-First-Name
  RequestHeader unset X-SIPASS-Last-Name

  RequestHeader set X-SIPASS-Token "%{SICAS_TOKEN}e" env=SICAS_TOKEN
  RequestHeader set X-SIPASS-EMSO "%{SICAS_EMSO}e" env=SICAS_EMSO
  RequestHeader set X-SIPASS-Tax-Number "%{SICAS_DS}e" env=SICAS_DS
  RequestHeader set X-SIPASS-First-Name "%{SICAS_IME}e" env=SICAS_IME
  RequestHeader set X-SIPASS-Last-Name "%{SICAS_PRIIMEK}e" env=SICAS_PRIIMEK
</Location>
```

Ce Shibboleth na tvojem Apache uporablja drug casing atributov, preveri dejanska imena na `https://auth.demokracija-20.si/Shibboleth.sso/Session` po uspesni prijavi in popravi `RequestHeader` vrstice.

V `/etc/shibboleth/attribute-map.xml` morajo biti mapirani atributi, ki jih SI-CAS politika posreduje. Za trenutni nabor so bistveni:

```xml
<Attribute name="urn:oid:1.3.6.1.4.1.44044.1.1.1.1" id="sicas_emso"/>
<Attribute name="urn:oid:1.3.6.1.4.1.44044.1.1.1.2" id="sicas_ds"/>
<Attribute name="urn:oid:1.3.6.1.4.1.44044.1.1.1.6" id="sicas_ime"/>
<Attribute name="urn:oid:1.3.6.1.4.1.44044.1.1.1.7" id="sicas_priimek"/>
<Attribute name="urn:oid:1.3.6.1.4.1.44044.1.1.3.1" id="sicas_token"/>
```

Po spremembi naredi:

```bash
shibd -t
systemctl restart shibd
systemctl restart apache2
```

Preverjanje izvedenega VPS bridgea:

```bash
systemctl status demos-auth
curl -i http://127.0.0.1:5173/api/auth/session
curl -I "http://127.0.0.1:5173/auth/sipass/login"
curl -I "https://auth.demokracija-20.si/auth/sipass/login"
```

Pricakovano stanje:

- `demos-auth` je `active (running)`,
- lokalni session endpoint pred prijavo vrne neprijavljeno sejo,
- lokalni in javni login endpoint vrneta `302` na Shibboleth `/Shibboleth.sso/Login` z `entityID=SICAS`.

VPS in Vercel morata imeti isti `SIPASS_SESSION_SECRET`. Vrednost naj bo dolg nakljucen secret, npr. rezultat `openssl rand -base64 48`.

VPS env:

```env
SIPASS_SESSION_SECRET=...
SIPASS_USER_REF_SALT=...
SIPASS_COOKIE_DOMAIN=.demokracija-20.si
SIPASS_APP_ORIGIN=https://demokracija-20.si
SIPASS_SP_ORIGIN=https://auth.demokracija-20.si
SIPASS_COMPLETE_URL=https://auth.demokracija-20.si/auth/sipass/complete
SIPASS_IDP_ENTITY_ID=SICAS
```

Vercel env:

```env
SIPASS_SESSION_SECRET=...
SIPASS_USER_REF_SALT=...
SIPASS_COOKIE_DOMAIN=.demokracija-20.si
SIPASS_LOGIN_URL=https://auth.demokracija-20.si/auth/sipass/login
AUTH_SESSION_ENDPOINT=/api/auth/session
AUTH_LOGOUT_ENDPOINT=/api/auth/logout
SIGNATURES_ENDPOINT=/api/signatures
SUPABASE_SERVICE_ROLE_KEY=...
```

## Trenutni SI-PASS podpisni tok

Podpis pobude trenutno tece prek backend endpointa `POST /api/signatures`. Frontend poslje samo `initiativeId`; backend prebere SI-PASS `HttpOnly` cookie, preveri `sipass-*` uporabnika, sam zapise `signer_ref`, `signer_name` in `method = 'sipass'` ter po potrebi prestavi pobudo v `signature_collection`.

Za utrditev Supabase izvedite `supabase/signatures-security.sql`, ki odstrani direktni `insert` v tabelo `signatures` za javni anon kljuc. Podrobnosti so v `docs/sipass-podpisi.md`.

## SI-CeS podpisni tok

Delno implementiran/pripravljen tok:

1. Uporabnik izbere podpis pobude.
2. Frontend poklice backend pot za zacetek SI-CeS podpisa.
3. Backend preveri prijavljeno SI-PASS/SI-CAS identiteto.
4. Backend pripravi podpisni zahtevek za SI-CeS.
5. Backend izvede SI-CeS klic z ustreznim klient certifikatom.
6. Rezultat podpisa se shrani v tabelo `signatures` z `method = 'sices'`.
7. V revizijsko sled se shrani cas, rezultat, pobuda in anonimiziran uporabnik.

V kodi to trenutno pokrivajo `server/sices.mjs`, lokalne poti `/api/sices/start`, `/api/sices/callback` in `/api/sices/complete` v `scripts/dev-server.mjs`, frontend konfiguracija za `SICES_ENABLED` ter `supabase/sices-signatures.sql`. Loceni Vercel `api/sices/*` endpointi se niso dodani, zato je SI-CeS del pripravljen za lokalni oziroma locen backend tok, ne pa se zakljucen produkcijski Vercel tok.

Zasebni kljuc in certifikati ne smejo biti v gitu, frontendu ali javnem buildu.

## Potrebne spremembe za produkcijo

- Na Vercel deployati novo kodo in session endpointa.
- Na Vercel dodati env spremenljivke za SI-PASS session in narediti redeploy.
- Po prvi pravi SI-PASS prijavi preveriti dejanske atribute v Shibboleth sessionu in Apache `X-SIPASS-*` mapping.
- Uvesti trajnejso uporabnisko tabelo ali backend zapis, ce bo treba hraniti email in profile zunaj sifrirane seje.
- V Supabase uvesti stroge RLS politike ali pisanje izkljucno prek backenda.
- Omejiti spreminjanje statusov na administratorje.
- Dodati revizijsko sled za podpise in statusne spremembe.
- Aplikacijski rate limiting razsiriti tudi na prihodnje backend poti za oddajo pobud, glasove in komentarje; AI pregled in SI-PASS podpis sta ze omejena na trenutnih API endpointih.
- Produkcijsko urediti email prejemnike, predloge, odjave oziroma pravno podlago za obvestila.

## Varnostni minimum

- `.env.local` ne sme biti commitan.
- `HF_TOKEN`, SMTP gesla, SAML private key in SI-CeS certifikati ne smejo biti v repozitoriju.
- Callback URL-ji morajo biti registrirani pri ustrezni SI-CAS/SI-PASS ekipi.
- Produkcijski promet mora teci prek HTTPS.
- Osebni podatki morajo biti minimizirani.
- Revizijska sled mora omogociti dokazljivost brez nepotrebnega razkrivanja identitete.

## Povezani dokumenti

- `docs/si-pass-testno-okolje.md`
- `docs/sicas-vps-vzpostavitev.md`
- `docs/uporabniska-dokumentacija.md`
- `docs/supabase.md`
- `docs/baza-porocilo.md`
