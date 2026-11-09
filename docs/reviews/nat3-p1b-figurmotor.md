# Review af NAT-3 P1b – Figurmotoren: vinkler, markeringer, fejl og bevægelse (og H3)

2026-11-09 · 8b0de82 (H3), b125b60, cda6bd9, e59624c, a604b3f, 1a6409b, 7b70297, 13461dc og ece1f42 · worktree på ece1f42 (`git diff 9d009de ece1f42`)

(Revieweren kunne ikke selv oprette filen; orkestratoren har gemt rapporten ordret fra reviewerens svar.)

Metode:

- **Læst** mod:
  - P1b i `docs/runs/NAT-3-TASKS.md`, pakke 2 og brugerens feedback i `docs/runs/NAT-3.md`;
  - SPEC 3.2, 3.8, 5, 6 og 9.1, DECISIONS D48, D52, D56, D58, R23 og R24;
  - `tools/pictos/README.md`, `docs/runs/NAT-3-FIGURES.md` og H3 i »Opfølgning« i `docs/reviews/nat3-p1a-figurmotor.md`;
  - trænernes figurbrief G1–G6 og P2's figurfiler fra anden omgang (scratchpad `p2/figures/`), for at se, hvordan felterne allerede bruges.
- **Kørt** i worktreen:
  - Vitest for figur, indhold og kontaktark: 311/311.
  - `node scripts/check-explain.ts`: alle 46 filer i orden, 15 figurer som VENTER.
  - `npm run build`: JavaScript 100,6 kB gz.
  - Startfilerne er bygget fra `git archive 9d009de` og fra ece1f42. `engine` er byte for byte ens, og `index.js` er ens bortset fra versionsteksten.
  - Playwright i `pixel9a` (Firefox uden JIT, `E2E_PORT=4184`): `figure.spec.ts`, `card.spec.ts` og `session.spec.ts` 34/34. Testen af dobbelttryk på introkortets »Luk« (D57) løb ud af tid med tre workers, men bestod alene.
- **Egne flows** i `pixel9a` (scratch, figurfilen ændret med `page.route`):
  - lange cues i kortet, i »Nu« og i wall sit-holdet;
  - en cue ved hoften i »Sæt dig ned«;
  - en push-up i én og i to vinkler i »Nu«;
  - armene forfra midt i »Spring op«;
  - »Nu« ved reduceret bevægelse;
  - P2's Dragon flag og burpee E1;
  - tegninger i sekundet og kortets åbningstid i ægte tid.
- **Forkerte kopier** gennem formatet og `checkFigureFile`:
  - en markering ved en position uden hold;
  - gradtal på 120° og 100°, hvor figuren tegner 90°;
  - en pil i et hold;
  - to markeringer på samme tid i hver sin vinkel;
  - en fejl, der næsten ikke afviger, og en fejl i gulvet;
  - en via forfra med bøjede ben og en via i burpee E1.
- **Scratch-scripts** over `src/figure/`:
  - hvor langt kroppen flytter sig fra markeringen i P2's 41 fase-markeringer;
  - pile på en figur, der rejser;
  - to vinklers løkkelængde;
  - hvor meget »etbens bounds« bevæger sig i dag;
  - P2's figurer med to vinkler i den størrelse, de får i »Nu«.

## Resultat

2 høj, 3 middel og 3 lav.

- **Det virker:**
  - **H3** er rettet, og intet er slækket.
  - **Markeringerne** står på det rigtige tidspunkt og én ad gangen, i kortet og i »Nu«. Tjekket fanger en markering uden hold, et forkert gradtal, en pil i et hold, en vinkel i en fase, der bevæger sig, og to markeringer på én gang.
  - **Fejlparret** står under fejlen med »Rigtigt« og »Forkert« i ord, i samme skala og med en ring. Det tegnes først, når folden åbnes.
  - **To vinkler** følger samme ur.
  - **Reduceret bevægelse:** stillbillederne har markeringerne, også i »Nu«.
  - **Ydelsen** holder.
- **Det virker ikke:**
  - Teksten løber ud over sin tegning (H1).
  - Markeringer ved en kropsdel, der flytter sig, bliver stående (H2).
  - Figuren bliver meget lille med to vinkler i »Nu« (M1).
  - Tjekket fanger ikke bounds (M2).
  - `power_legs.1` forfra svinger armene forkert (M3).

