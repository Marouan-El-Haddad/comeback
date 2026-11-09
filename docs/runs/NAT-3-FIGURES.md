# NAT-3 – figurerne efter P1a (til figuragenterne i P2)

Figurmotoren er rettet efter `docs/runs/NAT-2-P3-FIX.md` (`docs/DECISIONS.md` D56, `docs/SPEC.md` 9.1, vejledningen i `tools/pictos/README.md`). Kroppen bevæger sig nu mellem positionerne ud fra det, der står stille, og tjekket ser også billederne imellem. Denne fil siger, hvilke figurer der fejler de nye tjek, og hvilke der kan tegnes bedre med de nye muligheder.

Status ved P1a (9/11): `node scripts/check-explain.ts` uden fil er grøn med 14 figurer på ventelisten i `src/figure/waiting.ts`. En fil, der tjekkes for sig, fejler på dem. Fjern en figur fra listen, når den består: Vitest siger, hvilke der gør. Trænernes nye ordlyd (3648b6b og c1685a6) er tjekket med. Kør tjekket igen, når positionernes tekst ændres: tjekket af strakte led læser den.

## Nye muligheder i formatet

- **`transitions`** i figuren: `{ "from", "to", "lift": [...], "advance": n }` gælder hver gang, bevægelsen går fra `from` til `to`. Ved en `repeat` er vejen ud og vejen tilbage hver sin.
  - `lift` (`near.hand`, `far.hand`, `near.foot`, `far.foot`): hånden eller foden går i en bue og må flytte sig. Det gælder skridt, hop tilbage og hænder, der går.
  - `advance`: hele figuren flyttes langs x (bounds). Tegn hver keyframe på stedet med samme fodpunkt i fx `land`, `push` og `stand`, og lad overgangene flytte figuren.
- **`bend` på en arm i sidebilledet**, kun med armen over hovedet (håndstand, pike): albuen peger den anden vej.
- **`spine`** (sidebilledet, −10 til 10): ryggen krummer, + mod ryggen (katten, rund øvre ryg) og − mod brystet (koen).
- **Ansigtet:** et lille mærke på hovedet viser, hvor ansigtet vender. Det drejer med `head`.
- **Ryg, mave og side:** kontakten betyder, at den del af overkroppen rører fladen; resten må løftes.
- **Flasker og rygsæk på ryggen** ligger langs ryggen.
- **Strakte led:** punktet på fuld længde eller op til 1 over. Siger teksten »strakte arme«, »benene er strakte« eller »strakt knæ«, skal leddet være strakt (højst 5°).
- **Fødder:** i sidebilledet har hvert synligt ben `tip`.

## Figurer, der fejler nu (ventelisten)

| Fil › punkt | Hvad tjekket siger | Hvad der skal til |
|---|---|---|
| `burpee_emom.json` › `burpee_emom.E1` (E2–E9 er `like`) | Benene mangler `tip`. squat → chest: knæene bøjer 10–12° mere end i positionerne og går 12 ned i gulvet. plank → squat: knæene går 4,6 ned i gulvet | Fødder på begge ben: flade i `stand` og `squat`, på tæerne i `chest` og `plank`, strakt vrist i `jump`. Overgange squat → chest og plank → squat med `lift` på begge fødder. Afprøvet i P1a: selv med `lift` og en højere hofte i `squat` går knæene ned i gulvet undervejs, for hoften falder, mens fødderne flyver tilbage. Det kræver en mellempose med hoften højt (forslag `via`, P1b) |
| `burpee_skill.json` › `burpee_skill.V1` | Som E1 | Som E1 |
| `burpee_skill.json` › `burpee_skill.V2` | Benene mangler `tip`. guard → sprawl: knæene bøjer 59° og 39° mere. sprawl → crouch: knæene bøjer 37° og 10° mere og går 12 ned i gulvet | Fødder. `lift` på begge fødder i guard → sprawl og sprawl → crouch |
| `burpee_skill.json` › `burpee_skill.V3` | Som E1, og knæene bøjer 35° og 26° mere i squat → chest og plank → squat | Som E1 |
| `burpee_skill.json` › `burpee_skill.V4 › tuck` | Som E1 | Som E1 |
| `burpee_skill.json` › `burpee_skill.V4 › clap` | Som E1 (catch → squat: knæene går 5,8 ned i gulvet) | Som E1, også catch → squat |
| `burpee_skill.json` › `burpee_skill.V5` | Benene mangler `tip`. squat → plank og plank → squat: knæet går 4,6 ned i gulvet | Fødder. `lift` på standbenets fod i squat → plank og plank → squat |
| `measures.json` › `measures.burpee_3min` | Som E1 | Som E1 |
| `core_side.json` › `core_side.S4` (`down`) | Teksten siger »overkroppen løftet på strakt arm«, men begge arme er bøjede (145° og 35°) | Strakt støttearm med hånden under skulderen. Med den nye sidekontakt må skulderen være højt |
| `groin.json` › `groin.5` (down → up) | Det nederste ben svinger op gennem sofaen og bøjer 42° mellem to strakte positioner; foden peger 31° bagud undervejs | Lad benet løftes foran sofaens kant, eller flyt sofaen, så benets bue ikke går gennem den |
| `neck.json` › `neck.N5 › mave` (stotte ↔ hold) | Hånden og albuen går 5 og 8,6 ned i sengen undervejs | Støttehånden står på samme punkt i begge, eller `lift` på hånden mellem de to positioner |
| `neck.json` › `neck.N5 › side` (frontbillede) | Albuen bøjer til hver sin side i de to positioner og skifter side undervejs | Samme `bend` på armen i begge keyframes |
| `shoulder.json` › `shoulder.3` (wall walk) | plank → walk og walk → handstand: knæene bøjer 32–72° mellem to strakte positioner, albuerne 49°; fødderne går 1,8 ind i væggen | Hold hænderne på samme punkt i plank → walk, så kroppen drejer om dem, mens fødderne glider op ad væggen. `lift` på hænderne i walk → handstand, hvor de går ind mod væggen. Fødderne på væggens flade |
| `warmup.json` › `warmup.2 › spiderman` (planke ↔ udfald) | Knæet bøjer 49,5° mere og går 3,9 ned i gulvet; foden går 2,6 ned i gulvet | `lift` på `near.foot` i planke → udfald og udfald → planke |

