# Review NAT-3 P3 – skærpede forklaringer, del B

2026-11-09 · forklaringerne: 3648b6b · trænernes tolkninger P62–P67: d0cb7cc · feltet »Mærk«: 0a6b352, 77072e3 og 112ef68 (D55) · worktree på d0cb7cc · diff `git diff 112ef68 3648b6b -- content/explain/`

Omfang: `content/explain/` power_legs, power_upper, burpee_skill, burpee_emom, groin, neck, os, warmup, club_sequence og measures (63 punkter). Del A (pres, træk, skulder, ben, bagside, wall sit og core) reviewes for sig.

## Metode

Alle 63 punkter er læst felt for felt med brugerens blik: hjemme med gulv, stol, sofa, væg, rygsæk, pude og håndklæde, midt i et pas eller i Open & Strong. Kilderne er:

- `docs/PROGRAM_KILDE.md`: Lyske, Power ben og overkrop, Burpees, Teknik og varianter, Klubsekvensen, Opvarmning, Open & Strong, Nakke-stigen, Målinger, Målbrættet og »Fire regler«;
- `program/tracks/*.json`, `program/routines.json` og `program/measures.json`;
- ENGINE 5.3–5.6, 6.2 og 6.5 (R-POWER, R-EMOM, R-CLUB, R-NECK, R-HOLD, R-DP-*, R-PAIN-*);
- SPEC 3.2, 3.5, 3.8, 4.8, 8 og 9.1;
- DECISIONS P4–P7, P31, P35, P36, P47, P49, P52, P54–P67, D47, D54, D55 og R19.

Kortenes påstande om knapper, passet og motoren er tjekket i koden: `src/ui/session/Runner.tsx`, `MeasureInput.tsx`, `outline.ts`, `src/ui/screens/Ladders.tsx`, `src/engine/derive.ts`, `session.ts` og `plan.ts`.

Kørt i worktree:

- `node scripts/check-explain.ts` på hver af de ti filer: alle i orden.
- `npx vitest run`: 30 filer, 583 tests grønne (heriblandt `content`, `validate` og `no-source-refs`).
- `npm run shots:cards` (`CARDS_PORT=4183`): 129 kort i `screenshots/cards/` (ignoreret af git). To kort i omfanget har første trin under første skærm, se L2.
- `npx playwright test --project=pixel9a e2e/card.spec.ts e2e/measure.spec.ts e2e/no-source-refs.spec.ts e2e/content.spec.ts e2e/week1.spec.ts` (`E2E_PORT=4183`): 21 grønne, heriblandt uge 1 tirsdag (væg-test, push-ups og bord-rows som første sæt, E1, nakke), torsdag (base-check) og fredag.
- Et scratch-flow i `pixel9a` (tirsdag 10/11, indfasning med standardtrinene): Stiger → Lyske har 4 knapper »Vælg selv dette trin«; Øvrige → Nakke-stigen og Øvrige → Klubsekvensen har ingen. Skærmbilleder: `screenshots/review-nat3-p3b-nakke-ovrige.png` og `screenshots/review-nat3-p3b-nakke-n2-lettere.png`.

## Resultat

0 høje, 2 middel og 7 lave.