## Fund

### H1 (høj): En markerings tekst, der er bredere end sin tegning, løber ud over den

Det sker tre steder: over målet og uret i »Nu«, ud over skærmen på kortet og ind over den anden vinkel.

- **Hvor:**
  - `src/figure/marks.ts:520–582` (`placeLabel`): `clamp` (534–537) holder kun en tekst inde, hvis den er smallere end tegningen. Er den bredere, bliver x = 0, og teksten løber ud til højre.
  - `src/ui/components/figure.css:165–180` (`.figure-mark`): 18 px, `white-space: nowrap` og ingen største bredde. Kommentaren i `src/ui/components/Figure.tsx:223–264` siger »The text never leaves the drawing«.
  - Pladsen bestemmes af `figure.css:133–137` og `Figure.tsx:503–511` (to vinkler i to kolonner) og `src/ui/session/session.css:156` og `:261–264` (ringen i et hold er 212 px).
  - `src/content/validate.ts:1262` (`MARK_CUE`): en cue må have op til 24 tegn.
- **Hvorfor:**
  - **Kilderne:**
    - SPEC 3.2: figuren står ved siden af målet eller uret.
    - SPEC 6: tal på 88–96 px og en skærm på 414 px.
    - SPEC 9.1, Markeringer: teksten står ved sit punkt, på en anden side, over eller under kroppen eller i et hjørne.
    - D58 (2): teksten placeres ud fra tegningens målte størrelse.
  - **Pladsen:**
    - »Nu« med to vinkler: 121 px pr. tegning.
    - Et hold ved ringen: 158 px til figuren, dvs. 75 px pr. vinkel.
    - Kortet med to vinkler: 187 px pr. tegning.
    - I 18 px er »Knæ over tæer« 143 px bred og »Håndsbredde fra gulvet« (22 tegn, tilladt) 221 px.
  - **Målt:**
    - **»Nu«, squat jump med cuen forfra gjort 22 tegn lang:** teksten står i x 145–366 og dækker toppen af målet »3« (x 278–398) i hele »Frys 2 sek« (`review-p1b-nu-lang-cue.png`).
    - **Kortet med samme cue:** teksten løber til x 432 på en skærm på 414 px, siden kan rulle vandret, og teksten skæres af (`review-p1b-kort-lang-cue-front.png`). Står cuen i vinklen fra siden, dækker den 26 px af den anden vinkel (`-side.png`).
    - **Wall sit-holdet med en cue på 21 tegn i én vinkel:** teksten (x 16–220) går 34 px ind over ringen (x 186–398) i hele holdet (`review-p1b-nu-hold-lang-cue.png`).
  - **P2's filer rammer det allerede:**
    - Cuerne i holdene `core_front.4` (»Albuer foran hovedet«) og `core_side.S4` (»Hånd under skulder«) er bredere end de 158 px.
    - Figurerne med to vinkler (`core_front.1`, `core_rot.R1`, `core_rot.R4` og `core_side.S5`) har cues på 13 tegn (143 px) i tegninger på 121 px.
    - Eksemplet »Knæ over tæer« stikker allerede 22 px ud af sin tegning i »Nu«.
  - **Ingen ser det i dag:** kontaktarket viser teksten i kortets størrelse, ikke i »Nu«, og e2e-testen prøver kun »Én planke« i én vinkel.
- **Rettelse:**
  - Hold teksten inde i sin tegning: største bredde = tegningens bredde og `white-space: normal` (højst to linjer), og lad `placeLabel` måle efter ombrydningen.
  - Er teksten stadig for bred, så stil den på sin egen linje over eller under figurerne, med prikken eller linjen på figuren.
  - Test en cue på 24 tegn i den anden vinkel i kortet, i »Nu« (reps og hold) og på stillbillederne:
    - ingen vandret rulning (`scrollWidth === clientWidth`);
    - teksten står inde i sin tegning;
    - teksten overlapper ikke `.now-target`.
  - Indtil det er rettet, skal README sige: højst ca. 11 tegn i figurer med to vinkler og højst ca. 15 i hold.

