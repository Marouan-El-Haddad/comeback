# Review af NAT-3 P5b – Livet: flyt og spring over

2026-11-10 · c5d495f, 5a6604d, 7ed05e0, 622b215, b9abdbb, 051a4f6, 959fbc5, 42512da og e414f9b · worktree på e414f9b (`git diff de76ce6 e414f9b`)

Metode:

- **Læst** mod:
  - P5b i `docs/runs/NAT-3-TASKS.md` og pakke 5 i `docs/runs/NAT-3.md`;
  - SPEC 3.1, 3.4, 3.7, 4.11, 5 og 6;
  - ENGINE 3.1, 5.1, 5.3, 5.7, 5.9, 5.10, 5.14 og 8 (S-MOVE-01..04);
  - PROGRAM_KILDE »Din uge« (s. 6) og »Når livet ændrer sig« (s. 47);
  - PLAN M3, tjekliste 7;
  - DECISIONS D57, D61, D63, D64 og R27.
- **Kørt** i worktreen:
  - `npm run check`: exit 0. Det giver 768/768 tests, typecheck, lint og build. JavaScript fylder 113,8 kB gz: startfilerne `index` 29,9 kB og `engine` 27,3 kB, og `LifeForm` 4,1 kB hentes efter start. Startfilerne henviser ikke til indholdet.
  - `e2e/moves.spec.ts` i `pixel9a` og `pixel9a-utc` (`E2E_PORT=4185`, Firefox uden JIT): 14/14.
- **Egne flows** (scratch, ikke committet):
  - Tidsmaskinen i `pixel9a`:
    - lørdag efter en uge uden pas;
    - torsdag med motoren sprunget over og flyttet, og tirsdagens A flyttet til i dag (L1);
    - A flyttet til torsdag, så ugen frem til søndag (M2);
    - B flyttet til søndag og ikke taget, frem til mandag.
  - Det rigtige ur uden tidsmaskine i begge projekter (6/6):
    - I dag tirsdag 10/11 kl. 7.30;
    - flytteskærmen åben tirsdag kl. 22 hen over midnat;
    - B flyttet til søndag, så søndag kl. 23.50 → mandag kl. 00.05.
- **Motoren** med et scratch-script på testenes `Log`:
  - regel 3 med en begivenhed mandag og torsdag;
  - partnerens advarsel;
  - syge- og feriedage;
  - `catchUp` på en rejsedag;
  - to flytninger af samme pas;
  - hviledagsreglen med `clubDays` [1, 2, 3, 5, 6].
- **Skærmbilleder** i `screenshots/`:
  - `review-p5b-tirsdag-rigtigt-ur.png`
  - `review-p5b-loerdag-tre-kort.png`
  - `review-p5b-uge-forkert-status.png`
  - `review-p5b-soendag-uden-rolig-tur.png`
  - `review-p5b-soendag-med-b.png`
  - `review-p5b-mandag-soendagspas.png`

## Resultat

0 høje, 2 middel og 5 lave.

