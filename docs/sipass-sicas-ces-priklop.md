# SI-PASS, SI-CAS in SI-CES priklop

Ta dokument razloci tri povezane, vendar razlicne sklope integracije:

- **SI-PASS**: uporabniska prijava oziroma drzavna e-identiteta.
- **SI-CAS**: tehnicna avtentikacijska pot prek SAML/Shibboleth okolja.
- **SI-CES**: elektronsko podpisovanje dokumentov oziroma zahtevkov.

Trenutno stanje projekta: aplikacija ima demo prijavo in demo podpis. Prava integracija je dokumentirana in pripravljena kot naslednja produkcijska faza.

## Trenutno stanje v kodi

| Sklop | Trenutna izvedba | Datoteke |
| --- | --- | --- |
| Prijava | Demo uporabnik v `localStorage` | `src/lib/auth.js`, `src/main.js` |
| SI-PASS konfiguracija | Placeholder nastavitve | `src/config.js`, `scripts/dev-server.mjs` |
| Podpis | Demo evidencni podpis | `src/domain/validation.js`, `src/main.js` |
| Podatkovni model | `signatures.method` podpira nacin podpisa | `supabase/schema.sql` |
| Dokumentacija | Testno okolje in VPS checklist | `docs/si-pass-testno-okolje.md`, `docs/sicas-sices-vps-checklist.md` |

## Ciljna produkcijska arhitektura

Priporocena pot za produkcijo:

1. Frontend ostane odjemalec za prikaz pobud.
2. Prijava prek SI-PASS/SI-CAS tece na backendu ali VPS reverse proxyju.
3. Backend po uspesni prijavi izda aplikacijsko sejo.
4. Backend v bazo zapisuje anonimiziran stabilni identifikator uporabnika.
5. Glasovi in podpisi se ne zapisujejo neposredno iz brskalnika z javnim anon kljucem.
6. SI-CES podpisovanje se izvaja samo na strezniku, kjer so certifikati in zasebni kljuci.

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

## SI-CES podpisni tok

Predlagan tok:

1. Uporabnik izbere podpis pobude.
2. Frontend poklice backend pot, npr. `POST /api/signatures`.
3. Backend preveri prijavljeno SI-PASS/SI-CAS identiteto.
4. Backend pripravi podpisni zahtevek za SI-CES.
5. Backend izvede SI-CES klic z ustreznim klient certifikatom.
6. Rezultat podpisa se shrani v tabelo `signatures` z `method = 'sices'`.
7. V revizijsko sled se shrani cas, rezultat, pobuda in anonimiziran uporabnik.

Zasebni kljuc in certifikati ne smejo biti v gitu, frontendu ali javnem buildu.

## Potrebne spremembe za produkcijo

- Dodati backend auth callback.
- Uvesti varno sejo oziroma token, ki ga aplikacija razume.
- Nadomestiti demo `DemoAuth` z adapterjem za prijavljenega uporabnika.
- V Supabase uvesti stroge RLS politike ali pisanje izkljucno prek backenda.
- Omejiti spreminjanje statusov na moderatorje.
- Dodati revizijsko sled za podpise in statusne spremembe.
- Dodati rate limiting za oddajo pobud, glasove, komentarje in AI pregled.
- Odstraniti vsak zacasni hardkodan demo prejemnik email obvestil.

## Varnostni minimum

- `.env.local` ne sme biti commitan.
- `HF_TOKEN`, SMTP gesla, SAML private key in SI-CES certifikati ne smejo biti v repozitoriju.
- Callback URL-ji morajo biti registrirani pri ustrezni SI-CAS/SI-PASS ekipi.
- Produkcijski promet mora teci prek HTTPS.
- Osebni podatki morajo biti minimizirani.
- Revizijska sled mora omogociti dokazljivost brez nepotrebnega razkrivanja identitete.

## Povezani dokumenti

- `docs/si-pass-testno-okolje.md`
- `docs/sicas-sices-vps-checklist.md`
- `docs/supabase.md`
- `docs/baza-porocilo.md`
