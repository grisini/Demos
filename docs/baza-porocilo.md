# Porocilo o zasnovi baze

## Namen baze

Baza je bila zasnovana za prototip spletne platforme **Demokracija 2.0**, kjer uporabniki oddajajo zakonodajne pobude, glasujejo, komentirajo in spremljajo analitiko ter osnovno AI presojo pobud.

Glavni cilj zasnove je bil:

- podpreti osnovne funkcionalnosti aplikacije,
- ohraniti model dovolj enostaven za prototip,
- hkrati pa pripraviti podatkovno strukturo, ki jo je mogoce razsiriti za nadaljnji razvoj.

Baza je implementirana v **Supabase PostgreSQL**, ker omogoca hitro vzpostavitev relacijske baze, REST dostop do tabel in podporo za Row Level Security.

## Zakaj taka zasnova

Pri nacrtovanju baze sem izhajal iz dejanske strukture aplikacije v kodi:

- `src/domain/validation.js` doloca poslovna pravila, statuse, kategorije in AI oceno,
- `src/lib/supabase.js` doloca, katera polja aplikacija bere in zapisuje v bazo,
- `src/domain/analytics.js` doloca, katere agregacije in metrike aplikacija potrebuje.

Zaradi tega je bila izbrana **relacijska zasnova**, kjer je entiteta `initiatives` jedro sistema, ostale tabele pa predstavljajo povezane dogodke oziroma interakcije uporabnikov:

- glasovi,
- podpisi,
- komentarji,
- AI pregledi.

Tak pristop je primeren zato, ker:

- ena pobuda lahko vsebuje vec glasov, podpisov in komentarjev,
- relacije `1:N` so v PostgreSQL preproste in pregledne,
- agregacije za analitiko so lazje izvedljive z SQL view-i,
- podatki ostanejo normalizirani in se ne podvajajo po nepotrebnem.

## Pregled podatkovnega modela

Osnovna entiteta je:

- `initiatives`

Na njo so vezane naslednje odvisne entitete:

- `votes`
- `signatures`
- `comments`
- `initiative_ai_reviews`

Logika relacij:

- ena pobuda ima lahko vec glasov,
- ena pobuda ima lahko vec podpisov,
- ena pobuda ima lahko vec komentarjev,
- ena pobuda ima lahko vec AI pregledov.

To pomeni, da je model zasnovan po principu:

- `initiatives 1:N votes`
- `initiatives 1:N signatures`
- `initiatives 1:N comments`
- `initiatives 1:N initiative_ai_reviews`

## Opis tabel

### `initiatives`

Tabela `initiatives` predstavlja glavni zapis pobude.

Shranjuje:

- identifikator pobude (`id`),
- naslov (`title`),
- kratek povzetek (`summary`),
- podrobno obrazlozitev (`description`),
- kategorijo (`category`),
- pravno podlago (`legal_reference`),
- pricakovani ucinek (`expected_impact`),
- status pobude (`status`),
- avtorja pobude (`author_ref`, `author_name`),
- rezultat AI ocene (`ai_score`, `ai_risk`, `ai_findings`, `ai_checks`),
- cas ustvaritve in posodobitve (`created_at`, `updated_at`).

Ta tabela je centralna, ker aplikacija vsebine na dashboardu, detail pogledu in pri analitiki gradi prav iz teh podatkov.

### `votes`

Tabela `votes` hrani glasove uporabnikov za posamezno pobudo.

Shranjuje:

- identifikator glasu,
- povezavo na pobudo (`initiative_id`),
- identifikator uporabnika (`voter_ref`),
- ime uporabnika (`voter_name`),
- cas oddaje glasu.

Dodana je omejitev:

- `unique (initiative_id, voter_ref)`

S tem se zagotovi pravilo:

- en uporabnik lahko za isto pobudo glasuje samo enkrat.

### `signatures`

Tabela `signatures` je locena od glasov, ker podpis v aplikaciji predstavlja drugacen tip podpore kot navaden glas.

Shranjuje:

- identifikator podpisa,
- povezavo na pobudo,
- identifikator podpisnika,
- ime podpisnika,
- nacin podpisa (`method`), npr. `demo` ali kasneje `sipass`,
- cas podpisa.

Tudi tukaj je uporabljena omejitev:

- `unique (initiative_id, signer_ref)`

S tem se prepreci podvajanje podpisov iste osebe.

### `comments`

Tabela `comments` hrani javno razpravo ob pobudah.

