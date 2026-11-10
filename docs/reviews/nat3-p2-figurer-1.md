# Review af NAT-3 P2, del 1 – figurerne til pres, træk, rygsæk-row, skuldre, ben, etbens RDL, lægge, bagkæde og wall sit

2026-11-09 · da9abf8 (fletningen 196bb1e og trænernes tekster i `git diff d92a6e2 da9abf8 -- content/explain/`) · worktree `scratchpad/wt/figs`

Metode:

- **Læst** mod:
  - NAT-3 pakke 2 og brugerens feedback;
  - `docs/runs/NAT-3-FIGURES.md` og `tools/pictos/README.md`;
  - SPEC 3.2, 3.8, 5, 6 og 9.1 samt D48, D56, D58 og D60;
  - PROGRAM_KILDE: Pres, Skuldre, Træk, Ben, Wall sit og lægge, Bagkæde, »Tempo i styrkesæt« og »Film dig selv«.
- **Kørt i worktreen:**
  - `node scripts/check-explain.ts` på de 9 figurfiler: alle OK.
  - Vitest `content-figures` og `content`: 13/13.
- **Kontaktark:** repoets og egne i dobbelt opløsning.
- **Geometri:** et scratch-script over `src/figure/` (`solve`, `buildModel`, `poseAt`) har målt hver position, hver via-pose og 30 billeder i sekundet:
  - led- og hoftevinkler;
  - hoftens afstand fra linjen fod–skulder;
  - albuens plads foran eller bag overkroppen;
  - `upper` og `lower` mellem positionerne;
  - laveste led og ender.
- **Kortet i `pixel9a`:**
  - Firefox uden JIT, 414 × 847, DSF 2;
  - `e2e/review/cards.html` på 127.0.0.1:4186 med `page.clock` stoppet i faserne;
  - reduceret bevægelse og fejlparrene foldet ud;
  - vandret overløb målt på 18 kort.
- **»Nu« i tidsmaskinen:** onboarding med standardvalg, dvs. trin 1 overalt.
  - Styrke A tirsdag 10/11: push-up, rygsæk-row, split squat, hoftebro og tåløft.
  - Styrke B fredag 13/11: pike push-up, rygsæk-row, etbens RDL og wall sit.
- **Afprøvede rettelser** i scratch-kopier (check-explain OK, kontaktark set):
  - fejlparrene i `pull.1` og `sl_rdl.1`;
  - »Oppe« og »Nede« i `pull.3`, `pull.6` og `pull.7`;
  - markeringen i `calf.1`.

## Resultat

43 figurer: 30 godkendt og 13 afvist. Fund: 1 høj, 9 middel og 8 lav.

- **Det virker:**
  - Alle ni filer består tjekket. Ingen led bøjer forkert, og intet går gennem gulv, væg eller møbler, heller ikke midt i bevægelsen.
  - Segmenterne holder længden, bortset fra den bevidste forkortning i M1 og M2.
  - Tempoet følger dosis, og alle trin 1 og 2 har et fejlpar.
  - Wall sit, skuldrene (pike, gå op ad væggen og HSPU), bagkæden (hoftebro, leg curl og Nordic), benenes trin 3–7 og bord-row trin 2 og 4 er tydelige og passer med positionerne.
  - I »Nu« er figurerne store nok, og markeringerne dækker ikke kroppen – undtagen i tåløftet (M7).
- **Det virker ikke:**
  - Bord-row trin 3, 6 og 7 trækker med albuen foran brystet (H1).
  - Archer-øvelserne (M1, M2) og forskellen mellem etarms trin 6 og 7 (M3) kan ikke ses fra siden.
  - To fejlpar for trin 1 viser fejlen uklart (M4, M6).
  - Split squat-trinene mangler vinklen forfra (M5).
  - I »Nu« kan en tekst dække foden (M7, M8).
  - En fase skæres af ved skærmkanten (M9).

## Alle figurer