- **Det virker:**
  - **Reglerne i 5.9:**
    - Skærmen viser kun dage fra i dag til søndag i passets uge.
    - Der lander aldrig to pas på samme dag, heller ikke oven på et pas, der er logget eller i gang.
    - Motoren kan kun flyttes til en fri dag, og A eller B på motorens dag fjerner motoren den uge.
    - Hverken A eller en motor i en intervaluge kan flyttes til dagen før en begivenhed. Med en begivenhed mandag kan A ikke flyttes til søndag, og med en begivenhed torsdag ikke til onsdag.
    - Hviledagsreglen tæller passets egen dag med og en dag, der er gået uden pas. Med `clubDays` [1, 2, 3, 5, 6] kan B flyttes til søndag, når torsdag gik uden pas, men ikke når A blev taget torsdag.
    - PLAN M3, tjekliste 7, giver præcis det, kilderne beskriver:
      - torsdag og søndag som hele dage, torsdag med »Motoren udgår denne uge.« og »B skal efterlade dig frisk.«;
      - onsdag og lørdag som kort version;
      - aldrig fredag.
  - **»Det, der flyttes, taber« (S-MOVE-04) i `scheduleForWeek`:**
    - En flytning i loggen til en optaget dag eller ud af ugen gælder ikke.
    - En gyldig flytning bagefter virker.
    - To flytninger af samme pas lander rigtigt, og motoren kommer igen, når A flytter væk fra dens dag.
  - **Hændelserne:**
    - Der tilføjes kun `session_moved` og `session_skipped`, og kun gennem `model.commit`.
    - `forDate` fandtes allerede i typen og i `catchUp`. Der er ingen skemaændring og derfor ingen migration.
  - **Tidsmaskinen:**
    - Alle skrivninger går til kopien.
    - »Afslut« lukker skærmen på I dag og i Uge.
    - `useSameWorld` stopper en skrivning på tværs af verdenerne. Lageret vælges synkront før første `await` i `commit`, så »Afslut« midt i et tryk når aldrig det rigtige lager.
    - Lagerets antal hændelser er uændret i alle flows.
  - **Datoer:**
    - Ugen er mandag–søndag, og I dag følger København, også med uret i UTC.
    - Står skærmen åben over midnat, regner den dagene fra onsdag, og flytningen får onsdagens dato.
    - Et pas, der står søndag og ikke bliver taget, står mandag med kun »Spring over«.
  - **Dobbelttryk:** D61-spærren og det halve sekund (D57) virker på »Flyt eller spring over«, dagene, »Spring over« og kortet, også når hver skrivning er 400 ms langsommere.
  - **Brug under træning:**
    - Knapperne er 56 px (også Uges chip-knapper) med 8 px imellem, og al tekst er mindst 16 px.
    - Der er ingen dialog, »Tilbage« står øverst, og hver status har tekst.
    - Der er ingen henvisninger til kilder.
    - Tirsdag står »Flyt eller spring over« over fanerne (bunden 613 px, fanerne 782 px).
    - Lørdag med tre glemte pas står hovedkortet stadig over fanerne, også under tidsmaskinens banner.
  - **Teksterne** er korte og ens på I dag, skærmen og Uge.
- **Det virker ikke:**
  - »Flyt« tilbyder syge- og feriedage, og et pas, der flyttes dertil, forsvinder (M1).
  - »Valgfri rolig tur« mangler, når motoren udgår (M2).

## Fund

### M1 (middel): »Flyt« tilbyder syge- og feriedage, og passet forsvinder uden spor

- **Alvor:** middel.
  - I dag kan det kun ske med en importeret log, for appen kan endnu ikke sætte »Syg« eller »Ferie«.
  - Når P5c bygger det, mister brugeren et pas uden at se det.
- **Hvor:**
  - `src/engine/moves.ts:44–90`: `validMoveDays` ser ikke på `statusOn` for dagen.
  - `src/engine/plan.ts:884–891` og `src/ui/moves.ts:46–47`: en syge- eller feriedag har intet pas og intet kort.
- **Hvorfor:**
  - **Kilderne:**
    - ENGINE 5.7, R-ILL: »alle dage røde: kun Open & Strong og gåtur«.
    - ENGINE 5.7, R-HOLIDAY: »hvile«.
    - ENGINE 5.1, punkt 3.
    - ENGINE 5.9: »To pas kan aldrig lande på samme dag; det, der flyttes, taber«. Her taber passet uden at lande nogen steder.
  - **Probe med syg torsdag–fredag:**
    - Onsdag tilbyder skærmen tirsdagens A torsdag med »Motoren udgår denne uge.«.
    - Efter trykket er torsdag rød uden pas, og motoren er væk.
    - A står resten af ugen hverken på I dag, i et kort eller i Uge, selv om søndag var en gyldig dag.
  - **Med ferie lørdag–søndag** tilbydes lørdag (kort version) og søndag på samme måde.