- **Navne, doser og tempo er uændrede.** Tempofelterne og alle tider i trinene passer med programmet og P55. Holdene i nakke, Open & Strong og opvarmningen passer med urene (P49). Bevægelsernes ID'er, kontakter og faser er ikke rørt.
- **Kortene er blevet mere konkrete uden at blive svære at skimme.** Udgangsstillinger med sofa, væg, trappetrin og håndklæde er præcise, »Mærk« står efter »Træner« og flytter ikke trinene ned, og kun os.1 og burpee_skill.V3 har første trin under første skærm (L2, fandtes før P3).
- **»Sværere« passer med motoren** i power (5 i alle sæt og lige høje/hurtige to pas i træk; skater-hop og split jumps 4 pr. side), EMOM (rene minutter med 20 sek pause, ved næste EMOM, højst ugens loft), klubsekvens (»Ren runde?« to pas i træk), nakke (»Let« to pas i træk) og lyske (toppen af intervallet med 2 i reserve). Toptrinene lover intet.
- **Målingerne til tirsdag 10/11 er entydige:** væg-testen, push-ups og bord-rows siger, hvad der tæller (knytnæve-højde ca. 10 cm og strakte arme; brystet til kanten og strakte arme; kun rene gentagelser), hvornår sættet stopper, og hvad der skrives i feltet. Knapnavnene passer med appen: »Gem målingen«, »Spring målingen over«, »Start uret«, »Stop«, »Start 3 minutter«, »Venstre side«/»Højre side«, »Venstre ben«/»Højre ben« og »Videre« (`MeasureInput.tsx`, `Runner.tsx`). R19 holder: burpee-testen står kun i de lette uger.
- **Sikkerhed:** smertereglen står med appens knapper (»Smerte«, »Let (≤3)«, »Skarp eller i et led«, nakkens »Stop: snurren, svimmelhed …«), ingen nakkebroer, støtte af hovedet over sengekanten, bløde landinger og stop ved fartfald. Lyskens »Hvorfor« lover ikke færre skader. Ingen henvisninger til PDF, sider eller kilder.
- **Trænernes valg:** P62 (power ben trin 1 uden landinger), P66 (N6 med ca. halv kraft) og P67 (hage-ind med armene i garden) står ordret i kortene og er forsvarlige. D54/P54 er fulgt: skater-hop og split jumps er ét sæt »skiftevis«, etbens bounds side for side. Men P62 er ikke ført videre til opvarmningens »Potensér« (L7).
- **To middel fund:** ti kort sender brugeren til et trinvalg, Stiger ikke har (M1), og lyskens to hold-trin lader ham støtte foden, mens uret logger et fuldt hold (M2).

## Fund

### M1 (middel): »Vælg den under Stiger« i nakke og klubsekvens kan ikke følges

- **Hvor:**
  - `content/explain/neck.json:104`, `:181`, `:285`, `:389` og `:515` (N2–N6, `easier`);
  - `content/explain/club_sequence.json:124`, `:210`, `:296`, `:382` og `:472` (C2–C6, `easier`);
  - skærm: Stiger → Øvrige → Nakke-stigen og Klubsekvensen (`screenshots/review-nat3-p3b-nakke-ovrige.png`, `screenshots/review-nat3-p3b-nakke-n2-lettere.png`).
- **Hvorfor:**
  - SPEC 3.5 (`docs/SPEC.md:150`): nakke-stigen og klubsekvensen står under »Øvrige«, og »Her vælges intet trin«.
  - Koden følger SPEC: kun spor med `category` ladder eller power får »Vælg selv dette trin« (`src/ui/screens/Ladders.tsx:25` og `:331`). »Øvrige« (`OtherDetail`, `:221–263`) viser kun »Dit trin«. Scratch-flowet bekræfter det: 4 knapper i Lyske, 0 i Nakke-stigen og Klubsekvensen.
  - Kortet sender altså brugeren efter en knap, der ikke findes, netop når trinnet er for hårdt. Motoren rykker heller ikke ned for »Hårdt« eller »Ren runde? nej« (ENGINE R-NECK, R-CLUB, 6.2).
  - Sætningerne er nye i P3. Før stod der kun nabotrinnet (»Trin N1: hage-ind liggende, …«).
- **Rettelse:** fjern »Vælg den under Stiger …« i de ti felter, og skriv det, appen kan. Fx:
  - N2: »Trin N1: hage-ind liggende. Glider hagen frem, før holdet er slut, så læg hovedet ned, og svar »Hårdt« efter nakken.« (116 tegn). N3–N6 tilsvarende med deres egne tegn på, at trinnet er for hårdt.
  - C2: »Trin C1: én runde i hvert sæt. Knækker formen i anden runde, så svar nej til »Ren runde?«. Du bliver på trinnet.« (112 tegn). C3–C6 tilsvarende.
  - Alternativ, hvis brugeren skal kunne vælge trin her: ret SPEC 3.5, skriv en D-linje, og giv nakke og klubsekvens »Vælg selv dette trin« i `Ladders.tsx`. Så kan teksterne blive.

