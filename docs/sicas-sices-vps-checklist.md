# SI-CAS / SI-CES VPS checklist

Kratek checklist za projekt, kjer bo avtentikacija tekla na VPS strezniku.

## 1. VPS in domena

- [x] Kupiti oziroma pridobiti VPS.
- [x] Izbrati Linux distribucijo, priporoceno Ubuntu LTS.
- [ ] Urediti dostop prek SSH.
- [x] Ustvariti domeno `demokracija-20.si`.
- [x] Ustvariti avtentikacijsko subdomeno `auth.demokracija-20.si`.
- [x] DNS `A` zapis usmeriti na IPv4 naslov VPS-ja `67.221.249.29`.
- [x] Namestiti oziroma preveriti HTTPS dostop za `auth.demokracija-20.si`.

## 2. Shibboleth SP za SI-CAS

- [x] Namestiti Apache.
- [x] Namestiti Shibboleth SP.
- [x] Preveriti, da se konfiguracija nalozi z `shibd -t`.
- [x] Nastaviti lokalni SP `entityID`: `https://auth.demokracija-20.si/shibboleth`.
- [x] V Shibboleth dodati SI-CAS test metadata:
      `https://sicas-test.sigov.si/static/idp-metadata.xml`
- [x] Nastaviti SI-CAS IdP `entityID`: `SICAS`.
- [x] Ustvariti SAML SP certifikat in zasebni kljuc:
      `/etc/shibboleth/sp-cert.pem`, `/etc/shibboleth/sp-key.pem`
- [x] Nastaviti pravice za SP kljuc/certifikat za `root:_shibd`.
- [x] Nastaviti `CredentialResolver` za signing in encryption.
- [ ] Urediti `attribute-map.xml` za atribute, ki jih potrebujemo.

## 3. SP metadata za SI-CAS

- [x] Odpreti metadata URL:
      `https://auth.demokracija-20.si/Shibboleth.sso/Metadata`
- [x] Preveriti, da metadata vsebuje pravi `entityID`.
- [x] Preveriti, da metadata vsebuje javni certifikat.
- [x] Preveriti, da metadata vsebuje `KeyDescriptor` za signing in encryption.
- [x] Preveriti, da ACS URL kaze na pravi VPS HTTPS naslov:
      `https://auth.demokracija-20.si/Shibboleth.sso/SAML2/POST`
- [ ] Metadata poslati SI-CAS ekipi.
- [ ] Pocakati, da SI-CAS ekipa vkljuci nase metapodatke v testno okolje.

## 4. Atributi in prijava

- [ ] Dogovoriti nabor atributov s SI-CAS ekipo.
- [ ] Minimalno zahtevati stabilni identifikator uporabnika, npr. `sicas_token`.
- [ ] Po potrebi zahtevati `sicas_ime`, `sicas_priimek`, email.
- [ ] Po uspesni prijavi preveriti Shibboleth session endpoint.
- [ ] Preveriti, da aplikacija prejme atribute prek headerjev ali okolja.
- [ ] V aplikaciji mapirati SI-CAS uporabnika v `author_ref`, `voter_ref`, `signer_ref`.

## 5. Povezava z aplikacijo

- [ ] Odlociti, ali bo celotna aplikacija tekla na VPS ali bo VPS proxy do Vercel frontenda.
- [ ] Ce VPS proxyja Vercel, nastaviti reverse proxy.
- [ ] Zascititi samo poti, ki zahtevajo prijavo.
- [ ] Demo prijavo pustiti samo za lokalni razvoj.
- [ ] Dodati realen logout tok.
- [ ] Preveriti, da uporabnik po prijavi pride nazaj v aplikacijo.

## 6. SI-CES podpisovanje

- [ ] Od SI-CES ekipe pridobiti ali potrditi `serviceProvider` oznako.
- [ ] Pripraviti klient certifikat za TLS klice.
- [ ] Zasebni kljuc hraniti samo na VPS-ju, ne v git in ne v frontend kodi.
- [ ] Implementirati backend klic `putRequest` na:
      `https://sicas-test.sigov.si/CES-Sign/SicesSign`
- [ ] Narediti testni klic s klient certifikatom.
- [ ] SI-CES ekipi poslati tocen cas klica do minute in uporabljeni `serviceProvider`.
- [ ] Pocakati, da vpisujejo pravice za certifikat.
- [ ] Ponoviti testni klic in preveriti odgovor.

## 7. Varnost in konfiguracija

- [x] Noben private key ne sme biti v repozitoriju.
- [x] Noben certifikat z zasebnim kljucem ne sme biti v frontend buildu.
- [x] Shibboleth SP zasebni kljuc hraniti samo na VPS-ju z omejenimi pravicami.
- [ ] Nastaviti backup konfiguracije brez zasebnih kljucev.
- [ ] Omejiti dostop do admin/SSH.
- [ ] Vklopiti osnovni firewall.
- [ ] Redno posodabljati sistemske pakete.

## 8. Dokumentacija za oddajo

- [x] Shraniti oziroma pripraviti SI-CAS SP metadata XML.
- [x] Shraniti staticni SP metadata XML brez opozorilnega komentarja:
      `docs/sicas-sp-metadata.xml`
- [x] Zapisati `entityID`: `https://auth.demokracija-20.si/shibboleth`.
- [x] Zapisati javni metadata URL:
      `https://auth.demokracija-20.si/Shibboleth.sso/Metadata`
- [x] Zapisati ACS/logout URL-je iz Shibboleth metadata.
- [ ] Zapisati seznam prejetih atributov.
- [ ] Zapisati SI-CES `serviceProvider`.
- [ ] Zapisati cas in rezultat testnega SI-CES klica.