### H2 (høj): En cue eller hjælpelinje ved en kropsdel i en fase, hvor kroppen bevæger sig, står stille, hvor kroppen var, da fasen begyndte, og 19 markeringer i P2 gør det

- **Hvor:**
  - `src/figure/marks.ts:431–447` (`markShows`): en fases markering tegnes én gang ved fasens start og står hele fasen. Cue og linje ved deres punkter tegnes i `:399–420`.
  - `src/content/validate.ts:1399–1409` tillader cue og linje i enhver fase. Kun pilen og vinklen har regler for faser.
  - `tools/pictos/README.md:50` og `:54–55`, SPEC 9.1 og D58 (2) nævner det ikke.
  - Testen `scripts/__tests__/figure-sheet.test.ts` bruger selv `{ "cue": "Albuerne ud", "phase": 3, "point": "near.elbow" }`.
- **Hvorfor:**
  - **Kilderne:**
    - SPEC 9.1 og D58 (2): markeringen står ved sit punkt.
    - P1b mål 2: markeringerne står på det rigtige tidspunkt.
    - Opgaven: det skal være helt tydeligt, hvordan øvelsen udføres.
  - **Målt:** squat jumpet fik `{ "cue": "Hoften bagud", "phase": 1, "point": "hip" }`. Sidst i »Sæt dig ned« står prikken i (0,6; 50,45), hvor hoften stod, mens hoften er i (−11,2; 34,8). Prikken sidder altså midt på maven (`review-p1b-fasecue-start.png` og `-slut.png`). Formatet og tjekket siger OK.
  - **P2's anden omgang** har 41 cues og linjer ved en kropsdel i en fase, der bevæger sig. I 19 af dem flytter kropsdelen sig 5–88 enheder væk i løbet af fasen:
    - `core_situp.6` (Dragon flag): linjen »Én planke« ligger langs gulvet, mens kroppen rejser sig lodret (88 enheder, `review-p1b-p2-dragonflag.png`).
    - `burpee_skill.V2`: »Op i garde« bliver i gulvet (84).
    - `measures.nordic_depth`: linjen »Lige linje« fra knæ til hoved står lodret, mens kroppen falder frem (43).
    - `legs.7`: »Driv knæet op« bliver nede (32).
    - `burpee_emom.E1` og dermed E2–E9, `burpee_skill.V1` og `measures.burpee_3min`: prikken for »Brystet i gulvet« ligger på gulvet, mens brystet presses op (23, `review-p1b-p2-burpee.png`). E1 kører i hvert motorpas.
    - I opvarmningen: `warmup.2 › spiderman` (»Hoften lav«, 10) og `warmup.1 › skygge` (»Hånd til kind«, 9).
- **Rettelse:**
  - Afvis i formatet en cue med en kropsdel som `point` og en linje mellem kropsdele i en fase, hvor figuren bevæger sig, som det allerede gøres for vinklen. `[x, y]` og en cue uden punkt er stadig tilladt.
  - Alternativt: lad prikken og linjen følge punktet hvert billede, mens teksten står stille.
  - Skriv reglen i README og SPEC 9.1, og test den.
  - Send de 19 markeringer til figuragenterne. De 22 andre sidder på en kropsdel, der står stille, og kan blive.

### M1 (middel): To vinkler i »Nu« halverer figuren; en bred figur bliver 113 × 26 px

- **Hvor:** `src/ui/components/figure.css:133–137`, `src/ui/components/Figure.tsx:503–511` (layoutet for høje figurer bruges ikke med to vinkler), `src/ui/session/session.css:156–167` og `:261–264`.
- **Hvorfor:**
  - **Kilderne:**
    - SPEC 5: figuren er hovedpersonen.
    - SPEC 6: telefonen ligger på gulvet ca. 1 m væk.
    - SPEC 3.2: en figur med to vinkler viser begge side om side på figurens plads.
  - **Målt:**
    - En push-up i »Nu« er 233 × 63 px i én vinkel og 113 × 26 px i hver af to (`review-p1b-nu-pushup-1-vinkel.png` og `-2-vinkel.png`).
    - Pilens skaft er 1,8 figurenheder, ca. 2 px i »Nu« med to vinkler.
  - **P2's filer:** alle fem figurer med to vinkler ligger ned. I »Nu«, målt på kassen med luft:
    - `core_front.1` bliver 121 × 45 px mod 250 × 93 px i én vinkel;
    - `core_rot.R4` fra siden bliver 121 × 34 px;
    - `core_rot.R2`, som er et hold ved ringen, bliver 75 × 21 px pr. vinkel.
