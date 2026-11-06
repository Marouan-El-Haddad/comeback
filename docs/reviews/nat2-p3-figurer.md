# Review af NAT-2 P3 – Figursystemet og animationen

2026-11-06 · commits ce36e67, c23e514, d52e302, 33a1d3b, 6d1c8bb, 2b3feda, 3be4e44, 9a3c254, 5d1999b og 533c543 (c984532 er indhold og ikke med)

Metode:

- Læst mod pakke 3 i `docs/runs/NAT-2.md`, P3 i `docs/runs/NAT-2-TASKS.md`, `docs/SPEC.md` 3.8, 5, 6, 7 og 9.1, `docs/DECISIONS.md` D48 og R17 og `tools/pictos/` (README, `picto.py`, `poses.py`).
- Kørt i worktreen:
  - Vitest 534/534, `tsc` og eslint uden fejl;
  - build: JS 75,6 kB gz;
  - `check-explain` på alle filer: OK;
  - Playwright i `pixel9a` (Firefox uden JIT): `e2e/figure.spec.ts` 5/5 og hele suiten 47/47 (begge projekter, ingen gentagne forsøg).
- Startfilerne er sammenlignet med c160cbc (før P3, bygget fra `git archive`). `index` og `engine` er byte for byte ens bortset fra versionsteksten, og `index.html` er 97 byte større (`--c-picto-*`).
- Scratch-flows i `pixel9a`, ikke committet:
  - billeder i sekundet, talt med en MutationObserver;
  - appen i baggrunden via `visibilitychange`;
  - trykflader og tekststørrelser;
  - tid til at åbne kortet;
  - figuren undervejs i »3 sek ned«;
  - stillbilleder med fem positioner.
- Leddenes vinkler målt hvert kvarte sekund gennem hele animationen for de tre figurer med `src/figure/motion.ts` (scratch-script).
- 28 forkerte kopier af referencefigurerne kørt gennem `check-explain` og `figure-sheet`. Fejlene var:
  - svævende fødder og tæer;
  - hænder i væg, gulv og stol;
  - knæ og albuer, der bøjer forkert;
  - forkert `facing`;
  - hoved og bryst i gulvet;
  - en hængende hofte;
  - en rygsæk i gulvet.

## Resultat

1 høj, 3 middel og 4 lav.

- **Det virker:**
  - **Tempoet:** push-up 3 sek ned, 1 sek stille og 1 sek op, row 1 + 1 + 3 sek og wall sit 2 + 2 + 2 sek.
  - **Afspilning:** slowmotion virker både ved tryk og med knappen, og ved reduceret bevægelse vises stillbilleder.
  - **Tekstalternativet:** `role="img"` med positionerne og faserne.
  - **Synlighed:** den aktuelle fase står i rødt med en streg under (7,5:1), og faserne er 20 px.
  - **Størrelser:** figuren er 382 × 150 px (wall sit 185 × 214 ved siden af faserne), og knappen er 128 × 56 px.
  - **Ydelse:** i Firefox uden JIT tegner animationen 22 billeder i sekundet (højst 30). I baggrunden og uden for skærmen tegner den ingen, og bagefter fortsætter den, hvor den stod. Kortet med figur åbner på 33–51 ms mod 30–48 ms uden.
  - **Startfilerne** er uændrede, og figurerne er SVG.
- **Referencefigurerne:** keyframes er anatomisk mulige, og knæ og albuer bøjer den rigtige vej. Kontakten passer:
  - push-up: hænder og tæer i gulvet;
  - wall sit: ryg og hofte mod væggen, fødderne i gulvet og knæene over anklerne i 90°;
  - row: én hånd på stolesædet, og rygsækken i hånden fra lodret arm op til hoften.

  Men animationen mellem push-uppens to positioner knækker knæet (H1). Desuden er led, som teksten kalder strakte, tegnet 16–24° bøjede i alle tre figurer (M2).
