# Review NAT-3 P0 – passet færdigt fra arbejdsmappen

Reviewet: 73213a6, 62e3ca9, 504feea, 6f0d761 og 3c91d73 (`git diff 2894827 3c91d73`) i en ren worktree på 073aafc. Kilder: SPEC 3, 3.1–3.3, 3.8, 4.2–4.5, 4.8, 5 og 6; DECISIONS D33, D44, D45, D47, D50–D54, P47, P54, R19; ENGINE 5.2–5.6; PROGRAM_KILDE (Styrke A og B); `docs/reviews/nat2-p2-forklaringer-1.md` (N3).

**Resultat: 1 høj, 1 middel, 6 lav.**

## Fund

### H1 (høj): Introkortets »Luk« har ingen trykspærre, og knappen under det er nakkens »Stop«

- **Hvor:**
  - `src/ui/session/Runner.tsx:222–228`: trykspærren på et halvt sekund reagerer kun på `run.phase`, `run.preIndex`, `run.stepIndex` og `away`. Når et introkort lukker, ændres kun `introShut` (linje 239), og så er der ingen spærre.
  - `src/ui/session/Intro.tsx:80` og `:166`: selve kortet lukker ved tryk, men det er ingen `button`, så `.session.settling button` (`src/ui/app.css:816`) dækker det ikke.
  - Skærme: nakkens introkort (tirsdag og fredag), opvarmningens kort og introkort i en pause.
- **Målt (Playwright `pixel9a`, uden tidsmaskine, 17/11):** »Luk« fylder 382 × 56 px ved y = 775. Når kortet er lukket, ligger en anden knap på præcis samme sted. To tryk med 180 ms imellem gav:
  - **Nakken:** en ny hændelse `set_logged A.neck pain: 'stop'`. Nakken og spørgsmålet springes over, og skærmen viser »Alt er logget«.
  - **Opvarmningen:** »Videre« springer »Hæv pulsen« over (headeren viser »Opvarmning · 2/4«).
  - **Pausen før Pres:** »Spring pausen over« springer pausen over, og power-spørgsmålet kommer.
  - Det samme sker med ét tryk på »Luk« i det øjeblik, »Gør klar« (10 sek) lukker kortet af sig selv.
  - Efter layoutet rammer et dobbelttryk på en gul dag reserveknappen »2« ved første sæt.
- **Hvorfor:**
  - SPEC 3.3 og D33: en knap, der vises efter et skift af skærm, kan først trykkes efter et halvt sekund (designgennemgangen D1, D2).
  - SPEC 6: ingen hurtigt skiftende knapper på samme sted.
  - Stop-hændelsen bliver stående i den tilføj-kun log og udløser R-NECK (advarslen »Søg læge …«), R-PAIN-SHARP (»lettere variant«, `hits = 0`) og sætter q2 til »nej« i to dage (ENGINE 5.2, 5.4 og 5.5).
  - Ingen test prøver et tryk lige efter et introkort.
- **Rettelse:**
  1. Tilføj `introShut` til afhængighederne i trykspærrens effekt (`Runner.tsx:228`), så et introkort, der lukkes med tryk, »Luk« eller uret, tæller som et skift af skærm.
  2. Giv `.intro-card` `pointer-events: none` under `.session.settling`. Ellers lukker andet tryk i et dobbelttryk på »Som planlagt« straks næste øvelses introkort.
  3. Playwright: et dobbelttryk på »Luk« ved nakkens introkort skriver ingen hændelse, og ved en pauses introkort kører pausen videre.

### M1 (middel): Styrke B i måleuger – hollow deler Par 2, og »Dagens pas« viser »Par 2« to gange

- **Hvor:**
  - `src/ui/session/steps.ts:153–157`: gruppen stopper ved den selvstændige måling.
  - `src/ui/session/outline.ts:40–45` og `src/ui/session/DayPlan.tsx:176–178`.
  - Skærm, »Dagens pas« fredag 13/11:
    - Del 4 »Par 2« har kun Etbens RDL, men noten siger »Et sæt af hver øvelse efter tur, med pause imellem«.
    - Del 5 er »Måling · Hollow hold«.
    - Del 6 er »Par 2« igen, med sideplanke og rotation.
  - I passet står »Del 4 af 10 · Par 2« og »Del 6 af 10 · Par 2 · sæt 5/10«.
