# SI-PASS podpisi pobud

Datum revizije: 2026-06-04

Krovni povzetek zadnje verzije je v `docs/stanje-zadnje-verzije.md`.

Ta dokument opisuje trenutni podpisni tok za pobude v aplikaciji Demokracija 2.0. Gre za evidencni SI-PASS podpis pobude v aplikaciji, ne za poln SI-CeS kvalificiran elektronski podpis dokumenta.

## Povzetek

Podpis pobude ne zaupa vec frontendu. Frontend samo poslje ID pobude na backend endpoint, backend pa iz `HttpOnly` SI-PASS seje sam doloci podpisnika in zapis v Supabase.

Glavne datoteke:

- `src/main.js` - gumb in klic `POST /api/signatures`,
- `api/signatures.js` - Vercel serverless endpoint,
- `server/signatures.mjs` - skupna backend logika podpisa,
- `scripts/dev-server.mjs` - lokalni endpoint za razvoj,
- `server/sipass-session.mjs` - branje sifrirane SI-PASS seje,
- `supabase/signatures-security.sql` - zapiranje direktnega insert dostopa do podpisov,
- `supabase/sices-signatures.sql` - dodatna polja za SI-CeS podpisni tok, kadar je ta vklopljen.

## Tok podpisa

1. Uporabnik se prijavi prek SI-PASS.
2. VPS bridge ustvari sifriran `HttpOnly` cookie za domeno `.demokracija-20.si`.
3. Frontend nalozi sejo prek `/api/auth/session`.
4. Pri pobudi se prikaze gumb `SI-PASS podpis`.
5. Frontend poklice:

```http
POST /api/signatures
Content-Type: application/json

{
  "initiativeId": "..."
}
```

6. Backend prebere SI-PASS cookie.
7. Backend zavrne zahtevo, ce uporabnik ni prijavljen prek SI-PASS.
8. Backend v Supabase zapise podpis z:

```text
signer_ref = sipass-...
signer_name = ime in priimek iz SI-PASS seje
method = sipass
```

9. Ce je pobuda v statusu `active`, jo backend prestavi v `signature_collection`.
10. Backend vrne osvezeno pobudo, frontend pa osvezi prikaz.

## Kaj frontend ne sme vec delati

Frontend pri SI-PASS podpisu ne sme posiljati:

- `signer_ref`,
- `signer_name`,
- `method`.

Ti podatki pridejo samo iz backend seje. To preprecuje, da bi uporabnik prek DevTools ali direktnega HTTP klica ponaredil podpisnika.

## Potrebne okoljske spremenljivke

Na Vercelu oziroma v server okolju morajo biti nastavljene:

```env
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=PUBLIC_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=SERVER_ONLY_SERVICE_ROLE_KEY

SIPASS_SESSION_SECRET=...
SIPASS_USER_REF_SALT=...
SIPASS_COOKIE_DOMAIN=.demokracija-20.si
AUTH_SESSION_ENDPOINT=/api/auth/session
AUTH_LOGOUT_ENDPOINT=/api/auth/logout
SIGNATURES_ENDPOINT=/api/signatures
```

`SUPABASE_SERVICE_ROLE_KEY` in `SIPASS_SESSION_SECRET` ne smeta biti `VITE_*` in ne smeta v frontend runtime config kot javni vrednosti.

## Supabase utrditev

Po osnovni shemi `supabase/schema.sql` izvedite se:

```sql
\i supabase/sices-signatures.sql
\i supabase/signatures-security.sql
```

Ce uporabljate Supabase SQL editor, vsebino datoteke `supabase/signatures-security.sql` prilepite in izvedite rocno.
Ce uporabljate SI-CeS oziroma zelite zadnjo verzijo podpisnih polj, pred tem izvedite tudi vsebino `supabase/sices-signatures.sql`.

Ta skripta:

- odstrani prototipno politiko `prototype insert signatures`,
- odvzame `insert` pravico za `anon` in `authenticated`,
- pusti javno branje podpisov za prikaz stevila in evidenc,
- pusti `service_role` pisanje za backend endpoint.

S tem uporabnik z javnim `SUPABASE_ANON_KEY` ne more vec neposredno dodati vrstice v `signatures`.

## En podpis na pobudo

Podatkovni model v `supabase/schema.sql` vsebuje omejitev:

```sql
unique (initiative_id, signer_ref)
```

Zato isti SI-PASS uporabnik, ki ima isti stabilni `sipass-*` identifikator, ne more podpisati iste pobude vec kot enkrat. Backend ob obstojecem podpisu vrne osvezeno pobudo brez podvajanja.

## Prikaz imen in zasebnost

Podpis v Supabase trenutno shrani ime in priimek v `signer_name`, ker je namen podpisne evidence dokazljivost podpore.

Komentarji so loceni: komentarji se v bazi lahko hranijo z imenom, frontend pa SI-PASS komentarje prikaze samo s prvim imenom. To je prikazna anonimizacija, ne brisanje podatkov iz baze.

Ce je cilj mocnejsa zasebnost, je treba dodatno:

- v backendu za komentarje uvesti locen endpoint,
- v Supabase omejiti direktni insert v `comments`,
- v javnih pogledih ne vracati polnih imen podpisnikov ali komentatorjev.

## Razlika do SI-CeS

Ta tok je SI-PASS evidencni podpis v aplikaciji. Uporabnikova identiteta je potrjena prek SI-PASS/SI-CAS seje, rezultat pa je vrstica v tabeli `signatures`.

SI-CeS je locen podpisni tok, kjer backend pripravi podpisni zahtevek, komunicira s SI-CeS storitvijo in hrani rezultat elektronskega podpisa dokumenta oziroma zahtevka. V projektu je ta tok pripravljen delno: `server/sices.mjs` vsebuje strezniske helperje, lokalni dev server ima `/api/sices/start`, `/api/sices/callback` in `/api/sices/complete`, `supabase/sices-signatures.sql` pa razsiri tabelo `signatures`.

Obicajni tok v aplikaciji zato ostaja SI-PASS evidencni podpis. SI-CeS se uporablja samo, ce je nastavljen `SICES_ENABLED=true`, so konfigurirani certifikati in endpointi ter je dodana produkcijska vstopna tocka. V mapi `api/` trenutno ni locenih Vercel `api/sices/*` endpointov.

## Preverjanje

Lokalno:

```bash
npm test
```

Pricakovani testi:

- SI-PASS session ustvari stabilen `sipass-*` identifikator,
- SI-PASS podpis backend zavrne zahtevo brez seje,
- SI-PASS podpis backend sam zapise `method = "sipass"`,
- podpis ostane dedupliciran po `initiative_id + signer_ref`,
- SI-CeS konfiguracija in helperji se ob manjkajocih nastavitvah obnasajo predvidljivo.

Rocno v aplikaciji:

1. Prijavite se prek SI-PASS.
2. Odprite aktivno pobudo.
3. Kliknite `SI-PASS podpis`.
4. Preverite, da se stevilo podpisov poveca.
5. V Supabase preverite tabelo `signatures`.
6. Poskusite direktni insert z anon kljucem; po `signatures-security.sql` mora biti zavrnjen.
