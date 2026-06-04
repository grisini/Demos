# Razvojni nacrt

Datum revizije: 2026-06-04

Ta nacrt opisuje dejansko pot projekta do zadnje verzije. Za krovni povzetek trenutnega stanja glej `docs/stanje-zadnje-verzije.md`.

## Zakljucene iteracije

### Iteracija 1: osnovni prototip

- Vzpostavljena struktura projekta.
- Dodan osnovni frontend brez frameworka.
- Dodan lokalni `localStorage` repozitorij.
- Dodana demo prijava za razvoj.
- Dodana osnovna Supabase shema.
- Dodani prvi domenski testi.

### Iteracija 2: pobude in sodelovanje

- Oddaja zakonodajnih pobud.
- Pregled, iskanje, filtriranje in razvrscanje pobud.
- Glasovanje po pravilu en uporabnik, en glas.
- Komentiranje pobud.
- Statusni tok pobude.
- Osnovna analitika.

### Iteracija 3: AI in analitika

- Lokalni AI fallback v `src/domain/validation.js`.
- Hugging Face AI predpregled prek server-side endpointa.
- AI score, risk, suitability, completeness in categorySuggestion.
- AI audit tabela `initiative_ai_reviews`.
- SQL view-a `initiative_analytics` in `category_analytics`.
- Mermaid diagrami za use-case, UML, ER in zaporedja.
- DevWork zapis za sledljiv razvoj.

### Iteracija 4: email in CI/CD

- Email domenska pravila za statusne spremembe.
- SMTP/outbox posiljanje.
- Dnevni digest ustvarjalcu pobude.
- GitHub Actions pipeline.
- Coverage in SonarCloud scan.
- Preverjanje prisotnosti kljucnih datotek in skrivnosti.

### Iteracija 5: Vercel in runtime konfiguracija

- Vercel runtime config endpoint `api/config.local.js`.
- Rewrite `/config.local.js` v `vercel.json`.
- AI in email poti pripravljene za Vercel.
- Responsive UI in stranski meni.
- Vercel cron za dnevni digest.
- Popravljena Vercel konfiguracija brez BOM.

### Iteracija 6: analiticne plasti

- Vercel Web Analytics.
- Vercel Speed Insights.
- Microsoft Clarity tracking, tags in events.
- Clarity Data Export proxy prek `api/analytics/[...path].js`.
- Osebna analitika prijavljenega uporabnika.
- Admin sistemska analitika.
- Supabase `system_analytics_events`.
- Razsirjena `supabase/analytics.sql` shema z `analytics_events`, Clarity snapshot-i in dnevnimi snapshot-i.

### Iteracija 7: iskanje in izvoz dokumentov

- Supabase hybrid search RPC v `supabase/search.sql`.
- Lokalni fallback iskanja.
- PDF tisk in PDF prenos pobude za DZ.
- DOCX in ODT izvoz prek `src/lib/docx-export.js`.
- Lazy-load DOCX/ODT generatorja, da zacetni payload ostane manjsi.

### Iteracija 8: SI-PASS, backend pisanje in podpisi

- SI-PASS session model in `HttpOnly` cookie.
- VPS SI-CAS/Shibboleth bridge dokumentiran in pripravljen.
- Backend endpoint `/api/signatures` za SI-PASS podpis.
- `supabase/signatures-security.sql` zapre direktni insert podpisov.
- Backend oddaja pobud, komentarjev in admin statusnih sprememb prek `api/initiatives.js`.
- Admin pravice se preverjajo server-side z `ADMIN_EMAILS`.
- Popravljeno UTF-8 dekodiranje SI-PASS imen iz proxy headerjev.

### Iteracija 9: varnost, dostopnost in performance

- Cloudflare Turnstile za oddajo pobude.
- Aplikacijski rate limiting na backend endpointih.
- CSP in varnostni HTTP headerji v Vercel in lokalnem dev serverju.
- Dostopnostni pogled in uporabniske prilagoditve.
- E2E smoke testi za lokalni dev server.
- Performance budget testi za HTML/JS/CSS payload.

### Iteracija 10: SI-CeS priprava in dokumentacijska uskladitev

- `server/sices.mjs` za SI-CeS SOAP helperje, konfiguracijo in podpisni tok.
- Lokalni dev-server poti `/api/sices/start`, `/api/sices/callback`, `/api/sices/complete`.
- `supabase/sices-signatures.sql` za SI-CeS polja v `signatures`.
- Dokumentirani trije glavni uporabniki: neprijavljen, SI-PASS prijavljen, admin.
- Posodobljeni Mermaid diagrami v README, `docs` in oddajni kopiji.
- Posodobljena dokumentacija na zadnje stanje projekta.

## Trenutno odprti koraki

- Dodati Vercel `api/sices/*` entrypointe, ce bo SI-CeS podpisovanje teklo prek Vercela in ne samo prek VPS/dev-server poti.
- Zapreti prototipne Supabase RLS politike za produkcijo.
- Premakniti tudi glasovanje v backend pot z realno identiteto ali strogo anonimizacijo.
- Produkcijsko urediti admin/IAM model namesto `ADMIN_EMAILS`.
- Dodati GDPR/consent tok za Clarity in druge analiticne storitve.
- Dodati preview smoke test po Vercel deployu.