- **Figurtjekket** fanger det, det skal, i hver position:
  - svævende fødder og tæer;
  - hænder i væg, gulv og stol;
  - kontakter, som positionen ikke nævner;
  - hovedet i gulvet;
  - glidende hænder og fødder;
  - punkter uden for rækkevidde;
  - led givet ved punkter, der bøjer forkert.

  Det overser forkert `facing`, når fødderne ikke har `tip`. Det overser også alt mellem positionerne undtagen bøjningsretningen, og det ser ikke rygsækken (M1).
- **Vejledningen** i `tools/pictos/README.md` har den rigtige arbejdsgang. Men den mangler `facing`, eksemplerne og tjekkets blinde pletter (M3).

## Fund

### H1 (høj): Push-uppens knæ knækker mellem positionerne, så kroppen ikke er én planke

- **Hvor:**
  - `src/figure/motion.ts:216`: `hip: lerpPoint(a.hip, b.hip, u)` i `lerpPose`;
  - `src/figure/check.ts:686–701`: mellem positionerne tjekkes kun bøjningsretningen;
  - `src/figure/sheet.ts:176–183`: løgskallen på kontaktarket skjuler knækket;
  - `docs/DECISIONS.md:56`: D48 punkt 2.

  Skærmbillede: `screenshots/review-p3-pushup-halvvejs-ned.png`. Knækket ses også i den committede `screenshots/kort-skimmet.png`.
- **Hvorfor:** Kilderne er
  - positionsteksten »Kroppen er stadig én lige linje fra hæl til hoved«, cuen »Kroppen som én planke« og den første typiske fejl, »Hoften hænger«, i `content/explain/press.json`;
  - NAT-2 pakke 3: kvalitet mindst som piktogrammerne;
  - SPEC 9.1 (Led) og 3.8: »En, der aldrig har set øvelsen, skal kunne lave den rigtigt ud fra kortet og figuren«.

  Hoften følger en lige linje mellem de to keyframes, mens fødderne står fast. Men kroppen drejer om fødderne, så hoften burde følge en bue. På den lige linje kommer hoften 0,46 tættere på anklen, og så bøjer IK'en det nære knæ:
  - Halvvejs nede er knæet 164° (16° bøjning) og hænger 3,3 enheder under linjen fra ankel til skulder. Det er ca. 10 CSS-px på telefonen, en halv lemtykkelse.
  - Knæet er bøjet mere end 8° i ca. 2 af de 3 sek ned og ca. 0,7 af 1 sek op, altså i halvdelen af hver gentagelse.
  - Det fjerne ben når ikke sin ankel (47,6 > 47) og står strakt. Derfor stikker det lyse ben op over det mørke.

  Tjekket ser det ikke, for billederne mellem positionerne tjekkes kun for bøjningsretning. Løgskallen på kontaktarket tegner dem lyst oven i hinanden.

  Fejlen sidder i motoren og ikke i data. Den rammer alle figurer, hvor et strakt lem drejer om en hånd eller fod, der står fast: planker, push-up-trinene, pike, hollow og bro. P4 og P5 må ikke ændre koden.
- **Rettelse** (efter ændringsprotokollen: SPEC og D48 først, så test og kode):
  - D48 punkt 2 og SPEC 9.1 (Led): står en fod fast (samme `to` i begge keyframes), drejer hoften om den. Hoftens afstand og vinkel til anklen interpoleres i stedet for x og y. Brug den nære fod, ellers den fjerne. Så er et lem, der er strakt i begge positioner, strakt hele vejen. Wall sit'en glider stadig ned ad væggen, og hoften kommer højst 0,9 nærmere.
  - Ret `lerpPose` i `src/figure/motion.ts` efter den regel.
  - Udvid `checkFigure`: et knæ eller en albue, der er strakt (over ca. 170°) i begge positioner, må ikke bøje mere end 8° imellem dem. Beskeden kunne være »undervejs: near.legs: knæet bøjer 16° mellem to strakte positioner«.
  - Tilføj tests:
    - `press.1` hvert 0,1 sek: begge knæ er mindst 175°, og hoften er højst 0,5 fra linjen fra ankel til skulder;
    - `wallsit.W1`: hoften er højst 7,5 fra væggen hele vejen.
  - Tegn billedet midt i hver bevægelse (u = 0,5) som et eget felt på kontaktarket, så et knæk kan ses.
  - Tag nye skærmbilleder af kortet og kontaktarket.