- **Rettelse:**
  - I »Nu« og i pausen: stil to brede vinkler over hinanden i hele figurens bredde, og lad kun høje figurer stå side om side.
  - Eller: vis hovedvinklen i fuld størrelse og den anden mindre under den.
  - Sæt en nedre grænse for figurens højde (fx 60 px for en bred figur), test den, og ret SPEC 3.2.

### M2 (middel): Tjekket fanger ikke »etbens bounds«, som den er i dag

- **Hvor:** `src/figure/check.ts:1270–1272` og `:1288–1334` (`stillnessProblems`), D58 (4) og `docs/runs/NAT-3-FIGURES.md:94`.
- **Hvorfor:**
  - **Kilderne:** P1b mål 4: »check-explain afviser en figur, der ikke bevæger sig synligt (som »etbens bounds« i dag)«, og brugerens feedback.
  - **Målt:** bounds er den samme som i 2894827, den version brugeren så.
    - Den består, fordi hver fase flytter et punkt 20–67 enheder, og grænserne er 2 og 3.
    - Men standfoden lander, hvor den satte af (anklen i x 1,2 i både `stand` og `land`), selv om `land` siger »Ca. 1–1,5 m foran afsættet«. Figuren hopper altså på stedet.
  - Reglen fanger nakkens N1 og N2, men ikke bounds. Det eneste, der får P2 til at give bounds `advance`, er en linje i NAT-3-FIGURES.
- **Rettelse:**
  - Tilføj et tjek, der læser teksten, ligesom tjekket af strakte led: lander en position efter et hop »foran afsættet« eller »… m foran«, skal standfoden stå mindst ca. 30 enheder foran, enten via keyframes eller `advance`.
  - Sæt bounds på ventelisten, og ret D58 (4) og NAT-3-FIGURES.

### M3 (middel): `power_legs.1` forfra svinger armene ud til siden som en sprællemand, mens de fra siden svinger frem

- **Hvor:**
  - `content/figures/power_legs.json:192–196` og `:222–226`: forfra står hænderne ved hofterne i `dip` og over hovedet i `takeoff`.
  - `tools/pictos/README.md:25` og `:31–45` anviser eksemplet.
  - P2's `power_legs.json` har de samme arme.
- **Hvorfor:**
  - **Kilderne:**
    - Opgaven: præcis hvordan øvelsen udføres.
    - Positionsteksten `takeoff`: »armene er svinget frem og op over hovedet«.
    - SPEC 3.8: to vinkler med samme ur.
  - Forfra drejer skulderens vinkel fra ned til op gennem vandret ud til siden. Midt i »Spring op« og »I luften → Landing« står armene derfor ude til siderne (`review-p1b-forfra-armsving.png`, kontaktarket »Midt i: Nede → Afsæt«), mens de fra siden svinger frem.
  - Motoren kan ikke tegne en arm, der svinger mod beskueren, fordi `upper`/`lower` højst kan forkortes til det halve.
- **Rettelse:**
  - Forfra skal armene blive foran kroppen (garden, som i `land`) i alle positioner, eller udelades.
  - Skriv det i README under »En anden vinkel«.

### L1 (lav): To vinkler kan få hver sin løkkelængde

- **Hvor:**
  - `src/figure/motion.ts:157–163`: klippet tilføjer kun 0,5 sek i den vinkel, der har `advance`.
  - `src/ui/components/Figure.tsx:404–434`: hver vinkel går rundt i sin egen `total`.
- **Hvorfor:**
  - **Kilder:** SPEC 3.8 og D58 (1) kræver samme faser og samme ur.
  - **Målt:** med `p2/power_legs.6.bounds.json` plus en vinkel uden `advance` tager løkken 5,1 og 4,6 sek. Efter 10 løkker er den anden vinkel 0,4 sek foran, så figurerne kommer ud af trit.
- **Rettelse:** giv begge vinkler klippet, eller afvis to vinkler med forskellig løkkelængde i tjekket.

