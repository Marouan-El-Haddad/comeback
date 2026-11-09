# Review af NAT-3 P2, del 3 – figurerne til lyske, nakke, Open & Strong, opvarmning, klubsekvensen og målingerne

2026-11-09 · da9abf8 (fletningen 196bb1e og trænernes tekster i `git diff d92a6e2 da9abf8 -- content/explain/`) · worktree `scratchpad/wt/p3b`

Metode:

- **Læst** mod:
  - NAT-3 pakke 2 og brugerens feedback;
  - `docs/runs/NAT-3-FIGURES.md` og `tools/pictos/README.md`;
  - SPEC 3.8, 5, 6 og 9.1 samt D48, D56, D58 og D60;
  - PROGRAM_KILDE: Lyske, Nakke-stigen, Open & Strong, Opvarmning (med »Øvelser, du måske ikke kender«), Klubsekvensen og Målinger.
- **Kørt i worktreen:** `node scripts/check-explain.ts` på de 12 forklarings- og figurfiler: alle OK.
- **Kontaktark** i dobbelt opløsning, og filmstrimler for hver bevægelse hvert 0,05–0,5 sek tegnet med `src/figure` (`viewModels`, `poseAt`, `solve`). Leddenes punkter er målt i hver position, via-pose og fejl.
- **Kortet i `pixel9a`:**
  - Firefox uden JIT, 414 × 847, DSF 2;
  - `e2e/review/cards.html` på 127.0.0.1:4188 med `page.clock` stoppet midt i de faser, der er beskrevet;
  - reduceret bevægelse og fejlparrene foldet ud;
  - vandret overløb målt på alle 129 kort;
  - markeringens synlighed målt hvert 0,1 sek på `measures.base_check`.
- **»Nu«:** `screenshots/maaling-nu.png` og `os-nu.png` fra da9abf8. Trin 1 er udgangspunktet overalt (onboarding med standardvalg), så tirsdag 10/11 er det N1, lyske 1 og målingerne væg-test, push-ups og bord-rows.
- **Afprøvede rettelser** i scratch-kopier uden for repoet (check-explain OK, kontaktark eller filmstrimmel set):
  - det nederste ben i `groin.2–5`;
  - via'erne i `neck.N5 › mave`, `os.2`, spiderman og skyggeboksning;
  - fejlparret i kosak-squat.

## Resultat

52 figurer: **34 godkendt, 18 afvist.** Fund: **1 høj, 13 middel og 9 lav.**

- **Det virker:**
  - Alle 12 filer består tjekket, og alt er animeret. Ingen led bøjer forkert i positionerne.
  - Tirsdagens målinger (væg-test, push-ups max, bord-rows max) er rigtige og læselige på kortet og i »Nu«. Lyske 1 er godkendt.
  - Klubsekvensen C1–C5 og målingerne er tegnet med omhu. Alle ti målinger, der kan vises, har et tydeligt fejlpar.
- **Det, der skal rettes først:**
  - **os.1:** brystryggen bøjer i nakken i stedet for over håndklædet (høj). Rutinen tages hver dag.
  - **Nakke N1 og N2:** skuldrene synker i stedet for, at hagen trækkes ind. Det skyldes motoren (M10). Nakken tages hver tirsdag og fredag.
  - **Copenhagen-plankerne:** det nederste ben hviler i gulvet.
  - **Opvarmningen:**
    - spiderman-armen svinger bagud langs kroppen;
    - kosak-fejlparret viser den forkerte fejl;
    - drejningen i hip airplane kan ikke ses.
  - **Markeringer:** i os.4 og os.5 dækker teksten hænderne og hovedet.
  - **Pike-kortet** er bredere end skærmen (fredag 13/11).

## Alle figurer

