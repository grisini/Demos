-- Demo seed data for Demos / Demokracija 2.0.
-- Run after supabase/schema.sql and supabase/search.sql.

insert into initiatives (
  id,
  title,
  summary,
  description,
  category,
  legal_reference,
  expected_impact,
  legislative_text,
  article_explanation,
  financial_impact,
  budget_funding,
  comparative_review,
  impact_assessment,
  public_participation,
  proposer_representatives,
  affected_provisions,
  status,
  author_ref,
  author_name,
  notification_email,
  ai_score,
  ai_risk,
  ai_findings,
  ai_checks,
  ai_reviewed_at,
  created_at,
  updated_at
)
values
(
  '11111111-1111-4111-8111-111111111111',
  'Javna sledljivost zakonodajnih sprememb',
  'Predlog uvaja javno sledljivost vseh sprememb zakonodajnih predlogov v celotnem postopku.',
  'Trenutno javnost pogosto tezko razbere, kdo je predlagal posamezno spremembo, v kateri fazi postopka je nastala in kaksna je bila obrazlozitev. Predlog uvaja enoten elektronski zapis sprememb, da so razlicice zakonodajnega besedila primerljive in javno dostopne.',
  'Digitalna drzava',
  'Zakon o dostopu do informacij javnega znacaja, Poslovnik Drzavnega zbora in nacelo transparentnosti javnega delovanja.',
  'Cilj predloga je zagotoviti sledljivost sprememb, nacelo javnosti postopka, vecjo odgovornost predlagateljev in enoten digitalen prikaz poglavitnih resitev.',
  '1. clen' || chr(10) || 'Predlagatelj spremembe zakonodajnega predloga mora navesti besedilo spremembe, razlog zanjo, fazo postopka in identifikacijo predlagatelja.' || chr(10) || chr(10) || '2. clen' || chr(10) || 'Drzavni organ objavi primerjalni prikaz sprememb v elektronski in strojno berljivi obliki.',
  'K 1. clenu: clen doloca obvezne podatke pri vsaki spremembi predloga zakona.' || chr(10) || chr(10) || 'K 2. clenu: clen doloca javno objavo primerjalnega prikaza in tehnicno obliko objave.',
  'Predlog ne predvideva pomembnih dodatnih izdatkov drzavnega proracuna. Izvedba se zagotovi z nadgradnjo obstojecih informacijskih resitev.',
  'Sredstva za izvedbo se zagotovijo v okviru ze sprejetih postavk za digitalizacijo zakonodajnih postopkov.',
  'Primerljive resitve poznajo Estonija, Finska in Avstrija, kjer so zakonodajna gradiva javno dostopna z elektronskimi sledmi sprememb. Predlog je skladen s pravom Evropske unije, ker krepi transparentnost in dostop do informacij javnega znacaja.',
  'Administrativne posledice so omejene na dopolnitev objav. Okoljskih in prostorskih posledic ni. Gospodarski in socialni ucinki so pozitivni, ker javnost lazje spremlja pravila. Predlog podpira razvoj digitalne drzave.',
  'Javnost je sodelovala prek komentarjev v aplikaciji, evidentiranih glasov podpore in demo podpisov pobude.',
  'Demo uporabnik, predstavnik predlagateljev',
  'Ce se predlog vlozi kot novela, se prilozi besedilo dolocb zakona, ki urejajo objavo zakonodajnih gradiv.',
  'signature_collection',
  'demo@demos.local',
  'Demo uporabnik',
  'demo@demos.local',
  86,
  'low',
  '["Predlog vsebuje obvezne vsebinske sklope za predlog zakona.", "Izbrana kategorija je skladna z zaznanimi izrazi.", "Ni ocitnih proracunskih opozoril v osnovnem pregledu."]'::jsonb,
  '{"suitability":"ready","completeness":{"score":100},"categorySuggestion":{"category":"Digitalna drzava","confidence":90},"provider":"local","model":"local-rule-engine-v1"}'::jsonb,
  '2026-05-26 10:00:00+00',
  '2026-05-20 08:30:00+00',
  '2026-05-26 10:00:00+00'
),
(
  '22222222-2222-4222-8222-222222222222',
  'Register cakalnih dob v javnem zdravstvu',
  'Predlog vzpostavlja enoten javni register cakalnih dob po izvajalcih, storitvah in regijah.',
  'Podatki o cakalnih dobah so pogosto razprzeni, neenotno posodobljeni in tezko primerljivi med izvajalci. Pacienti zato tezje izberejo najhitrejso ustrezno storitev, nadzorni organi pa tezje zaznajo ozka grla v sistemu.',
  'Zdravstvo',
  'Zakon o pacientovih pravicah, Zakon o zdravstveni dejavnosti in pravila o dostopu do javnih informacij.',
  'Cilj je izboljsati preglednost cakalnih dob, omogociti primerjavo izvajalcev in podpreti nacrtovanje zmogljivosti v javnem zdravstvu.',
  '1. clen' || chr(10) || 'Vzpostavi se javni register cakalnih dob za zdravstvene storitve, ki se financirajo iz javnih sredstev.' || chr(10) || chr(10) || '2. clen' || chr(10) || 'Izvajalci morajo podatke posodobiti najmanj enkrat tedensko.',
  'K 1. clenu: clen opredeli register in obseg storitev, ki jih zajema.' || chr(10) || chr(10) || 'K 2. clenu: clen doloca minimalno pogostost posodabljanja podatkov.',
  'Vzpostavitev registra ima zmeren enkratni strosek in manjse redne stroske vzdrzevanja, ki se lahko krijejo iz sredstev za digitalizacijo zdravstva.',
  'Sredstva se zagotovijo v financnem nacrtu ministrstva, pristojnega za zdravje, in iz projektov digitalne preobrazbe.',
  'Podobne javne prikaze cakalnih dob uporabljajo Danska, Nizozemska in Finska. Predlog je skladen s pravom EU, ker ne omejuje prostega pretoka storitev in podpira dostop do informacij.',
  'Administrativne posledice nastanejo pri porocanju izvajalcev. Socialni ucinki so pozitivni zaradi lazjega dostopa pacientov do storitev. Gospodarski, okoljski in prostorski ucinki niso bistveni.',
  'Predlog je bil predstavljen uporabnikom aplikacije, komentarji pa so opozorili na potrebo po rednih posodobitvah in razumljivih filtrih.',
  'Ana Novak, predstavnica predlagateljev',
  'Spreminjajo se dolocbe zakona, ki urejajo porocanje izvajalcev zdravstvene dejavnosti o cakalnih dobah.',
  'active',
  'ana@example.test',
  'Ana Novak',
  'ana@example.test',
  74,
  'medium',
  '["Predlog je vsebinsko popoln, vendar ima proracunske posledice.", "AI predlaga kategorijo Zdravstvo z visokim ujemanjem."]'::jsonb,
  '{"suitability":"needs_review","completeness":{"score":100},"categorySuggestion":{"category":"Zdravstvo","confidence":92},"budgetHits":["proracun","sredstva"],"provider":"local","model":"local-rule-engine-v1"}'::jsonb,
  '2026-05-26 10:05:00+00',
  '2026-05-21 09:15:00+00',
  '2026-05-25 16:20:00+00'
),
(
  '33333333-3333-4333-8333-333333333333',
  'Odprti podatki o javnih razpisih',
  'Predlog doloca obvezno objavo podatkov o javnih razpisih v enotni odprti in strojno berljivi obliki.',
  'Podatki o javnih razpisih so objavljeni na razlicnih mestih in v razlicnih formatih, zato jih javnost, podjetja in nadzorni organi tezko primerjajo. Enoten nabor odprtih podatkov bi izboljsal nadzor in ponovno uporabo informacij.',
  'Javne finance',
  'Zakon o javnem narocanju, Zakon o dostopu do informacij javnega znacaja in pravila o transparentni porabi javnih sredstev.',
  'Predlog uvaja enotne podatkovne standarde, redno objavo razpisov in moznost avtomatiziranega spremljanja porabe javnih sredstev.',
  '1. clen' || chr(10) || 'Narocniki in dodeljevalci javnih sredstev objavijo podatke o razpisih v odprtem podatkovnem formatu.' || chr(10) || chr(10) || '2. clen' || chr(10) || 'Objava mora vsebovati predmet, vrednost, rok, upravicence in povezave do razpisne dokumentacije.',
  'K 1. clenu: clen doloca splosno obveznost objave v odprtem formatu.' || chr(10) || chr(10) || 'K 2. clenu: clen doloca minimalni nabor podatkov, ki mora biti objavljen.',
  'Predlog zahteva manjso tehnicno prilagoditev portalov, vendar ne uvaja novih materialnih pravic ali vecjih transferjev.',
  'Sredstva so zagotovljena v okviru obstojecih informacijskih sistemov in rednega vzdrzevanja portalov javne uprave.',
  'Podobne odprte podatkovne standarde uporabljajo Francija, Spanija in Irska. Predlog je skladen z Direktivo o odprtih podatkih in ponovno uporabo informacij javnega sektorja.',
  'Administrativne posledice so povezane z enotnim vnosom podatkov. Gospodarski ucinki so pozitivni zaradi lazje priprave ponudb. Socialnih, okoljskih in prostorskih posledic ni.',
  'Predlog je bil v javni razpravi podprt s strani uporabnikov, ki redno spremljajo razpise in opozarjajo na razprsenost informacij.',
  'Bor Kranjc, predstavnik predlagateljev',
  'Predlog dopolnjuje dolocbe, ki urejajo javno objavo razpisne dokumentacije in podatkov o prejemnikih sredstev.',
  'submitted',
  'bor@example.test',
  'Bor Kranjc',
  'bor@example.test',
  88,
  'low',
  '["Predlog je dovolj konkreten za nadaljnjo obravnavo.", "Zaznane so pravne oporne tocke in jasen pricakovani ucinek."]'::jsonb,
  '{"suitability":"ready","completeness":{"score":100},"categorySuggestion":{"category":"Javne finance","confidence":86},"provider":"local","model":"local-rule-engine-v1"}'::jsonb,
  '2026-05-26 10:10:00+00',
  '2026-05-22 11:45:00+00',
  '2026-05-26 08:10:00+00'
)
on conflict (id) do update set
  title = excluded.title,
  summary = excluded.summary,
  description = excluded.description,
  category = excluded.category,
  legal_reference = excluded.legal_reference,
  expected_impact = excluded.expected_impact,
  legislative_text = excluded.legislative_text,
  article_explanation = excluded.article_explanation,
  financial_impact = excluded.financial_impact,
  budget_funding = excluded.budget_funding,
  comparative_review = excluded.comparative_review,
  impact_assessment = excluded.impact_assessment,
  public_participation = excluded.public_participation,
  proposer_representatives = excluded.proposer_representatives,
  affected_provisions = excluded.affected_provisions,
  status = excluded.status,
  author_ref = excluded.author_ref,
  author_name = excluded.author_name,
  notification_email = excluded.notification_email,
  ai_score = excluded.ai_score,
  ai_risk = excluded.ai_risk,
  ai_findings = excluded.ai_findings,
  ai_checks = excluded.ai_checks,
  ai_reviewed_at = excluded.ai_reviewed_at,
  updated_at = excluded.updated_at;