### L2 (lav): Stillbilledets pil ser bort fra `advance`

- **Hvor:** `src/figure/marks.ts:230–273` og `:495–504` (`stillMarks`).
- **Hvorfor:**
  - **Kilder:** SPEC 3.8 og D58 (2).
  - **Målt:** en pil ved hoften i »I luften« med `advance` 14:
    - i animationen peger den frem (8,3; 3,2);
    - på stillbilledet peger den tilbage (−5,7; 3,2);
    - tekstalternativet siger »frem«.
- **Rettelse:** tegn stillbilledets pil med turen langs gulvet regnet fra fasens start, eller udelad pilen i en fase med `advance`.

### L3 (lav): Tre beskrivelser passer ikke med motoren

- **Hvor:**
  - `src/content/types.ts:347` siger »and as it arrives and leaves«.
  - `docs/runs/NAT-3-FIGURES.md:94` siger »går tilbage til start på vejen tilbage«.
  - `tools/pictos/README.md:97` siger »vejen tilbage til start fører den tilbage«.
- **Hvorfor:**
  - D58 fravalgte at vise markeringen på vejen ind og ud.
  - Bounds klipper nu tilbage til start (D58 (6), README:72) i stedet for at gå tilbage.
- **Rettelse:** ret de tre steder.

## Tjekket uden fund

- **H3:**
  - Via-posen og billederne på begge sider af den måles mod de to rigtige positioner, også i den anden vinkel.
  - Spidermanen fra før H3 fejler i testen, og de rettede tal (spiderman, V5 og wall walk) står i anvisningerne.
  - Min via forfra i `power_legs.1` med bøjede ben fanges i via'en og i begge halvdele (»knæet bøjer 59,1° mellem to strakte positioner«).
  - Intet er slækket: grænserne er stadig 8° og 5°, og et løftet lem måles stadig mod via'en.
- **Markeringer:**
  - En markering ved en position uden hold afvises.
  - 120° afvises, mens 100° godtages (grænsen er 10°).
  - En pil i et hold, en vinkel i en fase, der bevæger sig, og to markeringer på én gang på tværs af vinkler afvises.
  - Pilen følger vejen og peger derfor altid rigtigt.
  - I »Nu« følger markeringerne passets ur. Hold, EMOM og runder beholder fasernes numre.
- **Fejlpar:**
  - En forkert stilling i gulvet afvises, og det samme gør én, der afviger under 3 enheder.
  - Ringen sidder, hvor stillingerne afviger mest: ved hoften i press.1 og ved knæet i power_legs.1.
- **Stilstand:** N1 og N2 fejler med de rigtige tal, og en figur med ens positioner afvises.
- **Reduceret bevægelse:** stillbillederne har markeringerne, og »Nu« viser begge vinkler med »Knæ over tæer« (`review-p1b-nu-reduceret.png`).
- **Ydelse** (Firefox uden JIT):
  - 22,7 tegninger i sekundet med én vinkel og 16,7 med to;
  - ingen tegning, når appen er i baggrunden;
  - kortet åbner på 35–42 ms (press.1) og 52–67 ms (squat jump med to vinkler);
  - JavaScript fylder 100,6 kB gz.
- **Tekst:** »Fra siden«, »Forfra«, »Ovenfra«, »Rigtigt« og »Forkert« er ens overalt, 18 px og mindst 7:1, og der er ingen henvisninger til kilder.

Målingerne er taget på ece1f42. P4 (42401d1–68c7888) har siden ændret højder og afstande, men ikke kolonnerne eller hvor teksten placeres. H1 og M1 gælder derfor stadig og skal testes på den endelige `main`.

## Skærmbilleder fra revieweren

- `review-p1b-nu-lang-cue.png`: »Nu« med en cue på 22 tegn, der dækker målet (H1).
- `review-p1b-kort-lang-cue-front.png` og `review-p1b-kort-lang-cue-side.png`: kortet med samme cue, ud over skærmen og ind over den anden vinkel (H1).
- `review-p1b-nu-hold-lang-cue.png`: wall sit-holdet med en cue på 21 tegn ind over ringen (H1).
- `review-p1b-fasecue-start.png` og `review-p1b-fasecue-slut.png`: en cue ved hoften i en fase, hvor hoften flytter sig (H2).
- `review-p1b-p2-dragonflag.png` og `review-p1b-p2-burpee.png`: P2's markeringer, der står, hvor kroppen var (H2).
- `review-p1b-nu-pushup-1-vinkel.png` og `review-p1b-nu-pushup-2-vinkel.png`: en push-up i »Nu« i én og to vinkler (M1).
- `review-p1b-forfra-armsving.png`: squat jumpet forfra midt i »Spring op« (M3).
- `review-p1b-nu-reduceret.png`: »Nu« ved reduceret bevægelse.