- **Rettelse:**
  - Spring dage over i `validMoveDays`, hvor `statusOn` er `ill` eller `holiday`. En rejsedag må gerne tage A eller B som rejsepas.
  - Skriv det som en regel i ENGINE 5.9 og som et scenarie (fx S-MOVE-05: syg torsdag og ferie i weekenden, så torsdag, lørdag og søndag ikke tilbydes), med test, før P5c.

### M2 (middel): »Valgfri rolig tur« mangler, når en flytning fjerner motoren

- **Hvor:**
  - `src/ui/screens/Today.tsx:722–728`: noten siger kun »Motoren udgår denne uge.«.
  - Dagens kort og `dayLine` for en fri dag i samme fil siger det heller ikke.
  - `src/engine/plan.ts:881`: flaget `motor_dropped` sættes kun ved layoutet og vises ingen steder.
- **Hvorfor:**
  - **Kilderne:**
    - ENGINE 5.9, regel 1: »motoren udgår så den uge …, og I dag viser »valgfri rolig tur« på en fri dag, hvis der er en«.
    - Programmet (»Når livet ændrer sig«): »Motor-passet ryger først … Behold én rolig tur, hvis du kan.«
  - **I appen:**
    - Efter tjekliste 7's flytning til torsdag står der kun »Motoren udgår denne uge.«, og det læses som ingen kondition den uge.
    - Søndag står »Fri gåtur · Open & Strong valgfri« og søndagstjekket (`screenshots/review-p5b-soendag-uden-rolig-tur.png`).
    - D64 nævner det ikke.
- **Rettelse:**
  - Når `motorGone` gælder, så vis »Valgfri rolig tur« på ugens næste frie dag (ingen klub og intet pas): på dagens kort og i »I morgen« og »Resten af ugen«.
  - Skriv noten og knappens note som »Motoren udgår denne uge – tag en valgfri rolig tur på en fri dag.«.
  - Test det i `e2e/moves.spec.ts`.
  - Samme tekst mangler for layoutet i 5.10 (S-EXTRA-01), men det hører til P6.

### L1 (lav): Uge kalder et pas »sprunget over«, når et andet pas blev sprunget over samme dag

- **Hvor:** `src/ui/screens/Week.tsx:82–84` og `:92–93`.
- **Hvorfor:**
  - SPEC 3.4 giver hvert pas sin status, men `skipped` ser kun på dagen og ikke på passet.
  - Et eksempel torsdag:
    - Motoren springes over, og den flyttes til søndag.
    - Tirsdagens A flyttes til i dag.
    - Uge viser så »Styrke A · 55 min« med »– sprunget over« (`screenshots/review-p5b-uge-forkert-status.png`), mens I dag rigtigt siger »Flyttet fra tirsdag.«.
  - Desuden står »– sprunget over« før »i gang«. Et pas, der er sprunget over og så startet alligevel, står derfor som sprunget over, mens det kører.
- **Rettelse:** brug `item?.skipped`, som kun gælder passet selv, og tjek `d.open` før.

### L2 (lav): »B skal efterlade dig frisk« ved et partnerpas, der aldrig blev taget

- **Hvor:** `src/engine/moves.ts:78–83`.
- **Hvorfor:**
  - ENGINE 5.9, regel 5, handler om A og B på to dage i træk.
  - Koden finder partneren i ugeplanen, også på en dag, der er gået.
  - Et eksempel lørdag: fredagens B blev ikke taget, men tirsdagens A får alligevel »Kort version i dag · B skal efterlade dig frisk.«.
- **Rettelse:**
  - Er partnerens dag før i dag, så vis kun advarslen, hvis partneren er logget den dag (`state.sessions`).
  - Tilføj et tilfælde i testen.

### L3 (lav): ENGINE 3.1 siger noget om `session_skipped`, som `catchUp` ikke gør

- **Hvor:** `docs/ENGINE.md:50` og `src/engine/session.ts:508–513`.
- **Hvorfor:**
  - Den nye tekst i ENGINE 3.1 siger:
    - `date` er dagen, hændelsen skrives;
    - `kind` er ugeplanens pas, A eller B, også på en rejsedag.
  - `catchUp` skriver `reason: 'missed'` anderledes:
    - `date` er passets dag. Tirsdagens A skrevet onsdag får `date: 2026-11-10`, set i begge projekter.
    - `kind` er `travel` på en rejsedag.
  - Det har ingen virkning i dag, men en senere pakke, der læser `skipped`, vil stole på teksten.
