# SI-PASS testno okolje

Povzetek iz dokumenta `Testiranje v razvojnem okolju.docx`.

## Kaj je pomembno za razvoj

- SI-PASS testni CRP uporablja testne podatke, zato se ime in priimek v testu lahko ne ujemata z realnimi podatki uporabnika.
- Za produkcijsko SIGEN-CA ali SIGOV-CA potrdilo je za testiranje potreben vpis v testno prevajalno tabelo.
- Testni uporabniski racun se ureja na `https://sicas-test.sigov.si/`.
- Za testni `smsPASS` je po registraciji potreben dodatni postopek z digitalnim potrdilom in aktivacijsko kodo.
- Redirect URL-ji morajo biti vnaprej registrirani pri SI-PASS, zato je lokalni callback nastavljen kot konfiguracijski placeholder.

## Nastavki v aplikaciji

V `.env.example` so pripravljene spremenljivke:

```env
SIPASS_ENV=test
SIPASS_AUTHORITY=https://sicas-test.sigov.si/
SIPASS_CLIENT_ID=
SIPASS_REDIRECT_URI=http://localhost:5173/auth/sipass/callback
```

Trenutna aplikacija uporablja demo prijavo. Ko bodo na voljo registrirani SI-PASS podatki, je naslednji korak dodati backend auth callback in mapiranje SI-PASS identitete v anonimiziran `author_ref`, `voter_ref` in `signer_ref`.

