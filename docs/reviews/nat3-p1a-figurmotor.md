# Review af NAT-3 P1a – Figurmotoren rettet (og P3a – feltet »Mærk«)

2026-11-09 · P1a: a2b48c7, fd74aae, fc4ba80, c627215, 20648bc, 53c52de og ac78155 · P3a: 0a6b352, 77072e3 og 112ef68 · worktree på ac78155

Metode:

- **Læst** mod:
  - briefen `docs/runs/NAT-2-P3-FIX.md` (H1, M1–M3, L1–L4 og grænserne 1–6);
  - P1a i `docs/runs/NAT-3-TASKS.md` og det oprindelige review `docs/reviews/nat2-p3-figurer.md`;
  - SPEC 3.8 og 9.1 og DECISIONS D48, D55, D56, R20 og P68;
  - `tools/pictos/README.md` og `docs/runs/NAT-3-FIGURES.md`.
- **Kørt** i worktreen:
  - Vitest for figur, indhold og kort: 251/251;
  - `node scripts/check-explain.ts`: OK, 14 figurer som VENTER. `content/figures/burpee_emom.json` alene giver FEJL og exit 1;
  - Playwright i `pixel9a` (Firefox uden JIT): `figure.spec.ts` og `card.spec.ts` 17/17.
- **Egne flows** i `pixel9a` (scratch, ikke committet):
  - figuren i ægte tid: 22,2–22,6 tegninger i sekundet for push-up, burpee og wall sit, og kortet åbner på 39–103 ms;
  - burpee E1 og spidermanen midt i en fase;
  - etbens bounds med `advance`, som `NAT-3-FIGURES.md` anviser (figurfilen ændret med `page.route`).
- **Startfilerne** er bygget fra `git archive fcf8c3e` (lige før P1a) og sammenlignet med P1a. `engine` er byte for byte ens. `index.js` og `index.html` er ens, når versionsteksten og de lazy filers navne er normaliseret.
- **Scratch-scripts** over `src/figure/`:
  - alle figurer med 120 billeder pr. bevægelse mod tjekkets 7. Målt: bøjning ud over positionerne, segmentlængder, led og segmenter i flader, forkert bøjning, spring mellem to billeder ved 30 billeder i sekundet og spring ved positionerne;
  - vinkler hvert 0,1–0,25 sek for push-up, dead bug, wall sit, RKC-planke, row, nordic (trin 4 og 6), tåløft, burpee, spiderman og nakke N5;
  - de samme mål med motoren fra før P1a (`git archive fd74aae~1`).
- **Omkring 30 ændrede kopier** gennem `checkFigure` og formatvalideringen:
  - vendt `facing` med og uden spejlede fødder: push-up, wall sit, planke, dead bug, bord-row og hollow;
  - rekvisitter på ryggen;
  - `spine` på kat-ko og curl-up;
  - `advance` på bounds og længdespring;
  - hver rettelse, `NAT-3-FIGURES.md` anviser for ventelisten og håndstanden.

## Resultat

2 høj, 2 middel og 2 lav. P3a har ingen fund.

- **Det virker:**
  - **Det oprindelige reviews H1 er rettet** for figurerne, der består:
    - push-uppens knæ er 180° hele vejen;
    - wall sit'ens hofte bliver 4,5–5,5 fra væggen;
    - nordic drejer om knæet;
    - dead buggens frie arm holder længden;
    - i tåløftet står tæerne stille, mens foden drejer om dem.
  - **Med 120 billeder pr. bevægelse** finder jeg kun to små overskridelser i figurer, der består (L2). Ingen figur, der består, springer mellem to billeder.
  - **Det oprindelige reviews M1–M3 og L1–L4 er lavet:**
    - fødder er påkrævet, og et lår over 70° bag kroppen fanges;
    - strakte led læses i teksten (men se M2);
    - kontaktbeskeden nævner hvert lem;
    - stillbillederne står højst tre pr. række;
    - testene af baggrunden og loftet på 30 billeder i sekundet findes.
  - **`spine`, ansigtsmærket, flasker langs ryggen og sidekontakten virker.**
  - **Ventelisten er ærlig.**
  - **Ydelsen** holder.
- **Det virker ikke:**
  - `advance` får figuren til at springe frem og tilbage, og tjekket siger OK (H1).
  - `lift` gør ikke skridt og hop mulige, for knæet går stadig i gulvet. 11 af de 14 figurer på ventelisten kan ikke rettes som anvist, og fem anvisninger i `NAT-3-FIGURES.md` virker ikke (H2).
  - To andre anvisninger er forkerte (M1).
  - Tjekket af strakte led læser ikke »strakt knæ« (M2).