| Fil › punkt › bevægelse | Dom | Grund |
|---|---|---|
| `press.json` › `press.1` | Godkendt | Hoften ligger på linjen fod–skulder i alle billeder. 3–1–1 i tempo, »Én planke« langs kroppen i bunden, og fejlparret »hoften hænger« er tydeligt. Se L1. |
| `press.json` › `press.2` | Godkendt | Tæerne midt på sædet, stolen ved væggen, kroppen skråner i bunden, og fejlparret »hoften knækker op« er tydeligt. Se L6 om stolen. |
| `press.json` › `press.3` | Godkendt | Bøgerne og højdeforskellen ses, og »Nederste arm arbejder« står ved albuen. Se L2. |
| `press.json` › `press.4` | **Afvist** (M1) | Archer fra siden: forskydningen og den strakte arm kan ikke ses. |
| `press.json` › `press.5` | Godkendt | Hånden på bordkanten, den frie hånd på lænden og albuen tæt ind. |
| `press.json` › `press.6` | **Afvist** (M3) | Samme tegning som `press.7`. De brede fødder ses ikke, og »Fødderne bredt« peger på samlede fødder. |
| `press.json` › `press.7` | **Afvist** (M3) | Samme tegning som `press.6`. Hoftebredden og »Ingen vridning« ses ikke. |
| `pull.json` › `pull.1` | **Afvist** (M4) | Bevægelsen er god: ryggen 20° over vandret, albuen op og bagud og hånden ved hoften. Men fejlparret viser armen som en lodret pind. |
| `pull.json` › `pull.2` | Godkendt | Knæ, hofte og skuldre på én linje, albuerne bag ryggen i toppen, og fejlparret »hoften hænger« er tydeligt. |
| `pull.json` › `pull.3` | **Afvist** (H1) | Albuen står foran brystet i »Oppe«. |
| `pull.json` › `pull.4` | Godkendt | Hælene på stolen, kroppen vandret i toppen og albuen langs siden. |
| `pull.json` › `pull.5` | **Afvist** (M2) | Archer fra siden: det brede greb og forskydningen ses ikke, og den hjælpende arm skrumper fra 29 til 16 enheder. |
| `pull.json` › `pull.6` | **Afvist** (H1) | Samme »Oppe« som `pull.3`. Den frie arm langs siden er god. |
| `pull.json` › `pull.7` | **Afvist** (H1) | Som `pull.6`. Holdet på 3 sek er med. |
| `backpack_row.json` › `backpack_row.1` | **Afvist** (M4) | Samme figur og samme fejlpar som `pull.1`. |
| `shoulder.json` › `shoulder.1` | Godkendt | Omvendt V, hovedet lige over gulvet foran fingrene, og fejlparret »hoften falder« er tydeligt. Se L1. |
| `shoulder.json` › `shoulder.2` | Godkendt | Hoften over skuldrene med hjælpelinjen, og fejlparret »hænderne for langt fra stolen« er tydeligt. |
| `shoulder.json` › `shoulder.3` | Godkendt | Hænderne går ind, og fødderne går op ad væggen med via-posen. »Lang og lige« står i håndstanden. |
| `shoulder.json` › `shoulder.4` | Godkendt | Spark op med via, ryggen mod væggen og hovedet blødt på puden. Ned uden at presse op. |
| `shoulder.json` › `shoulder.5` | Godkendt | Albuerne skråt ud i rummet (99°/103°), og hovedet rører puden let. |
| `shoulder.json` › `shoulder.6` | Godkendt | Som trin 5, med hovedet i gulvet. |
| `shoulder.json` › `shoulder.7` | Godkendt | Bøgerne og linjen »Under håndhøjde«. |
| `legs.json` › `legs.1` | **Afvist** (M5) | Siden er rigtig: lodret ned, knæet på puden og hælen i gulvet. Men der er ingen vinkel forfra til »to skinner« og knæ over tæer. |
| `legs.json` › `legs.2` | **Afvist** (M5) | Som `legs.1`. »Knæet må frem« og hælen er rigtige fra siden. |
| `legs.json` › `legs.3` › `backpack` | Godkendt | Rygsækken langs ryggen, dybt, og bagerste knæ lige over gulvet. Se L3. |
| `legs.json` › `legs.3` › `pause` | Godkendt | Pausen på 3 sek i bunden. |
| `legs.json` › `legs.4` | Godkendt | Stolens forkant, næsen over tæerne og armene frem. |
| `legs.json` › `legs.5` | Godkendt | Ned på ét ben på 5 sek, foden ned og op på to. Se L4. |
| `legs.json` › `legs.6` | Godkendt | Hele vejen ned og op på ét ben med hælen i gulvet. |
| `legs.json` › `legs.7` | Godkendt | Pausen på 2 sek og knæsparket over hoftehøjde. |
| `sl_rdl.json` › `sl_rdl.1` | **Afvist** (M6) | Bevægelsen er god: det frie ben i linje med ryggen. Men fejlparrets ring står om den frie fod. |
| `calf.json` › `calf.1` | **Afvist** (M7) | Figuren er god, men i »Nu« dækker »Helt op« foden og trinnets kant. |
| `posterior.json` › `posterior.1` | Godkendt | Skuldre, hofte og knæ på linje, underbenet lodret og det frie ben i forlængelse. Fejlparret »svaj« er tydeligt. |
| `posterior.json` › `posterior.2` | Godkendt | Hælene på håndklæder, hoften oppe ude, og fejlparret »hoften falder« er tydeligt. |
| `posterior.json` › `posterior.3` | Godkendt | Det frie knæ over hoften, 3 sek ud og hurtigt ind. |
| `posterior.json` › `posterior.4` | Godkendt | Sofaen, puden, lige fra knæ til hoved og hænderne, der tager fra. Se L7. |
| `posterior.json` › `posterior.5` | Godkendt | 5 sek ned. Se L7. |
| `posterior.json` › `posterior.6` | Godkendt | Et lille skub, og baglårene trækker op. |
| `wallsit.json` › `wallsit.W1` | Godkendt | Glid ned ad væggen og 90° i holdet. Fejlparret »hoften glider op« er tydeligt. |
| `wallsit.json` › `wallsit.W2` | Godkendt | Garde og lige slag. Fejlparret »hånden falder fra garden« er tydeligt. |
| `wallsit.json` › `wallsit.W3` | Godkendt (tegningen) | Fasens tekst løber ud af kortet (M9), og løkken er 67 sek i kortet (L5). |
| `wallsit.json` › `wallsit.W4` | Godkendt | Benet strakt frem i hoftehøjde og 90° i standbenet. |
| `wallsit.json` › `wallsit.W5` | Godkendt | Runden med skift. Fasens tekst rører skærmkanten (M9). |

## Fund

### H1 (høj): Bord-row trin 3, 6 og 7 trækker med albuen foran brystet, ikke langs siden

- **Hvor:**
  - `content/figures/pull.json:96–122` (`pull.3`), `:221–247` (`pull.6`) og `:260–286` (`pull.7`);
  - `screenshots/review-p2-1-pull3-albue-foran-brystet.png`.
- **Hvorfor:**
  - **Positionerne og trinene:**
    - »Oppe« i `pull.3`: »Brystet oppe ved bordkanten, albuerne bøjet og tæt langs siden«. I `pull.6` og `pull.7`: »albuen bøjet og tæt langs siden«.
    - Trinene: »Træk brystet op mod kanten med albuerne tæt langs siden«.
    - PROGRAM_KILDE, Træk: »Brystet mod kanten«.
  - **Målt i »Oppe«:**
    - Skulderen står i (39,1; 31,9) lige under hånden i (39; 40,6). Armen må folde sig til 32° i albuen.
    - Albuen ender i (24,3; 37,8): 11 enheder foran overkroppens midtlinje, op mod bordet. Overkroppen er 4,3 tyk til hver side.
  - **Det, man ser:** armen ligger som en kile oven på brystet, og trækket går til skulderen med albuen frem. En row trækker albuen ned og bagud.
  - **Til sammenligning:** albuen står 4,1 bag ryggen i `pull.2` og 1,5 foran midtlinjen i `pull.4`.
  - Det er toppen af hver gentagelse i tre trin.