- **Rettelse:** præcisér ENGINE 3.1 for `missed`: »`date` er passets dag; `kind` er dagens pas, `travel` på en rejsedag«. Koden skal ikke ændres.

### L4 (lav): Et fejltryk på kortets »Spring over« fjerner passet fra I dag uden at sige, hvor det kan findes

- **Hvor:** `src/ui/screens/Today.tsx:395–441` (`MissedCard`).
- **Hvorfor:**
  - D64 (4) lader et pas, der er sprunget over på dagen, blive stående, »så et fejltryk ikke koster passet«.
  - På kortet med et glemt pas står »Flyt« og »Spring over« side om side med 8 px imellem, og »Spring over« skriver og fjerner kortet med det samme.
  - Passet kan stadig flyttes fra Uge, men intet på I dag siger det.
- **Rettelse:** gør ét af to:
  - lad linjen sige »✓ Styrke A i går er sprunget over. Du kan stadig flytte det under Uge.«, når ugen har dage tilbage;
  - eller lad kortet blive stående resten af dagen som »Sprunget over« med »Flyt«, som hovedkortet gør.

### L5 (lav): Testene holder ikke regel 3 og »en dag, der er gået, tæller som hviledag« fast

- **Hvor:** `src/engine/__tests__/moves.test.ts` og `src/ui/__tests__/moves.test.ts`.
- **Hvorfor:**
  - Opgaven peger på dagen før en begivenhed, men ENGINE 5.9, regel 3, har ingen test.
  - Det har regel 4's anden sætning heller ikke: »En dag i ugen, der er gået uden pas og uden klub, tæller som hviledag«. S-MOVE-01's søndag består også uden den, for tirsdag er passets egen dag og er fri under alle omstændigheder.
  - Koden virker i dag (proben), men intet forhindrer, at den går i stykker.
- **Rettelse:** scenarier med test:
  - **En begivenhed:** hverken A eller en motor i en intervaluge kan flyttes til dagen før, men B kan.
  - **`clubDays` [1, 2, 3, 5, 6] med A flyttet til torsdag:**
    - B kan flyttes til søndag, når torsdag gik uden pas;
    - men ikke, når A blev taget torsdag.

## Opfølgning

2026-11-10 · 74c2736, c07d9be, cf4a759 og 5450bf1 (D66, R29, ENGINE 3.1, 5.9 regel 1, 5 og 6, S-MOVE-05..09, SPEC 3.1) · worktree på 5450bf1, hvor P5a's rettelser (8668a44–be3d17d) ligger imellem.

Metode:

- **Kørt** i worktreen:
  - `npm run check`: exit 0, 793/793 tests. JavaScript fylder 115,3 kB gz: startfilerne `index` 30,6 kB og `engine` 27,4 kB, og `LifeForm` 4,8 kB hentes efter start.
  - `e2e/moves.spec.ts` og `e2e/life.spec.ts` i `pixel9a` og `pixel9a-utc` (`E2E_PORT=4186`): 42/42.
- **Egne flows** i begge projekter (4/4, scratch):
  - Androids tilbage-gestus på flytteskærmen fra I dag og Uge;
  - tirsdagens A flyttet til torsdag om tirsdagen og ugen frem til søndag (`screenshots/review-p5b-fu-tirsdag-tur.png`).
- **Motoren** med et scratch-script: den rolige tur dag for dag og efter en flyttet motor.

### Status på fundene

- **M1 rettet:**
  - `validMoveDays` springer syge- og feriedage over (regel 6), og det gælder også den rolige tur.
  - En rejsedag kan tage A, som så bliver rejsepasset.
  - S-MOVE-05 prøver begge dele.