## Opfølgning

2026-11-09 · rettelserne 41e813e, b785424, 6ed66f9, cfe197b, 8d4f6c4, 79137a6, 55cbefd, 8861f84 og 3d04bba (D60, R25) · worktree på da9abf8, hvor P2's figurer er flettet ind (dem reviewer andre). (Revieweren kunne ikke skrive i filen; orkestratoren har tilføjet afsnittet ordret fra reviewerens svar.)

Metode:

- **Kørt** i worktreen:
  - Vitest: 712/712. Det er fire færre end før, fordi testene af anvisningerne til P2 faldt bort ved fletningen. H3-testen er omdøbt, ikke fjernet.
  - `node scripts/check-explain.ts`: alle 46 filer i orden, ingen figurer på ventelisten.
  - `npm run build`: JavaScript 103,7 kB gz.
  - Startfilerne er bygget fra 48322d4 (lige før rettelserne) og fra da9abf8. `engine` er byte for byte ens, og `index.js` er ens bortset fra versionsteksten.
  - Playwright i `pixel9a`: `figure.spec.ts`, `card.spec.ts` og `session.spec.ts` 39/39.
- **Mine flows fra reviewet igen** i `pixel9a`:
  - lange cues i kortet, i »Nu« med reps, i wall sit-holdet ved uret og på stillbillederne;
  - en cue ved hoften i en fase, hvor hoften bevæger sig;
  - en push-up i to vinkler i »Nu« og i pausen;
  - desuden indholdets egne lange cues på stillbillederne.
- **Forkerte kopier:**
  - bounds fra før P2, bounds med en fjerdedel af `advance` og bounds med `advance` baglæns;
  - en fejl og en via med `spine` i press.1;
  - en underarm på 5 og på 7 i sidebilledet (`legs.4`).

**Resultat:** Alle fund er rettet. Der er to nye lave fund (L4 og L5), og L5 er det eneste sted, tjekket er slækket.

| Fund | Status |
|---|---|
| H1 | Rettet. Teksten brydes inde i sin tegning, og kan den ikke det, står den på sin egen linje. Siden ruller ikke vandret (`scrollWidth` 414). **Kortet:** en cue på 22 tegn forfra står på to linjer i højre vinkel (x 234–398 inden for 211–398); fra siden står den i venstre vinkel (27–191 inden for 16–203). **»Nu«:** en cue på 23 tegn står over vinklerne (x 16–170), og målet (x 278–398) er frit. **Wall sit-holdet:** en cue på 21 tegn står i figurens tegning (x 61–180), og ringen (x 194–398) er fri. **Stillbillederne** forfra står to pr. række, og teksten er inde i billedet. Se dog L4 |
| H2 | Rettet. Prikken følger hoften fra (0,41; −49,9) til (−10,67; −35,01), og teksten står stille. I det flettede indhold markerer alle 15 fase-cues med en kropsdel en del, der står stille (0–0,6 enheder); de 19 fra reviewet er skrevet om |
| M1 | Rettet. En push-up i to vinkler står over hinanden i »Nu«: hver tegning er 254 × 76 px, og figuren 155 × 35 px (før 113 × 26 px; med én vinkel 233 × 63 px). I pausen står vinklerne side om side med 174 × 72 px hver. Høje figurer står stadig side om side |
| M2 | Rettet. Bounds fra før P2 fejler med »lander 0 enheder foran afsættet … (mindst 30)«. Den fejler også med en fjerdedel af `advance` (16) og med `advance` baglæns (−64). Den flettede bounds lander 64 foran og består |
| M3 | Rettet. Squat jumpets arme er udeladt forfra (`null`), og README:48 og SPEC 9.1 forklarer hvorfor. Tjekket håndhæver det ikke, men kun `power_legs.1` havde problemet |
| L1 | Rettet. Begge vinkler har en løkke på 5,1 sek (før 5,1 og 4,6), også i tjekket |
| L2 | Rettet. Stillbilledet har ingen pil i en fase med `advance` |
| L3 | Rettet i `src/content/types.ts:347`, README:103 og `NAT-3-FIGURES.md:94` |
| `spine` | Virker. En fejl med `spine` −6 og en via med `spine` 5 i press.1 tegnes med krum ryg |
| En fjerdedel | `upper` og `lower` kan nu forkorte et led til en fjerdedel. Se dog L5 |
| Slækket? | Kun L5. Grænserne 8°, 5°, 70°, 3 og 2 enheder, 0,4 sek, 10°, 4 og 3 er uændrede. To tests har fået nye tal, fordi fletningen ændrede `pull.1` og E1, ikke tjekket |
| Ydelse | Uændret: 22,7 tegninger i sekundet med én vinkel og 16,7 med to, og ingen, når appen er i baggrunden. Kortet åbner på 41–46 ms (press.1) og 53–76 ms (squat jump) |