### M2 (middel): Lyske trin 2 og 4: »Lettere« lader dig støtte foden midt i holdet, og uret logger det som et fuldt hold

- **Hvor:** `content/explain/groin.json:104` (groin.2, `easier`) og `:238` (groin.4, `easier`): »Lad den nederste fod hvile let i gulvet, hvis hoften synker, før tiden er gået.«
- **Hvorfor:**
  - Hold-uret logger selv »som planlagt«, når tiden er gået (SPEC 3.2 Hold-øvelser, `docs/SPEC.md:110`; ENGINE 5.3 punkt 2, `docs/ENGINE.md:134`; `Runner.tsx:1433–1441`). Et hold med foden i gulvet tæller derfor som et fuldt hold.
  - R-HOLD og R-DP-TARGET lægger så 5 sek til og tæller hits (ENGINE 5.4 og 6.2, `docs/ENGINE.md:141`, `:145` og `:270`). Brugeren kan altså rykke op til trin 3 og 5 på hold, han ikke klarede uden støtte.
  - Programmets stop-regel: »stop sættet, når … formen knækker« (`docs/PROGRAM_KILDE.md:132`). En hofte, der synker, er formen, der knækker. Appen har knappen til det, »Stoppede før tid« (`Runner.tsx:1449`), og core_front og wallsit i samme pakke bruger den (`core_front.json:90`, `wallsit.json:27`).
  - SPEC 9.1 (`docs/SPEC.md:359`): »Lettere« på et trin, der ikke er det første, er nabotrinnet eller programmets egen variant. Foden i gulvet er ingen af delene, og ingen P-linje beskriver den.
- **Rettelse:**
  - groin.2: »Trin 1: liggende adduktorløft. Synker hoften før tiden, så stop, og tryk »Stoppede før tid«. Sker det pas efter pas, så vælg trin 1 under Stiger.« (145 tegn)
  - groin.4: »Trin 3: kort Copenhagen, hoften op og ned. Synker hoften før tiden, så stop, og tryk »Stoppede før tid«. Sker det pas efter pas, så vælg trin 3 under Stiger.« (157 tegn)

### L1 (lav): power_upper.1: »stop lige over gulvet« kan læses som en pause, programmet ikke har

- **Hvor:** `content/explain/power_upper.json:39` (power_upper.1, `mistakes[2].fix`).
- **Hvorfor:** Programmet siger »Kontrolleret ned, eksplosivt op« (`docs/PROGRAM_KILDE.md:490`), og figuren har ingen pause i bunden. »… stop lige over gulvet, og pres først eksplosivt op derfra« lyder som en pause i bunden, som tager fjederen ud af et power-sæt. Trin 2 siger det modsatte: »Pres op med det samme fra bunden« (`:100`). Tempoet må ikke ændres (SPEC 9.1).
- **Rettelse:** »Sænk dig kontrolleret helt ned til lige over gulvet, og vend straks eksplosivt op uden at falde det sidste stykke.« (114 tegn)

### L2 (lav): Open & Strong punkt 1: første trin står under første skærm

- **Hvor:** `content/explain/os.json:13` (os.1, `start`). Skærm: kortet åbnet ved punkt 1 i Open & Strong. Det samme gælder burpee_skill.V3, men det kort åbnes ikke i et pas.
- **Hvorfor:** SPEC 3.8 og D47 (`docs/SPEC.md:177`): cues og starten af trinene skal stå på første skærm (414 × 847) midt i et pas. `npm run shots:cards` melder »os.1: første cue slutter 591 px, første trin begynder 851 px« og »burpee_skill.V3: … første trin begynder 884 px«. Det fandtes før P3, for figur, faser, cues og `start` er uændrede. Men pakkens mål var at skære ned, hvor det kan lade sig gøre, og trinets første linje skal op over 823 px, altså to linjer.
- **Rettelse:** gør `start` til to linjer, og flyt håndklædets placering ind i trin 1:
  - `start`: »Lig på ryggen med bøjede knæ og hænderne om baghovedet.«
  - trin 1: »Læg dig, så håndklædet ligger på tværs under de nederste spidser af skulderbladene, og ånd dybt ind gennem næsen.« (113 tegn)
  - Tjek bagefter med `npm run shots:cards`.