| Fil › punkt › bevægelse | Status | Grund |
|---|---|---|
| groin › groin.1 | Godkendt | Forfra er rigtigt for et løft i frontalplanet. Benet løftes strakt ca. 20 cm (12,6 enh.), 2 sek op og 3 sek ned som dosis. Fejlpar 2 (tæerne mod loftet) er tydeligt. Lav: den øverste hånd ses ikke (L4) |
| groin › groin.2 | Afvist (M1) | Det nederste ben ser ud til at hvile i gulvet i »Planke«. Ellers rigtigt: albuen under skulderen, knæet på sofakanten, kroppen lige og fejlparret med hængende hofte |
| groin › groin.3 | Afvist (M1) | Som groin.2 i »Planke« og »Hoften nede« |
| groin › groin.4 | Afvist (M1) | Som groin.2. Programmet siger selv »Det nederste ben hænger frit«. Lav: gradtallet 180° står langt fra buen (L5) |
| groin › groin.5 | Afvist (M1) | »Hænger strakt lige over gulvet« ser ud som foden i gulvet |
| neck › N1 | Afvist (M2, M10) | Skuldrene synker 3,2, og hagen ses kun som mærket. Fejlparret viser en løftet overkrop |
| neck › N2 | Afvist (M2, M10) | Som N1 i »Hagen ind«. Løftet og fejlparret (mavebøjning) er tydelige |
| neck › N3 › pande | Godkendt | Hånden går til panden med albuen frem, hovedet står stille, og »Halv kraft« står i holdet |
| neck › N3 › baghoved | Godkendt | Hånden ligger på baghovedet. Fasens tekst gør kortet for bredt (M13) |
| neck › N3 › sider | Godkendt | Forfra: hånden over venstre øre med albuen ud til siden og hovedet lodret |
| neck › N4 › pande | Godkendt | Som N3 med »80 % kraft« |
| neck › N4 › baghoved | Godkendt | Som N3 (M13) |
| neck › N4 › sider | Godkendt | Som N3 |
| neck › N5 › ryg | Godkendt | Skuldrene ved kanten, hovedet ude over den og hånden under baghovedet. Armen svinger frit op og ned langs siden |
| neck › N5 › mave | Afvist (M3) | Via'en sætter overarmen lodret op bag ryggen |
| neck › N5 › side | Godkendt | Forfra: hovedet ude over kanten. Via'en med strakt arm skifter albuens side rent |
| neck › N6 › frem | Godkendt | Hovedet bøjer ca. 40° frem, og hånden følger |
| neck › N6 › bagud | Godkendt | Hovedet bøjer ca. 30° bagud, og blikket går skråt op |
| neck › N6 › sider | Godkendt | Forfra: øret går mod skulderen, mens hånden holder imod |
| os › os.1 | Afvist (H1) | Bøjningen sker i nakken, ikke over håndklædet |
| os › os.2 | Afvist (M4) | Ovenfra går armen hen over hovedet, og brystets drejning ses ikke |
| os › os.3 | Afvist (M5) | Y'et kan ikke ses fra siden |
| os › os.4 | Afvist (M6) | Figuren er rigtig: underarmene mod væggen, glid til Y og løft 2,6. Men cuen dækker hænderne under »Løft 2 cm« |
| os › os.5 | Afvist (M6) | Hovedet glider 2,8 bagud, men cuen dækker hovedet i hele holdet. Ansigtet vipper desuden 14° op (M10) |
| os › os.6 | Godkendt | Knæet på håndklædet ved sofaen, skinnebenet op ad forkanten og forreste knæ 90° over anklen. Overkroppen rejser sig, og »Klem ballen« står i holdet |
| warmup › warmup.1 › sjip | Godkendt | På forfødderne, et lille hop på 0,25 + 0,25 sek og fejlparret med tunge hæle |
| warmup › warmup.1 › skygge | Afvist (L1) | De lige slag går i en bue op over hovedhøjde, og cuen blinker |
| warmup › warmup.2 › spiderman | Afvist (M7) | Positionerne og fejlparret er gode, men armen svinger bagud langs kroppen for at nå lodret |
| warmup › warmup.2 › kosak | Afvist (M8) | Bevægelsen forfra er god, men fejlparret viser knæet, der falder ind, ikke hælen |
| warmup › warmup.2 › katko | Godkendt | Kat med rund ryg og hagen ind, ko med svaj og blikket op. Fejlparret med bøjede arme er tydeligt |
| warmup › warmup.3 › haandled | Godkendt | Skuldrene vipper 7 frem over flade hænder. Fejlparret med håndroden, der letter, er tydeligt |
| warmup › warmup.3 › skulderblad | Godkendt | Brystet synker med strakte arme. Lav: overarmen forkortes 18 % (L8) |
| warmup › warmup.3 › airplane | Afvist (M9, M11) | Bækkenets drejning ses ikke; det ligner et benløft |
| warmup › warmup.4 › pogo | Godkendt | Korte hop på forfødderne med næsten strakte knæ, 0,2 + 0,2 sek. Lav: fejlringen står ved hovedet (L6) |
| club_sequence › C1 | Godkendt | Midten 90° (tegnet 94°) med vinkel, nede lige over gulvet og 10 mikro-pumps à 0,8 sek. Linjen »Kroppen lige« og fejl 1 og 2 er tydelige (L6) |
| club_sequence › C2, C3, C4 | Godkendt | Som C1 med fejl 2 og 3 |
| club_sequence › C5 | Godkendt | Knyttede næver med underarm og næve på én linje i alle positioner. Fejlparret med knækket håndled er tydeligt |
| club_sequence › C6 | Afvist (L2) | Diamanten og albuerne tæt ind kan ikke ses fra siden |
| measures › wall_test | Godkendt | Hæle, baller og skulderblade mod væggen, baghovedet ca. 3 cm fra den og fingrene ind bag hovedet. Fejlparret med løftet hage er tydeligt |
| measures › pushups | Godkendt | Brystet ned til knytnæve-linjen (5 enh.), 1 + 1 sek og fejlparret med for lidt dybde |
| measures › table_rows | Godkendt | Strakte arme med skuldrene lidt inde under bordet (rigtigt, hælene er omdrejningspunkt) og brystet til kanten. Fejlparret med hængende hofte er tydeligt |
| measures › burpee_3min | Godkendt | Som E1 med via'er: brystet i gulvet og hop med strakt hofte. Fejlpar 2 er tydeligt |
| measures › base_check | Afvist (L3) | Løbet er fint, men »Tale-tempo« blinker |
| measures › cooper | Godkendt | Hurtigt løb på stedet, på forfoden med knæløft |
| measures › pike | Godkendt | Figuren er god, men fasens tekst gør kortet for bredt (M13) |
| measures › hollow | Godkendt | Lænden i gulvet, hælene 20 cm oppe (linje) og fejlparret med lænden, der løfter sig |
| measures › side_plank | Godkendt | Forfra: albuen under skulderen og fødderne oven på hinanden. Linjen »Hoften op« og fejlparret med hængende hofte er tydelige |
| measures › wall_sit | Godkendt | 90° ved knæet og ryggen, der glider ned ad væggen. Fejl 1 er tydelig (L6) |
| measures › balance | Godkendt | Forfra: højre fod en håndsbredde oppe og fri af standbenet, og fejl 2 er tydelig (M13: 1 px) |
| measures › nordic_depth | Godkendt | Hælene under sofaen og knæene på puden. Kvart, halv og helt ned i lige linje, og fejlparret med knæk i hoften |