- **Rettelse:** skulderen skal stå ca. 6 enheder forbi hånden under bordet i »Oppe«. Afprøvet i en kopi med check-explain OK (`review-p2-1-pull3-forslag.png` og `review-p2-1-pull6-forslag.png`):
  - **Fødderne i begge positioner i `pull.3`, `pull.6` og `pull.7`:** `"near": { "to": [-26.53, 3], "tip": [-28.13, 10.3] }` og `"far": { "to": [-27.13, 3], "tip": [-28.73, 10.3] }`.
  - **»Oppe«:** `"hip": [17.13, 20.4]`, `"torso": 21.72`, `"head": -22`.
  - **»Nede«:** `"hip": [20.18, 8.24]`, `"torso": 6.4`, `"head": 0`.
  - **Hænderne** står som i dag.
  - **Den frie hånd i `pull.6` og `pull.7`:** `"far": { "to": [17.8, 16] }` i »Oppe« og `{ "to": [19.2, 3.8] }` i »Nede«.
  - **Resultat:**
    - Albuen står 3,8 foran midtlinjen, dvs. inde i overkroppen og langs siden, med 41° i albuen.
    - Hovedet går fri af bordet: toppen af hovedet står i 37,8, og bordets underside i 39,8.
    - Armene hælder ca. 20° i »Nede«. Det dækker »næsten lodrette«, som trænerne har skrevet.
  - **Afvejningen:** jo længere skulderen står forbi hånden, jo mere hælder armene i »Nede«. Med 4 enheder forbi hælder de 17°, og albuen står 6 foran midtlinjen.

### M1 (middel): Archer push-up (`press.4`) tegnes kun fra siden

- **Hvor:**
  - `content/figures/press.json:123–160`. Den fjerne arm har `upper`/`lower` 15,76/14,77 i »Oppe« (:135) og 8,86/8,31 i »Nede til siden« (:148);
  - `screenshots/review-p2-1-press4-kort-nede.png`.
- **Hvorfor:**
  - **Kilderne:**
    - PROGRAM_KILDE, Pres trin 4: »Hænderne i dobbelt skulderbredde. Sænk dig mod den ene hånd; den strakte arm hjælper mindst muligt.«
    - Positionen »Nede til siden«: »Skuldrene er flyttet over mod den arbejdende hånd … Den anden arm er strakt skråt ud til siden.«
    - NAT-3 pakke 2: forfra for sideværts bevægelser, og to vinkler, hvor én ikke er nok.
  - **Fra siden** kan hverken den dobbelte skulderbredde, forskydningen eller den strakte arm ses. Den strakte arm svinger ud mod beskueren og kan kun tegnes kortere: den skrumper fra 30,5 til 17,2 enheder på de 3 sek ned.
  - **På kortet** ligner »Nede til siden« en almindelig push-up med en grå stump under brystet. Cuen »Armen forbliver strakt« peger på stumpen.
  - **Motoren:** forfra kan en vandret krop ikke tegnes, for overkroppen kan ikke forkortes. Vinklen ovenfra er vejen, men den tjekkes kun for formatet (README, »Det ser tjekket ikke«), så kontaktarket skal ses efter.
- **Rettelse:** giv figuren en vinkel ovenfra.
  - Brug `second` med `"view": "top"` som i `core_front.1` og `core_rot.R2`, eller gør ovenfra til hovedvinklen med siden som den anden vinkel, som i `core_rot.R1`.
  - Hænderne står i dobbelt skulderbredde, fx y = ±22, med skuldrene ±11.
  - I »Nede til siden« flytter skuldrene sig over mod den nære hånd. Den nære albue bøjer ca. 45° bagud (`bend`), og den fjerne arm er strakt ud til sin hånd.
  - Flyt »Armen forbliver strakt« til `far.elbow` ovenfra.
  - Fra siden kan den fjerne arm skjules, så den ikke skrumper.

### M2 (middel): Archer bord-row (`pull.5`) tegnes kun fra siden

- **Hvor:**
  - `content/figures/pull.json:176–213`. Den fjerne arm har `upper`/`lower` 15/14 i »Nede« (:188) og 8,21/7,7 i »Oppe til siden« (:201);
  - `screenshots/review-p2-1-pull5-kort-oppe.png`.
- **Hvorfor:**
  - **Kilderne:**
    - PROGRAM_KILDE, Træk trin 5: »Grib bredt. Den ene arm trækker, den anden hjælper kun lidt.«
    - Positionerne: »hænderne om kanten i ca. dobbelt skulderbredde« og »Brystet oppe ved kanten tæt ved den trækkende hånd … Den anden arm er næsten strakt ud mod sin hånd.«
  - **Fra siden** ses det brede greb og forskydningen ikke. Den hjælpende arm skrumper fra 29 til 16 enheder i trækket og skjuler sig bag den trækkende.
  - **På kortet** ligner det et almindeligt bord-row. Albuen står desuden 4,3 foran midtlinjen i toppen (som H1, men mindre).
- **Rettelse:**
  - Giv figuren en vinkel ovenfra med `props: []` uden bordet:
    - hænderne på kanten i y = ±22;
    - kroppen trækkes op og over mod den nære hånd;
    - den nære albue langs siden og den fjerne arm næsten strakt;
    - »Én arm trækker« står der.
  - Fra siden: placér skulderen som i H1.

### M3 (middel): `press.6` og `press.7` er samme tegning, så forskellen mellem trinene ses ikke

- **Hvor:**
  - `content/figures/press.json:195–226` og `:228–259`. Keyframes i `:200–221` og `:233–254` er ens; kun cuen er forskellig;
  - `screenshots/review-p2-1-press6-kort-nede.png` og `review-p2-1-press7-kort-nede.png`.
- **Hvorfor:**
  - **Programmet:** trin 6 »I gulvet med brede fødder. Den frie hånd på lænden«. Trin 7 »Fødderne i hoftebredde. Ingen vridning.«
  - **Positionerne:** »fødderne står ca. dobbelt skulderbredde fra hinanden« og »Fødderne i hoftebredde«.
  - **Fra siden** står fødderne oven i hinanden i begge figurer. »Fødderne bredt« i `press.6` peger på samlede fødder, og »Ingen vridning« i `press.7` kan ikke ses.
  - **SPEC 3.8:** en, der aldrig har set øvelsen, skal kunne lave den ud fra kortet og figuren.
- **Rettelse:** giv begge en vinkel ovenfra.
  - Arbejdshånden står under brystet lidt inden for skulderen, og den frie hånd ligger på lænden.
  - Fødderne står i y = ±22 i `press.6` og ±6 i `press.7`.
  - Sæt »Fødderne bredt« ved fødderne ovenfra og »Ingen vridning« ved hoften ovenfra.

### M4 (middel): Rygsæk-row (`pull.1` og `backpack_row.1`): fejlparret for »albuen ude til siden« viser armen som en lodret pind

- **Hvor:**
  - `content/figures/pull.json:41–47` og `content/figures/backpack_row.json:41–47`;
  - `screenshots/review-p2-1-pull1-fejlpar.png`.