- **Logget fredag 13/11 (Playwright):** RDL venstre/højre to gange i træk med 45 sek pause, så hollow, så skifter sideplanke og rotation.
- **Hvorfor:**
  - PROGRAM_KILDE, Styrke B: »Par 2 | Bagkæde: etbens RDL + Mave 2: side og rotation | … | 45 s« og »Sådan kører du et par: lav den første øvelse, hold pause, lav den anden …«.
  - SPEC 3.2: delene er dem, passet kører i, og et par siger »Et sæt af hver øvelse efter tur«.
  - ENGINE 5.6 kræver kun, at hollow kommer »før Mave 2«.
  - Det rammer denne fredag (13/11) og uge 4, 8 og 12. Rækkefølgen fandtes før pakken, men »Dagens pas« og »Del N af M« viser den nu som to par, hvor det ene har én øvelse.
- **Rettelse:**
  1. Lad `buildSteps` placere en selvstændig måling, der ligger inde i en gruppe, før gruppen. Så kommer hollow først, og Par 2 er RDL, sideplanke og rotation efter tur, stadig »før Mave 2«.
  2. Vitest for Styrke B uge 1: Par 2 skifter mellem RDL og Mave 2, og `sessionSections` har ét »Par 2«.
  3. Trinnøglerne (D54) holder et gemt pas på sit trin. Skal ENGINE 5.6 læses anderledes, så ret den først.

### L1 (lav): Genoptagelse fra loggen kender ikke selvstændige målinger og stoppede blokke

- **Hvor:** `src/ui/session/steps.ts:300–326` (`firstNotLogged`):
  - `'measure'` falder i `default: false`, så en logget hollow eller balance tæller aldrig som udført.
  - Sæt i en blok, der er stoppet af skarp smerte eller »Stop«, tæller som ikke logget.
  - Et skiftevist sæt, som den forrige version gemte efter venstre side, tages om, så venstre logges to gange.
- **Hvornår:** når D54's sikkerhedsnet bruges: en nøgle, der ikke findes, et pas fra den forrige version med et skiftevist sæt, eller manglende `comeback.run` (se L2). Et pas, der genoptages efter hollow om fredagen, starter forfra ved hollow, og de sæt, der kommer bagefter, vises igen. »Som planlagt« logger dem så en gang til.
- **Hvorfor:** D54 (2) siger »det første sæt, der ikke er logget«, og SPEC 4.2 lover, at passet fortsætter samme sted.
- **Rettelse:**
  1. `'measure'` tæller som udført, når der findes en `measurement_logged` med samme `measureId` og dato efter `session_started`.
  2. Spring sæt i `ended`-blokke over, som `advance` gør.
  3. Et skiftevist sæt med kun venstre side logger kun højre side.
  4. Vitest for alle tre.

### L2 (lav): Tidsmaskinen skriver `comeback.run` over et rigtigt pas, der holder pause

- **Hvor:** `src/ui/session/Runner.tsx:290–295`, `:359` og `:372` skriver `RUN_KEY` (`src/ui/session/resume.ts:64`) også i simuleringen.
- **Forløbet:**
  1. Et rigtigt pas sættes på »Hold pause«.
  2. Brugeren går til Mere → Om → tidsmaskinen og kører et pas dér (D53 gør det muligt).
  3. Nu indeholder `comeback.run` simuleringens pas, eller `null` efter »Færdig«.
  4. Tilbage i den rigtige verden findes passet kun i loggen (L1), og pausens ur er væk. Holdt passet pause i opvarmningen (før `session_started`), starter det forfra med væg-testen, og den kan logges to gange.
