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
SIPASS_LOGIN_URL=https://auth.demokracija-20.si/auth/sipass/login
AUTH_SESSION_ENDPOINT=/api/auth/session
AUTH_LOGOUT_ENDPOINT=/api/auth/logout
```

Trenutna aplikacija ima SI-PASS gumb in session endpointa. Po uspesni prijavi Shibboleth SP na VPS posreduje atribute bridge endpointu, ta pa vrne sifriran session cookie za spletno aplikacijo. Za delovanje je treba na VPS se nastaviti protected path `/auth/sipass/complete`, `attribute-map.xml` in Apache proxy/header mapping iz `docs/sipass-sicas-ces-priklop.md`.