- **Hvorfor:**
  - Det er trin 1, som brugeren laver i begge pas. NAT-3 pakke 2: fejlparret skal tydeligt vise fejlen.
  - `wrong` lægger overarmen (forkortet til 8) lodret op fra skulderen og underarmen (14,9) lodret ned oven i den til rygsækken. De to dækker hinanden, så »Forkert« er en rød pind fra over ryggen ned til rygsækken ved skulderen, med ringen om rygsækken.
  - Det ligner en arm, der peger lige op, ikke en albue ude til siden. »Ude til siden« kan ikke tegnes fra siden.
- **Rettelse:** vis i stedet fejl 3, »Ryggen bliver rund«, som siden viser tydeligt.
  - Afprøvet med check-explain OK (`review-p2-1-pull1-fejlpar-forslag.png`): `{ "mistake": 3, "at": "bottom", "wrong": { "spine": 6, "head": -25 } }` i begge filer.
  - Ringen lander på den runde øvre ryg.
  - Vil trænerne beholde fejl 2, så flyt albuen frem foran skulderen, så overarm og underarm står som et omvendt V. Det er ikke afprøvet.

### M5 (middel): Split squat og bulgarsk split squat (`legs.1`, `legs.2`) har ingen vinkel forfra

- **Hvor:**
  - `content/figures/legs.json:6–52` og `:54–102` har intet `second`;
  - `screenshots/review-p2-1-legs1-kort.png`.
- **Hvorfor:**
  - **NAT-3 pakke 2:** forfra for knæ over tæer, og trin 1 og 2 er de vigtigste øvelser.
  - **Forklaringerne:**
    - `legs.1`'s udgangsstilling: »fødderne i hoftebredde, som på to skinner«.
    - Den typiske fejl »Forreste knæ falder ind mod det andet ben« (fejl 2 i `legs.1` og fejl 3 i `legs.2`).
  - Ingen af dem kan ses fra siden.
  - Motoren kan tegne det: `power_legs.1` har squat jump forfra med »Over tæerne« og knæene, der falder ind, som fejlpar forfra.
- **Rettelse:** giv figuren `second` med `"view": "front"` som `power_legs.1`.
  - Hoften står i samme højde som fra siden (45,5 og 30,4 i `legs.1`).
  - Forreste ben (`near`, `bend` 1) har knæet over anden tå og låret forkortet i bunden (`upper` 6, det mindste).
  - Bagerste ben (`far`, `bend` −1) har låret lodret ned til puden (`legs.1`) eller en håndsbredde over gulvet (`legs.2`) i x = −6, med foden bag knæet (`lower` 5,75).
  - Fødderne står i hoftebredde (±6) i `legs.1`.
  - Tilføj markeringen `{ "line": ["near.knee", "near.toes"], "cue": "Over tæerne", "at": "bottom" }`.
  - Tilføj et fejlpar forfra med knæet ind (`"view": "front"`, `near` med `bend` −1) ved siden af hælens fejlpar.
  - Lav prioritet: `legs.4`–`legs.6` og `wallsit.W4` har samme typiske fejl og kan få samme vinkel senere.

### M6 (middel): Etbens RDL (`sl_rdl.1`): fejlparrets ring står om den frie fod, ikke om den runde ryg

- **Hvor:**
  - `content/figures/sl_rdl.json:38–49`;
  - `screenshots/review-p2-1-slrdl-fejlpar.png`.
- **Hvorfor:**
  - SPEC 3.8: ringen står, hvor den forkerte stilling afviger mest.
  - `wrong` flytter hoften 4 frem og sænker det frie ben 15,5 enheder. Derfor afviger foden mest (18,5), og ringen lander dér.
  - Fejlen er »Ryggen bliver rund i bunden«, så ringen peger på det forkerte sted.
- **Rettelse:** lad hoften og det frie ben stå.
  - Afprøvet med check-explain OK (`review-p2-1-slrdl-fejlpar-forslag.png`): `{ "mistake": 1, "at": "bottom", "wrong": { "torso": 3, "head": -30, "spine": 7, "arms": { "near": { "to": [22.5, 21.5] }, "far": { "to": [21.5, 21.7] } } } }`.
  - Ringen står så om hovedet og den øvre ryg, og afvigelsen er 10.
  - Motoren kunne desuden lade et fejlpar selv sige, hvor ringen skal stå.

### M7 (middel): Tåløft (`calf.1`): »Helt op« dækker foden og trinnets kant i »Nu«

- **Hvor:**
  - `content/figures/calf.json:36–39`;
  - `screenshots/review-p2-1-calf-nu.png` og `review-p2-1-calf-nu-zoom.png` (tirsdagens tri-sæt).
- **Hvorfor:**
  - SPEC 9.1, Markeringer: teksten står væk fra kroppen, og uden punkt i tegningens øverste venstre hjørne.
  - I »Nu« er tegningen så smal, at teksten lander nederst til venstre oven på foden, hælen og trinnets kant i hele fasen »Op«. Det er netop det, øvelsen handler om.
  - På kortet står teksten øverst til højre og er fin.
- **Rettelse:**
  - Erstat cuen med en pil, der viser hælen op i fase 2: `{ "arrow": "near.foot", "phase": 2, "offset": [-8, 0] }`, som fase 1's pil ned. Afprøvet med check-explain OK.
  - Motoren: se M8.

### M8 (middel, motoren): En markerings tekst må dække kroppen, når der ikke er en fri plads, og »Nu« bliver ikke tjekket

- **Hvor:**
  - `src/figure/marks.ts:618–689`: `placeLabel` vælger den plads, der dækker færrest af kroppens punkter, også når den dækker nogle.
  - `src/ui/components/Figure.tsx:341–358`: `placeMark` bruger den plads, så længe teksten kan stå på to linjer i tegningen. Først når den ikke kan det, står den på sin egen linje.
  - `src/figure/sheet.ts`: kontaktarket viser teksterne i kortets størrelse, ikke i »Nu«.
- **Hvorfor:**
  - **SPEC 9.1:** teksten står ved sit punkt, eller – hvis den dér ville dække kroppen – på en anden side, over eller under kroppen eller i et hjørne.
  - **D60:** står teksten ikke i sin tegning, står den på sin egen linje over eller under figuren.
  - **Konsekvensen:** M7 er et eksempel. Cues uden punkt i en fase (`legs.7` »Driv knæet op«, `wallsit.W3` »Lår vandrette«) og alle høje figurer i »Nu« kan ramme det samme, og intet viser det, før brugeren står i passet.