- **Hvorfor:** CLAUDE.md siger, at tidsmaskinen aldrig skriver til lageret. Se også SPEC 3.7 og D53.
- **Rettelse:** Brug en egen nøgle i simuleringen (`comeback.run.sim`), eller hold simuleringens genoptagelse i hukommelsen. Lav en Playwright-test: et rigtigt pas sættes på pause, et pas køres i tidsmaskinen, simuleringen afsluttes, og »Fortsæt passet« står på samme trin.

### L3 (lav): Målingens »Nu« nævner trinnets øvelse

- **Hvor:** `src/ui/session/Runner.tsx:802` (`firstSetOf`). Skærmen viser »Nu · Måling · første sæt i Pres · Push-up med tempo« og »… i Træk · Rygsæk-row med én arm«.
- **Hvorfor:** SPEC 3.8 og D45 siger, at en max-test er en almindelig push-up uanset trinnet. Efter D54 (3) hedder målingen »Første sæt i Pres · max« i »Næste« og på introkortet. Teksten over navnet kan læses, som om max-testen skal tages med tempo, og så bliver nulpunktet for lavt.
- **Rettelse:** Skriv »Måling · første sæt i Pres · max« som på introkortet.

### L4 (lav): »Synligt uden at rulle« tælles, men måles ikke

- **Hvor:** `e2e/session.spec.ts:310` tæller cues med `toHaveCount(2)`, og `:324` og `:345` bruger `toBeVisible()`, der ikke ser, om bundblokken dækker. På skærmen:
  - Pausen før »Læg · Etbens tåløft på et trappetrin« (tirsdag) og »Rygsæk-row« (fredag): navnet står på tre linjer ved siden af »Sådan gør du« og skubber »Gør klar« ind under »Spring pausen over«, så sætningen om rygsækken ikke kan ses.
  - I tidsmaskinen ligger andet cue under bundblokken (pakkens egen `screenshots/pas-nu-og-naeste.png`). Tjeklisten til telefonen bruger tidsmaskinen.
- **Hvorfor:** SPEC 3.2 kræver 2 cues i »Nu« og »Gør klar« i pausen, og D51 lover: »Pausen viser »Næste« stort uden at rulle på 414 × 847«.
- **Rettelse:**
  1. Lad »Sådan gør du« stå under navnet i pausen, eller gør figuren mindre, når navnet fylder mere end to linjer.
  2. Lav en Playwright-hjælper, der tjekker, at cues, mål og »Gør klar« ender over `.fixed-actions` på hver sæt- og pauseskærm, også med tidsmaskinens banner.

### L5 (lav, fandtes før pakken): »Afslut« uden bekræftelse i opvarmningen, væg-testen og spørgsmål 3

- **Hvor:** `src/ui/session/Runner.tsx:546`, `:592` og `:641` (`onClose={close}`).
- **Hvorfor:** SPEC 3 siger: »Et aktivt pas ... kan kun forlades via »Afslut pas« (bekræftes) eller »Hold pause««. »Hold pause« står nu 8 px fra »Afslut« i samme header. Rammer brugeren forkert i de 8 minutter, forsvinder passet uden spørgsmål, og opvarmningen starter forfra. Om tirsdagen kommer væg-testen igen og kan logges to gange (S-MEAS-05: samme dags plan ændres ikke).
- **Rettelse:** Brug samme bekræftelse som i passet (`setConfirmEnd`).

### L6 (lav, fandtes før pakken): EMOM uden lyd 10 sekunder før minutskiftet

- **Hvor:** `src/ui/session/outline.ts:259` (`emomClock`) og `src/ui/session/timers.tsx:18`, som kun spiller 3-2-1 og minuttonen.
- **Hvorfor:** SPEC 3.2 kræver for EMOM »lyd ved hvert nyt minut og ved 10 sekunder tilbage«.
- **Rettelse:** Spil en tone 10 sek før hvert EMOM-minut slutter, fx med et felt på fasen, og test det med `page.clock`.

## Det, der holder

- **`npm run check`** (worktree, exit 0): 565 Vitest-tests, typecheck, lint og build.
  - JavaScript fylder 88,5 kB gz (2894827: 76,3 kB).
  - Startfilerne er index 25,9 kB (før 25,6 kB) og engine 26,5 kB (uændret). Resten hentes med `lazy()`.
  - `perf.spec.ts` er grøn.