## Fund

### H1 (høj): `advance` får figuren til at springe tilbage til start efter hver bevægelse, der flytter den, og tjekket siger OK

- **Hvor:**
  - `src/figure/motion.ts:93–103` (`timeline`, `push`): kun en bevægelse med sin egen `advance` får `shift`. Alle andre (land → push, et hold, de næste faser) tegnes ved x = 0, og vejen tilbage (`:120–127`) starter fra den samlede forskydning.
  - `src/figure/__tests__/figure.test.ts:564` tester kun en `repeat`, hvor begge veje flytter figuren.
  - Skærmbilleder: `screenshots/review-p1a-bounds-advance-foer-spring.png` og `screenshots/review-p1a-bounds-advance-efter-spring.png`.
- **Hvorfor:**
  - **Kilderne:** briefen, grænse 3 (bounds i `power_legs.6` skal kunne flytte figuren frem), SPEC 9.1, Overgange (»flytter hele figuren langs x … vejen tilbage til start fører figuren tilbage«) og D56 (3). `NAT-3-FIGURES.md:46–47` anviser netop `advance` til bounds og længdespringet.
  - **Bounds** med `advance` 20 på push → air og air → land, som anvist. I appen er torsoens x hver 1/30 sek »… 34 37 38 −1 −1 1 6 6 10 14 54 54 …«:
    - figuren springer 39 enheder tilbage, når »Spring 2« begynder, og 40 frem, når »I luften« begynder, efter hver landing;
    - under »Stå stille« og »Rejs dig« står den ved start;
    - på vejen tilbage springer den 120 frem og glider tilbage på 1 sek.
  - **Længdespringet** med `advance` 20 på air → land: hoften springer 19 tilbage, når »Stå stille« begynder, og 20 frem, når vejen tilbage begynder.
  - **`checkFigure`** siger »ingen problemer« til begge. Det ser hver bevægelse for sig og ikke, om den ene slutter, hvor den næste begynder.
  - **Figuren bliver mindre.** Kassen måles med hele turen (94 → 182 enheder bred), så bounds-figuren skifter fra den høje opstilling (214 px) til den brede (150 px) og bliver ca. 30 % mindre på kortet.
- **Rettelse:**
  - **I `timeline`:**
    - giv hver bevægelse den løbende forskydning, `move.shift = [x, x + dx]`, når x eller dx ikke er 0, også holdene (`from === to`);
    - lad vejen tilbage gå fra x til 0;
    - nøglen for planerne i `buildModel` og for `distinctSteps` i `check.ts` skal tage selve forskydningen med, når figuren har rekvisitter.
  - **I tjekket:** bevægelserne skal hænge sammen. Billedet ved slutningen af én bevægelse må højst være 0,5 fra billedet ved starten af den næste.
  - **Test:** bounds med `advance` på kun to overgange og et hold bagefter. Hoftens x må ikke springe mellem to billeder ved 30 billeder i sekundet.
  - **Kassen:** mål den uden `advance`, og lad tegningen følge figuren, så den ikke skrumper. Alternativt kan det skrives som forslag til P1b sammen med stillbillederne.

### H2 (høj): `lift` gør ikke skridt og hop mulige, så 11 af de 14 figurer på ventelisten kan ikke rettes som planlagt, og `NAT-3-FIGURES.md` anviser `lift` fem steder, hvor det ikke virker

- **Hvor:**
  - **`src/figure/tween.ts`:**
    - `:367–373` og `:645–664`: et løftet lem løses med IK mod en lige linje plus en bue på højst 6 (`liftHeight`, `:271–274`), og knæet bøjer den anatomiske vej;
    - `:665–673`: kun hånd og fod skubbes op af en flade, ikke knæ og albue.
  - **Dokumenterne:** `docs/runs/NAT-3-FIGURES.md:24–37`, `docs/SPEC.md:386` (Overgange) og `tools/pictos/README.md:46`.
  - **Testen** `src/figure/__tests__/figure.test.ts:517` prøver kun et skridt i stående stilling.
  - **Skærmbilleder:** `screenshots/review-p1a-burpee-knae-i-gulvet.png` og `screenshots/review-p1a-spiderman-knae-i-gulvet.png`.