- **Rettelse:**
  - Lad `placeMark` gå videre til sin egen linje over eller under figuren, når den bedste plads i tegningen stadig dækker kroppen (`labelCovers` > 0).
  - Test alle markeringer i alle figurfiler i de størrelser, de har i »Nu« og i pausens »Næste«: ingen tekst dækker kroppen.
  - Vis placeringen i »Nu« på kontaktarket.

### M9 (middel): En lang fase skæres af ved skærmkanten på kortet for en høj figur

- **Hvor:**
  - `src/ui/components/figure.css:37` (`.figure-phase { white-space: nowrap }`) med den høje figurs kolonne i `:53–83`;
  - teksterne i `content/explain/wallsit.json:220` (»20 kontrollerede squats«) og `:408` (»30 sek på venstre ben«);
  - `screenshots/review-p2-1-w3-kort-fase.png`.
- **Hvorfor:**
  - SPEC 3.8: en høj figur står i venstre halvdel med faserne under hinanden ved siden af.
  - SPEC 5: sikker zone på 16 px. SPEC 6.
  - Målt på kortet i 414 px:
    - W3's fase slutter i x = 433, så siden kan rulle 19 px vandret, og »squats« skæres af.
    - W5's fase slutter i x = 415.
- **Rettelse:**
  - Lad en fase brydes inden i sig selv i den høje figurs kolonne (`white-space: normal` dér). Reglen om, at en fase ikke deles, gælder linjen med faserne under figuren.
  - Eller stil faserne under figuren, når én af dem er bredere end kolonnen.
  - Test `scrollWidth === clientWidth` på alle kort.

### L1 (lav): »Albuerne er bøjet til ca. 50°« (pres) og »til ca. 60°« (`shoulder.1`)

- **Hvor:** `content/explain/press.json:57`, `:119`, `:182`, `:245`, `:307`, `:369` og `:431`; `content/explain/shoulder.json:57`.
- **Hvorfor:**
  - **Er det rigtig træning? Ja.** Dybden er programmets: »lige over gulvet« (pres) og »hovedet ned foran hænderne« (skuldre). Ved den dybde er albuen bøjet godt forbi 90°.
  - 50° er vinklen i sidebilledet. Med albuerne 45° ud er den reelle vinkel ca. 60°. Den gamle tekst, »ca. 90°«, passede til en halv push-up, ikke til programmets dybde.
  - Ingen navne, doser eller regler er ændret.
  - **Men:** et gradtal kan brugeren ikke selv bedømme, og »bøjet 50°« læses let som en lille bøjning.
- **Rettelse:** skriv fx »Albuerne er bøjet godt forbi en ret vinkel«, eller udelad tallet. Brystet og hovedet er målet for dybden.

### L2 (lav): »… den på bøgerne lidt mindre« i `press.3` siger nu det modsatte af figuren

- **Hvor:** `content/explain/press.json:182`.
- **Hvorfor:**
  - Med »bøjet til ca. 50°« læses »lidt mindre« som en mindre vinkel, dvs. mere bøjet.
  - Figuren tegner albuen på bøgerne med 64° og den i gulvet med 54°, altså den på bøgerne mindre bøjet.
- **Rettelse:** »… og den på bøgerne er lidt mindre bøjet«, eller L1's formulering for begge.

### L3 (lav): Cuen »Dybt og roligt« i `legs.3 › backpack` følger ikke programmets ord

- **Hvor:** `content/figures/legs.json:135–139`.
- **Hvorfor:**
  - PROGRAM_KILDE, Ben trin 3, og kortets cue: »Dybt og kontrolleret«.
  - Teksten skal være ens på tværs af skærmene.
- **Rettelse:** »Dybt og kontrolleret« (3 ord; brydes på to linjer).

### L4 (lav): »Hælen i gulvet« står i `legs.5` kun i fasen »Sæt foden ned« på 0,6 sek

- **Hvor:** `content/figures/legs.json:276–279`.
- **Hvorfor:**
  - Mens den frie fod sættes ned, læses cuen som »sæt (den frie) hæl i gulvet«.
  - Hælen gælder de 5 sek ned: »Hold hele foden i gulvet«.
- **Rettelse:** sæt cuen i fase 1 (`"phase": 1`, `"point": "near.foot"`), og flyt pilen ved hoften til fase 3, »Rejs dig på to«. Der vises én markering ad gangen.

### L5 (lav, motoren): `repeat` med et tal kører alle gangene i kortet, så W3's løkke er 67 sek

- **Hvor:** `src/figure/motion.ts:51` og `:87–92`.
- **Hvorfor:**
  - SPEC 3.8: kortet viser bevægelsen og gentager den.
  - Med 20 squats à 3 sek ses wall sit-delen kun 6 af 67 sek. Åbner man kortet midt i squatsene, venter man et minut på at se den.
- **Rettelse:** lad kortet vise et `repeat` over 3 som 3 gange, som `"dose"` (SPEC 9.1 og `CARD_TIMING`). Labelen og passet beholder tallet.

### L6 (lav, motoren): Stolen har intet ryglæn

- **Hvor:** `src/figure/draw.ts:374–378`.
- **Hvorfor:**
  - `press.2`, `shoulder.2`, `pull.1`, `backpack_row.1` og `legs.4` siger, at stolen står med ryglænet mod en væg.
  - Figuren tegner en skammel ved siden af væggen.
- **Rettelse:** giv `chair` et ryglæn som sofaens `back` og `backSide`, og brug det i figurerne.

### L7 (lav): »Lige linje« i `posterior.4` og `posterior.5` er en prik ved knæet

- **Hvor:** `content/figures/posterior.json:196–200` og `:251–255`.
- **Hvorfor:**
  - Prikken viser ikke en linje.
  - Pointen er kroppen lige fra knæ til hoved (cuen »Lige fra knæ til hoved«).
- **Rettelse:** `{ "line": ["near.knee", "head"], "cue": "Lige linje", "phase": 2 }`. En linje i en fase følger kroppen (D60), som »Hæl til hoved« i `pull.3`.

### L8 (lav, uden for pakken): I »Nu« skubber et langt navn den første cue ind under »Næste«