### L4 (lav, ny): På et lavt stillbillede kan en tekst på to linjer dække hovedet

- **Hvor:**
  - `src/ui/components/Figure.tsx`, `Stills`: der sættes kun færre billeder pr. række, når teksten ikke kan stå på to linjer.
  - `src/figure/marks.ts`, `placeLabel`: er intet sted frit, vælges det sted, der dækker færrest punkter af kroppen.
- **Hvorfor:**
  - SPEC 9.1, Markeringer: teksten skal holde sig fra kroppen, hvor der er plads.
  - En cue på 22 tegn forfra på squat jumpets »Landing« står på to linjer hen over hovedet og overkroppen; stillbilledet er 183 × 120 px (`review-p1b-opf-stillbilleder-lang-cue.png`).
  - Indholdets egne lange cues dækker højst 2 af 160 målepunkter, så ingen figur har problemet i dag.
- **Rettelse:** sæt færre billeder pr. række, eller stil teksten på sin egen linje, også når den dækker kroppen.

### L5 (lav, ny): Forkortningen til en fjerdedel slækker tjekket af led givet ved `joint`/`end` i sidebilledet

- **Hvor:** `src/figure/check.ts`, `jointLimbProblems` (`length < want / 4`).
- **Hvorfor:**
  - D60 (8) begrunder ændringen med et lår, der peger frem, set forfra. Men grænsen gælder i alle vinkler.
  - I `legs.4` set fra siden består nu en underarm på 5 og en på 7 (normalt 15). Før blev alt under 7,5 fanget.
- **Rettelse:** tillad en fjerdedel kun forfra og ovenfra, og behold det halve i sidebilledet.

Pausen er målt på da9abf8. P4 retter pausens og introkortets layout i hovedmappen, så testen »M1: to liggende vinkler … i »Nu« og i pausen, hver mindst 60 px høj« skal være grøn på den endelige `main`.

Skærmbilleder fra opfølgningen:

- `review-p1b-opf-kort-lang-cue-front.png` og `review-p1b-opf-kort-lang-cue-side.png`: kortet med en cue på 22 tegn inde i sin vinkel.
- `review-p1b-opf-nu-lang-cue.png`: »Nu« med en cue på 23 tegn over vinklerne og frit mål.
- `review-p1b-opf-nu-hold-lang-cue.png`: wall sit-holdet med en cue på 21 tegn i figurens tegning og fri ring.
- `review-p1b-opf-stillbilleder-lang-cue.png`: stillbillederne forfra, to pr. række; teksten dækker hovedet (L4).
- `review-p1b-opf-still-shoulder2.png`, `review-p1b-opf-still-shoulder5.png`, `review-p1b-opf-still-press4.png` og `review-p1b-opf-still-pull6.png`: indholdets lange cues på stillbillederne.
- `review-p1b-opf-fasecue-slut.png`: cuen ved hoften følger hoften.
- `review-p1b-opf-nu-pushup-2-vinkler.png` og `review-p1b-opf-pause-pushup-2-vinkler.png`: push-uppen over hinanden i »Nu« og side om side i pausen.
