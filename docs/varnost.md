# Varnostni mehanizmi

Ta dokument opisuje trenutno stanje varnosti v projektu Demokracija 2.0 in dodatne nastavitve, ki morajo biti vklopljene v produkciji.

## Implementirano v projektu

### Cloudflare Turnstile

Turnstile je priklopljen na obrazec `Oddaja pobude`.

- Frontend prikaze Turnstile widget.
- Backend endpoint `/api/security/turnstile` preveri token prek Cloudflare Siteverify API.
- Token se ne zaupa samo na strani brskalnika.
- Endpoint zavrne manjkajoc, predolg, neveljaven ali za napacen hostname izdan token.

Frontend sme dobiti samo public site key:

```bash
TURNSTILE_SITE_KEY=...
TURNSTILE_ENDPOINT=/api/security/turnstile
```

Secret mora ostati samo na strezniku oziroma v Vercel env:

```bash
TURNSTILE_SECRET_KEY=...
TURNSTILE_ALLOWED_HOSTNAMES=localhost,demokracija-20.si
```

Ce `TURNSTILE_SITE_KEY` ni nastavljen, aplikacija deluje brez widgeta. Ce je site key nastavljen, secret pa ne, oddaja pobude varnostno preverjanje zavrne.

### Rate limiting na backend endpointih

Projekt ima aplikacijski in-memory rate limiter v `server/rate-limit.mjs`. Uporabljen je na Vercel endpointih in na lokalnem `scripts/dev-server.mjs`.

Trenutne omejitve:

| Endpoint | Omejitev |
| --- | --- |
| `POST /api/security/turnstile` | 30 zahtevkov / 1 min / IP |
| `POST /api/ai/review-initiative` | 20 zahtevkov / 1 min / IP |
| `POST /api/signatures` | 12 zahtevkov / 5 min / IP |
| `POST /api/notifications/email` | 20 zahtevkov / 1 min / IP |
| `GET /api/notifications/daily-digest` | 10 zahtevkov / 1 min / IP |
| `GET /api/analytics/clarity` | 60 zahtevkov / 1 min / IP |
| `GET /api/analytics/system` | 30 zahtevkov / 1 min / IP |
| `POST /api/analytics/system` | 60 zahtevkov / 1 min / IP |

Ko je omejitev presezena, endpoint vrne `429` in headerje `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining` in `X-RateLimit-Reset`.

Pomembno: ta limiter je uporaben kot aplikacijski sloj in za kratke burst napade, ni pa zamenjava za Cloudflare Rate Limiting, ker serverless instance nimajo globalnega trajnega stevca.

### Varnostni HTTP headerji

V `vercel.json` in lokalnem dev strezniku so nastavljeni:

- `Content-Security-Policy`,
- `Referrer-Policy: strict-origin-when-cross-origin`,
- `X-Content-Type-Options: nosniff`,
- `X-Frame-Options: DENY`,
- `Permissions-Policy`,
- `Cross-Origin-Opener-Policy`.

CSP dovoli samo potrebne zunanje vire:

- Cloudflare Turnstile,
- Microsoft Clarity,
- Vercel Web Analytics / Speed Insights,
- Supabase REST,
- Hugging Face backend klice iz aplikacijskega endpointa,
- lastne statike in API poti.

### SI-PASS session in podpisi

SI-PASS session token je sifriran z AES-256-GCM in shranjen v `HttpOnly` cookieju `__Secure-demos_sipass`.

`POST /api/signatures` ne zaupa podatkom iz frontenda. Frontend poslje samo `initiativeId`, backend pa iz SI-PASS seje sam doloci:

- `signer_ref`,
- `signer_name`,
- `method = "sipass"`.

Za Supabase utrditev podpisov je pripravljena datoteka:

```bash
supabase/signatures-security.sql
```

Ta odstrani javni `insert` v `signatures`, pusti javno branje za prikaz stevcev in dovoli pisanje samo prek `service_role`.

### Integriteta podatkov

Supabase shema vsebuje:

- `unique (initiative_id, voter_ref)` za en glas istega uporabnika na pobudo,
- `unique (initiative_id, signer_ref)` za en podpis istega uporabnika na pobudo,
- dolzinske `check` omejitve za vsebinska polja pobude,
- dolzinsko `check` omejitev komentarja,
- `on delete cascade` za povezane glasove, podpise, komentarje in AI preglede.

Turnstile tokeni, podpisni zahtevki in API bodyji imajo dodatne velikostne omejitve na backend endpointih.

## Cloudflare nastavitve

V Cloudflare naj bo za produkcijsko domeno vklopljeno:

- DNS zapis aplikacije naj bo **Proxied / orange cloud**.
- `SSL/TLS > Overview`: **Full (strict)**.
- `Edge Certificates`: **Always Use HTTPS = On**.
- `Minimum TLS Version = TLS 1.2` ali visje.
- `TLS 1.3 = On`.
- `HSTS = On` sele, ko so vsi relevantni subdomaini zanesljivo na HTTPS.
- `Security > WAF`: **Cloudflare Managed Ruleset = On**.
- `Security > WAF`: **Cloudflare OWASP Core Ruleset = On**; za zacetek `PL2` ali `PL3`, po testiranju lahko stroze.
- `Security > Bots`: **Bot Fight Mode** ali **Super Bot Fight Mode**, ce je na voljo.
- Rate limiting pravilo za `/api/security/turnstile`, `/api/ai/review-initiative`, `/api/signatures`, `/api/notifications/email` in vse prihodnje pisalne poti.
- Cache rule: bypass cache za `/api/*`, `/auth/*`, `/vote*`, `/admin*`.

Origin naj ne bo dosegljiv mimo Cloudflare. Najboljsa izbira je Cloudflare Tunnel; drugace naj origin firewall dovoli samo Cloudflare IP-je in zaupanja vredne administrativne IP-je.

## Preprecevanje veckratnega glasovanja

Trenutno stanje:

- Lokalni demo uporablja brskalniski anonimni ID.
- Supabase tabela `votes` preprecuje dvojni zapis za isti `initiative_id + voter_ref`.
- Neprijavljen anonimen glas je primeren za prototip, ne za pravno zanesljivo glasovanje.

Za produkcijo je treba glasove premakniti na backend endpoint, kjer se:

1. prebere SI-PASS ali druga preverjena seja,
2. izdela salted hash uporabnika,
3. preveri rate limit,
4. preveri status pobude,
5. naredi insert v `votes` s `service_role`,
6. nikoli ne vraca osebnih identifikatorjev v javni seznam glasov.

## Anonimizacija

Projekt ze uporablja stabilni `sipass-*` identifikator namesto EMSO ali davcne stevilke. Ti izvorni osebni podatki ne smejo biti zapisani v javne tabele.

Priporoceno produkcijsko pravilo:

- v javnih tabelah hraniti salted hash oziroma stabilni interni identifikator,
- polna imena podpisnikov prikazovati samo tam, kjer je to nujno za evidenco podpisa,
- komentarje iz SI-PASS identitete v javnem UI prikazovati z omejenim imenom,
- ne logirati surovih EMSO, davcnih stevilk, SI-CAS tokenov ali celotnih session cookiejev.

## Preostala tveganja

To je se vedno prototip. Pred produkcijo ostaja:

- prestaviti oddajo pobude, glasovanje, komentarje in statusne spremembe iz direktnega Supabase anon dostopa na backend,
- zapreti prototipne RLS politike v `supabase/schema.sql`,
- uvesti moderator/admin avtorizacijo za statusne spremembe,
- odstraniti zacasnega hardkodanega demo prejemnika email obvestil,
- dodati revizijsko sled za statusne spremembe, glasove in podpise,
- redno izvajati DAST skeniranje na testnem okolju,
- preveriti Cloudflare Security Events po vklopu strozijih WAF pravil.

## Integracijski testi

Trenutni `npm test` preverja:

- osnovna domenska pravila,
- deduplikacijo glasov in podpisov,
- SI-PASS session sifriranje in obnovo,
- SI-PASS podpis prek backenda,
- Turnstile odzive brez secreta, z veljavnim tokenom in z napacnim hostname,
- rate limiter pri presezenem stevilu zahtevkov,
- E2E smoke test API endpointov,
- prisotnost varnostnih headerjev na lokalnem dev strezniku.

Rocno preverjanje pred oddajo:

```bash
npm test
npm run dev
```

Nato preverite:

1. `/config.local.js` ne vsebuje `HF_TOKEN`, `SMTP_PASS`, `SUPABASE_SERVICE_ROLE_KEY` ali `CRON_SECRET`.
2. Oddaja pobude zahteva Turnstile, ko je site key nastavljen.
3. SI-PASS podpis ne deluje brez SI-PASS seje.
4. Direktni insert v `signatures` z anon kljucem po `supabase/signatures-security.sql` pade.
5. Cloudflare Security Events prikaze WAF, bot in rate-limit dogodke.

## Viri

- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- https://developers.cloudflare.com/waf/rate-limiting-rules/
- https://developers.cloudflare.com/waf/managed-rules/
- https://developers.cloudflare.com/bots/get-started/bot-fight-mode/
- https://developers.cloudflare.com/dns/manage-dns-records/reference/proxied-dns-records/
- https://developers.cloudflare.com/ssl/edge-certificates/additional-options/http-strict-transport-security/
- https://www.zaproxy.org/getting-started/