- **Hvor:**
  - Tåløftet i tirsdagens tri-sæt: navnet og »Tri-sæt · sæt 5/12« står på to linjer hver;
  - `screenshots/review-p2-1-calf-nu.png`.
- **Hvorfor:**
  - SPEC 3.2: »Nu« viser figur, mål og cues.
  - Cuen »3 sek ned, 1 sek stop« er halvt dækket af »Næste«.
- **Rettelse:** vis kun de cues, der er plads til helt (til P4 eller P0).

## Positionsteksternes nye ordlyd (`git diff d92a6e2 da9abf8`)

| Punkt | Før → nu | Vurdering |
|---|---|---|
| `press.1`–`press.7`, »Nede« | »albuerne bøjet ca. 90°« → »bøjet til ca. 50°« | Rigtig træning ved programmets dybde (se L1). Formuleringen bør ændres, og `press.3` siger nu det modsatte af figuren (L2). |
| `shoulder.1`, »Nede« | »ca. 90°« → »til ca. 60°« | Som pres: rigtigt ved dybden »lige over gulvet«. Figuren tegner 57°. Se L1. |
| `pull.3`, »Nede« | »strakte og lodrette« → »næsten lodrette« | Passer med figuren (10° i dag) og med H1's rettelse (ca. 20°). |
| `pull.6` og `pull.7`, »Nede« | »lige over skulderen« → »næsten lige over skulderen« | Passer, også med H1. |
| `legs.2`, »Oppe« | »bagerste knæ let bøjet« → »bøjet ca. 120°« | Rigtigt. Med vristen på sofaen er bagerste knæ bøjet ca. 110–130° i toppen, og »let bøjet« var for lidt. |
| `posterior.1`, »Oppe« | »knæ ca. 90° med underbenet lodret« → »underbenet lodret, knæet bøjet ca. 65°« | Rigtigt: med lodret underben og skuldre, hofte og knæ på en linje (ca. 24° op) er knæet 90° − 24° ≈ 65°. Foden tæt på bagdelen passer med »ballen arbejder« og fejl 3. |

Ingen navne, doser, tempi eller regler er ændret. Teksterne til `backpack_row`, `calf`, `sl_rdl` og `wallsit` er ikke rørt.

## Skærmbilleder (`screenshots/`)

- **Kortet:**
  - `review-p2-1-press4-kort-nede.png`;
  - `review-p2-1-press6-kort-nede.png` og `review-p2-1-press7-kort-nede.png`;
  - `review-p2-1-pull5-kort-oppe.png`;
  - `review-p2-1-legs1-kort.png`;
  - `review-p2-1-w3-kort-fase.png`.
- **Fejlparrene:**
  - `review-p2-1-pull1-fejlpar.png` og `review-p2-1-pull1-fejlpar-forslag.png`;
  - `review-p2-1-slrdl-fejlpar.png` og `review-p2-1-slrdl-fejlpar-forslag.png`.
- **Kontaktark i dobbelt opløsning:**
  - `review-p2-1-pull3-albue-foran-brystet.png`;
  - `review-p2-1-pull3-forslag.png` og `review-p2-1-pull6-forslag.png`.
- **»Nu«:**
  - `review-p2-1-calf-nu.png` og `review-p2-1-calf-nu-zoom.png`;
  - `review-p2-1-nu-pushup.png`, `review-p2-1-nu-pike.png` og `review-p2-1-nu-rdl.png`, der viser, at de er fine.

## Ikke gjort

- **»Nu« for trin over 1** er ikke set: onboardingen satte trin 1 overalt. M8 foreslår en test, der dækker dem.
- **Vinklerne ovenfra og forfra** (M1, M2, M3 og M5) er ikke afprøvet; figuragenterne tegner dem. Ovenfra tjekker motoren kun formatet, så reviewet af rettelsen skal se kontaktarket.

## Opfølgning

Gennemgået igen på 2e0909b (7a300af–2e0909b: motorrunde 2 med D62 og figuragenternes rettelser). Jeg har set:

- `git diff da9abf8 2e0909b -- content/` for de ni spor;
- de nye kontaktark i `screenshots/figures/` og egne i dobbelt opløsning;
- kortene i `pixel9a` (Firefox uden JIT, `E2E_PORT=4186`), med vandret overløb målt på alle 42 kort;
- »Nu« i tidsmaskinen tirsdag 10/11 og fredag 13/11.

`check-explain` er OK for alle ni filer.

**Resultat:** 39 af 43 figurer er godkendt, og 4 er afvist:

- `legs.2` er stadig afvist (N1);
- `pull.2`, `shoulder.1` og `wallsit.W1` er nyt afvist (N2). Rettelsen er én linje hver og er afprøvet.

Af de oprindelige fund er H1, M1–M4, M6–M9, L1–L4, L7 og L8 rettet. M5 er rettet for `legs.1`, men ikke for `legs.2`. L5 og L6 er åbne.

Der er 4 nye fund: 3 middel og 1 lav.

### De afviste figurer

| Figur | Status | Hvad jeg så |
|---|---|---|
| `press.4` | Godkendt | Ovenfra: hænderne i dobbelt skulderbredde, skuldrene flyttet over mod den nære hånd, den nære albue bøjet ca. 45° bagud og den fjerne arm strakt ud til sin hånd. »Armen forbliver strakt« står fri af kroppen (`review-p2-1-opf-press4-kort.png`). Fra siden skrumper den fjerne arm stadig, men vinklen ovenfra viser nu, hvad der sker. |
| `press.6` | Godkendt | Ovenfra står fødderne i ±22 med linjen »Fødderne bredt«. Arbejdshånden står under brystet og den frie hånd på lænden (`review-p2-1-opf-press6-kort.png`). |
| `press.7` | Godkendt | Ovenfra står fødderne i ±6 med »Ingen vridning« ved hoften, så trin 6 og 7 kan skelnes. Teksten står over sidebilledet (N4). |
| `pull.1` | Godkendt | Fejlparret viser »Ryggen bliver rund« med ringen på den øvre ryg (`review-p2-1-opf-pull1-fejlpar.png`). |
| `backpack_row.1` | Godkendt | Som `pull.1`. |
| `pull.3` | Godkendt | H1's rettelse er ordret: albuen langs siden i »Oppe« og hovedet fri af bordet (`review-p2-1-opf-pull3-kort.png`). |
| `pull.5` | Godkendt | Fra siden uden den fjerne arm og med H1's skulder. Ovenfra med bordkanten, det brede greb, den nære albue langs siden og den fjerne arm næsten strakt (`review-p2-1-opf-pull5-kort.png`). |
| `pull.6` og `pull.7` | Godkendt | H1's rettelse, og den frie arm ligger langs siden. |
| `legs.1` | Godkendt | Forfra: fødderne på to skinner, knæet over tæerne med »Over tæerne« og fejlparret »knæet falder ind« forfra med ringen om knæet (`review-p2-1-opf-legs1-kort.png`, `-legs1-fejlpar.png`). »Hælen i gulvet« er flyttet til »Kontrolleret op«, hvor den passer til »pres dig op gennem forreste hæl«. Se N3 om »Nu«. |
| `legs.2` | **Stadig afvist** (N1) | Forfra er knæ over tæer og fejlparret rigtige, men sofaen står ved siden af figuren, og bagerste skinneben går op og ud til den. |
| `sl_rdl.1` | Godkendt | Rettelsen fra M6 er ordret, og ringen står om den øvre ryg (`review-p2-1-opf-slrdl-fejlpar.png`). |
| `calf.1` | Godkendt | Pilen i »Op« dækker intet i »Nu«, og begge cues står over »Næste« (`review-p2-1-opf-calf-nu.png`). |