Shranjuje:

- identifikator komentarja,
- povezavo na pobudo,
- avtorja komentarja,
- vsebino komentarja (`body`),
- cas objave.

Nad poljem `body` je dodan `check`, ki omeji dolzino komentarja med 3 in 2000 znaki. S tem je usklajena validacija med aplikacijo in bazo.

### `initiative_ai_reviews`

Tabela `initiative_ai_reviews` je pripravljena za kasnejso razsiritev AI funkcionalnosti.

Trenutno aplikacija uporablja osnovno lokalno oceno pobude, vendar je smiselno hraniti tudi zgodovino AI pregledov, zato tabela vsebuje:

- ponudnika AI storitve (`provider`),
- model (`model`),
- numericni rezultat (`score`),
- stopnjo tveganja (`risk`),
- oceno ustreznosti (`suitability`),
- predlagano kategorijo,
- seznam ugotovitev (`findings`),
- dodatne kontrole (`checks`),
- surov odgovor modela (`raw_response`).

Ta zasnova omogoca revizijsko sled, ce bi kasneje AI pregled tekocih pobud izvajali prek zunanjega modela ali backend storitve.

## Uporaba enum tipov

V bazi so uporabljeni posebni PostgreSQL `enum` tipi:

- `initiative_status`
- `initiative_category`
- `ai_risk_level`
- `ai_suitability`

To je bilo izbrano zato, ker aplikacija uporablja koncen seznam dovoljenih vrednosti. Prednost enumov je:

- bolj stroga validacija na nivoju baze,
- manj moznosti za nekonsistentne podatke,
- bolj jasen podatkovni model.

Na primer:

- status pobude ne more biti poljubno besedilo,
- kategorija ne more vsebovati napacnih ali razlicno zapisanih vrednosti,
- AI ocena tveganja ostane omejena na `low`, `medium`, `high`.

## Omejitve in integriteta podatkov

Da baza ne bi sprejemala neveljavnih podatkov, so bili dodani naslednji mehanizmi:

- `primary key` na vseh glavnih tabelah,
- `foreign key` povezave na `initiative_id`,
- `on delete cascade` pri odvisnih tabelah,
- `check` omejitve za dolzino besedil,
- `check` omejitve za `ai_score`,
- `unique` omejitve na glasovih in podpisih.

Uporaba `on delete cascade` pomeni, da se ob brisanju pobude avtomatsko pobrisejo tudi pripadajoci glasovi, podpisi, komentarji in AI pregledi. To ohranja referencno integriteto in preprecuje osirotele zapise.

## Casovna polja in trigger

V bazi so uporabljena casovna polja:

- `created_at`
- `updated_at`
- `ai_reviewed_at`

Za samodejno posodabljanje `updated_at` je definiran trigger `initiatives_set_updated_at`, ki poklice funkcijo `set_updated_at()`.

To je smiselno zato, ker:

- aplikacija pogosto spreminja status pobude,
- ob aktivnosti nad pobudo je pomembno vedeti, kdaj je bila zadnjic posodobljena,
- analitika uporablja tudi podatek o zadnji aktivnosti.

## Indeksi

Dodani so indeksi na stolpcih, ki se pogosto uporabljajo pri iskanju in agregaciji:

- `initiatives(status)`
- `initiatives(category)`
- `initiatives(created_at desc)`
- `votes(initiative_id)`
- `signatures(initiative_id)`
- `comments(initiative_id)`
- `comments(created_at asc)`
- `initiative_ai_reviews(initiative_id)`
- `initiative_ai_reviews(created_at desc)`

Razlog za indekse je hitrejse:

- filtriranje pobud po statusu in kategoriji,
- nalaganje povezanih zapisov po `initiative_id`,
- urejanje po casu nastanka ali aktivnosti,
- izvajanje analitike.

## Pogledi (views)

Za poenostavitev branja podatkov in analitike sta bila ustvarjena dva glavna pogleda ter en sestavljen pogled za detajl pobude.

### `initiative_detail`

Ta pogled zdruzi:

- osnovne podatke pobude,
- seznam glasov v JSON obliki,
- seznam podpisov v JSON obliki,
- seznam komentarjev v JSON obliki.

Namen tega pogleda je, da lahko frontend v prihodnje v enem klicu dobi celoten detajl pobude, brez vec locenih poizvedb nad razlicnimi tabelami.

### `initiative_analytics`

Ta pogled izracuna:

- stevilo glasov,
- stevilo podpisov,
- stevilo komentarjev,
- skupno podporo,
- delez glasov,
- konverzijo glasov v podpise,
- engagement score,
- zadnjo aktivnost.

To je pomembno zato, ker aplikacija v modulu `analytics.js` prikazuje prav take metrike, zato je del logike smiselno prestaviti tudi na nivo baze.

### `category_analytics`

Ta pogled agregira podatke po kategorijah in vrne:

- stevilo pobud,
- stevilo glasov,
- stevilo podpisov,
- stevilo komentarjev,
- povprecno AI oceno,
- povprecno stevilo glasov.

Tak pogled je uporaben za dashboard in porocila, kjer zelimo hitro dobiti povzetek po vsebinskih podrocjih.

## Varnost in RLS

Vse glavne tabele imajo vklopljen:

- `Row Level Security`

Trenutno so v prototipu dodane odprte politike za branje in pisanje z anon kljucem. To je bilo narejeno zato, da je bilo mogoce hitro testirati frontend neposredno iz brskalnika.

Tak pristop je sprejemljiv za razvojni demo, ni pa primeren za produkcijo.

Za produkcijsko uporabo bi bilo treba:

- pisanje premakniti na backend ali Supabase Edge Function,
- uporabljati preverjeno identiteto uporabnika,
- omejiti spreminjanje statusov samo na moderatorje,
- skriti oziroma minimizirati osebne podatke,
- dodati revizijsko sled in rate limiting.

## Povezava med bazo in aplikacijo

Frontend uporablja repozitorij `SupabaseInitiativeRepository` v datoteki `src/lib/supabase.js`.

Ta repozitorij:

- bere pobude iz `initiatives`,
- bere povezane glasove iz `votes`,
- bere podpise iz `signatures`,
- bere komentarje iz `comments`,
- zapisuje nove pobude, glasove, podpise in komentarje,
- posodablja status pobude.

To pomeni, da je baza neposredno vezana na UI in poslovno logiko aplikacije.

Pomembna odlocitev je bila, da se poimenovanja v bazi prilagodijo PostgreSQL slogu:

- frontend uporablja `camelCase`,
- baza uporablja `snake_case`.

Zato repozitorij opravlja mapiranje med:

- `legalReference` <-> `legal_reference`
- `expectedImpact` <-> `expected_impact`
- `createdAt` <-> `created_at`
- `updatedAt` <-> `updated_at`

Tak pristop omogoca cistejso bazo in hkrati ne spreminja strukture frontend objektov.

## Prednosti izbrane resitve

Glavne prednosti te baze so:

- model je dovolj enostaven za prototip,
- relacije so logicne in dobro podpirajo funkcionalnosti aplikacije,
- podatki so normalizirani,
- AI podatki so pripravljeni za razsiritev,
- analitika je podprta ze na nivoju SQL pogledov,
- zasnova je primerna za nadaljnji prehod v produkcijsko resitev.

## Slabosti in mozne izboljsave

Ker gre za prototip, so v zasnovi tudi zavestni kompromisi:

- uporabniski podatki se trenutno hranijo zelo preprosto (`author_ref`, `author_name`) brez posebne uporabniske tabele,
- RLS politike so prevec odprte za produkcijo,
- AI rezultat je delno podvojen v `initiatives` in `initiative_ai_reviews`,
- frontend trenutno pri branju pobude uporablja vec REST klicev namesto enega optimiziranega pogleda.

Mozne izboljsave:

- uvedba posebne tabele `users` ali povezava na `auth.users`,
- prehod na strozje dostopne politike,
- uporaba `initiative_detail` pogleda v frontend repozitoriju,
- uvedba moderatorjev in vlog,
- locevanje javnih in zasebnih podatkov o uporabnikih,
- dodaten audit log za spremembe statusa.

## Zakljucek

Baza je zasnovana tako, da podpira vse kljucne funkcionalnosti prototipa Demokracija 2.0:

- oddajo pobud,
- glasovanje,
- podpisovanje,
- komentiranje,
- AI predpregled,
- osnovno analitiko.

Pri zasnovi sem sledil dejanski strukturi aplikacije in poslovnim pravilom v kodi, zato je shema usklajena z implementacijo in pripravljena za nadaljnjo nadgradnjo. Resitev je primerna za razvojni in predstavitveni namen, hkrati pa vsebuje dovolj dobrih osnov za poznejsi prehod v bolj varen in razsirljiv produkcijski sistem.