### M1 (middel): Figurtjekket overser forkert `facing`, alt mellem positionerne og rygsækken

- **Hvor:**
  - `src/figure/check.ts:512–520`: fodens retning tjekkes kun med `tip`;
  - `src/figure/check.ts:686–701`: mellem positionerne tjekkes kun bøjningsretningen;
  - `src/figure/check.ts:155–157`: rygsæk og flasker er ikke med blandt fladerne;
  - `src/figure/check.ts:395`: billedet ovenfra tjekkes ikke;
  - `src/content/validate.ts:907`: `tip` er valgfri.

  Skærmbilleder: `screenshots/review-p3-row-forkert-facing-ingen-fejl.png` og `screenshots/review-p3-rygsaek-i-gulvet-ingen-fejl.png`.
- **Hvorfor:** NAT-2 pakke 3 og P3 kræver »Kvalitet som tests: led bøjer den rigtige vej, kontakt med gulv, væg og stol passer«. Det står også i SPEC 9.1 (Led, Kontakter). Ifølge D48 skriver flere agenter figurerne i P4 og P5 som rene datafiler, og `check-explain` er porten.
  - **Forkert `facing`:** i sidebilledet bøjer IK'en altid efter `facing`. Et knæ, der bøjer forkert, kan derfor kun komme fra en forkert `facing`. Den fanges kun af fodens retning (`tip`) eller tilfældigt af en kontakt. Scratch-test: `pull.1` med `facing: -1` og uden `tip`, eller med spejlede `tip`, giver »ingen problemer«. Imens bøjer det forreste knæ og den trækkende albue bagud. `press.1` med `facing: -1` uden `tip` fanges kun, fordi en albue tilfældigt rører gulvet.
  - **Mellem positionerne** tjekkes hverken kontakter eller flader. Et knæ eller et hoved kan gå gennem gulvet eller væggen undervejs, og knækket i H1 består.
  - **Rygsækken:** en rygsæk 5,6 enheder nede i gulvet giver »ingen problemer«.
  - **Billedet ovenfra:** her tjekkes intet ud over formatet.
- **Rettelse:**
  - Kræv `tip` på hvert synligt ben i sidebilledet. Piktogrammerne tegner fødder på 62 af 68 ben, og så vogter fodens retning altid `facing`.
  - Kør tjekket af flader (intet mere end 1,5 ind i en flade) og reglen om strakte led fra H1 i billederne mellem positionerne.
  - Tag båret rygsæk og flasker med som kasser, der ikke må gå ind i gulv og møbler.
  - Tilføj en test for hvert hul med en forkert kopi, som i `src/figure/__tests__/check.test.ts`.
  - Skriv i SPEC 9.1, hvad tjekket ikke ser, fx holdning som en hængende hofte og billedet ovenfra. Det skal man se efter på kontaktarket.

### M2 (middel): Led, som teksten kalder strakte, er tegnet 16–24° bøjede i alle tre referencefigurer

- **Hvor:**
  - `content/figures/press.json:12` (`top`): albuerne er 163° og 160°;
  - `content/figures/wallsit.json:12` (`stand`): knæene er 163° og 156°;
  - `content/figures/pull.json:15` (`bottom`): den trækkende albue er 158°.

  Se albuerne i `screenshots/kort-figur.png` og stillbilledet af row'en.
- **Hvorfor:** Positionsteksterne i `content/explain/` siger »Strakte arme« (`press.1` Oppe) og »Benene er strakte« (`wallsit.W1` Stående), og positionen i `pull.1` hedder »Strakt arm«. NAT-2 pakke 3 kræver led, der bøjer den rigtige vej, og figurer mindst som piktogrammerne.
  - To-leds IK er meget følsom nær fuld længde. En hånd 0,4 inden for rækkevidde (30,6 af 31) giver 17° bøjning, og 0,1 giver 9°. Alle tre figurer ligger 0,4–1 inden for.
  - »Strakt arm« over en tydeligt bøjet albue får en nybegynder til at tro, at armen skal være bøjet i bunden. Uden en regel i vejledningen gentager P4 og P5 fejlen.