### Fundene

| Fund | Status |
|---|---|
| H1 – albuen foran brystet i bord-row | **Rettet** i `pull.3`, `pull.5`, `pull.6` og `pull.7`. |
| M1 – archer push-up fra siden | **Rettet:** vinkel ovenfra. |
| M2 – archer bord-row fra siden | **Rettet:** vinkel ovenfra, og den fjerne arm er skjult fra siden. |
| M3 – `press.6` og `press.7` ens | **Rettet:** vinkler ovenfra med forskellig fodstilling. |
| M4 – fejlparret i rygsæk-row | **Rettet:** fejl 3, »Ryggen bliver rund«. |
| M5 – vinkel forfra i split squat | **Delvist:** rettet i `legs.1`. For `legs.2`, se N1. |
| M6 – ringen i RDL | **Rettet.** |
| M7 – »Helt op« over foden | **Rettet:** en pil i fase 2. |
| M8 – tekst over kroppen | **Rettet i motoren** (D62 (2)). På kortene og i »Nu« står teksterne fri af kroppen. W3's »Lårene vandrette«, `legs.7`'s »Driv knæet op« og split squats »Over tæerne« står i striben over tegningen. Se N4. |
| M9 – fasen ud over kortet | **Rettet** (D61 (5)). W3's fase står på to linjer, og ingen af de 42 kort er bredere end 414 px (`review-p2-1-opf-w3-kort.png`). |
| L1 – gradtal i positionerne | **Rettet:** »godt forbi en ret vinkel« i pres og i `shoulder.1`. |
| L2 – »lidt mindre« i `press.3` | **Rettet:** »den på bøgerne er lidt mindre bøjet«. |
| L3 – »Dybt og roligt« | **Rettet:** »Dybt og kontrolleret«. |
| L4 – »Hælen i gulvet« i `legs.5` | **Rettet:** cuen står i fase 1 og pilen i fase 3. |
| L5 – W3's løkke | **Åben:** stadig 67 sek i kortet. |
| L6 – stolen uden ryglæn | **Åben.** |
| L7 – »Lige linje« | **Rettet:** en linje fra knæ til hoved. |
| L8 – cuen under »Næste« | **Rettet** (D61): i tåløftets »Nu« står begge cues over »Næste«. |

### Nye fund

**N1 – Forfra i `legs.2` står sofaen ved siden af, og bagerste ben går ud til den (middel)**

- **Hvor:**
  - `content/figures/legs.json` › `legs.2` › `second`: sofaen i x = −30, og bagerste fod i (−12; 23,6);
  - `review-p2-1-opf-legs2-forfra-sofa.png` og `review-p2-1-opf-legs2-kort-nede.png`.
- **Hvorfor:**
  - Udgangsstillingen siger »Stå med ryggen til sofaen«, og sidebilledet viser sofaen bag figuren.
  - Forfra står sofaen til venstre for figuren, og bagerste skinneben går op og ud til den. Midt i bevægelsen peger bagerste knæ ud til siden. Det ligner en fod på en kasse ved siden af.
  - NAT-3 pakke 2: rekvisitter og kontakter skal være rigtige.
  - Motoren kan ikke stille en rekvisit bag figuren forfra. Med sofaen midt bag figuren finder `check-explain` 6 fejl, fordi knæ og hofte går ind i den.
- **Rettelse:**
  - **Hurtigt:** fjern `second` og fejlparret forfra fra `legs.2` (afprøvet: `check-explain` OK). Hælens fejlpar fra siden står, og `legs.1` viser knæ over tæer.
  - **Bedre (motoren):** en rekvisit, der står bag figuren i den anden vinkel, fx `"behind": true`. Den tegnes bag kroppen og er kun flade for det lem, der hviler på den. Så kan sofaen stå midt bag figuren med bagerste skinneben lodret op til sædet.

**N2 – Fejlringen står forkert i fejlpar for trin 1 og 2 (middel)**

- **Hvor:** `faults` i:
  - `pull.2` (ringen ved skulderen);
  - `shoulder.1` (ved skulderen);
  - `wallsit.W1` (ved knæet);
  - lav: `wallsit.W2` (ved skulderen) og `posterior.2` (ved knæet).

  Se `review-p2-1-opf-ring-*.png`.
- **Hvorfor:**
  - D62 (3): ringen står om det led, hvis vinkel ændrer sig mest. Når hoften hænger med hænder og fødder plantet, ændrer skulderen sig mest. Når hoften glider op ad væggen, ændrer knæet sig mest. Ringen peger så væk fra fejlen (SPEC 3.8, samme slags som M6).
  - I W1 ligner en ring om knæet desuden fejl 2, »Knæene står foran tæerne«. W1 er fredagens wall sit.
  - `pull.2`, W1 og W2 havde ringen rigtigt før D62.
  - `shoulder.1` (ringen ved hovedet) og `posterior.2` (ved knæet) havde den forkert allerede på da9abf8. Det overså jeg i første runde.
