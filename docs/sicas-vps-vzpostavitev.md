# SI-CAS VPS vzpostavitev

Datum revizije: 2026-06-04

Krovni povzetek zadnje verzije je v `docs/stanje-zadnje-verzije.md`.

Ta dokument povzema, kaj je bilo izvedeno pri vzpostavitvi VPS streznika za SI-CAS avtentikacijo.

## Povzetek

Vzpostavljen je locen VPS endpoint za Shibboleth Service Provider, ki bo sluzil kot SAML 2.0 vstopna tocka za SI-CAS testno okolje.

Trenutni SI-CAS SP podatki:

- domena: `demokracija-20.si`
- avtentikacijska subdomena: `auth.demokracija-20.si`
- VPS IPv4: `67.221.249.29`
- SP entityID: `https://auth.demokracija-20.si/shibboleth`
- SI-CAS IdP entityID: `SICAS`
- SP metadata URL: `https://auth.demokracija-20.si/Shibboleth.sso/Metadata`
- staticni SP metadata XML: `docs/sicas-sp-metadata.xml`
- ACS endpoint: `https://auth.demokracija-20.si/Shibboleth.sso/SAML2/POST`
- SI-CAS test metadata: `https://sicas-test.sigov.si/static/idp-metadata.xml`

## Izvedeno na VPS

- Namescen je Ubuntu VPS.
- Domena `demokracija-20.si` je povezana na VPS.
- Subdomena `auth.demokracija-20.si` je povezana na VPS.
- HTTPS endpoint za `auth.demokracija-20.si` je dostopen.
- Namescen je Apache.
- Namescen je Shibboleth SP.
- Shibboleth konfiguracija uporablja SP entityID `https://auth.demokracija-20.si/shibboleth`.
- Shibboleth uporablja SI-CAS testni IdP metadata URL.
- SI-CAS IdP je nastavljen z `entityID="SICAS"`.
- Ustvarjen je SAML SP certifikat `/etc/shibboleth/sp-cert.pem`.
- Ustvarjen je SAML SP zasebni kljuc `/etc/shibboleth/sp-key.pem`.
- Pravice za kljuc in certifikat so omejene na VPS uporabnike `root` in `_shibd`.
- `CredentialResolver` je nastavljen za signing in encryption.
- Metadata generator podpisuje SP metadata.
- Staticni izvoz SP metadata brez Shibboleth opozorilnega komentarja je shranjen v `docs/sicas-sp-metadata.xml`.
- Na VPS sta namescena Node.js in `npm` za SI-PASS auth bridge.
- Projekt je postavljen v `/opt/demos`.
- Auth bridge tece kot `systemd` service `demos-auth.service`.
- Auth bridge lokalno poslusa na `127.0.0.1:5173`.
- Apache proxy preusmeri javno pot `/auth/sipass/` na Node auth bridge.
- Apache pot `/auth/sipass/complete` zahteva Shibboleth session.
- `attribute-map.xml` vsebuje mapiranje za `sicas_emso`, `sicas_ds`, `sicas_ime`, `sicas_priimek` in `sicas_token`.
- Projekt vsebuje tudi SI-CeS helperje v `server/sices.mjs` in lokalne razvojne poti `/api/sices/start`, `/api/sices/callback` ter `/api/sices/complete`. Produkcijske Vercel `api/sices/*` poti se niso loceno dodane.

## Validacija

Preverjena je bila Shibboleth konfiguracija:

```bash
shibd -t
```

Rezultat je pokazal, da je konfiguracija nalozljiva. Opozorilo za `MetadataGenerator handler` je deprecation warning in ni blokada za osnovno delovanje.

Preverjena je bila tudi metadata vsebina:

```bash
curl -s https://auth.demokracija-20.si/Shibboleth.sso/Metadata | grep -E "entityID|KeyDescriptor|X509Certificate"
```

Metadata vsebuje:

- pravi SP `entityID`,
- javni X.509 certifikat,
- `KeyDescriptor use="signing"`,
- `KeyDescriptor use="encryption"`,
- ACS endpoint na `auth.demokracija-20.si`.

Preverjen je bil tudi Node auth bridge:

```bash
systemctl status demos-auth
curl -i http://127.0.0.1:5173/api/auth/session
curl -I "http://127.0.0.1:5173/auth/sipass/login"
```

Rezultat:

- `demos-auth.service` je `active (running)`,
- session endpoint pred prijavo vrne `{"authenticated":false,"user":null}`,
- login endpoint vrne `302` na Shibboleth login handler z IdP `SICAS`.

Preverjen je bil tudi javni Apache proxy:

```bash
curl -I "https://auth.demokracija-20.si/auth/sipass/login"
```

Rezultat je `302 Found` na:

```text
https://auth.demokracija-20.si/Shibboleth.sso/Login?entityID=SICAS...
```

## Poslano SI-CAS ekipi

SI-CAS ekipi je poslano SP metadata oziroma metadata URL:

```text
https://auth.demokracija-20.si/Shibboleth.sso/Metadata
```

Zraven je navedeno:

```text
SP entityID:
https://auth.demokracija-20.si/shibboleth

ACS endpoint:
https://auth.demokracija-20.si/Shibboleth.sso/SAML2/POST

Okolje:
SI-CAS testno okolje

Opomba:
SP metadata je generiran iz Shibboleth SP konfiguracije in vsebuje signing/encryption certifikat.
```

Ce zelijo XML kot priponko namesto javnega URL-ja, se lahko poslje datoteka:

```text
docs/sicas-sp-metadata.xml
```

Ta datoteka je staticni izvoz nase SP metadata

## Kaj se manjka

- Na Vercel je treba preveriti, da sta `/api/auth/session` in `/api/auth/logout` deployana z zadnjo kodo.
- Na Vercel je treba dodati oziroma preveriti SI-PASS session env spremenljivke in narediti redeploy po vsaki spremembi.
- Po pravi testni prijavi prek SI-PASS je treba preveriti prejete atribute na Shibboleth session endpointu.
- Preveriti je treba, ali Apache `X-SIPASS-*` header mapping ujame dejanska imena atributov iz Shibboleth sessiona.
- Preveriti je treba celoten povratek po prijavi nazaj na `https://demokracija-20.si`.
- Za SI-CeS produkcijo je treba dodati oziroma povezati strezniske endpoint-e, nastaviti certifikate (`SICES_PFX_BASE64` ali `SICES_PFX_PATH`) in preveriti celoten podpisni tok z zunanjim SI-CeS okoljem.
