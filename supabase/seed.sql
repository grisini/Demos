-- Demo seed data for Demos / Demokracija 2.0.
-- Run after supabase/schema.sql and supabase/search.sql.

drop table if exists pg_temp.demos_seed_initiatives;

create temporary table demos_seed_initiatives (
  ordinal integer primary key,
  id uuid not null,
  title text not null,
  summary text not null,
  description text not null,
  category initiative_category not null,
  legal_reference text not null,
  expected_impact text not null,
  legislative_text text not null,
  article_explanation text not null,
  financial_impact text not null,
  budget_funding text not null,
  comparative_review text not null,
  impact_assessment text not null,
  public_participation text not null,
  proposer_representatives text not null,
  affected_provisions text not null,
  status initiative_status not null,
  author_ref text not null,
  author_name text not null,
  notification_email text not null,
  ai_score integer not null,
  ai_risk ai_risk_level not null,
  ai_suitability ai_suitability not null,
  suggested_category initiative_category not null,
  vote_target integer not null,
  signature_target integer not null,
  comment_target integer not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

insert into demos_seed_initiatives (
  ordinal,
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
  ai_suitability,
  suggested_category,
  vote_target,
  signature_target,
  comment_target,
  created_at,
  updated_at
)
values
(
  1,
  '11111111-1111-4111-8111-111111111111',
  'Javna sledljivost zakonodajnih sprememb',
  'Predlog uvaja javno sledljivost vseh sprememb zakonodajnih predlogov v celotnem postopku.',
  'Trenutno javnost pogosto tezko razbere, kdo je predlagal posamezno spremembo, v kateri fazi postopka je nastala in kaksna je bila obrazlozitev. Predlog uvaja enoten elektronski zapis sprememb, da so razlicice zakonodajnega besedila primerljive in javno dostopne.',
  'Digitalna drzava',
  'Zakon o dostopu do informacij javnega znacaja, Poslovnik Drzavnega zbora in nacelo transparentnosti javnega delovanja.',
  'Cilj predloga je zagotoviti sledljivost sprememb, vecjo odgovornost predlagateljev in enoten digitalen prikaz poglavitnih resitev.',
  '1. clen' || chr(10) || 'Predlagatelj spremembe zakonodajnega predloga mora navesti besedilo spremembe, razlog zanjo, fazo postopka in identifikacijo predlagatelja.' || chr(10) || chr(10) || '2. clen' || chr(10) || 'Drzavni organ objavi primerjalni prikaz sprememb v elektronski in strojno berljivi obliki.',
  'K 1. clenu: clen doloca obvezne podatke pri vsaki spremembi predloga zakona.' || chr(10) || chr(10) || 'K 2. clenu: clen doloca javno objavo primerjalnega prikaza in tehnicno obliko objave.',
  'Predlog ne predvideva pomembnih dodatnih izdatkov drzavnega proracuna. Izvedba se zagotovi z nadgradnjo obstojecih informacijskih resitev.',
  'Sredstva za izvedbo se zagotovijo v okviru ze sprejetih postavk za digitalizacijo zakonodajnih postopkov.',
  'Primerljive resitve poznajo Estonija, Finska in Avstrija, kjer so zakonodajna gradiva javno dostopna z elektronskimi sledmi sprememb.',
  'Administrativne posledice so omejene na dopolnitev objav. Gospodarski in socialni ucinki so pozitivni, ker javnost lazje spremlja pravila.',
  'Javnost je sodelovala prek komentarjev v aplikaciji, evidentiranih glasov podpore in demo podpisov pobude.',
  'Maja Vidmar, predstavnica predlagateljev',
  'Ce se predlog vlozi kot novela, se prilozi besedilo dolocb zakona, ki urejajo objavo zakonodajnih gradiv.',
  'signature_collection',
  'maja.vidmar@example.test',
  'Maja Vidmar',
  'maja.vidmar@example.test',
  88,
  'low',
  'ready',
  'Digitalna drzava',
  626,
  326,
  16,
  '2026-05-13 08:30:00+00',
  '2026-06-02 14:10:00+00'
),
(
  2,
  '22222222-2222-4222-8222-222222222222',
  'Register cakalnih dob v javnem zdravstvu',
  'Predlog vzpostavlja enoten javni register cakalnih dob po izvajalcih, storitvah in regijah.',
  'Podatki o cakalnih dobah so pogosto razprseni, neenotno posodobljeni in tezko primerljivi med izvajalci. Pacienti zato tezje izberejo najhitrejso ustrezno storitev, nadzorni organi pa tezje zaznajo ozka grla v sistemu.',
  'Zdravstvo',
  'Zakon o pacientovih pravicah, Zakon o zdravstveni dejavnosti in pravila o dostopu do javnih informacij.',
  'Cilj je izboljsati preglednost cakalnih dob, omogociti primerjavo izvajalcev in podpreti nacrtovanje zmogljivosti v javnem zdravstvu.',
  '1. clen' || chr(10) || 'Vzpostavi se javni register cakalnih dob za zdravstvene storitve, ki se financirajo iz javnih sredstev.' || chr(10) || chr(10) || '2. clen' || chr(10) || 'Izvajalci morajo podatke posodobiti najmanj enkrat tedensko.',
  'K 1. clenu: clen opredeli register in obseg storitev, ki jih zajema.' || chr(10) || chr(10) || 'K 2. clenu: clen doloca minimalno pogostost posodabljanja podatkov.',
  'Vzpostavitev registra ima zmeren enkratni strosek in manjse redne stroske vzdrzevanja, ki se lahko krijejo iz sredstev za digitalizacijo zdravstva.',
  'Sredstva se zagotovijo v financnem nacrtu ministrstva, pristojnega za zdravje, in iz projektov digitalne preobrazbe.',
  'Podobne javne prikaze cakalnih dob uporabljajo Danska, Nizozemska in Finska. Predlog je skladen s pravom EU in podpira dostop do informacij.',
  'Administrativne posledice nastanejo pri porocanju izvajalcev. Socialni ucinki so pozitivni zaradi lazjega dostopa pacientov do storitev.',
  'Predlog je bil predstavljen uporabnikom aplikacije, komentarji pa so opozorili na potrebo po rednih posodobitvah in razumljivih filtrih.',
  'Ana Novak, predstavnica predlagateljev',
  'Spreminjajo se dolocbe zakona, ki urejajo porocanje izvajalcev zdravstvene dejavnosti o cakalnih dobah.',
  'active',
  'ana.novak@example.test',
  'Ana Novak',
  'ana.novak@example.test',
  76,
  'medium',
  'needs_review',
  'Zdravstvo',
  482,
  214,
  13,
  '2026-05-14 09:15:00+00',
  '2026-06-01 16:20:00+00'
),
(
  3,
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
  'Podobne odprte podatkovne standarde uporabljajo Francija, Spanija in Irska. Predlog je skladen z Direktivo o odprtih podatkih.',
  'Administrativne posledice so povezane z enotnim vnosom podatkov. Gospodarski ucinki so pozitivni zaradi lazje priprave ponudb.',
  'Predlog je bil v javni razpravi podprt s strani uporabnikov, ki redno spremljajo razpise in opozarjajo na razprsenost informacij.',
  'Bor Kranjc, predstavnik predlagateljev',
  'Predlog dopolnjuje dolocbe, ki urejajo javno objavo razpisne dokumentacije in podatkov o prejemnikih sredstev.',
  'submitted',
  'bor.kranjc@example.test',
  'Bor Kranjc',
  'bor.kranjc@example.test',
  91,
  'low',
  'ready',
  'Javne finance',
  589,
  626,
  18,
  '2026-05-15 11:45:00+00',
  '2026-06-03 08:10:00+00'
),
(
  4,
  '44444444-4444-4444-8444-444444444444',
  'Solarne skupnosti na javnih stavbah',
  'Predlog omogoca, da obcine na strehah javnih stavb organizirajo lokalne soncne skupnosti za gospodinjstva.',
  'Stevilne sole, vrtci, zdravstveni domovi in obcinske stavbe imajo primerne strehe, ki jih lokalne skupnosti ne izkoriscajo dovolj. Pobuda doloca pravni okvir, po katerem lahko obcina presezke proizvedene elektrike nameni prebivalcem z nizjimi prihodki in lokalnim javnim zavodom.',
  'Okolje',
  'Energetski zakon, zakonodaja o obnovljivih virih energije in pravila o lokalni samoupravi.',
  'Predlog zmanjsuje stroske energije, pospesuje uporabo obnovljivih virov in krepi lokalno energetsko samooskrbo.',
  '1. clen' || chr(10) || 'Obcina lahko na javnih stavbah vzpostavi lokalno soncno skupnost.' || chr(10) || chr(10) || '2. clen' || chr(10) || 'Merila za vkljucitev prebivalcev morajo biti javna, nediskriminatorna in socialno uravnotezena.',
  'K 1. clenu: clen doloca dopustnost vzpostavitve soncne skupnosti na javnih stavbah.' || chr(10) || chr(10) || 'K 2. clenu: clen varuje transparentno dodeljevanje koristi.',
  'Izvedba zahteva investicijska sredstva, vendar se delno povrne skozi prihranke pri energiji in razpolozljive evropske programe.',
  'Sredstva se zagotovijo iz obcinskih proracunov, podnebnih skladov in razpisov za obnovljive vire.',
  'Primerljive skupnostne energetske modele poznajo Nemcija, Avstrija in Portugalska.',
  'Okoljski ucinki so pozitivni zaradi manj izpustov. Socialni ucinki so pozitivni, ce so koristi usmerjene tudi k ranljivim gospodinjstvom.',
  'V razpravi so sodelovali predstavniki obcin, upravniki javnih stavb in prebivalci iz pilotnih lokalnih skupnosti.',
  'Nina Zajc, predstavnica predlagateljev',
  'Dopolnijo se dolocbe, ki urejajo lokalne energetske skupnosti in rabo javne infrastrukture.',
  'signature_collection',
  'nina.zajc@example.test',
  'Nina Zajc',
  'nina.zajc@example.test',
  83,
  'medium',
  'needs_review',
  'Okolje',
  302,
  302,
  12,
  '2026-05-16 10:20:00+00',
  '2026-06-01 12:40:00+00'
),
(
  5,
  '55555555-5555-4555-8555-555555555555',
  'Brezplacni osnovni ucni pripomocki',
  'Predlog zagotavlja enoten nabor osnovnih ucnih pripomockov za ucence v javnih osnovnih solah.',
  'Druzine imajo ob zacetku solskega leta razlicno visoke stroske za zvezke, delovne pripomocke in osnovni material. Pobuda uvaja minimalni standard pripomockov, ki ga sola zagotovi vsem ucencem, s cimer se zmanjsajo razlike med druzinami in administrativna bremena razrednikov.',
  'Izobrazevanje',
  'Zakon o osnovni soli, pravila o financiranju vzgoje in izobrazevanja ter nacelo enakega dostopa do javnih storitev.',
  'Cilj je zmanjsati stroske za druzine, izboljsati enake moznosti otrok in poenotiti osnovni standard solskih pripomockov.',
  '1. clen' || chr(10) || 'Javna osnovna sola zagotovi ucencem osnovni nabor ucnih pripomockov.' || chr(10) || chr(10) || '2. clen' || chr(10) || 'Minister doloci minimalni nabor pripomockov in nacin financiranja.',
  'K 1. clenu: clen doloca pravico ucenca do osnovnega nabora pripomockov.' || chr(10) || chr(10) || 'K 2. clenu: clen prepusti tehnicne podrobnosti podzakonskemu aktu.',
  'Predlog ima redne proracunske posledice, ki so omejene z dolocitvijo minimalnega nabora in skupnim javnim narocanjem.',
  'Sredstva se zagotovijo v proracunu za izobrazevanje, delno pa z racionalizacijo solskih nabav.',
  'Podobne modele poznajo Finska, Svedska in deloma Avstrija.',
  'Socialni ucinki so pozitivni zaradi manjsega financnega pritiska na druzine. Gospodarski ucinki so omejeni na dobavitelje solskega materiala.',
  'Predlog so komentirali starsi, ucitelji in svetovalni delavci, ki so izpostavili razlike v stroskih med solami.',
  'Sara Klemenc, predstavnica predlagateljev',
  'Spreminjajo se dolocbe, ki urejajo materialne pogoje za izvajanje osnovnosolskega programa.',
  'active',
  'sara.klemenc@example.test',
  'Sara Klemenc',
  'sara.klemenc@example.test',
  79,
  'medium',
  'needs_review',
  'Izobrazevanje',
  421,
  187,
  10,
  '2026-05-17 07:50:00+00',
  '2026-06-02 09:05:00+00'
),
(
  6,
  '66666666-6666-4666-8666-666666666666',
  'Digitalna osebna izkaznica za obcinske storitve',
  'Predlog poenoti uporabo digitalne identitete pri elektronskih vlogah za storitve obcin.',
  'Prebivalci morajo pri obcinskih storitvah pogosto uporabljati razlicne obrazce, nacine prijave in dokazila. Pobuda uvaja enotno uporabo digitalne identitete za oddajo vlog, spremljanje statusa in varno komunikacijo z obcinsko upravo.',
  'Digitalna drzava',
  'Zakon o elektronski identifikaciji, Zakon o splosnem upravnem postopku in predpisi o lokalni samoupravi.',
  'Predlog poenostavlja obcinske postopke, zmanjsuje stevilo fizicnih obiskov in izboljsuje uporabnisko izkusnjo.',
  '1. clen' || chr(10) || 'Obcine zagotovijo podporo enotni digitalni identiteti pri elektronskih vlogah.' || chr(10) || chr(10) || '2. clen' || chr(10) || 'Elektronska vloga ima enako dokazno vrednost kot pisna vloga, ce je oddana z ustrezno identifikacijo.',
  'K 1. clenu: clen doloca minimalno digitalno podporo obcinskim storitvam.' || chr(10) || chr(10) || 'K 2. clenu: clen ureja dokazno vrednost elektronske vloge.',
  'Stroski so povezani s prilagoditvijo obcinskih informacijskih sistemov, pri cemer se predvideva skupna drzavna platforma.',
  'Sredstva se zagotovijo iz programov digitalizacije javne uprave in obcinskih proracunov.',
  'Primerljive resitve obstajajo v Estoniji, na Danskem in v Belgiji.',
  'Administrativni ucinki so pozitivni, ker se zmanjsa rocno vnasanje podatkov in ponavljanje dokazil.',
  'Predlog je nastal na podlagi uporabniskih pritozb glede razlicnih obcinskih portalov in neenotnih obrazcev.',
  'Tim Rozman, predstavnik predlagateljev',
  'Dopolnijo se dolocbe, ki urejajo elektronsko poslovanje obcin z uporabniki.',
  'active',
  'tim.rozman@example.test',
  'Tim Rozman',
  'tim.rozman@example.test',
  86,
  'low',
  'ready',
  'Digitalna drzava',
  367,
  274,
  9,
  '2026-05-18 12:25:00+00',
  '2026-06-03 10:35:00+00'
),
(
  7,
  '77777777-7777-4777-8777-777777777777',
  'Hitrejse odlocanje v upravnih postopkih',
  'Predlog uvaja javno spremljanje rokov pri upravnih zadevah in opozorila ob ponavljajocih se zamudah.',
  'Dolgotrajni upravni postopki povzrocajo negotovost za posameznike, podjetja in nevladne organizacije. Pobuda uvaja obvezno spremljanje povprecnih casov resitev po organih, avtomatska opozorila predstojnikom in javno porocilo o razlogih za sistemske zamude.',
  'Pravosodje',
  'Zakon o splosnem upravnem postopku, Zakon o javnih usluzbencih in nacelo pravice do odlocitve v razumnem roku.',
  'Cilj je skrajsati postopke, izboljsati odgovornost organov in javnosti dati primerljive podatke o delovanju uprave.',
  '1. clen' || chr(10) || 'Organ vodi evidenco casa resevanja upravnih zadev po vrstah postopkov.' || chr(10) || chr(10) || '2. clen' || chr(10) || 'Ce organ tri mesece zapored presega povprecni rok, objavi nacrt odprave zamud.',
  'K 1. clenu: clen doloca evidenco casa resevanja.' || chr(10) || chr(10) || 'K 2. clenu: clen doloca odziv na ponavljajoce se zamude.',
  'Predlog ne uvaja novih pravic do transferjev, zahteva pa prilagoditev informacijskih evidenc in porocanja.',
  'Izvedba se krije iz rednega poslovanja organov in sredstev za digitalizacijo javne uprave.',
  'Podobne meritve casov upravnih postopkov uporabljajo Nizozemska, Irska in Estonija.',
  'Administrativni ucinki so zmerni, pricakovani ucinki za uporabnike pa pozitivni zaradi krajsih postopkov.',
  'V komentarjih so uporabniki izpostavili postopke gradbenih dovoljenj, socialnih pravic in dovoljenj za delo.',
  'Luka Horvat, predstavnik predlagateljev',
  'Spreminjajo se dolocbe o poslovanju upravnih organov in porocanju o rokih.',
  'review',
  'luka.horvat@example.test',
  'Luka Horvat',
  'luka.horvat@example.test',
  68,
  'medium',
  'needs_review',
  'Pravosodje',
  244,
  143,
  8,
  '2026-05-19 08:10:00+00',
  '2026-06-01 15:30:00+00'
),
(
  8,
  '88888888-8888-4888-8888-888888888888',
  'Lokalni podnebni nacrti in javno porocanje',
  'Predlog zavezuje vecje obcine k letnemu porocanju o podnebnih ukrepih in dosezenih kazalnikih.',
  'Obcine sprejemajo razlicne podnebne ukrepe, vendar javnost pogosto nima primerljivega pregleda nad izvajanjem. Pobuda uvaja enoten nabor kazalnikov, letno porocilo in javno objavo napredka na podrocjih energije, prometa, zelenih povrsin in odpadkov.',
  'Okolje',
  'Zakon o varstvu okolja, podnebne strategije in predpisi o lokalni samoupravi.',
  'Cilj je okrepiti odgovornost lokalnih skupnosti, izboljsati primerljivost ukrepov in pospesiti izvajanje podnebnih nacrtov.',
  '1. clen' || chr(10) || 'Mestne obcine in obcine nad 20.000 prebivalci pripravijo letno podnebno porocilo.' || chr(10) || chr(10) || '2. clen' || chr(10) || 'Porocilo vsebuje kazalnike o energiji, prometu, zelenih povrsinah in ravnanju z odpadki.',
  'K 1. clenu: clen doloca zavezance za porocanje.' || chr(10) || chr(10) || 'K 2. clenu: clen doloca minimalni nabor kazalnikov.',
  'Predlog ima omejene administrativne stroske, saj vecina obcin podatke delno ze zbira.',
  'Sredstva se zagotovijo v obcinskih proracunih in programih za podnebno upravljanje.',
  'Podobno lokalno podnebno porocanje uporabljajo mesta na Finskem, v Nemciji in na Nizozemskem.',
  'Okoljski ucinki so pozitivni, ker predlog pospesuje izvajanje ukrepov. Prostorski ucinki so posredni in odvisni od obcinskih nacrtov.',
  'Javnost je predlagala, naj se poleg ciljev objavijo tudi dejansko izvedeni ukrepi in porabljena sredstva.',
  'Eva Mlakar, predstavnica predlagateljev',
  'Dopolnijo se dolocbe o lokalnih programih varstva okolja in javnem porocanju.',
  'signature_collection',
  'eva.mlakar@example.test',
  'Eva Mlakar',
  'eva.mlakar@example.test',
  84,
  'low',
  'ready',
  'Okolje',
  556,
  458,
  15,
  '2026-05-20 09:40:00+00',
  '2026-06-04 07:55:00+00'
),
(
  9,
  '99999999-9999-4999-8999-999999999999',
  'Transparentnost porabe zdravstvenih domov',
  'Predlog uvaja poenoteno javno objavo vecjih pogodb, investicij in kazalnikov poslovanja zdravstvenih domov.',
  'Zdravstveni domovi upravljajo javna sredstva in pomembno infrastrukturo, podatki o vecjih pogodbah in investicijah pa niso vedno lahko primerljivi. Pobuda uvaja poenoteno letno objavo kljucnih pogodb, investicijskih nacrtov in osnovnih kazalnikov dostopnosti storitev.',
  'Zdravstvo',
  'Zakon o zdravstveni dejavnosti, Zakon o javnih financah in pravila o transparentni porabi javnih sredstev.',
  'Predlog izboljsuje nadzor nad porabo javnih sredstev in omogoca primerjavo poslovanja zdravstvenih domov.',
  '1. clen' || chr(10) || 'Javni zdravstveni dom objavi letni pregled vecjih pogodb in investicij.' || chr(10) || chr(10) || '2. clen' || chr(10) || 'Pregled vsebuje vrednost, izvajalca, namen, rok izvedbe in vir financiranja.',
  'K 1. clenu: clen doloca obveznost letne objave.' || chr(10) || chr(10) || 'K 2. clenu: clen doloca minimalne podatke za javni pregled.',
  'Stroski so omejeni na pripravo in objavo podatkov, vecina podatkov pa izhaja iz obstojecih evidenc.',
  'Sredstva se zagotovijo v okviru rednega poslovanja zdravstvenih domov.',
  'Primerljive prakse javnega porocanja poznajo Danska, Svedska in Ceska.',
  'Gospodarski in socialni ucinki so pozitivni zaradi vecje odgovornosti pri porabi javnih sredstev.',
  'Komentarji uporabnikov so poudarili potrebo po primerljivih podatkih med zdravstvenimi domovi.',
  'Tina Kos, predstavnica predlagateljev',
  'Dopolnijo se dolocbe o javnosti poslovanja javnih zdravstvenih zavodov.',
  'submitted',
  'tina.kos@example.test',
  'Tina Kos',
  'tina.kos@example.test',
  89,
  'low',
  'ready',
  'Zdravstvo',
  611,
  612,
  17,
  '2026-05-21 10:05:00+00',
  '2026-06-04 11:25:00+00'
),
(
  10,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Sklad za prvo stanovanje mladih',
  'Predlog oblikuje pilotni sklad za porostva pri prvem stanovanjskem kreditu mladih gospodinjstev.',
  'Visoke cene stanovanj in zahtevana lastna udelezba mladim gospodinjstvom otezujejo nakup prvega stanovanja. Pobuda predlaga omejen pilotni sklad porostev z jasnimi dohodkovnimi merili, zgornjo vrednostjo nepremicnine in javnim porocanjem o tveganjih.',
  'Javne finance',
  'Stanovanjski zakon, Zakon o javnih financah in pravila o drzavnih porostvih.',
  'Cilj je olajsati dostop do prvega stanovanja ob hkratnem nadzoru fiskalnih tveganj in preprecevanju dviga cen.',
  '1. clen' || chr(10) || 'Vzpostavi se pilotni sklad porostev za prvo stanovanje mladih gospodinjstev.' || chr(10) || chr(10) || '2. clen' || chr(10) || 'Upravicenost je vezana na starost, dohodek, prvo resevanje stanovanjskega vprasanja in zgornjo vrednost nepremicnine.',
  'K 1. clenu: clen doloca namen sklada.' || chr(10) || chr(10) || 'K 2. clenu: clen doloca osnovna merila za upravicence.',
  'Predlog lahko ustvari pogojne obveznosti drzave, zato zahteva strogo omejitev obsega in letno porocanje.',
  'Sredstva oziroma porostveni okvir se doloci v proracunu in posebnem programu sklada.',
  'Podobni modeli porostev obstajajo na Irskem, v Franciji in Zdruzenem kraljestvu.',
  'Socialni ucinki so lahko pozitivni, fiskalna tveganja pa zahtevajo dodatno presojo in varovalke.',
  'V javni razpravi so uporabniki izpostavili tveganje rasti cen in potrebo po najemnih resitvah.',
  'Rok Petek, predstavnik predlagateljev',
  'Predlog posega v dolocbe o stanovanjskih ukrepih in morebitnih drzavnih porostvih.',
  'rejected',
  'rok.petek@example.test',
  'Rok Petek',
  'rok.petek@example.test',
  52,
  'high',
  'insufficient',
  'Javne finance',
  198,
  96,
  11,
  '2026-05-22 08:35:00+00',
  '2026-06-02 17:15:00+00'
),
(
  11,
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'Obvezna objava sodnih statistik',
  'Predlog uvaja redno javno objavo kazalnikov trajanja postopkov, pripada zadev in zakljuckov po sodiscih.',
  'Javnost tezko spremlja, kje nastajajo najvecji zaostanki in kako se spreminja trajanje sodnih postopkov. Pobuda uvaja standardizirano cetrtletno objavo statistik po vrstah zadev, sodiscih in fazah postopka, brez razkrivanja osebnih podatkov.',
  'Pravosodje',
  'Zakon o sodiscih, Sodni red in pravila o varstvu osebnih podatkov.',
  'Cilj je izboljsati zaupanje v pravosodje, omogociti primerjavo delovanja sodisc in podpreti upravljanje zaostankov.',
  '1. clen' || chr(10) || 'Sodisca cetrtletno objavijo anonimizirane statistike o trajanju in stevilu postopkov.' || chr(10) || chr(10) || '2. clen' || chr(10) || 'Objava ne sme omogocati identifikacije strank ali sodnikov v posamezni zadevi.',
  'K 1. clenu: clen doloca pogostost in obseg statistik.' || chr(10) || chr(10) || 'K 2. clenu: clen varuje osebne podatke in neodvisnost sodstva.',
  'Predlog ima manjse tehnicne stroske priprave anonimiziranih porocil iz obstojecih informacijskih sistemov.',
  'Sredstva se zagotovijo iz rednega proracuna sodstva in projektov digitalizacije pravosodja.',
  'Primerljive sodne statistike objavljajo Nizozemska, Finska in Nemcija.',
  'Administrativni ucinki so zmerni, pricakovani ucinki na transparentnost pa pozitivni.',
  'Predlog je dobil podporo uporabnikov, ki zelijo razumljive podatke o trajanju postopkov po vrsti zadeve.',
  'Matej Kolar, predstavnik predlagateljev',
  'Dopolnijo se dolocbe o javnosti dela sodisc in statistickem porocanju.',
  'submitted',
  'matej.kolar@example.test',
  'Matej Kolar',
  'matej.kolar@example.test',
  87,
  'low',
  'ready',
  'Pravosodje',
  473,
  391,
  14,
  '2026-05-23 10:15:00+00',
  '2026-06-05 09:30:00+00'
),
(
  12,
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'Enotna prijava na studentske subvencije',
  'Predlog poenoti prijavo za prehrano, bivanje in prevoz prek enega digitalnega postopka za studente.',
  'Studenti morajo za razlicne subvencije pogosto oddajati podobne podatke na vec mestih. Pobuda uvaja enotno digitalno prijavo, samodejno preverjanje osnovnih pogojev in statusni pregled, ki zmanjsa podvajanje dokazil in administrativne napake.',
  'Izobrazevanje',
  'Zakon o visokem solstvu, Zakon o uveljavljanju pravic iz javnih sredstev in predpisi o subvencijah studentov.',
  'Predlog zmanjsuje birokracijo za studente, pospesuje obravnavo vlog in izboljsuje kakovost podatkov.',
  '1. clen' || chr(10) || 'Vzpostavi se enotna digitalna vloga za studentske subvencije.' || chr(10) || chr(10) || '2. clen' || chr(10) || 'Organ lahko pogoje preveri z uradnimi evidencami, ce ima za to zakonsko podlago.',
  'K 1. clenu: clen doloca enotno vlogo.' || chr(10) || chr(10) || 'K 2. clenu: clen ureja preverjanje podatkov iz uradnih evidenc.',
  'Izvedba zahteva razvoj povezav med evidencami, vendar zmanjsuje rocno obdelavo in ponovne pozive za dopolnitve.',
  'Sredstva se zagotovijo iz proracuna za digitalizacijo izobrazevanja in upravljanja javnih pravic.',
  'Podobne storitve na enem mestu poznajo Estonija, Finska in Danska.',
  'Socialni ucinki so pozitivni zaradi lazjega dostopa do pravic. Administrativni ucinki so pozitivni zaradi manj podvajanja.',
  'V razpravi so studenti poudarili potrebo po jasnem prikazu statusa in razlogov za morebitno zavrnitev.',
  'Katja Sever, predstavnica predlagateljev',
  'Spreminjajo se dolocbe, ki urejajo prijavo na subvencionirane studentske pravice.',
  'active',
  'katja.sever@example.test',
  'Katja Sever',
  'katja.sever@example.test',
  85,
  'low',
  'ready',
  'Izobrazevanje',
  334,
  225,
  10,
  '2026-05-24 09:05:00+00',
  '2026-06-05 13:50:00+00'
),
(
  13,
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'Zascita pitne vode pri prostorskih nacrtih',
  'Predlog krepi obvezno presojo vplivov prostorskih nacrtov na vodovarstvena obmocja.',
  'Prostorski nacrti lahko pomembno vplivajo na vire pitne vode, javnost pa pogosto prepozno vidi strokovne podlage. Pobuda uvaja zgodnejsi javni prikaz tveganj, obvezno mnenje pristojnega organa in razumljiv povzetek vplivov za prebivalce.',
  'Okolje',
  'Zakon o vodah, Zakon o urejanju prostora in predpisi o varstvu pitne vode.',
  'Cilj je bolje zavarovati vire pitne vode, izboljsati kakovost prostorskega odlocanja in okrepiti zaupanje prebivalcev.',
  '1. clen' || chr(10) || 'Pri prostorskih aktih na vodovarstvenih obmocjih se pripravi povzetek tveganj za pitno vodo.' || chr(10) || chr(10) || '2. clen' || chr(10) || 'Povzetek in mnenje pristojnega organa se objavita pred javno razgrnitvijo.',
  'K 1. clenu: clen doloca povzetek tveganj.' || chr(10) || chr(10) || 'K 2. clenu: clen doloca cas in nacin javne objave.',
  'Predlog ne uvaja vecjih novih izdatkov, zahteva pa pripravo razumljivega povzetka strokovnih podlag.',
  'Sredstva se zagotovijo v postopkih priprave prostorskih aktov.',
  'Podobne zgodnje okoljske objave poznajo Avstrija, Nemcija in Danska.',
  'Okoljski in prostorski ucinki so pozitivni. Gospodarski ucinki so odvisni od konkretnih prostorskih projektov.',
  'Prebivalci so v komentarjih poudarili, da strokovna mnenja potrebujejo jasen povzetek v razumljivem jeziku.',
  'Jan Primc, predstavnik predlagateljev',
  'Dopolnijo se dolocbe o prostorskih aktih na vodovarstvenih obmocjih.',
  'signature_collection',
  'jan.primc@example.test',
  'Jan Primc',
  'jan.primc@example.test',
  90,
  'low',
  'ready',
  'Okolje',
  604,
  544,
  17,
  '2026-05-25 08:55:00+00',
  '2026-06-06 10:45:00+00'
),
(
  14,
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'Portal za spremljanje proracunskih transferjev',
  'Predlog uvaja uporabniku prijazen portal za spremljanje transferjev po namenih, prejemnikih in obcinah.',
  'Podatki o proracunskih transferjih obstajajo, vendar so za povprecnega uporabnika pogosto tezko razumljivi. Pobuda predlaga javni portal z iskanjem po prejemnikih, namenih, obdobjih in obcinah ter razlago kategorij v preprostem jeziku.',
  'Javne finance',
  'Zakon o javnih financah, Zakon o dostopu do informacij javnega znacaja in pravila o odprtih podatkih.',
  'Cilj je izboljsati nadzor nad javno porabo, poenostaviti razumevanje transferjev in podpreti novinarske ter civilnodruzbene analize.',
  '1. clen' || chr(10) || 'Ministrstvo, pristojno za finance, zagotovi javni portal proracunskih transferjev.' || chr(10) || chr(10) || '2. clen' || chr(10) || 'Portal omogoca iskanje po prejemniku, namenu, obdobju, obcini in viru financiranja.',
  'K 1. clenu: clen doloca vzpostavitev portala.' || chr(10) || chr(10) || 'K 2. clenu: clen doloca minimalne iskalne moznosti.',
  'Stroski so povezani z nadgradnjo prikaza podatkov in pojasnil, osnovni podatkovni viri pa ze obstajajo.',
  'Sredstva se zagotovijo iz obstojecih postavk za transparentnost javnih financ in digitalizacijo.',
  'Primerljive portale za proracunsko porabo uporabljajo Francija, Italija in Irska.',
  'Gospodarski in socialni ucinki so posredni, glavni ucinek pa je vecja transparentnost in nadzor javnosti.',
  'Uporabniki so predlagali filtre po obcinah, izvoze podatkov in kratke razlage proracunskih kategorij.',
  'Nejc Turk, predstavnik predlagateljev',
  'Dopolnijo se dolocbe, ki urejajo javno objavo podatkov o porabi proracunskih sredstev.',
  'signature_collection',
  'nejc.turk@example.test',
  'Nejc Turk',
  'nejc.turk@example.test',
  92,
  'low',
  'ready',
  'Javne finance',
  517,
  337,
  15,
  '2026-05-26 11:20:00+00',
  '2026-06-06 12:15:00+00'
),
(
  15,
  'ffffffff-ffff-4fff-8fff-ffffffffffff',
  'Dostopnost javnih spletisc za invalide',
  'Predlog uvaja redno preverjanje dostopnosti javnih spletisc in javno objavo nacrtov odprave napak.',
  'Javna spletisca in digitalne storitve niso vedno dostopne slepim, slabovidnim, gluhim in drugim uporabnikom z oviranostmi. Pobuda uvaja redne preglede, javno objavo najdenih tezav in rok za odpravo kriticnih napak pri osnovnih javnih storitvah.',
  'Digitalna drzava',
  'Zakon o dostopnosti spletnisc in mobilnih aplikacij, predpisi o enakih moznostih in pravila EU o dostopnosti.',
  'Cilj je izboljsati dostop do digitalnih javnih storitev in zagotoviti merljivo odpravljanje napak.',
  '1. clen' || chr(10) || 'Organi javnega sektorja najmanj enkrat letno preverijo dostopnost svojih spletisc.' || chr(10) || chr(10) || '2. clen' || chr(10) || 'Za kriticne napake se objavi rok odprave in odgovorna kontaktna tocka.',
  'K 1. clenu: clen doloca redno preverjanje dostopnosti.' || chr(10) || chr(10) || 'K 2. clenu: clen doloca javni nacrt odprave kriticnih napak.',
  'Predlog ima zmerne izvedbene stroske, predvsem za preglede, usposabljanja in odpravo tehnicnih napak.',
  'Sredstva se zagotovijo v okviru rednega vzdrzevanja digitalnih storitev javnega sektorja.',
  'Podobne nadzorne mehanizme poznajo Finska, Nizozemska in Irska.',
  'Socialni ucinki so pozitivni zaradi bolj enakega dostopa. Administrativni ucinki so omejeni na redno porocanje in odpravo napak.',
  'V razpravi so sodelovali uporabniki podpornih tehnologij in organizacije, ki spremljajo dostopnost javnih storitev.',
  'Irena Pavlic, predstavnica predlagateljev',
  'Dopolnijo se dolocbe o spremljanju dostopnosti javnih spletisc in mobilnih aplikacij.',
  'review',
  'irena.pavlic@example.test',
  'Irena Pavlic',
  'irena.pavlic@example.test',
  81,
  'medium',
  'needs_review',
  'Digitalna drzava',
  286,
  168,
  9,
  '2026-05-27 09:30:00+00',
  '2026-06-06 15:05:00+00'
);

-- Keep local reruns stable while leaving non-seed user data intact.
delete from votes
where initiative_id in (select id from demos_seed_initiatives)
  and (
    voter_ref like 'seed-voter-%@demos.local'
    or voter_ref in ('ana@example.test', 'bor@example.test', 'cilka@example.test', 'demo@demos.local')
  );

delete from signatures
where initiative_id in (select id from demos_seed_initiatives)
  and (
    signer_ref like 'seed-signer-%@demos.local'
    or signer_ref in ('ana@example.test', 'bor@example.test', 'demo@demos.local')
  );

delete from comments
where initiative_id in (select id from demos_seed_initiatives)
  and id::text like 'cccccccc-cccc-4ccc-8ccc-%';

delete from initiative_ai_reviews
where initiative_id in (select id from demos_seed_initiatives)
  and id::text like 'dddddddd-dddd-4ddd-8ddd-%';

delete from system_analytics_events
where id::text like 'eeeeeeee-eeee-4eee-8eee-%';

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
select
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
  jsonb_build_array(
    'Predlog ima jasno opredeljen problem in pricakovani ucinek.',
    'Vsebuje pravne oporne tocke, besedilo clenov in obrazlozitev.',
    case
      when ai_risk = 'high' then 'AI opozarja na visoka financna ali izvedbena tveganja.'
      when ai_risk = 'medium' then 'AI predlaga dodatni uredniski pregled pred nadaljnjim postopkom.'
      else 'Ni ocitnih opozoril v osnovnem pregledu.'
    end
  ),
  jsonb_build_object(
    'suitability', ai_suitability,
    'completeness', jsonb_build_object('score', case when ai_suitability = 'ready' then 100 when ai_suitability = 'needs_review' then 92 else 74 end),
    'categorySuggestion', jsonb_build_object('category', suggested_category, 'confidence', 82 + (ordinal % 13)),
    'provider', 'local',
    'model', 'local-rule-engine-v1'
  ),
  updated_at,
  created_at,
  updated_at
from demos_seed_initiatives
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
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

insert into votes (id, initiative_id, voter_ref, voter_name, created_at)
select
  gen_random_uuid(),
  s.id,
  format('seed-voter-%s-%s@demos.local', lpad(s.ordinal::text, 2, '0'), lpad(v.n::text, 4, '0')),
  format('Podpornik %s/%s', lpad(s.ordinal::text, 2, '0'), lpad(v.n::text, 4, '0')),
  s.created_at
    + ((v.n / 125)::text || ' days')::interval
    + ((v.n % 24)::text || ' hours')::interval
    + ((v.n % 53)::text || ' minutes')::interval
from demos_seed_initiatives s
cross join lateral generate_series(1, s.vote_target) as v(n)
on conflict (initiative_id, voter_ref) do update set
  voter_name = excluded.voter_name,
  created_at = excluded.created_at;

insert into signatures (id, initiative_id, signer_ref, signer_name, method, created_at)
select
  gen_random_uuid(),
  s.id,
  format('seed-signer-%s-%s@demos.local', lpad(s.ordinal::text, 2, '0'), lpad(sig.n::text, 4, '0')),
  format('Podpisnik %s/%s', lpad(s.ordinal::text, 2, '0'), lpad(sig.n::text, 4, '0')),
  case when sig.n % 6 = 0 then 'sipass' else 'demo' end,
  s.created_at
    + '3 days'::interval
    + ((sig.n / 90)::text || ' days')::interval
    + ((sig.n % 20)::text || ' hours')::interval
    + ((sig.n % 47)::text || ' minutes')::interval
from demos_seed_initiatives s
cross join lateral generate_series(1, s.signature_target) as sig(n)
on conflict (initiative_id, signer_ref) do update set
  signer_name = excluded.signer_name,
  method = excluded.method,
  created_at = excluded.created_at;

insert into comments (id, initiative_id, author_ref, author_name, body, created_at)
select
  ('cccccccc-cccc-4ccc-8ccc-' || lpad((s.ordinal * 1000 + c.n)::text, 12, '0'))::uuid,
  s.id,
  format('seed-commenter-%s-%s@demos.local', lpad(s.ordinal::text, 2, '0'), lpad(c.n::text, 2, '0')),
  format('Komentator %s/%s', lpad(s.ordinal::text, 2, '0'), lpad(c.n::text, 2, '0')),
  case c.n % 8
    when 0 then 'Podpiram pobudo, ker je problem jasno opisan in ima predlog merljiv ucinek.'
    when 1 then 'Dobro bi bilo dodati se izvedbeni rok in odgovorni organ za prvo porocilo.'
    when 2 then 'Predlog je uporaben, ce bodo podatki objavljeni v odprtem formatu in brez nepotrebnih ovir.'
    when 3 then 'Manjka mi kratka ocena, koliko casa bi organi potrebovali za prilagoditev postopkov.'
    when 4 then 'Pomembno je, da se v resitev vkljuci tudi manjse obcine in javne zavode.'
    when 5 then 'Predlog bi moral imeti pilotno obdobje, da se preverijo stroski in odziv uporabnikov.'
    when 6 then 'Strinjam se z namenom, pri financiranju pa bi potrebovali bolj konkretno razdelitev virov.'
    else 'Tak ukrep bi povecal zaupanje javnosti, ce bodo rezultati redno posodobljeni.'
  end,
  s.created_at
    + '5 days'::interval
    + ((c.n * 7)::text || ' hours')::interval
    + ((s.ordinal % 9)::text || ' minutes')::interval
from demos_seed_initiatives s
cross join lateral generate_series(1, s.comment_target) as c(n)
on conflict (id) do update set
  initiative_id = excluded.initiative_id,
  author_ref = excluded.author_ref,
  author_name = excluded.author_name,
  body = excluded.body,
  created_at = excluded.created_at;

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
select
  ('dddddddd-dddd-4ddd-8ddd-' || lpad(ordinal::text, 12, '0'))::uuid,
  id,
  'local',
  'local-rule-engine-v1',
  ai_score,
  ai_risk,
  ai_suitability,
  suggested_category,
  jsonb_build_array(
    'Predlog vsebuje povzetek, opis problema in pricakovane ucinke.',
    'Besedilo clenov je pripravljeno za demo obravnavo.',
    case
      when ai_risk = 'high' then 'Priporocena je dodatna financna presoja pred objavo.'
      when ai_risk = 'medium' then 'Priporocen je uredniski pregled zaradi izvedbenih ali proracunskih posledic.'
      else 'Predlog je primeren za nadaljnjo obravnavo.'
    end
  ),
  jsonb_build_object(
    'completeness', jsonb_build_object('score', case when ai_suitability = 'ready' then 100 when ai_suitability = 'needs_review' then 92 else 74 end),
    'suitability', ai_suitability,
    'categorySuggestion', jsonb_build_object('category', suggested_category, 'confidence', 82 + (ordinal % 13)),
    'seedTargets', jsonb_build_object('votes', vote_target, 'signatures', signature_target, 'comments', comment_target)
  ),
  jsonb_build_object('seed', true, 'reviewedBy', 'local-rule-engine-v1'),
  updated_at
from demos_seed_initiatives
on conflict (id) do update set
  initiative_id = excluded.initiative_id,
  provider = excluded.provider,
  model = excluded.model,
  score = excluded.score,
  risk = excluded.risk,
  suitability = excluded.suitability,
  suggested_category = excluded.suggested_category,
  findings = excluded.findings,
  checks = excluded.checks,
  raw_response = excluded.raw_response,
  created_at = excluded.created_at;

insert into system_analytics_events (id, event_type, source, user_ref, user_role, session_id, path, data, created_at)
select
  ('eeeeeeee-eeee-4eee-8eee-' || lpad(e.n::text, 12, '0'))::uuid,
  case e.n % 10
    when 0 then 'initiative_docx_download'
    when 1 then 'data_load'
    when 2 then 'search_submitted'
    when 3 then 'initiative_opened'
    when 4 then 'vote_created'
    when 5 then 'comment_created'
    when 6 then 'signature_started'
    when 7 then 'analytics_viewed'
    when 8 then 'status_filter_changed'
    else 'initiative_odt_download'
  end,
  case when e.n % 6 = 0 then 'server' else 'frontend' end,
  format('seed-user-%s@demos.local', lpad(((e.n * 37) % 240 + 1)::text, 3, '0')),
  case when e.n % 17 = 0 then 'admin' else 'user' end,
  format('seed-session-%s', lpad(((e.n * 11) % 35 + 1)::text, 2, '0')),
  case e.n % 5
    when 0 then '/analytics'
    when 1 then '/'
    when 2 then '/initiatives'
    when 3 then '/initiative/' || s.id::text
    else '/search'
  end,
  jsonb_build_object(
    'initiativeId', s.id,
    'initiativeTitle', s.title,
    'status', s.status,
    'category', s.category,
    'seedTotalInitiatives', 15,
    'seedVotesForInitiative', s.vote_target,
    'seedSignaturesForInitiative', s.signature_target
  ),
  '2026-06-01 08:00:00+00'::timestamptz + ((e.n * 37)::text || ' minutes')::interval
from generate_series(1, 90) as e(n)
join demos_seed_initiatives s on s.ordinal = ((e.n - 1) % 15) + 1
on conflict (id) do update set
  event_type = excluded.event_type,
  source = excluded.source,
  user_ref = excluded.user_ref,
  user_role = excluded.user_role,
  session_id = excluded.session_id,
  path = excluded.path,
  data = excluded.data,
  created_at = excluded.created_at;

drop table if exists pg_temp.demos_seed_initiatives;
