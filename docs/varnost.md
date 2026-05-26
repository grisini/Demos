# Varnostni mehanizmi

## Priporocen brezplacen prvi sloj

Za to aplikacijo je najbolj smiseln prvi brezplacen in ugleden sistem **Cloudflare Turnstile**:

- namenjen je preverjanju, da akcije izvajajo legitimni uporabniki in ne avtomatizirani boti,
- brezplacen je za uporabo,
- ne zahteva klasicnih CAPTCHA ugank,
- primeren je za obrazce, kot so oddaja pobude, komentarji in drugi zapisi uporabnikov.

V tem projektu je Turnstile priklopljen na obrazec `Oddaja pobude`. Frontend prikaze Turnstile widget, backend endpoint `/api/security/turnstile` pa token preveri prek Cloudflare Siteverify API. To je pomembno, ker samo client-side widget ni zadostna zascita.

## Nastavitve

Frontend sme dobiti samo public site key:

```bash
TURNSTILE_SITE_KEY=...
TURNSTILE_ENDPOINT=/api/security/turnstile
```

Secret mora ostati samo na strezniku oziroma v Vercel env:

```bash
TURNSTILE_SECRET_KEY=...
TURNSTILE_ALLOWED_HOSTNAMES=localhost,vasadomena.si
```

Ce `TURNSTILE_SITE_KEY` ni nastavljen, aplikacija deluje brez Turnstile widgeta. Ce je site key nastavljen, secret pa ne, oddaja pobude varnostno preverjanje zavrne.

## Kaj to resi in cesa ne

Turnstile zmanjsa spam in avtomatizirane oddaje obrazcev. Ne nadomesti pa:

- Supabase RLS pravil,
- server-side validacije vseh pisalnih akcij,
- rate limitinga na API endpointih,
- varnostnih HTTP headerjev in Content Security Policy,
- WAF/CDN zascite,
- rednega DAST skeniranja.

Za produkcijo je naslednji logicen korak prestaviti pisalne akcije iz neposrednega frontend dostopa na backend endpoint, tam izvesti Turnstile, avtorizacijo, rate limiting in sele nato zapis v Supabase.

## Dodatni brezplacni ugledni sloji

- **Vercel Firewall**: Vercel dokumentacija navaja platform-wide firewall in avtomatsko DDoS zascito za vse deploye brez dodatne konfiguracije.
- **Cloudflare WAF/CDN**: primeren kot robni sloj pred domeno, posebej ce zelite pravila za promet, DNS in dodatno bot/WAF konfiguracijo.
- **ZAP by Checkmarx / OWASP ZAP projekt**: brezplacen odprtokoden DAST scanner za redno testiranje zagnane aplikacije. Full scan izvaja aktivne napade, zato ga uporabljajte samo na okoljih, kjer imate dovoljenje za testiranje.

Viri:

- https://developers.cloudflare.com/turnstile/plans/
- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
- https://vercel.com/docs/vercel-firewall
- https://www.zaproxy.org/getting-started/
- https://www.zaproxy.org/docs/docker/full-scan/