- **Rettelse:**
  - Læg punktet på fuld længde eller op til 1 ud over (arm 31 fra skulderen, ben 47 fra hoften), så lemmet tegnes strakt. Eksempler:
    - push-uppens top: overkrop og ben på samme linje i ca. 20,8°, så hoften er ca. (43,94; 20,29);
    - row'ens hånd lodret 31 under skulderen, ca. (59,58; 22,76);
    - wall sit'ens stående hofte ca. 1 højere (y ≈ 44,5), så begge ben er strakte.
  - Vis knæ- og albuevinklen ved hver position på kontaktarket, så bøjningen kan ses.
  - Tilføj reglen i vejledningen (se M3).

### M3 (middel): Vejledningen til figuragenterne mangler `facing`, eksemplerne og tjekkets blinde pletter

- **Hvor:** `tools/pictos/README.md:17–32`.
- **Hvorfor:** P4 og P5 laves af flere agenter parallelt som rene datafiler uden kodeændringer, og revieweren bedømmer figurerne ud fra kontaktarkene (NAT-2-TASKS P4 og P5, D36, D48). Ud over SPEC 9.1 har agenterne kun vejledningen. Den har disse huller:
  - **`facing`:** vejledningen siger, at knæ og albuer bøjer ud fra `facing`. Den siger ikke, hvordan `facing` vælges, eller at den blå pil på kontaktarket skal pege ud af brystet. En forkert `facing` er den eneste måde, et knæ kan bøje forkert i sidebilledet, og tjekket fanger den ikke altid (M1).
  - **Eksempler:** de tre referencefigurer nævnes ikke: gulv i `press.json`, væg i `wallsit.json` og stol og rygsæk i `pull.json`.
  - **Tjekkets grænser:** der står ikke, at »OK« ikke dækker holdning, billederne mellem positionerne, rygsækken og billedet ovenfra. Derfor skal man selv se på »Bevægelsen« og pilen.
  - **Strakte led og flader:** reglen for strakte led mangler (M2). Det står heller ikke, hvor fladerne er: stolesæde, bordplade, trappetrin og seng i `height`, og bøger i `at[1] + 2,4 × antal − 0,4`.
  - **Forfra:** her vælger `bend` siden, og tjekket ser ikke valget. 1 på `near` og −1 på `far` sender knæ og albuer udad.
- **Rettelse:** Tilføj punkterne til »Faldgruber« med højst én linje hver. Læg et afsnit »Det ser tjekket ikke« ind efter trin 3.

### L1 (lav): Stillbilleder med 4–6 positioner bliver 54–67 px brede

- **Hvor:**
  - `src/ui/components/figure.css:90–107`: `.figure-stills` står på én række uden ombrydning;
  - `src/ui/components/Figure.tsx:208–231`.

  Skærmbillede: `screenshots/review-p3-fem-stillbilleder.png`, hvor push-uppens to stillbilleder er kopieret til fem på 67 px hver.
- **Hvorfor:** SPEC 3.8 og 6 (reduceret bevægelse, og »en, der aldrig har set øvelsen …«). 36 af 146 bevægelser i forklaringerne har 4–6 positioner, fx burpees, klubsekvensen, power, W3 og W5. Med reduceret bevægelse bliver de så små, at de er svære at se fra gulvet. P4 og P5 må ikke ændre koden.
- **Rettelse:** Ombryd til højst tre stillbilleder pr. række, eller to, når figuren er bred. Tilføj et Playwright-flow med fem positioner, når den første sådan figur findes.

### L2 (lav): Ingen test af pausen i baggrunden, loftet på 30 billeder og opslaget af figuren ved »like« og »Potensér«

- **Hvor:**
  - `e2e/figure.spec.ts`: tester kun figuren uden for skærmen;
  - `src/ui/__tests__/card.test.ts`: ingen test af `figureIn`, `CardMovement.source` eller `figureText`.
- **Hvorfor:** SPEC 3.8 og 7 kræver, at figuren står stille i baggrunden og tegner højst 30 gange i sekundet. Ifølge D48 vises figuren også ved flere bevægelser og ved »Potensér«.
  - I scratch målte jeg 22 billeder i sekundet og 0 i baggrunden, men ingen test holder det fast.
  - Opslaget for `measures.hollow` (som `core_front.2`), `burpee_emom.E2` (som E1) og »Potensér« bruges først, når P4 og P5 tegner figurerne. Fejler opslaget, viser kortet piktogrammet uden at sige noget.