- **Hele Playwright-suiten** (Firefox uden JIT, `E2E_PORT=4181`): 64 af 64 grønne i `pixel9a` og `pixel9a-utc`, ingen flaky.
- **Egen gennemgang tirsdag 10/11 uden tidsmaskine**, fra I dag til opsummering:
  - Hændelser: 27 `set_logged`, 3 `measurement_logged` (væg-test, push-ups og bord-rows, alle `programWeek` 1), 3 `block_result` og `session_completed`. Ingen sidefejl.
  - R19 holder: EMOM E1 4 × 3, ingen burpee-test.
  - »Nu«, »Næste«, »Del N af 8«, pausen, introkortene og nakken virkede.
  - På alle 50 skærme i passet: tekst ≥ 18 px, kontrast ≥ 7:1 og trykflader ≥ 56 px.
  - På alle sætskærme stod mål, sæt, reserve og begge cues over bundblokken.
  - Fredag 13/11 fungerede på samme måde: 22 sæt og 5 målinger, hvoraf sideplanke og balance blev taget pr. side.
- **P54:**
  - Ét tryk skriver to `set_logged` med samme tal (venstre og højre).
  - Motoren giver +1 rep som før (`steps.test.ts`).
  - Hændelser, skema, motor og programdata er uændrede. Forklaringerne til `power_legs.3` og `.4` siger nu ét tryk.
- **»Hold pause«:**
  - Passet bliver monteret skjult, og ure og trin står stille.
  - Wake Lock slippes (`awake` er falsk, mens passet holder pause), og opdateringsbanneret er skjult, mens der findes et pas.
  - »Fortsæt passet« vender tilbage med samme tid (e2e).
- **Gemt pas fra 2894827:**
  - `RunState` er uændret bortset fra den valgfri `stepKey` og den nye fase `'overview'`.
  - `buildSteps` er identisk bortset fra skiftevise sæt, og `resumeIndex` beholder indekset uden dem. Det er prøvet i e2e.
- **SK3:** hold, nakke, EMOM efter »Start EMOM«, klubsekvensen og Open & Strong kører uden berøring.
- **N3** følger reviewets opskrift.
- **Dansk tekst:** ensartet, og ingen kilder (`no-source-refs` er grøn).

## Mine skærmbilleder (scratchpad, ikke i repoet)

- Tirsdag: `C:\Users\marou\AppData\Local\Temp\claude\dcafe82b35807500\a9e3666a-ba5d-4baf-be20-562dde837f26\scratchpad\review-shots\tirsdag\` (52 skærme). Nakkens introkort og »Klar« er `45-intro-nakke-hage-ind-liggende.png` og `46-nakke-klar.png`, pausen med skjult »Gør klar« er `40-pause-foer-laeg-etbens-taaloeft-paa-et-trappetrin.png`.
- Fredag: `C:\Users\marou\AppData\Local\Temp\claude\dcafe82b35807500\a9e3666a-ba5d-4baf-be20-562dde837f26\scratchpad\review-shots\fredag\`, med »Dagens pas« i fuld længde i `dagens-pas-fredag-hele.png`.
- Dobbelttryk: `C:\Users\marou\AppData\Local\Temp\claude\dcafe82b35807500\a9e3666a-ba5d-4baf-be20-562dde837f26\scratchpad\review-shots\taps-nakke-efter-dobbelttryk.png`, `taps-opvarmning-efter-dobbelttryk.png` og `taps-pause-efter-dobbelttryk.png` i samme mappe.

## Til telefonen

- **Tastaturet ved målingens felt** (væg-test, push-ups, bord-rows): kan tallet ses, mens det skrives? Playwright kan ikke vise IronFox' tastatur. I et vindue, der var gjort lavere som efterligning, lå feltet under bundblokken.
- **Lyd og skærm:** lyden kan høres fra gulvet, og skærmen forbliver tændt hele passet, men må slukke efter »Hold pause«.