- **Rettelse** (afprøvet: `check-explain` OK, og ringene står, hvor de skal):
  - `"ring": "hip"` i `pull.2`, `shoulder.1`, `wallsit.W1` og `posterior.2`;
  - `"ring": "far.hand"` i `wallsit.W2`.
  - Overvej at gøre `ring` påkrævet i et fejlpar, så figuragenten altid siger, hvor fejlen er.

**N3 – To vinkler i »Nu« gør split squat mindre end halvt så stor (middel)**

- **Hvor:**
  - »Nu« for `legs.1` i tirsdagens Par 2: `review-p2-1-opf-nu-split-squat.png` og zoom før og efter (`-zoom.png`, `-zoom-foer.png`);
  - layoutet for to stående vinkler ved målet (D60 (3), D61 (3) og D62 (2)).
- **Hvorfor:**
  - SPEC 5: figuren er hovedpersonen. SPEC 6: telefonen ligger på gulvet ca. 1 m væk.
  - Med vinklen forfra står de to tegninger side om side ved målet, og striben til »Over tæerne« tager højde over dem.
  - Sidebilledet er nu ca. 50 × 62 px mod ca. 114 × 148 px med én vinkel på da9abf8. Squat jumpet bliver lidt større, fordi det er smallere.
  - Split squat er tirsdagens øvelse.
- **Rettelse** (motoren, SPEC 3.2 og en linje i DECISIONS):
  - Vis kun den første vinkel i »Nu« og i pausen, når to vinkler side om side ville give en tegning under ca. 100 px. Begge vinkler står stadig på kortet.
  - Eller giv to stående vinkler hele bredden over målet.
  - Test tegningens højde i »Nu« for figurer med to vinkler.

**N4 – En tekst kan stå over den anden vinkel på kortet (lav)**

- **Hvor:**
  - `legs.2` i »Kontrolleret op«: »Over tæerne« står over sidebilledet, mens linjen er i frontbilledet;
  - `press.7` i »Nede«: »Ingen vridning« står over sidebilledet, mens prikken er på hoften ovenfra;
  - `review-p2-1-opf-legs2-kort-op.png` og `review-p2-1-opf-press7-kort.png`.
- **Hvorfor:** teksten dækker intet, men står ved den forkerte tegning og læses som sidebilledets. Det er samme fund som N3 i del 2.
- **Rettelse (motoren):** lad en tekst i området over eller under kroppene stå over sin egen vinkel.

### Kørt

- `node scripts/check-explain.ts` på de ni figurfiler: OK.
- Kontaktark i dobbelt opløsning for alle ni spor.
- Kortene i `pixel9a`:
  - de 13 figurer, der var afvist;
  - fejlparrene;
  - overløb på 42 kort, der alle er 414 px brede.
- »Nu« i tidsmaskinen tirsdag 10/11 og fredag 13/11.
- Afprøvet i scratch-kopier:
  - `ring` i fem fejlpar og `legs.2` uden vinklen forfra: `check-explain` OK;
  - sofaen midt bag figuren forfra: 6 fejl, derfor er det en sag for motoren.

Skærmbilleder: `screenshots/review-p2-1-opf-*.png` (22 filer).

## Slutstatus

Tjekket på b6e7147 (rettelserne i a749ca1 og kontaktarkene i b6e7147) i worktree `wt/r1`:

- `node scripts/check-explain.ts`: OK for `legs`, `pull`, `shoulder`, `wallsit` og `posterior`;
- kontaktarkene i `screenshots/figures/` og egne i dobbelt opløsning;
- »Nu« for split squat tirsdag 10/11 i tidsmaskinen (`E2E_PORT=4194`).

### De figurer, der stadig var afvist

| Figur | Status | Hvad jeg så |
|---|---|---|
| `legs.2` | **Godkendt** | Vinklen forfra og fejlparret forfra er væk. Sidebilledet med sofaen bag figuren og hælens fejlpar med ringen ved foden står (`review-p2-1-slut-legs2-fra-siden.png`). |
| `pull.2` | **Godkendt** | `"ring": "hip"`: ringen står om den hængende hofte. |
| `shoulder.1` | **Godkendt** | `"ring": "hip"`: ringen står om hoften, der er faldet. |
| `wallsit.W1` | **Godkendt** | `"ring": "hip"`: ringen står om hoften, der er gledet op ad væggen, ikke om knæet. |

Det lave i N2 er også rettet. I `wallsit.W2` står ringen om den hånd, der falder fra garden, og i `posterior.2` om hoften (`review-p2-1-slut-ringe-pull2-shoulder1-posterior2.png` og `review-p2-1-slut-ringe-w1-w2.png`).

### N1–N3

| Fund | Status |
|---|---|
| N1 – sofaen ved siden af forfra i `legs.2` | **Rettet** med den hurtige løsning. Vinklen forfra er fjernet, og `legs.1` viser heller ikke knæ over tæer lige nu (se N3). Det kræver en rekvisit bag figuren i motoren, før vinklen forfra kan komme tilbage. |
| N2 – fejlringen | **Rettet** i de fem fejlpar. **Men** `legs.1`'s eneste fejlpar, »Forreste hæl letter«, har ringen om knæet, ikke om hælen. Sådan har det været siden D62; jeg overså det i opfølgningen. Det er samme slags fejl, og en ring om knæet kan læses som »knæet for langt frem«. Rettelse (afprøvet: `check-explain` OK, ringen står om anklen, `review-p2-1-slut-legs1-ring-knae-og-fod.png`): `"ring": "near.foot"` i `legs.1`'s fejl 1. Split squat er tirsdagens øvelse. |
| N3 – to vinkler i »Nu« | **Rettet:** split squat står igen i én vinkel i »Nu« (`review-p2-1-slut-nu-split-squat.png`). Figuren er ca. 65 × 108 px mod 114 × 148 px på da9abf8. Det skyldes D61's 152 px for en stående figur i »Nu« og striben, D62 holder plads til »Hælen i gulvet«. Den er tydelig nok til at kende øvelsen igen, så det er en bevidst afvejning og ikke et nyt fund. Knæ over tæer forfra mangler, til »Nu« kan vise én vinkel og kortet begge. |

**Samlet:** alle 4 figurer, der stadig var afvist, er godkendt, og N1–N3 er rettet eller begrundet. Én linje mangler: `"ring": "near.foot"` i `legs.1`. Indtil den er lagt ind, er 42 af 43 figurer godkendt.

Skærmbilleder: `screenshots/review-p2-1-slut-*.png` (5 filer).