insert into votes (id, initiative_id, voter_ref, voter_name, created_at)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'ana@example.test', 'Ana Novak', '2026-05-21 09:00:00+00'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '11111111-1111-4111-8111-111111111111', 'bor@example.test', 'Bor Kranjc', '2026-05-21 10:00:00+00'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', '11111111-1111-4111-8111-111111111111', 'cilka@example.test', 'Cilka Zupan', '2026-05-22 08:30:00+00'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', '22222222-2222-4222-8222-222222222222', 'demo@demos.local', 'Demo uporabnik', '2026-05-22 12:00:00+00'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5', '22222222-2222-4222-8222-222222222222', 'bor@example.test', 'Bor Kranjc', '2026-05-23 13:30:00+00'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6', '33333333-3333-4333-8333-333333333333', 'demo@demos.local', 'Demo uporabnik', '2026-05-23 14:00:00+00'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7', '33333333-3333-4333-8333-333333333333', 'ana@example.test', 'Ana Novak', '2026-05-24 15:00:00+00')
on conflict (initiative_id, voter_ref) do nothing;

insert into signatures (id, initiative_id, signer_ref, signer_name, method, created_at)
values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '11111111-1111-4111-8111-111111111111', 'ana@example.test', 'Ana Novak', 'demo', '2026-05-22 09:15:00+00'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', '11111111-1111-4111-8111-111111111111', 'bor@example.test', 'Bor Kranjc', 'demo', '2026-05-22 09:35:00+00'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', '33333333-3333-4333-8333-333333333333', 'demo@demos.local', 'Demo uporabnik', 'demo', '2026-05-25 10:45:00+00')
on conflict (initiative_id, signer_ref) do nothing;