- **Rettelse:**
  - Et Playwright-flow, der sætter `document.visibilityState` til `hidden` og sender `visibilitychange`. Det tjekker, at fasen står stille, og tæller tegninger i sekundet med en MutationObserver.
  - Unit-tests af:
    - `figureIn`, også en figur med `like`;
    - `cardMovements(...).source` ved `like` i samme fil og i en anden fil og ved »Potensér«;
    - `figureText`.

### L3 (lav): Kontaktbeskeden viser afstanden for den forkerte fod og siger ikke hvilken

- **Hvor:** `src/figure/check.ts:417–425`.
- **Hvorfor:** SPEC 9.1 kræver korte danske fejlbeskeder med sted, og ifølge D48 retter agenterne figurerne ud fra beskederne. Når den nære fod i wall sit svæver 6 over gulvet, står der »foden (begge) skal røre gulvet, men er 0,3 fra (1 af 2 gør)«. De 0,3 er den anden fods tå.
- **Rettelse:** Nævn de lemmer, der ikke rører fladen, med deres egen afstand, fx »near.foot skal røre gulvet, men er 6 over (1 af 2 gør)«.

### L4 (lav): D48 siger, at figurens CSS ligger i en egen fil, men den ligger i kortets JavaScript

- **Hvor:** `docs/DECISIONS.md:56` (D48, konsekvens) mod `src/ui/components/Figure.tsx:22–34` (`figure.css?inline`).
- **Hvorfor:** D48. Adfærden er rigtig, for startfilerne er uændrede. Men en agent vil lede efter en CSS-fil, der ikke findes.
- **Rettelse:** Ret D48 til »dens CSS lagt ind i kortets fil«.

## Tjekket uden fund

- **Datasikkerhed:** P3 rører hverken lageret, hændelserne eller tidsmaskinen. Slowmotion og stillbilleder skriver intet.
- **Tempo og løkke:** faserne varer som deres sekunder (Vitest og Playwright med `page.clock`). En `"dose"`-fase varer 2 sek, og slowmotion kører med halv fart. Labeltjekket fra L7 godtager holdets tid fra dosis (»Hold 10 sek«) og tiden for én gentagelse (»Et slag hver 1,5 sek«), og det afviser andre tider med et råd, der kan følges (tests i `src/content/__tests__/validate.test.ts`).
- **Tilgængelighed:**
  - figuren og stillbillederne har tekstalternativ, og SVG'en er skjult for skærmlæsere;
  - knappen »Slowmotion« har tekst;
  - den aktuelle fase vises med både farve og streg;
  - ingen tekst på kortet er under 18 px;
  - der er ingen forbudte mønstre, og `a11yProblems` er grøn.
- **Indhold:** tempo og navne er programmets: `press.1` har 3 sek ned og 1 sek pause, `pull.1` 1 sek stop i toppen og `wallsit.W1` ingen tider. Figurerne ændrer intet i `program/`.
- **Opstart:** startfilerne er ens med c160cbc. Kortets fil er vokset fra 2,9 til 9,5 kB gz og hentes i baggrunden et sekund efter I dag.
- **Brug under træning:** kortet holder stadig passet stille, når det åbnes fra passet, og figuren kører kun på kortet.

## Skærmbilleder fra revieweren

- `screenshots/review-p3-pushup-halvvejs-ned.png`: figuren 1,5 sek inde i »3 sek ned« (H1).
- `screenshots/review-p3-row-forkert-facing-ingen-fejl.png`: kontaktarket for `pull.1` med `facing: -1` og uden `tip` siger »ingen problemer« (M1).
- `screenshots/review-p3-rygsaek-i-gulvet-ingen-fejl.png`: rygsækken står i gulvet, og kontaktarket siger »ingen problemer« (M1).
- `screenshots/review-p3-fem-stillbilleder.png`: fem stillbilleder side om side (L1).
