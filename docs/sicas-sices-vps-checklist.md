# SI-CAS / SI-CES VPS checklist

Kratek checklist za projekt, kjer bo avtentikacija tekla na VPS strezniku.

## 1. VPS in domena

- [ ] Kupiti oziroma pridobiti VPS.
- [ ] Izbrati Linux distribucijo, priporoceno Ubuntu LTS.
- [ ] Urediti dostop prek SSH.
- [ ] Ustvariti domeno ali subdomeno, npr. `demos.example.si`.
- [ ] DNS `A` zapis usmeriti na IPv4 naslov VPS-ja.
- [ ] Namestiti HTTPS certifikat, npr. Let's Encrypt.

## 2. Shibboleth SP za SI-CAS

- [ ] Namestiti Apache.
- [ ] Namestiti Shibboleth SP.
- [ ] Preveriti, da `shibd` tece.
- [ ] Nastaviti `entityID`, ki ga potrdi SI-CAS ekipa.
- [ ] V Shibboleth dodati SI-CAS test metadata:
  `https://sicas-test.sigov.si/static/idp-metadata.xml`
- [ ] Ustvariti ali uporabiti SAML SP certifikat.
- [ ] Urediti `attribute-map.xml` za atribute, ki jih potrebujemo.
- [ ] Preveriti lokalno Shibboleth konfiguracijo z `shibd -t`.

## 3. SP metadata za SI-CAS

- [ ] Odpreti metadata URL, npr. `https://demos.example.si/Shibboleth.sso/Metadata`.
- [ ] Preveriti, da metadata vsebuje pravi `entityID`.
- [ ] Preveriti, da metadata vsebuje javni certifikat.
- [ ] Preveriti, da ACS URL kaze na pravi VPS HTTPS naslov.
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

- [ ] Noben private key ne sme biti v repozitoriju.
- [ ] Noben certifikat z zasebnim kljucem ne sme biti v frontend buildu.
- [ ] Secrets hraniti v VPS datotekah z omejenimi pravicami ali v secret managerju.
- [ ] Nastaviti backup konfiguracije brez zasebnih kljucev.
- [ ] Omejiti dostop do admin/SSH.
- [ ] Vklopiti osnovni firewall.
- [ ] Redno posodabljati sistemske pakete.

## 8. Dokumentacija za oddajo

- [ ] Shraniti koncni SI-CAS metadata XML.
- [ ] Zapisati `entityID`.
- [ ] Zapisati javni URL aplikacije.
- [ ] Zapisati ACS/logout URL-je.
- [ ] Zapisati seznam prejetih atributov.
- [ ] Zapisati SI-CES `serviceProvider`.
- [ ] Zapisati cas in rezultat testnega SI-CES klica.