insert into comments (id, initiative_id, author_ref, author_name, body, created_at)
values
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', '11111111-1111-4111-8111-111111111111', 'ana@example.test', 'Ana Novak', 'Podpiram, ker mora biti vsaka sprememba predloga jasno sledljiva.', '2026-05-22 10:10:00+00'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc2', '11111111-1111-4111-8111-111111111111', 'bor@example.test', 'Bor Kranjc', 'Koristno bi bilo dodati tudi izvoz primerjalnega prikaza v odprtem formatu.', '2026-05-23 11:05:00+00'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3', '22222222-2222-4222-8222-222222222222', 'demo@demos.local', 'Demo uporabnik', 'Register naj prikazuje tudi datum zadnje posodobitve podatka.', '2026-05-24 08:20:00+00'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc4', '33333333-3333-4333-8333-333333333333', 'ana@example.test', 'Ana Novak', 'Odprti podatki o razpisih bi olajsali nadzor in primerjavo porabe.', '2026-05-25 12:40:00+00')
on conflict (id) do nothing;

insert into initiative_ai_reviews (
  id,
  initiative_id,
  provider,
  model,
  score,
  risk,
  suitability,
  suggested_category,
  findings,
  checks,
  raw_response,
  created_at
)
values
  (
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
    '11111111-1111-4111-8111-111111111111',
    'local',
    'local-rule-engine-v1',
    86,
    'low',
    'ready',
    'Digitalna drzava',
    '["Predlog vsebuje obvezne vsebinske sklope za predlog zakona.", "Ni ocitnih proracunskih opozoril."]'::jsonb,
    '{"completeness":{"score":100},"suitability":"ready"}'::jsonb,
    '{}'::jsonb,
    '2026-05-26 10:00:00+00'
  ),
  (
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
    '22222222-2222-4222-8222-222222222222',
    'local',
    'local-rule-engine-v1',
    74,
    'medium',
    'needs_review',
    'Zdravstvo',
    '["Predlog je popoln, vendar ima financne posledice.", "Priporocen je uredniski pregled pred zbiranjem podpisov."]'::jsonb,
    '{"completeness":{"score":100},"suitability":"needs_review"}'::jsonb,
    '{}'::jsonb,
    '2026-05-26 10:05:00+00'
  ),
  (
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd3',
    '33333333-3333-4333-8333-333333333333',
    'local',
    'local-rule-engine-v1',
    88,
    'low',
    'ready',
    'Javne finance',
    '["Predlog je dovolj konkreten za nadaljnjo obravnavo.", "Besedilo clenov in obrazlozitev sta pripravljena."]'::jsonb,
    '{"completeness":{"score":100},"suitability":"ready"}'::jsonb,
    '{}'::jsonb,
    '2026-05-26 10:10:00+00'
  )
on conflict (id) do nothing;

insert into system_analytics_events (id, event_type, source, user_ref, user_role, session_id, path, data, created_at)
values
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', 'data_load', 'frontend', 'demo@demos.local', 'user', 'seed-session-1', '/', '{"count":3,"dataSource":"supabase"}'::jsonb, '2026-05-26 10:20:00+00'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2', 'initiative_docx_download', 'frontend', 'demo@demos.local', 'user', 'seed-session-1', '/', '{"initiativeId":"11111111-1111-4111-8111-111111111111","status":"signature_collection"}'::jsonb, '2026-05-26 10:25:00+00'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3', 'initiative_odt_download', 'frontend', 'admin@demos.local', 'admin', 'seed-session-2', '/', '{"initiativeId":"33333333-3333-4333-8333-333333333333","status":"submitted"}'::jsonb, '2026-05-26 10:30:00+00')
on conflict (id) do nothing;