## Afviste figurer og fund

### H1 – os.1: bøjningen sker i nakken, ikke over håndklædet
- **Alvor:** høj.
- **Hvor:**
  - `content/figures/os.json:12–44`;
  - kortet og »Nu« i Open & Strong: `screenshots/os-nu.png` og `screenshots/review-p2-3-os1-knaek-i-nakken.png`.
- **Hvorfor:**
  - **Kilden:** programmet siger »et sammenrullet håndklæde under brystryggen« (PROGRAM_KILDE, Open & Strong 1). Forklaringen siger »den øvre ryg bøjer bagover hen over det« og »Mærk: ... midt i den øvre ryg ..., ikke i lænden eller nakken«.
  - **Ryggen er en rampe:** skulderen (y 12,2 / 11,2 / 10,9) er ryggens højeste punkt og ligger over ryggen ved håndklædet (ca. 10,5).
  - **Bøjningen ligger i nakken:** hovedets midte er 3,6 under skulderen, og halsen går 20° under vandret. Det er netop typisk fejl 3, »Nakken strammer, fordi hovedet hænger«.
  - Rutinen tages hver dag.
- **Rettelse:** i alle tre positioner:
  - mindre `torso` (ca. 5–8°) og en stærkere bue (`spine` ca. −3 til −4), så ryggens top hviler på håndklædet, og skuldrene falder bag det;
  - `head` ca. 0 til −10, så hovedet ligger i forlængelse af den øvre ryg, båret af hænderne i gulvet (som nu).
  - **Tjek på kontaktarket:** skulderen ligger ikke over ryggen ved håndklædet, og hovedets midte ligger ikke under skulderen.

### M1 – groin.2–5: det nederste ben hviler i gulvet
- **Alvor:** middel.
- **Hvor:**
  - `content/figures/groin.json:86` (groin.2 › plank), `:126` og `:140` (groin.3 › plank og dip) samt `:183` og `:215` (groin.4 › plank og groin.5 › down);
  - kortet: `screenshots/review-p2-3-lyske-nederste-ben-i-gulvet.png`.
- **Hvorfor:**
  - Positionerne siger »Nederste ben hænger frit (lige over gulvet)« og i groin.5 »hænger strakt«. Programmet siger for trin 4: »Det nederste ben hænger frit« (PROGRAM_KILDE, Lyske).
  - Anklen står 2,8–3 over gulvet, og benets runde ende (radius 3,3) når gulvlinjen. Foden ser derfor ud til at støtte, og så er det en lettere øvelse.