- **M2 rettet:**
  - `calmTourDay` giver den første dag, motoren selv kunne flyttes til.
  - Den dag står linjen over hovedkortet, og »Valgfri rolig tur« står i »I morgen« og »Resten af ugen«.
  - Noten på flyttedagens knap og på det flyttede pas nævner dagen (»… tag en valgfri rolig tur søndag.«). Er der ingen dag, står kun »Motoren udgår denne uge.«.
  - S-MOVE-06 og e2e fra onsdag til søndag prøver det. Se dog N1 og N2.
- **L1 rettet:** status bruger nu `item?.skipped`, og »i gang« vises før »– sprunget over«. Flowet fra reviewet er nu en e2e-test.
- **L2 rettet:** ved en partnerdag, der er gået, vises advarslen kun, når partneren blev taget (S-MOVE-07).
- **L3 rettet** i ENGINE 3.1.
- **L4 rettet:** linjen siger »… Du kan stadig flytte passet under Uge.«, når ugen har en dag til det.
- **L5 rettet:** S-MOVE-08 prøver regel 3, og S-MOVE-09 prøver hviledagsreglen. S-MOVE-09 skelner virkelig mellem de to tilfælde: fredag er klubdag i den uge, så kun torsdag kan blive hviledag.

**Samspillet med P5a på I dag** gav ingen fund:

- Tilbage-gestussen lukker flytteskærmen på I dag og i Uge uden at skrive.
- Historikken vokser ikke efter en flytning.
- »Afslut« lukker nu alle skærme.
- Dobbelttryk- og tidsmaskinetestene består stadig.

### Nye fund

#### N1 (lav): Den rolige tur kan foreslås to gange og tage ugens eneste hviledag

- **Hvor:**
  - `src/engine/moves.ts:134–147`: `calmTourDay` regner altid fra i dag.
  - `src/ui/screens/Today.tsx:227` og `:306`: linjen over hovedkortet.
- **Hvorfor:**
  - **Kilderne:**
    - ENGINE 5.9, regel 1: »Behold én rolig tur, hvis du kan«.
    - ENGINE 5.9, regel 4, og programmet: »Mindst én hel hviledag om ugen«.
  - **I appen:** et eksempel, hvor tirsdagens A om tirsdagen flyttes til torsdag:
    - Knappen siger »… tag en valgfri rolig tur i dag.«, og I dag foreslår turen tirsdag.
    - Søndag foreslår I dag turen igen. En tur logges ikke, så tirsdag tæller stadig som hviledag.
    - Tager brugeren begge ture, har ugen ingen hel hviledag: mandag, onsdag og lørdag er klub, torsdag A og fredag B.
- **Rettelse:**
  - Lad en dag, der er gået, og som I dag foreslog turen på, tælle som optaget i hviledagsreglen, når den næste tur findes. Så foreslås søndag kun, hvis ugen stadig har en anden hel hviledag.
  - Tilføj tilfældet til S-MOVE-06.

#### N2 (lav): Den rolige tur kan ikke lægges på motorens egen dag, heller ikke når dagen er fri

- **Hvor:** `src/engine/moves.ts:146`: `calmTourDay` giver motorens plandag som `fromDate`, og `validMoveDays` springer altid den dag over.
- **Hvorfor:**
  - ENGINE 5.9, regel 1 (D66): turen står på den første dag, »motoren selv kunne flyttes til«.
  - Et eksempel:
    - Mandag flyttes motoren til søndag.
    - Onsdag flyttes tirsdagens A til søndag, og knappen siger kun »Motoren udgår denne uge.«.
    - Torsdag er nu fri, men der foreslås ingen tur. Proben viser, at `validMoveDays` ellers ville give torsdag.
  - Det kræver en sjælden rækkefølge.
- **Rettelse:**
  - Brug motorens sidste plads, før den udgik, som `fromDate`, eller lad `validMoveDays` tage en `fromDate`, der ikke springer nogen dag over.
  - Tilføj tilfældet til S-MOVE-06.

### Resultat efter opfølgningen

Alle syv fund er rettet. Der er 2 nye lave fund (N1 og N2) og ingen høje eller middel.