- **Hvorfor:**
  - **Kilderne:**
    - briefen, grænse 3: burpees, spiderman og hænderne i `shoulder.3` kan ikke tegnes, og den beder om et lem, der kan løftes;
    - P1a, accept 1: »intet går gennem gulvet«;
    - SPEC 9.1, Overgange: `lift` klarer »fødderne, der hopper tilbage i en burpee, hænderne, der går ind mod væggen«;
    - P2 er rene datafiler uden kodeændringer (`docs/runs/NAT-3-TASKS.md`).
  - **Hver anvisning er prøvet, som den står:**

    | Figur | Anvist i `NAT-3-FIGURES.md` | Resultat i tjekket |
    |---|---|---|
    | `warmup.2 › spiderman` | `lift` på `near.foot` begge veje | Knæet bøjer 61,6° mere end i positionerne, går 3,8 ned i gulvet og springer 18 enheder på 0,1 sek. Med hoften højere i udfaldet går det 2,7 ned |
    | `burpee_skill.V2` | Fødder og `lift` på begge fødder | Knæene bøjer op til 68° mere og går op til 11,5 ned i gulvet |
    | `burpee_skill.V5` | Fødder og `lift` på standbenets fod | Knæet går 4,7 ned i gulvet |
    | `neck.N5 › mave` | `lift` på hånden (»samme punkt« modsiger teksten: hånden går fra panden til siden) | Albuen bøjer 66° mere og går 8,3 ned i sengen |
    | `shoulder.3` | Hænderne stille i plank → walk og `lift` i walk → handstand | Knæene bøjer 42° og 72° mellem to strakte positioner, albuerne 96° |
    | `burpee_emom.E1`, og dermed E2–E9, V1, V3, V4 › tuck og clap samt `measures.burpee_3min` | Fødder og `lift`. Filen siger selv, at det kræver `via` (P1b) | Knæene går 9,9 ned i gulvet |

  - **`via` mangler i planen.** Det står ikke i P1b i `docs/runs/NAT-3-TASKS.md`, kun som forslag i D56 og `NAT-3-FIGURES.md:55`.
  - **Følgen:** kun `core_side.S4`, `groin.5` og `neck.N5 › side` kan rettes med data. Resten bliver stående i appen:
    - burpeen i hvert motorpas med knæene 12 under gulvet midt i »Brystet til gulvet«;
    - spidermanen i opvarmningen før hvert styrkepas.
  - **Før P1a** var dybden den samme (12,4 mod 12,0 nu). Det er ingen forværring, men heller ingen rettelse.
- **Rettelse:**
  - **Et løftet lem** skal bevæge sig med leddenes vinkler som et frit lem: hofte- eller skuldervinklen og knæets eller albuens bøjning interpoleres fra roden. Først i den sidste del af vejen skal det løses med IK mod landingspunktet, med en blød overgang.
  - **Knæ og albue** skal skubbes op af fladerne, eller buen skal hæves, til de er fri. Buens højde skal følge skridtets længde: 6 er lavt for spidermanens 73.
  - **Et strakt lem, der glider langs en væg,** skal blive strakt (enden der, hvor det strakte lem møder væggen). Når intet står stille, er den glidende kontakt ankeret.
  - **`via`** skal skrives ind i P1b i NAT-3-TASKS eller laves i denne pakke, for burpeerne kræver det efter `NAT-3-FIGURES.md`'s egen vurdering.
  - **Test:** spiderman, V2, V5 og `neck.N5 › mave` med de anviste overgange består `checkFigure`.
  - **Dokumenterne:** ret SPEC 9.1, README og rækkerne i `NAT-3-FIGURES.md`, så de kun lover det, motoren kan.

### M1 (middel): To andre anvisninger i `NAT-3-FIGURES.md` er forkerte: albuerne i håndstanden og `lift` på vejen tilbage

- **Hvor:**
  - `docs/runs/NAT-3-FIGURES.md:48` (håndstanden) og `:47` (længdespringet);
  - `src/content/validate.ts:1172–1203` (`movesOf`) mod `src/figure/motion.ts:123–124`.
