# SI-CAS VPS vzpostavitev

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

- SI-CAS ekipa mora nase SP metapodatke vkljuciti v testno okolje.
- Po vkljucitvi je treba izvesti testno prijavo prek SI-CAS.
- Po testni prijavi je treba preveriti prejete atribute na Shibboleth session endpointu.
- Po potrebi je treba dopolniti `attribute-map.xml`.
- Nato je treba Shibboleth prijavo povezati z aplikacijo in mapirati uporabnika v aplikacijski model.
- SI-CES podpisovanje se dela posebej kasneje.