### L3 (lav): Klubsekvens C6 bruger »triceps«

- **Hvor:** `content/explain/club_sequence.json:442` (C6, `trains`) og `:461` (C6, `mistakes[0].fix`).
- **Hvorfor:** SPEC 8 (`docs/SPEC.md:318–319`): samme ord for det samme overalt og ingen fagudtryk uden forklaring. Pakken har skiftet »triceps« ud med »bagsiden af overarmene« i power_upper, og de andre klubkort skriver »armenes bagside«.
- **Rettelse:** `trains`: »Stærk bagside af armene til lige slag: …«; `fix`: »… så armenes bagside gør arbejdet.«

### L4 (lav): Push-up-målingen: »på knæ« og »på knoer« står side om side

- **Hvor:** `content/explain/measures.json:108` (measures.pushups, `easier`).
- **Hvorfor:** Målingen er tirsdag 10/11. »Gentagelser på knæ … tæller ikke. Ondt i håndleddet: tag den på knoer hver gang.« Ordene ligner hinanden, og læst i farten kan det blive til push-ups på knæ, som netop ikke tæller (SPEC 8: konkret og ét budskab pr. sætning; opgaven: entydigt, hvad der tæller).
- **Rettelse:** »Ingen lettere udgave. Push-ups på knæ, på sofaen eller uden dybde tæller ikke. Ondt i håndleddet: tag den på knyttede hænder hver gang.« (135 tegn)

### L5 (lav): Bord-rows: vipper bordet, siger kortet stadig »resten af træk-sættene på dit trin«

- **Hvor:** `content/explain/measures.json:146` og `:149` (measures.table_rows, trin 1 og 4).
- **Hvorfor:** P61 (`docs/DECISIONS.md:158`): vipper bordet, tager du resten af dagens træk-sæt som rygsæk-row. Tirsdag 10/11 er første gang, bordet prøves. Trin 1 siger »spring målingen over«, og trin 4 siger, uden forbehold, »Resten af træk-sættene tager du på dit trin«. På pull trin 2 eller højere er det bord-rows ved samme bord. Pull-kortene (del A) har reglen, men de åbnes først ved næste skridt.
- **Rettelse:** trin 1: »Træk først let. Vipper bordet det mindste, så stop, tryk »Spring målingen over«, og tag træk-sættene som rygsæk-row.« (116 tegn)

### L6 (lav): EMOM-»Hvorfor« lover oprykning »i næste uges pas«

- **Hvor:** `content/explain/burpee_emom.json:6` (`why[1]`). Fandtes før P3.
- **Hvorfor:** ENGINE R-EMOM (`docs/ENGINE.md:149`), P5 og P36: oprykningen sker ved næste EMOM-pas. I en let uge er der burpee-test, så oprykningen venter til ugen efter, og i en uge med reduceret mængde (R-FLAT) sker den ikke. Kortenes »Sværere« i samme fil siger rigtigt »ved næste EMOM«.
- **Rettelse:** »… får du næste trin ved næste EMOM, højst til ugens loft. Ellers bliver du på trinnet.«

### L7 (lav): Opvarmningens »Potensér« følger ikke den lettere variant fra P62

- **Hvor:** `content/explain/warmup.json:386` (warmup.4, trin 1) og `:408` (`easier`).
- **Hvorfor:** P62 (`docs/DECISIONS.md:159`) giver power ben trin 1 en lettere variant uden landinger, fordi »efter skarp smerte er det landingen, der skal skånes«. I samme pas beder warmup.4 om 2 × 3 af dagens første power-øvelse, altså seks squat jumps, plus pogo-hop. Opvarmningen sender heller ikke »lettere variant« med til kortet (`Runner.tsx:339`). Det samme gælder power overkrop trin 1 (hænderne på sofaen) i Styrke B.
- **Rettelse:** warmup.4 trin 1: »Lav 3 gentagelser af dagens første power-øvelse i halv fart og 3 i fuld fart, som lettere variant, hvis passet viser det.« (121 tegn). Bedre er det, hvis opvarmningen også viser »lettere variant« under »Potensér« (kode, uden for P3).