- **Hvorfor:**
  - **Håndstanden (`shoulder.4`–`shoulder.7`):**
    - Filen siger: »Giv armene `bend`, så albuerne peger bagud«. P68 og positionsteksterne siger, at albuerne »peger skråt ud i rummet« (`content/explain/shoulder.json`, `bottom`).
    - Uden `bend` peger albuen allerede ud i rummet: i en bund tegnet efter P68 står skulderen i (0,9; 17,1), hånden i (10; 0) og albuen i (13,1; 14,7).
    - Med `bend` −1 kommer albuen til (−3,9; 5,6), mod væggen og her 3,9 ind i den.
    - Står hænderne længere fra væggen, siger tjekket intet, og figuren modsiger sin tekst.
  - **Længdespringet:**
    - Filen foreslår at give vejen land → start `lift` på fødderne.
    - Formatet afviser det: »bevægelsen går aldrig fra »land« til »start««. Det er fordi `movesOf` ikke kender vejen tilbage, selv om `timeline` kan løfte på den.
- **Rettelse:**
  - **Linje 48:** tegn bunden efter P68, med hovedet ned mod væggen foran fingerspidserne. Giv armene ingen `bend`, så albuen peger ud i rummet, som teksten siger.
  - **Linje 47:** tillad enten en overgang på vejen tilbage til start i `movesOf` og test den, eller fjern forslaget.
  - **D56 (4) og SPEC 9.1** (`docs/SPEC.md:384`) må ikke kunne læses som en anvisning på at vende albuerne i `shoulder.4`–`7`.

### M2 (middel): Tjekket af strakte led læser ikke »strakt knæ« og »strakte knæ«, som SPEC selv nævner

- **Hvor:**
  - `src/figure/check.ts:668` og `:671`, også `:665`. `\b` i JavaScript regner ikke »æ« for et bogstav, så `strakt knæ\b` rammer aldrig, heller ikke med flaget `u`.
  - Testen i `src/figure/__tests__/check.test.ts:356–365` prøver ikke »knæ«.
- **Hvorfor:**
  - **Kilderne:** SPEC 9.1, Et strakt led (`docs/SPEC.md:385`), nævner »strakt knæ« som eksempel. README (`tools/pictos/README.md:39`) siger, at tjekket afviser et sådant led bøjet over 5°. Briefens M2 kræver et tjek for strakte led, og P2 tegner alle figurer om ud fra det.
  - **Ikke læst i dag:**
    - »strakte knæ« (`neck.N3`/`N4` › klar, burpeens hop);
    - »strakt knæ« (`groin.1` › up, `groin.4` › down, `legs.7` › knee);
    - »knæ og ankler strakte« (`power_legs.1` og `.5` › takeoff);
    - »armen strakt« (`pull.6` og `.7` › bottom);
    - »hænger strakt« (`groin.5` › down);
    - »strakt standben« (`power_legs.6` › drop).
  - **Følgen:** figurerne er strakte i dag, så ingen ser forkert ud endnu. Men porten for P2 er svagere, end SPEC og README siger.
- **Rettelse:**
  - Brug `(?<!\p{L})` og `(?!\p{L})` med flaget `u` i stedet for `\b`.
  - Tilføj formerne ovenfor: »armen …«, »knæ og ankler …«, »hænger/sparket/ført strakt« og »strakt standben«.
  - Test »strakt knæ.« og »strakte knæ,«.

### L1 (lav): En vendt `facing` med spejlede fødder slipper igennem, og ryg, mave og side tjekker ikke, hvilken side der vender mod fladen

- **Hvor:** `src/figure/check.ts:614–627` (`hipProblems`) og `:219–223` (`bodyTouches`); `docs/SPEC.md:391`.
- **Hvorfor:** SPEC 9.1, Led, siger: »et lår står højst 70° bag kroppen, så en forkert `facing` fanges, også med spejlede fødder«. Det passer ikke for wall sit:
  - Med vendt `facing` løser IK'en knæet om, så låret hænger lodret. Så står intet lår bag kroppen.
  - `wallsit.W1` med siddehoften 4 højere, vendt `facing` og spejlede fødder giver »ingen problemer«. Ansigtet vender ind i væggen, og figuren knæler i luften med skinnebenene bagud.
  - I den committede figur fanges det kun, fordi knæet tilfældigt rører gulvet.
  - Ryg, mave og side godtager et hvilket som helst punkt af overkroppen, uanset hvilken vej brystet vender.
- **Rettelse:**
  - Ved `back`, `belly`, `chest` og `side` mod en flade: tjek brystets retning mod fladens normal. Ved ryggen vender brystet væk fra fladen, ved maven og brystet mod den.
  - Ret sætningen i SPEC 9.1 til det, tjekket faktisk fanger.

### L2 (lav): Tjekket mellem positionerne ser kun hver ottendedel af vejen og ingen spring mellem to billeder