## Figurer, der består, men kan tegnes bedre nu

- **Sideplanke og lyske på albuen** (sidekontakten): `core_side.json` › `core_side.S1`, `core_side.S3`, `core_side.S4`; `groin.json` › `groin.2`, `groin.4`; `measures.json` › `measures.side_plank`. De må hvile på albuen med overarmen lodret under skulderen.
- **Hollow hold og sit-up med løftede skuldre** (rygkontakten): `core_front.json` › `core_front.2` (begge bevægelser); `core_situp.json` › `core_situp.1` (`top`); `measures.json` › `measures.hollow`.
- **Bunden i underarmsplanken** (mavekontakten): `core_front.json` › `core_front.3`, `core_front.4` (`down`).
- **Håndklædet:** `os.json` › `os.1` behøver ikke længere en ekstra håndklædehale.
- **Flasken på ryggen** tegnes nu langs ryggen. Se efter på kontaktarket: `core_rot.json` › `core_rot.R2`, `core_rot.R3`, `core_rot.R4`.
- **Etbens bounds, der flytter sig frem** (brugerens eksempel på en figur, der ligner en stillestående tegning): `power_legs.json` › `power_legs.6 › bounds`. Brug overgange push → air og air → land med `advance` (afprøvet i P1a: figuren rejser hen over scenen). Tegn `land`, `push` og `stand` med samme fodpunkt.
- **Længdespringet:** `power_legs.json` › `power_legs.2` lander 90 enheder fremme og glider tilbage på vejen til start. Tegn springet på stedet med `advance`, eller giv vejen land → start `lift` på fødderne, så figuren hopper tilbage.
- **Albuerne i håndstanden:** `shoulder.json` › `shoulder.4`–`shoulder.7` (facing −1). Giv armene `bend`, så albuerne peger bagud som i en rigtig håndstand-push-up med albuehulerne frem.
- **Ryggens krumning:** `warmup.json` › `warmup.2 › katko` (kat og ko: `spine` + og −) og de øvelser, hvor teksten nævner en rund øvre ryg (curl-ups i `core_situp.json`).
- **Ansigtets retning:** nakkens tuck og nik i `neck.json` (N1, N2, N3 › pande, N6 › frem og bagud) og hagen i `os.json` › `os.5`. Se på mærket på hovedet, og drej hovedet med `head`, så hagen og blikket passer med teksten.
- **Alle figurer:** se på billedet midt i hver bevægelse (stiplet ramme) og på knæ- og albuevinklerne under hver position på kontaktarket.

## Forslag til motoren (P1b)

- **`via` på en overgang:** en mellempose på vejen mellem to positioner, uden at forklaringen får en ny position. Den løser burpeens squat → chest med hoften højt og kan gøre kip op på væggen i `shoulder.3` og `shoulder.4` tydeligere.
- **Stillbilleder ved `advance`:** de står i hele bevægelsens brede kasse og bliver små; tegn dem i deres egen kasse.