## Uden for pakken (forslag)

- **EMOM og klubsekvensen har ingen »Smerte«-knap** (`EmomStep` og `ClubStep` i `Runner.tsx`), så »Skarp eller stigende smerte i et led: stop øvelsen, og gå et trin ned i en uge« i EMOM-kortenes »Hvorfor« kan kun følges ved at vælge trinnet under Stiger. Det bør med i P5a, når søndagstjekket kan give smerte på et spor.
- **EMOM-oprykningen ser ikke på et midlertidigt trin** (`src/engine/session.ts:228–233`). Har EMOM fået »lettere variant« på E1 (det kan først ske, når søndagstjekket kan give smerte på EMOM'en), kan et rent pas give E2 ved næste EMOM, og gendannelsen sætter ham så tilbage til E1 i samme pas (`session.ts:390–393`). Det kræver et scenarie i ENGINE 8, før søndagstjekket bygges.

## Opfølgning

2026-11-09 · rettelserne: c1685a6 · `git diff 5fa62f0 c1685a6 -- content/explain/` · worktree på c1685a6

Kørt: `node scripts/check-explain.ts` på de ti filer (alle i orden), `npx vitest run` (30 filer, 583 tests grønne) og `npm run shots:cards` (`CARDS_PORT=4183`: kun burpee_skill.V3 står under første skærm). `src/` og `program/` er ikke rørt.

| Fund | Status | Tjekket |
|---|---|---|
| M1 nakke | Rettet | N2–N6 siger nu fx »Glider hagen frem …, så læg hovedet ned, og svar »Hårdt« efter nakken. Du bliver på trinnet.« Det passer med appen: efter nakken spørger passet »Hvordan føltes trinnet?« med »Let«, »Passende« og »Hårdt« (`Runner.tsx`, `Feel`). Det passer også med R-NECK og ENGINE 6.2: kun »Let« to pas i træk giver næste trin, et andet svar nulstiller tælleren (`derive.ts`, `done(feel === 'easy')`), og »Hårdt« rykker ikke ned. Rådene (læg hovedet ned, pres mindre, støt hovedet, mindre modstand) følger kortenes egne typiske fejl og P66. Alle under 160 tegn |
| M1 klubsekvens | Rettet | C2–C6: »Knækker formen …, så svar nej til »Ren runde?«. Du bliver på trinnet.« Spørgsmålet har knapperne »Nej« og »Ja«, og R-CLUB nulstiller ved et urent pas |
| M2 lyske | Rettet | groin.2 og groin.4 peger på nabotrinnet og »Stoppede før tid«, som hold-uret har (`Runner.tsx:1449`). Lyske er en stige, så »vælg trin … under Stiger« kan følges |
| L1 | Rettet | power_upper.1: »vend straks eksplosivt op uden at falde det sidste stykke«. Ingen pause i bunden |
| L2 | Rettet for os.1 | Første trin står nu på første skærm. burpee_skill.V3 står stadig under, men kortet åbnes ikke i et pas, og figurens faseliste er uændret, så det accepteres |
| L3 | Rettet | C6 siger »bagside af armene« i `trains` og i fejlens rettelse |
| L4 | Rettet | »på knyttede hænder« i stedet for »på knoer« |
| L5 | Rettet | Bord-rows trin 1 siger nu, at træk-sættene tages som rygsæk-row, hvis bordet vipper (P61) |
| L6 | Rettet | EMOM-»Hvorfor«: »ved næste EMOM, højst til ugens loft« |
| L7 | Rettet i teksten | warmup.4 trin 1 siger »som lettere variant, hvis passet viser det«. »Dagens pas« viser »Lettere variant i dag«, så brugeren kan vide det. At opvarmningen selv viser »lettere variant« under »Potensér« (`Runner.tsx:339`), er stadig et forslag uden for P3 |

Ingen nye fund i de ændrede felter. Pakkens del B er godkendt fra min side.