- **Hvor:** `src/figure/check.ts:745` (`k < 8`). Der er intet tjek af spring mellem to billeder efter hinanden.
- **Hvorfor:** SPEC 9.1 og D56 (6): intet led bøjer over 8° mere, og intet går i en flade undervejs.
  - **To figurer, der består, overskrider undervejs** med 120 billeder pr. bevægelse. Begge er små:
    - `power_legs.2` takeoff → air: foden peger 11° bagud (grænsen er 10°);
    - `power_legs.4` air ↔ right_front: knæet bøjer 8,4° mere (grænsen er 8°).
  - **`pushOut` kan få hånden til at springe.** Den skubber en hånd ud af en kasse mod den nærmeste side, og den side kan skifte. Hos `neck.N5 › mave` springer hånden 26,9 enheder mellem to billeder ved 30 billeder i sekundet, mens resten af bevægelsen flytter sig 1,3 pr. billede. Det sker kun i en figur på ventelisten i dag, men tjekket ville ikke se det i en ny figur.
- **Rettelse:**
  - Tjek billederne mellem positionerne ved 30 billeder i sekundet eller mindst 16–24 pr. bevægelse. Det koster kun tid i `check-explain` og Vitest.
  - Tilføj et tjek af spring: intet punkt flytter sig mere end ca. 3 gange bevægelsens gennemsnitlige skridt mellem to billeder. Det fanger også H1.
  - Lad `pushOut` beholde den side, punktet kom ind fra.

## Tjekket uden fund

- **Det oprindelige reviews H1, for figurerne, der består:**
  - `press.1`: knæene er 180°, og hoften er på linjen hele vejen (Vitest og Playwright).
  - `pull.1`: armen går fra 180° til 100,5° uden knæk.
  - Nordic: kroppen drejer om knæet, og knæet står stille.
  - `core_front.1`: den frie arm holder 31.
  - `calf.1`: tæerne står i (2; 10,5), mens anklen drejer om dem.
  - Med 120 billeder pr. bevægelse holder segmenterne længden, intet går i en flade, og ingen bevægelse springer ved positionerne.
- **Det oprindelige reviews M1:**
  - En vendt `facing` fanges ved fødderne og hoften i push-up, planke, dead bug og bord-row, også med spejlede fødder.
  - Rygsæk og flasker i hånden og på ryggen fanges i gulvet, også undervejs.
- **Det oprindelige reviews M3, L1, L3 og L4** er lavet som beskrevet. D48 og R20 er rettet.
- **`spine`:** katten buer 7 op, og koen synker 6. En curl-up med rund ryg består.
- **Ansigtsmærket** drejer med `head`, og README's regel om hagen passer.
- **Flasken** ligger oven på ryggen i `core_rot.R2` og `core_rot.R3` (kontaktark i scratch).
- **Ventelisten:** `figureKeyOf` rammer de 14 figurer, og testen kræver, at listen er ajour. En fil for sig fejler, og `like`-figurerne E2–E9 følger E1.
- **Ydelse:**
  - 22 tegninger i sekundet i ægte tid uden JIT, og ingen i baggrunden (e2e).
  - Kortet åbner på 39–103 ms mod 33–51 ms før.
  - Startfilerne er ens med fcf8c3e, og figurkoden hentes med kortet.
- **P3a:**
  - `feel` er valgfrit med højst 120 tegn og én sætning. »ca. 45°« og et spørgsmål tæller som én sætning.
  - Valideringen afviser emojis, kilder, studier og dosis, og en `like` kan ikke have sit eget.
  - Kortet viser »Mærk« lige efter »Træner« og ingen tom overskrift uden feltet (SPEC 3.8 og 9.1, D55).
  - Testene prøver det, og `screenshots/kort-maerk.png` viser det.

## Skærmbilleder fra revieweren

- `screenshots/review-p1a-bounds-advance-foer-spring.png` og `screenshots/review-p1a-bounds-advance-efter-spring.png`: etbens bounds med `advance` som anvist, i »Land« og 1/30 sek senere i »Spring 2«. Figuren er sprunget tilbage til start (H1).
- `screenshots/review-p1a-burpee-knae-i-gulvet.png`: burpee E1 midt i »Brystet til gulvet«, med knæene under gulvet (H2).
- `screenshots/review-p1a-spiderman-knae-i-gulvet.png`: spidermanen i opvarmningen midt i »Foden frem til hånden«, med knæet i gulvet (H2).
