# NAT-3 – figurerne efter P1a (til figuragenterne i P2)

Figurmotoren er rettet efter `docs/runs/NAT-2-P3-FIX.md` og efter reviewet af P1a (`docs/reviews/nat3-p1a-figurmotor.md`): `docs/DECISIONS.md` D56 og R22, `docs/SPEC.md` 9.1 og vejledningen i `tools/pictos/README.md`. Kroppen bevæger sig nu mellem positionerne ud fra det, der står stille, og tjekket ser også billederne imellem. Denne fil siger, hvilke figurer der fejler tjekkene, hvad der skal til, og hvilke der kan tegnes bedre med de nye muligheder.

Status efter reviewets rettelser og P1b: `node scripts/check-explain.ts` uden fil er grøn med 15 figurer på ventelisten i `src/figure/waiting.ts`. De to nye er nakkens N1 og N2, som står næsten stille (P1b's tjek af, at figuren bevæger sig synligt, D58). En fil, der tjekkes for sig, fejler på dem. `burpee_emom.E1` er tegnet som eksempel og består, og dermed også E2–E9, der er `like`.

**Hver anvisning herunder er afprøvet.** Figuren, som anvisningen giver, står som en hel figur i `src/figure/__tests__/p2/<punkt>.json`. Vitest (`src/figure/__tests__/p2-instructions.test.ts`) tjekker, at den består formatet og alle tjek mod forklaringen, som den er i dag. Sådan bruger du den:

1. Kopiér `keyframes`, `transitions` og `props` derfra til `content/figures/<spor>.json`. Du må gerne tegne figuren bedre, så længe den består.
2. Fjern figuren fra `src/figure/waiting.ts` (Vitest siger, hvilke der består).
3. Slet filen i `p2/`.

Kør tjekket igen, når positionernes tekst ændres: tjekket af strakte led læser den.

## Nye muligheder i formatet

### Overgange

**`transitions`** i figuren: `{ "from", "to", "lift"?, "advance"?, "via"? }`, med mindst ét af de tre. En overgang gælder hver gang, bevægelsen går fra `from` til `to`. Ved en `repeat` er vejen ud og vejen tilbage hver sin.

- **`lift`** (`near.hand`, `far.hand`, `near.foot`, `far.foot`): hånden eller foden forlader sin flade og må lande et andet sted. Det gælder skridt, hop tilbage og hænder, der går.
  - Lemmet svinger med leddenes vinkler og drejer fri af fladen med hånd, fod, knæ og albue.
  - Det går helst i en bue på en tiendedel af vejen, 3–8 høj.
- **`advance`**: hele figuren flyttes langs x (bounds og spring frem).
  - Holdene og de næste faser står, hvor figuren kom til, og vejen tilbage til start fører den tilbage.
  - Tegn hver keyframe på stedet med samme fodpunkt.
- **`via`**: en pose på vejen, skrevet som en hel keyframe, uden at forklaringen får en ny position. Bevægelsen går til via-posen og videre, med halvdelen af tiden til hver halvdel.
  - Via-posen tjekkes som en position. Den rører det, begge positioner rører, men en hånd eller fod med `lift` giver slip. Den rører intet, som ingen af dem rører.
  - Via-posen og billederne på hver side af den måles mod de to rigtige positioner (H3 i opfølgningen på P1a-reviewet): et lem, overgangen ikke løfter, bøjer højst 8° mere end i den mest bøjede af dem, og et led, som teksten kalder strakt i begge positioner, er strakt i via-posen. Læg derfor de lemmer, der er strakte i begge positioner, på fuld længde i via-posen.
  - Den har `tip`, hvor positionerne har.
  - Kontaktarket viser den med blå ramme.
  - Eksemplet fra `burpee_emom.E1`, hvor hoften går højt, mens fødderne hopper tilbage:

    ```json
    { "from": "squat", "to": "chest", "via": { "hip": [39.6, 33.6], "torso": -5, "head": -4,
      "arms": { "near": { "to": [69.04, 0] }, "far": { "to": [70.44, 0] } },
      "legs": { "near": { "to": [20, 12], "tip": -125 }, "far": { "to": [19.4, 12], "tip": -125 } } } }
    ```

- **Vejen tilbage til start** kan have sin egen overgang, `from` den sidste position og `to` den første. Det gælder, når bevægelsen slutter et andet sted, end den startede.

### Andre muligheder

- **`bend` på en arm i sidebilledet:** kun med armen over hovedet, og kun når teksten siger, at albuen peger den anden vej, end den gør af sig selv. Håndstanden har ingen `bend` (se herunder).
- **`spine`** (sidebilledet, −10 til 10): ryggen krummer, + mod ryggen (katten, rund øvre ryg) og − mod brystet (koen).
- **Ansigtet:** et lille mærke på hovedet viser, hvor ansigtet vender. Det drejer med `head`.
- **Ryg, mave og side:** kontakten betyder, at den del af overkroppen rører fladen; resten må løftes. I sidebilledet vender brystet væk fra fladen ved ryggen og mod den ved mave og bryst.
- **Flasker og rygsæk på ryggen** ligger langs ryggen.
- **Strakte led:** punktet på fuld længde eller op til 1 over. Siger teksten, at et led er strakt, må det højst være bøjet 5°. Tjekket læser fx:
  - »strakte arme« og »armen strakt«;
  - »benene er strakte«, »strakt knæ« og »strakte knæ«;
  - »knæ og ankler strakte«, »benet hænger strakt« og »strakt standben«.
- **Fødder:** i sidebilledet har hvert synligt ben `tip`.

## Figurer, der fejler nu (ventelisten)

Tallene i midterkolonnen er fra tjekket i dag. Højre kolonne er afprøvet, og den hele figur står i `p2/`.

| Fil › punkt | Hvad tjekket siger | Hvad der skal til (afprøvet) |
|---|---|---|
| `burpee_skill.json` › `burpee_skill.V1` | Benene mangler `tip`. squat → chest: knæene går 12 ned i gulvet og bøjer 10–12° mere. plank → squat: knæene går 4,5 ned | Som `burpee_emom.E1`: kopiér E1's fem keyframes og de to overgange med `via` (squat → chest og plank → squat) |
| `burpee_skill.json` › `burpee_skill.V2` | Benene mangler `tip`. sprawl → crouch: knæene går 12–12,8 ned i gulvet og bøjer 11–37° mere. guard → sprawl: knæet bøjer 20° mere | Fødder: `guard` med bageste hæl løftet (`near` til [52,2; 5,6], tå [57,94; 0,3]), `sprawl` på tæerne og `crouch` med flade fødder, tæerne hvor de er i `guard`. Begge overgange får `lift` på begge fødder og en `via`. I guard → sprawl er det E1's squat → chest-via. I sprawl → crouch er det E1's plank → squat-via med fødderne i [40; 12] og [48; 12] |
| `burpee_skill.json` › `burpee_skill.V3` | Som V1, og knæene bøjer 26–35° mere | Som E1 på V3's egne fødder. E1's `chest` og `plank` og de to `via`-overgange. Flade fødder forskudt i `squat` som i garde. `guard` med bageste hæl løftet. `jump` med `tip` −80. I `knee` står forreste fod på forfoden med tæerne, hvor de er i `guard` |
| `burpee_skill.json` › `burpee_skill.V4 › tuck` | Som V1 | Som E1: E1's `stand`, `squat`, `chest` og `plank` og de to `via`-overgange. `tuck` med `tip` −80 på begge ben |
| `burpee_skill.json` › `burpee_skill.V4 › clap` | Som V1, og catch → squat: knæene går 5,8 ned | Som E1: E1's `stand`, `squat`, `chest` og `jump`. `clap` og `catch` på tæerne (anklen 3,6 over, tåen 3,4 foran). E1's via på squat → chest, og E1's plank → squat-via på catch → squat |
| `burpee_skill.json` › `burpee_skill.V5` | Benene mangler `tip`. squat → plank og plank → squat: knæet går 4,5 ned i gulvet | Fødder. `lift` på standbenets fod (`near.foot`) og en `via` i squat → plank og plank → squat. Via'erne er E1's med det løftede ben strakt bagud på fuld længde (`far` til [−5,6; 19,8] i squat → plank og [−5; 21,7] i plank → squat, `tip` 200) |
| `measures.json` › `measures.burpee_3min` | Som V1 | Som E1: kopiér E1's keyframes og overgange |
| `core_side.json` › `core_side.S4` (`down`) | Teksten siger »strakt arm«, men begge arme er bøjede (145° og 35°) | Strakt støttearm i `down`. `torso` 56,1 med hoften, hvor den er. Støttehånden i [71,97; 0] som i `plank`, så armen er 31,5 fra skulderen. Den øverste hånd på hoften i [42,89; 9,45]. Ryggens side rører stadig gulvet |
| `groin.json` › `groin.5` (down ↔ up) | Det nederste ben går 5 ind i sofaen begge veje, og figuren springer 2,7 mellem to billeder | Flyt sofaen 2,3 til venstre (`x` −42,3). I `up` er det nederste ben strakt vandret med anklen mod sofaens forside lige under den øverste fod, i [−2; 22,43], og tæerne ned (`tip` [−2; 19,03]). Så går benet op foran sofaen. Med sofaen, hvor den står, kan et strakt ben fra hoften ikke nå sædet uden at gå gennem forsiden, og `lift` hjælper ikke |
| `neck.json` › `neck.N1` | Figuren står næsten stille: intet punkt flytter sig mere end 1,1 enheder (mindst 3), og »Hagen ind« og »Slip roligt« flytter den højst 1,1 (mindst 2). Hovedet vipper desuden mod loftet i stedet for mod brystet | Hovedet vipper mod brystet: `head` 0 i `rest` (ansigtet lige op) og −15 i `tuck`. Baghovedet bliver i gulvet (hovedets midte 5 og 7,9 over gulvet), og ansigtets mærke flytter sig 3,3. Resten som i dag |
| `neck.json` › `neck.N2` | Som N1, og »Løft 2 cm« og »Ned og slip« flytter figuren højst 1,9 og 1,2 enheder | Som N1 i `rest` og `tuck` og `head` −26 i `lift`: hovedet løftes 2,1 over hage ind, så luften under baghovedet kan ses (briefen: overdriv højst til ca. 2 enheder) |
| `neck.json` › `neck.N5 › mave` (stotte ↔ hold) | Hånden og albuen går 12 og 8,8 ned i sengen undervejs | `lift` på `near.hand` og en `via` i begge overgange. Via'en løfter hånden fra panden op over sengen (`near` til [30; 42], tå [36; 44]); resten som i positionerne, med hoften [51; 31] og `torso` 180 |
| `neck.json` › `neck.N5 › side` (frontbillede) | Albuen bøjer til hver sin side i de to positioner og skifter side undervejs | En `via` i begge overgange med den nederste arm strakt op foran brystet (`joint` [85,3; 33,5], `end` [81; 41], `tip` [78; 46,2]). Samme `bend` kan ikke løse det: i `stotte` hviler albuen på sengen med hånden under hovedet. I `hold` skal den være mindst 3 over sengen, for positionen nævner den ikke. Gennem den strakte arm folder den sig ud og ind igen |
| `shoulder.json` › `shoulder.3` (wall walk) | walk → handstand og tilbage: hænderne går 2,7 og 4 ned i gulvet | `walk` med hænderne fladt på samme punkt som i `plank`, hoften i [48,62; 39,49], `torso` −16,45 og fødderne på væggen i [3,5; 52,85] og [3,35; 52,35]. `lift` på fødderne i plank ↔ walk. `lift` på hænderne og en `via` halvvejs i walk ↔ handstand, med hoften i [27; 55,5], `torso` −52, hænderne i [45,47; −0,05] og [46,87; 0] og fødderne højt på væggen med det fjerne ben på fuld længde (`far` til [3,56; 96,58]) |
| `warmup.json` › `warmup.2 › spiderman` (planke ↔ udfald) | Knæet går 3,9 ned i gulvet og bøjer 51,6° mere; foden går 2,9 ned | `lift` på `near.foot` og en `via` med knæet højt i begge overgange. Hoften i [44; 24], `torso` 14, `near`-benet til [38; 10] med `upper` 22 og `tip` −125 og det bageste ben som i udfald (`far` til [0,38; 4,9], `tip` [2,78; 0,3]). Så er armene og det bageste ben strakte hele vejen (H3) |

## Figurer, der består, men kan tegnes bedre nu

- **Sideplanke og lyske på albuen** (sidekontakten): `core_side.json` › `core_side.S1`, `core_side.S3`; `groin.json` › `groin.2`, `groin.4`; `measures.json` › `measures.side_plank`. De må hvile på albuen med overarmen lodret under skulderen.
- **Hollow hold og sit-up med løftede skuldre** (rygkontakten): `core_front.json` › `core_front.2` (begge bevægelser); `core_situp.json` › `core_situp.1` (`top`); `measures.json` › `measures.hollow`.
- **Bunden i underarmsplanken** (mavekontakten): `core_front.json` › `core_front.3`, `core_front.4` (`down`).
- **Håndklædet:** `os.json` › `os.1` behøver ikke længere en ekstra håndklædehale.
- **Flasken på ryggen** tegnes nu langs ryggen. Se efter på kontaktarket: `core_rot.json` › `core_rot.R2`, `core_rot.R3`, `core_rot.R4`.
- **Etbens bounds, der flytter sig frem** (brugerens eksempel på en figur, der ligner en stillestående tegning): `power_legs.json` › `power_legs.6 › bounds`. `advance` 14 på push → air og air → land (afprøvet: `p2/power_legs.6.bounds.json`). Figuren rejser hen over scenen, står, hvor den landede, og går tilbage til start på vejen tilbage.
- **Længdespringet:** `power_legs.json` › `power_legs.2` lander 90 enheder fremme og glider tilbage på vejen til start. Giv vejen land → start `lift` på begge fødder, så figuren hopper tilbage (afprøvet: `p2/power_legs.2.json`). Du kan også tegne springet på stedet med `advance`.
- **Albuerne i håndstanden:** `shoulder.json` › `shoulder.4`–`shoulder.7` (facing −1). Tegn bunden som teksten og P68: hovedet ned mod væggen foran fingerspidserne. Giv armene ingen `bend`, så peger albuerne skråt ud i rummet af sig selv; `bend` −1 sender dem mod væggen.
- **Kip op på væggen:** en `via` kan gøre opgangen i `shoulder.3` og `shoulder.4` tydeligere.
- **Ryggens krumning:** `warmup.json` › `warmup.2 › katko` (kat og ko: `spine` + og −) og de øvelser, hvor teksten nævner en rund øvre ryg (curl-ups i `core_situp.json`).
- **Ansigtets retning:** nakkens tuck og nik i `neck.json` (N1, N2, N3 › pande, N6 › frem og bagud) og hagen i `os.json` › `os.5`. Se på mærket på hovedet, og drej hovedet med `head`, så hagen og blikket passer med teksten.
- **Alle figurer:** se på billedet midt i hver bevægelse (stiplet ramme), på via-poserne (blå ramme) og på knæ- og albuevinklerne under hver position på kontaktarket.

## Forslag til motoren

- **Kassen ved `advance` under animationen:** stillbillederne står nu i deres egen kasse. Den animerede figur tegnes stadig i hele turens kasse og bliver derfor mindre på kortet; reviewet målte ca. 30 % mindre for bounds med `advance`. Lad tegningen følge figuren, eller mål kassen uden `advance`.