- **Rettelse** (afprøvet, filen består check-explain):
  - `groin.2` og `groin.3 › plank`: near `{ "to": [6.5, 7.5], "bend": 1, "upper": 12.19, "lower": 11.5 }`.
  - `groin.3 › dip`: near `{ "to": [4, 6.5], "bend": 1, "upper": 12.5, "lower": 11.5 }`.
  - `groin.4 › plank` og `groin.5 › down`: near `{ "to": [0.62, 7], "bend": 1 }`. Benet er strakt og 47 fra hoften, som »hænger strakt« kræver.
  - `groin.5` får `transitions` med `lift: ["near.foot"]` begge veje, ellers glider foden på sofaens forkant.
  - Et strakt, forkortet ben i groin.2 og groin.3 rammer sofaens forkant, derfor knæet bøjet dér.

### M2 – neck.N1 og N2: skuldrene synker i stedet for, at hagen trækkes ind
- **Alvor:** middel.
- **Hvor:**
  - `content/figures/neck.json:12–31` (torso 176,96 → 183,11), `:34–44` (N1's fejlpar) og `:53–82` (N2);
  - `screenshots/review-p2-3-n1-skuldre-synker.png` og `review-p2-3-n1-fejlpar.png`.
- **Hvorfor:**
  - **Kilden:** programmet siger »Træk hagen ind, og pres baghovedet blidt mod gulvet«. Positionen siger »Baghovedet presser blidt i gulvet ... Hovedet løfter sig ikke«. Skuldrene ligger stille.
  - **Figuren:**
    - i »Hvile« svæver den øvre ryg 2,3 over gulvet (skulderen i y 6,6 med overkroppens halve tykkelse 4,3);
    - i »Hagen ind« synker skuldrene 3,2 (ca. 6 cm) ned til 0,9 inde i gulvet, mens halsen vipper op mod hovedet;
    - det synlige er altså en skulderbevægelse, der ikke hører til, og hagen ses kun på mærket, der drejer 17°.
  - **Fejlparret** »Hagen peger op« løfter overkroppen 10 over gulvet. Det ligner en nakkebro, som programmet forbyder uden træner, og hagen kan ikke ses.
  - N1 er brugerens trin, og nakken tages hver tirsdag og fredag.
- **Rettelse:**
  - Kræver M10.
  - **Derefter:**
    - overkroppen ligger stille på gulvet i alle positioner (`torso` ca. 181,3, skulderen 4,3 over gulvet);
    - »Hagen inde« er kun et nik på −15 til −20°, så mærket flytter sig mindst 2;
    - N2 »Løftet« løfter hovedet 2 med nikket bevaret;
    - cuen »Hagen ind« står ved hovedet i fase 1.
  - **Nu:** fjern N1's fejlpar. Tegn det igen som et nik på +20° med skuldrene i gulvet, når M10 er lavet.

### M3 – neck.N5 › mave: overarmen går lodret op bag ryggen
- **Alvor:** middel.
- **Hvor:**
  - `content/figures/neck.json:392–416`: begge via'er har near `to` [34; 42], så albuen står i [19,8; 47,0];
  - `screenshots/review-p2-3-n5-mave-arm-bag-ryggen.png`.
- **Hvorfor:**
  - På maven betyder en lodret overarm ca. 90° ekstension i skulderen, mere end skulderen kan (ca. 50–60°).
  - Hånden går i en bue op over hovedet og ned bag ryggen.
  - Leddene skal bøje anatomisk, også midt i bevægelsen (SPEC 9.1, D56).
- **Rettelse** (afprøvet, består check-explain): begge via'er får near `{ "to": [28, 33], "upper": 8, "lower": 10, "tip": [34, 32.5] }`.
  - Hånden føres tilbage langs siden af brystet lige over sengen med albuen ud til siden.

### M4 – os.2 åben bog: armen går hen over hovedet
- **Alvor:** middel.
- **Hvor:**
  - `content/figures/os.json:89–124`: via'en lægger armen langs kroppens akse ind over hovedet (joint [38,4; 25], end [46,3; 25]);
  - `screenshots/review-p2-3-os2-arm-over-hovedet.png`.
- **Hvorfor:**
  - Armen føres »i en bue op og over til den anden side, så brystet vender mod loftet« (positionen »Åben«; PROGRAM_KILDE, Open & Strong 2).
  - Set ovenfra skulle armen blive kort, mens den peger op mod beskueren. Her fejer den langs gulvet forbi hovedet som en vindmølle.
  - Brystets drejning, som er det, øvelsen træner, ses ikke, fordi figuren ovenfra ingen skulderbredde har (M11).
- **Rettelse:**
  - Via'en skal tegne armen kort ved skulderen, ikke rettet mod hovedet: near `{ "joint": [30.5, 29.2], "end": [30.8, 33.1] }` i begge via'er (afprøvet, består check-explain).
  - Tilføj `second` forfra som i groin.1 (liggende på siden set forfra). Den øverste arm går fra en kort stump frem, til lodret op på fuld længde og bagud.
  - `width.shoulders` går fra 16 til ca. 6 i »Åben«, så brystet ses åbne.

### M5 – os.3 Y-løft: Y'et ses ikke
- **Alvor:** middel.
- **Hvor:**
  - `content/figures/os.json:131–168`, som kun har et sidebillede;
  - `screenshots/review-p2-3-os3-y-usynligt.png`.
- **Hvorfor:**
  - Y'et er øvelsens kerne: »Armene i et Y, tommelfingrene op« (PROGRAM_KILDE) og »ca. 90° mellem armene« (positionen).
  - Fra siden ligger armene oven i hovedet, og figuren er en flad streg. Et I-løft med parallelle arme ser ens ud.
- **Rettelse:** tilføj `second` med `view: "top"`:
  - kroppen set oppefra, armene fra skulderen ±45° fra hovedlinjen;
  - fuld længde i »Nede« og forkortet i »Løftet« (fx `upper` 14, `lower` 13), så hænderne flytter sig ca. 4, og tjekket af bevægelse i begge vinkler består;
  - ovenfra tjekkes kun formatet, så se efter på kontaktarket.

### M6 – os.4 og os.5: markeringens tekst dækker hænderne og hovedet
- **Alvor:** middel.
- **Hvor:**
  - `content/figures/os.json:209` (os.4 »Skuldrene nede« i fase 2) og `:240` (os.5 »Blikket vandret« ved »Hagen ind«);
  - kortet: `screenshots/review-p2-3-os4-cue-daekker-haenderne.png` og `review-p2-3-os5-cue-daekker-hovedet.png`.
- **Hvorfor:**
  - På kortet står teksten øverst i den smalle tegning:
    - over hænderne i hele »Løft 2 cm« (os.4);
    - over hovedet i hele holdet på 5 sek (os.5).
  - Det er præcis det, der skal ses. SPEC 3.8 og D60 siger: teksten står væk fra kroppen, og hovedet tæller som kroppen.
  - Rutinen tages hver dag.
- **Rettelse:**
  - Fjern de to markeringer, indtil M12 er rettet. Teksten står i cue-listen.
  - Tjek på kortet i `pixel9a`, at hænder og hoved kan ses.

### M7 – spiderman: armen svinger bagud langs kroppen
- **Alvor:** middel.
- **Hvor:**
  - `content/figures/warmup.json:148–179`: ingen overgang mellem »Udfald« og »Drejet op«;
  - `screenshots/review-p2-3-spiderman-arm-bagud.png`.
- **Hvorfor:**
  - Fra hånden i gulvet til armen lodret op svinger armen bagud langs kroppen og peger vandret mod fødderne midt i fasen. Det er stærk ekstension i skulderen, som ikke kan lade sig gøre.
  - I virkeligheden drejer brystet op, og armen går ud til siden og op.
  - Opvarmningen tages hvert pas (SPEC 9.1, D56).
- **Rettelse** (afprøvet, består check-explain):
  - Overgangene »Udfald« → »Drejet op« og tilbage får `lift: ["near.hand"]`.
  - Via'en er som »Udfald«, men med `head` 20 og near `{ "to": [75.5, 45.5], "upper": 8, "lower": 7.5 }`.
  - Armen kommer frem og op mod beskueren, før den strækkes lodret. Brystets drejning kræver M11.

### M8 – kosak-squat: fejlparret viser den forkerte fejl
- **Alvor:** middel.
- **Hvor:**
  - `content/figures/warmup.json:264–284` (fejl 2 med `bend` −1);
  - kortet: `screenshots/review-p2-3-kosak-fejlpar.png`.
- **Hvorfor:**
  - Fejlen er »Hælen løfter sig«.
  - Med `bend` −1 og de samme forkortede led folder benet sig, og knæet flytter 11,5 ind i overkroppen. Ringen står på knæet inde i kroppen.
  - Man ser et knæ, der falder ind, ikke en hæl, der letter.
- **Rettelse** (afprøvet, består check-explain): near `{ "to": [26.5, 7.4], "tip": [29, 0.4], "bend": 1, "upper": 12.47, "lower": 18.5 }`.
  - Knæet bliver ude over tæerne, hælen kommer 3,8 op, og tæerne bliver i gulvet.

### M9 – hip airplane: drejningen ses ikke
- **Alvor:** middel.
- **Hvor:**
  - `content/figures/warmup.json:426–464`;
  - `screenshots/review-p2-3-airplane-drejning-usynlig.png`.
- **Hvorfor:**
  - Øvelsen er en drejning af bækkenet op mod loftet på standbenet (PROGRAM_KILDE, »Øvelser, du måske ikke kender«).
  - Fra siden løftes kun det bagerste ben og den bagerste hånd 6. Sammen med pilen op ved foden læses det som et benløft.
  - Motoren kan ikke tegne drejningen (M11).
- **Rettelse:**
  - Indtil M11 er lavet:
    - erstat pilen ved `far.foot` med en cue ved `hip` i fase 1 (fx »Bækkenet drejer op«);
    - hold det bagerste ben vandret i begge positioner, så det ikke ligner et benløft.
  - Derefter: vis bækkenet, der åbner.

### M10 – motoren: hovedet drejer om skulderen
- **Alvor:** middel.
- **Hvor:** `src/figure/geometry.ts:268`: `head = polar(shoulder, BODY.neck, torso + head)`.
- **Hvorfor:** halsen er stiv, så hovedet kan kun dreje om skulderen. Derfor kan to ting ikke tegnes, uden at skuldrene flytter sig, eller ansigtet vipper:
  - **et nik med baghovedet i gulvet:** N1 og N2 sænker skuldrene 3,2;
  - **en ren hage-ind stående:** os.5 vipper ansigtet fra −7,2° til +7,2°, selv om teksten siger »ansigtet stadig lodret«.

  NAT-3-FIGURES beder om ansigtets retning, men motoren kan ikke dreje ansigtet om hovedet.
- **Rettelse:**
  - Del halsen og hovedet: `head` drejer hovedet om halsens top, eller et nyt felt `nod` drejer kun hovedet og mærket om hovedets midte.
  - Lav en test, der viser, at et nik ikke flytter skuldrene.
  - Tegn derefter N1, N2 og os.5 om (M2).

### M11 – motoren: ingen drejning om kroppens længdeakse
- **Alvor:** middel.
- **Hvor:** `src/figure/geometry.ts:228–233`. Fra siden og ovenfra udgår arme og ben fra ét punkt; `width` findes kun forfra (SPEC 9.1).
- **Hvorfor:** et bryst eller et bækken, der drejer, kan ikke ses i nogen vinkel:
  - fra siden har kroppen ingen bredde;
  - ovenfra udgår arme og ben fra ét punkt;
  - forfra kan en overkrop, der peger mod beskueren, ikke tegnes.

  Det gør spiderman, åben bog og hip airplane utydelige (M4, M7 og M9), og de tages hver dag eller i hvert pas.
- **Rettelse:**
  - Brug `width` i alle vinkler, eller indfør `twist` pr. pose, der tegner den fjerne skulder og hofte forskudt.
  - Tjekket og kontaktarket skal vise det.

### M12 – motoren: teksten lægges oven på kroppen i smalle figurer
- **Alvor:** middel.
- **Hvor:** placeringen i `src/figure/marks.ts`. Den ses i:
  - os.4 i fase 2 og os.5 i holdet;
  - N3 og N4, hvor »Halv kraft« og »80 % kraft« dækker fødderne (`screenshots/review-p2-3-n3-cue-over-foedderne.png`).
- **Hvorfor:**
  - SPEC 3.8 og 9.1 og D60 siger: teksten står væk fra kroppen, og hovedet tæller som kroppen. Kan den ikke stå i tegningen, står den på sin egen linje over eller under figuren.
  - I smalle, stående figurer lægges den i stedet i et hjørne oven på hovedet, hænderne eller fødderne.
- **Rettelse:**
  - Alle tegnede dele skal tælle som kroppen, også hænder, underarme og fødder.
  - Findes der ingen plads uden overlap, bruges den egne linje over eller under figuren.
  - Lav en test i `pixel9a` med os.5's hold og os.4's fase 2.

### M13 – kortet bliver bredere end skærmen
- **Alvor:** middel.
- **Hvor:** fasernes tekst i `content/explain`:
  - `measures.json:458` »Hovedet ned foran hænderne«;
  - `neck.json:227` og `:331` »Hånden på baghovedet«;
  - `measures.json:713` »Løft foden, luk øjnene«;
  - skærmbillede: `screenshots/review-p2-3-pike-kort-for-bredt.png`.
- **Hvorfor:**
  - SPEC 3.8 siger, at »en fase deles aldrig over to linjer«. Med de lange tekster bliver kortet bredere end skærmens 414 px: pike 435 px, N3 og N4 427 px og balance 415 px.
  - Siden kan derfor skubbes sidelæns midt i et pas, og »Slowmotion« er skåret af på pike-kortet. Pike-målingen er fredag 13/11.
- **Rettelse:**
  - **Kortere tekster:** pike »Hovedet ned«, N3 og N4 »Hånd bag hovedet« og balance »Løft foden«; cuen »Øjnene lukket« står allerede på balance.
  - **Et tjek:** `document.documentElement.scrollWidth <= 414` på hvert kort, fx i `e2e/shots/cards.shots.ts` eller a11y.
  - **Uden for min del** har disse kort samme fejl:
    - `burpee_skill.V4` »Land med bløde albuer«;
    - `power_legs.5` »Knæene op mod brystet« og »Stræk benene, og land blødt«;
    - `wallsit.W3` »20 kontrollerede squats«;
    - `wallsit.W5` »30 sek på venstre ben«.

### L1 – skyggeboksning: slagene går i en bue
- **Alvor:** lav.
- **Hvor:**
  - `content/figures/warmup.json:60–107`: ingen via, og »Hånd til kind« står i fase 4 på 0,4 sek;
  - `screenshots/review-p2-3-skygge-slag-i-bue.png`.
- **Hvorfor:**
  - Leddenes vinkler interpoleres, så begge lige slag går i en bue op over hovedhøjde, før armen strækkes. Et lige slag går lige frem i skulderhøjde (positionerne).
  - Cuen blinker 0,4 sek ad gangen hvert 1,4 sek.
- **Rettelse** (afprøvet, består check-explain; filmstrimlen viser lige slag):
  - Overgangene »Garde« → »Forreste lige« og tilbage får en via som »Garde« med near `{ "to": [20, 82], "upper": 16 }`.
  - Overgangene »Garde« → »Bagerste lige« og tilbage får en via som »Bagerste lige« med `hip` [0.6, 48.4], `torso` 88 og far `{ "to": [22, 82], "upper": 16 }`.
  - Fjern cuen i fase 4; fejlparret viser den.

### L2 – klubsekvensen C6: diamanten ses ikke
- **Alvor:** lav.
- **Hvor:** `content/figures/club_sequence.json:382–449`, som kun har et sidebillede.
- **Hvorfor:**
  - Positionerne siger »hænderne samlet ... en diamant« og »albuerne tæt langs kroppen«, og fejl 1 er »Albuerne flyver ud til siden«.
  - Fra siden ligner C6 en almindelig push-up. README anbefaler »ovenfra for albuer«.
- **Rettelse:** tilføj `second` ovenfra med hænderne samlet under brystet og albuerne tilbage langs kroppen. Fejlpar 1 kan også tegnes ovenfra.

### L3 – base-check: »Tale-tempo« blinker
- **Alvor:** lav.
- **Hvor:** `content/figures/measures.json:297`.
- **Hvorfor:**
  - Cuen hører til fase 1 på 0,4 sek i en løkke på 0,8 sek. Målt på kortet er den skiftevis synlig og væk hvert 0,4 sek.
  - Den er svær at læse, og SPEC 5 siger, at bevægelse aldrig må være pynt.
- **Rettelse:** fjern markeringen. »Tale-tempo hele vejen« står allerede som første cue.

### L4 – groin.1: den øverste hånd ses ikke
- **Alvor:** lav.
- **Hvor:** `content/figures/groin.json:18`.
- **Hvorfor:** positionen siger »Den øverste hånd støtter foran brystet«, men fjerne lemmer tegnes bag overkroppen, så kun en bule under kroppen kan ses.
- **Rettelse:** sæt hånden, hvor den kan ses under brystets nederste kant, eller godtag det som en kendt grænse.

### L5 – groin.4: 180° står langt fra buen
- **Alvor:** lav.
- **Hvor:** `content/figures/groin.json:194`.
- **Hvorfor:**
  - SPEC 9.1 siger, at gradtallet står inde i vinklen lige uden for buen.
  - Ved 180° findes der intet »inde«, så motoren lægger tallet ved gulvet, langt fra knæet.
- **Rettelse:** brug en cue »Strakt knæ« ved `far.knee` i stedet.

### L6 – motoren: fejlringen står ved hovedet
- **Alvor:** lav.
- **Hvor:** `src/figure/faults.ts`. Ringen står ved hovedet eller armene i stedet for ved fejlen i:
  - pogo, hvor fejlen er knæene;
  - C1–C4 fejl 2 og C6 fejl 3, hvor fejlen er albuerne;
  - push-ups max fejl 1, hvor fejlen er brystets dybde;
  - wall sit (armene), hvor fejlen er hoften.
- **Hvorfor:**
  - SPEC 3.8 siger, at ringen står, hvor den forkerte stilling afviger mest.
  - Når hele kroppen flytter sig, er det hovedet, så ringen peger væk fra fejlen.
- **Rettelse:** lad en fejl angive ringens punkt (`"ring": "near.knee"`), eller se bort fra hoved og bårne lemmer, når ringen placeres.

### L7 – tjekket ser ikke skulderens bevægelighed
- **Alvor:** lav.
- **Hvor:** `src/figure/check.ts`.
- **Hvorfor:** tjekket afviste hverken overarmen bag ryggen i N5 › mave eller spiderman-armen, der svinger bagud. Begge er umulige midt i bevægelsen (SPEC 9.1).
- **Rettelse:** tjek skulderens ekstension i via-poser og i billederne imellem for lemmer, der ikke er forkortet, fx højst ca. 60° bag kroppen fra siden.

### L8 – motoren: ingen skulderblade
- **Alvor:** lav.
- **Hvor:** `content/figures/warmup.json:406–407`: `upper` 13,05 i »Sunket ned«.
- **Hvorfor:** brystet kan kun synke mellem skulderbladene, hvis overarmen forkortes 18 %. Segmentet skifter længde i en øvelse, hvor armene er strakte.
- **Rettelse:** godtag det som en kendt grænse (det ses næsten ikke på kortet), eller giv motoren en forskydning af skulderleddet.

### L9 – kortet til N3–N6 viser stadig det lånte piktogram
- **Alvor:** lav.
- **Hvor:** `src/ui/components/ExerciseCard.tsx:236–256` og `program/pictos.json`.
- **Hvorfor:**
  - SPEC 5 siger: »Piktogrammerne bruges, indtil et trin har sin figur«.
  - N3–N6 har nu figurer under »Bevægelserne«, men øverst på kortet står stadig hage-ind-piktogrammet med »Tegningen viser en lignende øvelse«. Det første, man ser, er altså en anden øvelse.
- **Rettelse:** når alle bevægelser er tegnet, vises intet piktogram øverst.

## Positionsteksternes nye ordlyd

Alle seks rettelser i mine filer er i orden. Ingen navne, doser eller regler er ændret.

- **groin.2 og groin.4 › »Nede«:** »albuen omtrent under skulderen« gælder startstillingen med hoften i gulvet. Cuen »Albuen under skulderen« og planken (»under skulderen«) står uændret.
- **groin.3 › »Hoften nede«:** »Albuen er blevet, hvor den stod, omtrent under skulderen« beskriver korrekt, at albuen står fast, mens skulderen flytter sig.
- **measures.table_rows › »Nede«:** »Skuldrene er lidt længere inde under bordet end hænderne« er fysisk rigtigt, når hælene er omdrejningspunkt, og passer med »brystet op til kanten«.
- **measures.side_plank › »Nede«:** »albuen næsten under skulderen« gælder startstillingen. Holdet siger stadig »Albuen lige under skulderen«.
- **warmup.2 › »Udfald«:** »knæet dybt bøjet (ca. 70°)« passer med figuren og med programmets »langt udfald«.

## Skærmbilleder

Alle i `screenshots/`, taget med Playwright (kortet i `pixel9a`/Firefox, filmstrimler og kontaktark med `src/figure`):

- **Høj og nakke:**
  - `review-p2-3-os1-knaek-i-nakken.png`;
  - `review-p2-3-n1-skuldre-synker.png` og `review-p2-3-n1-fejlpar.png`;
  - `review-p2-3-n5-mave-arm-bag-ryggen.png`.
- **Kortet:**
  - `review-p2-3-lyske-nederste-ben-i-gulvet.png`;
  - `review-p2-3-os4-cue-daekker-haenderne.png` og `review-p2-3-os5-cue-daekker-hovedet.png`;
  - `review-p2-3-n3-cue-over-foedderne.png`;
  - `review-p2-3-pike-kort-for-bredt.png`;
  - `review-p2-3-maalinger-tirsdag.png` (godkendt).
- **Bevægelser og fejlpar:**
  - `review-p2-3-os2-arm-over-hovedet.png` og `review-p2-3-os3-y-usynligt.png`;
  - `review-p2-3-spiderman-arm-bagud.png` og `review-p2-3-kosak-fejlpar.png`;
  - `review-p2-3-airplane-drejning-usynlig.png` og `review-p2-3-skygge-slag-i-bue.png`.
