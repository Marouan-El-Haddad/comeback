# ENGINE.md – Træningsmotoren

Version 1.1 · 5. november 2026 (rettet efter gennemgang mod PDF'en, se `DECISIONS.md` afsnit 6). Kilde for alle regler: `PROGRAM_KILDE.md` (sidetal henviser til PDF'en). Markeringer: **Præcisering** = PDF'en er tvetydig for software, og den forsigtigste rimelige regel er valgt. **Afvigelse** = bevidst ændring af programmet. **Tilføjelse** = funktion, programmet ikke nævner. Alle tre er logget i `DECISIONS.md`.

## 1. Principper

1. **Programmet er data.** `program/*.json` beskriver spor, trin, pas, uger, målinger og overlejringer med stabile ID'er. Koden kender ingen øvelser ved navn.
2. **Brugerdata er en tilføj-kun hændelseslog.** Tilstanden afledes ved at afspille loggen (`deriveState(program, events, today)`). Intet slettes; rettelser er nye hændelser.
3. **Motorens beslutninger er hændelser.** Når motoren rykker et trin op eller ned, skriver den en `step_changed` med `explanation`. Forklaringen er på dansk i appens egne ord og henviser ikke til PDF'en, sidetal eller kilder (`DECISIONS.md` A2). En senere regelrettelse ændrer aldrig historikken.
4. **Deterministisk og uden ur.** Ingen funktion i `src/engine` kalder `Date.now()`; `today` og `now` er parametre. Det gør tidsmaskinen og alle tests mulige.
5. **Forsigtigt som standard.** Når to tolkninger er mulige, vælges den, der rykker langsommere op og hurtigere ned.
6. **Ingen skyld.** Ingen streaks; gule pas tæller som gennemførte; sprungne pas registreres uden tællere, der »knækker«.

## 2. Domænemodel

| Begreb | ID-format | Beskrivelse |
|---|---|---|
| Spor (`Track`) | `press`, `shoulder`, `pull`, `legs`, `wallsit`, `posterior`, `core_front`, `core_side`, `core_rot`, `core_situp`, `groin`, `power_legs`, `power_upper`, `burpee_emom`, `burpee_skill`, `club_sequence`, `neck`, `calf`, `sl_rdl`, `backpack_row` | Et spor har én stige (hovedlinje) eller én fast øvelse |
| Trin (`Step`) | `press.1` … `press.7`, `wallsit.W1` … `W5`, `core_side.S1` … `S5`, `core_rot.R1` … `R4`, `neck.N1` … `N6`, `burpee_emom.E1` … `E9`, `burpee_skill.V1` … `V5`, `club_sequence.C1` … `C6` | Nøglen er PDF'ens nummerering, så brugeren og Opus kan slå op |
| Niveau (`Level`) | `basis`, `staerk`, `imponerende`, `boss` | På trin som i PDF'en; trin uden niveau er mellemtrin |
| Dosis (`Dose`) | `reps`, `hold`, `power`, `fixed`, `rounds`, `emom`, `always` | Se typerne i afsnit 7 |
| Pas-skabelon (`SessionTemplate`) | `A`, `B`, `motor`, `os`, `travel` | Blokke i rækkefølge med par/tri-sæt, pauser, hvad der udgår på gul dag og i let uge |
| Rutine (`Routine`) | `warmup`, `os`; punkterne `warmup.1` … `warmup.4`, `os.1` … `os.6` | Opvarmningen og Open & Strong; et punkts ID er rutinens ID og punktets nummer. Forklaringer og figurer bruger samme ID'er (`SPEC.md` 9.1) |
| Blok (`Block`) | `A.power`, `A.pair1.press` … | Henviser til et spor; sæt-antal kommer fra ugen |
| Uge (`Week`) | 1–12 | Fase, let uge, sæt, reserve, power-sæt, motor, EMOM-loft, målinger |
| Fase | `fundament`, `opbygning`, `kampform`, `let` | Afledt af ugen |
| Måling (`Measure`) | `wall_test`, `pushups`, `table_rows`, `burpee_3min`, `base_check`, `cooper`, `pike`, `hollow`, `side_plank`, `wall_sit`, `balance`, `nordic_depth` | Dag, placering i passet, enhed, Målbrættets niveauer |
| Overlejring (`Overlay`) | `xmas_2026_motor`, `xmas_2026_B`, `newyear_2026_measure` | Datobundne forslag til flytning |
| Status | `ill`, `travel`, `holiday`, `club_closed` | Datointerval sat af brugeren |
| Begivenhed | fri tekst + dato | Fx kamp; dagen før spærres (R-EVENT) |
| Sidegren | `knuckles`, `diamond`, `deficit`, `pseudo_planche` | Højst én aktiv |
| Programuge (`pw`) | 1–12 | Hvor i programmet brugeren er; afledt af gennemførte kalenderuger (R-PW) |
| Kalenderuge (`k`) | 0, 1, 2 … | Mandage fra startdatoen |
| Runde | 1, 2 … | Efter uge 12 starter runde 2 fra programuge 5 (R-ROUND2) |

## 3. Brugerens tilstand og historik

### 3.1 Hændelser

Alle hændelser har `id` (ulid), `at` (ISO-tidsstempel), `date` (`YYYY-MM-DD`, Europe/Copenhagen) og `v: 1`.

| Type | Felter | Skrives når |
|---|---|---|
| `onboarding_completed` | `startDate`, `completedWeeks: ISODate[]` (mandage) | Første start (Tilføjelse T2) |
| `step_set` | `trackId`, `stepId`, `target?`, `reason: 'onboarding' \| 'user_choice'`, `explanation` | Onboarding; brugeren vælger selv et trin |
| `session_started` | `sessionId`, `kind`, `light: 'green' \| 'yellow' \| 'red'`, `answers: [q1, q2, q3]`, `programWeek`, `round` | Trafiklyset er besvaret |
| `set_logged` | `sessionId`, `blockId`, `trackId`, `stepId`, `setIndex`, `side?`, `reps?`, `seconds?`, `rir: 0 \| 1 \| 2 \| 3`, `pain?: 'light' \| 'sharp' \| 'stop'`, `asPlanned: boolean` | Hvert sæt. `rir 1` betyder »1 eller mindre«, `3` betyder »3+«, `0` kun ved målinger og boss |
| `block_result` | `sessionId`, `trackId`, `stepId`, `result` (se 5.4) | EMOM, power, klubsekvens, nakke, W3 |
| `session_completed` | `sessionId`, `status: 'green' \| 'yellow' \| 'red' \| 'travel'`, `aborted: boolean`, `done: boolean` | Passet afsluttes. Et afbrudt pas beholder trafiklysets status; blokke, der blev logget færdige før afbrydelsen, vurderes normalt (S-DP-11) |
| `session_skipped` | `kind`, `reason: 'user' \| 'missed'` | Brugeren springer over, eller dagen er gået |
| `session_moved` | `kind`, `fromDate`, `toDate`, `short: boolean` | Flytning |
| `step_changed` | `trackId`, `from`, `to`, `by: 'engine' \| 'user'`, `reason`, `explanation`, `until?` | Motor eller bruger |
| `measurement_logged` | `measureId`, `value`, `programWeek`, `round` | Målinger |
| `club_logged` | `attended`, `content?[]`, `hardness?`, `freshness?`, `technique?` | Efter klubtræning (Tilføjelse T1) |
| `sunday_check` | `weekStart`, `sleepAvg?`, `painTracks?[]`, `tooHeavy?[]` | Søndagstjek |
| `status_set` | `status`, `from`, `to` | Syg, rejse, ferie, klubben lukket |
| `calendar_event_added` | `label`, `eventDate` | Kamp o.l. |
| `schedule_changed` | `clubDays: number[]` (1 = mandag), `clinch: boolean` | Ugeplan |
| `overlay_choice` | `overlayId`, `choice` | Jul/nytår |
| `os_done` | – | Open & Strong gennemført |
| `turbo_chosen` / `turbo_logged` | `exerciseId` / `sets` | Turbo |
| `side_branch_set` | `branchId \| null` | Sidegren |
| `variant_set` | `stepId` (`burpee_skill.V*`) | Burpee-variant valgt |
| `hero_checked` | `heroId`, `checked` | Hero-tavlen |
| `boss_logged` | `bossId`, `result`, `level` | Boss-udfordring |
| `backup_exported` | – | Eksport |

### 3.2 Afledt tilstand (`State`)

```ts
interface TrackState {
  stepId: string;            // nuværende trin
  target: number;            // arbejdstal: reps eller sekunder pr. sæt
  hits: number;              // på hinanden følgende kvalificerende pas med »hit«
  load: number;              // kg i rygsæk for load-spor
  tempDown?: { originalStepId: string; until: ISODate; sharpSince: ISODate };
  last?: { date: ISODate; sets: Array<{ reps?: number; seconds?: number; rir: number; side?: 'L' | 'R' }> };
}
interface State {
  startDate: ISODate; round: number;
  tracks: Record<TrackId, TrackState>;
  emom: { stepId: string; pendingUp: boolean; lastStepUpWeek?: { round: number; pw: number }; stepAtRoundStart: string };
  burpeeVariant: string; sideBranch: string | null;
  schedule: { clubDays: number[]; clinch: boolean };
  layout: Record<SessionKind, number>;        // ugedag pr. sekundært pas (R-EXTRA-MT)
  statuses: StatusRange[]; events: CalendarEvent[];
  weeks: Array<{ k: number; monday: ISODate; pw: number; round: number; completed: boolean | null; flat: boolean; volumeFactor: 1 | 0.67 }>;
  sessions: SessionSummary[]; club: ClubLog[]; measurements: MeasurementLog[];
  heroes: Record<string, boolean>; turbo: { exerciseId: string | null; log: Record<ISODate, number> };
  osByWeek: Record<ISODate, number>; lastBackup?: ISODate; completedOsWeeks: number;
}
```

Tilstanden afledes fra bunden ved hver start og efter hver hændelse (loggen er lille). UI'et læser kun `State`.

## 4. Centrale definitioner

| Begreb | Definition |
|---|---|
| **I dag** | `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen' }).format(now)`. Et pas hører til den dato, det blev startet (R-DATE) |
| **Kvalificerende pas** (for et spor) | `session_completed.status = 'green'`, programugen er ikke let, og alle planlagte sæt i sporets blok er logget uden `pain: 'sharp' \| 'stop'` |
| **Neutralt pas** | Gult, rødt, rejse, afbrudt før blokken, let uge, måling: ændrer hverken `hits` eller `target` |
| **Hit** (dobbelt progression) | Kvalificerende pas, hvor alle sæt (begge sider) har reps/sek ≥ trinnets max og `rir ≥ 2` |
| **Miss** | Kvalificerende pas uden hit → `hits = 0` (»to pas i træk« kræver på hinanden følgende hits) |
| **Gennemført uge** | Mindst ét pas af typen A, B eller rejse med `status ∈ {green, yellow, travel}` og `done = true` i kalenderugen. `done` = alle sæt i par 1 logget |
| **Programuge** | R-PW i 5.7. Kendes først for ugen, når den forrige er slut |
| **Dagen før en begivenhed** | Datoen umiddelbart før en `calendar_event` (Afvigelse A1: erstatter »dagen før sparring«) |

## 5. Algoritmer

### 5.1 Dagens plan for en dato (`planFor(state, program, date)`)

1. `k = kalenderuge(date)`; hvis `k < 0`: »Programmet starter mandag 9. november«.
2. `pw, round = programWeekFor(k)` (5.7). `week = program.weeks[pw]`.
3. Status på datoen: `ill` → rød dag (kun Open & Strong og gåtur, intet trafiklys). `holiday` → hvile + Open & Strong valgfri. `travel` → rejsepas på dage, der ellers har A eller B. `club_closed` → Muay Thai-dage viser »4–5 kamp-runder hjemme«.
4. Ugedagens pas: `layout[kind] = weekday`, eller en `session_moved` til datoen. Klubdage fra `schedule`.
5. Begivenhed i morgen → spærret indhold (R-EVENT; »aldrig tunge ben, Nordic eller intervaller«, s. 47): A uden power-ben, uden ben-stigen (`legs`) og uden Nordic-trin (`posterior.4–6`); motor som rolig base; B uden etbens-RDL med rygsæk. Appen viser »I morgen: {label} – let udgave«.
6. Overlejringer, der rammer datoen, tilføjes som forslag (5.8).
7. Skabelonen opløses: for hver blok hentes `tracks[trackId].stepId` og `target`, sæt fra `week` (tabel 6.3), pause fra blokken, reserve-plan fra `week.rirPlan`. EMOM-blokken får `min(emom.stepId, week.emomCap)`; i let uge erstattes den af `burpee_3min`. Målinger indsættes efter 5.6. Boss-valg vises, hvis R-BOSS tillader.
8. `volumeFactor` fra R-FLAT anvendes på sæt (rund ned, mindst 2).
9. Resultat: `DayPlan { date, pw, round, phase, light, kind, blocks[], flags[] }`.

### 5.2 Trafiklys (`applyTrafficLight(plan, answers)`)

- Svar: q1 søvn ≥ 6 t, q2 fri for ledsmerter, q3 opvarmning normal. q3 besvares efter opvarmningens trin 4.
- Udledte standardsvar: q2 = nej, hvis der er `pain: 'sharp' \| 'stop'` inden for 2 dage, eller ugens `sunday_check.painTracks` ikke er tom. Hint, hvis gårsdagens `club_logged.hardness = 'hard'`.
- Grøn (3 × ja): planen uændret. Gul (1–2 nej): kun blokke med `inYellow`, 2 sæt, reserve 3, ingen power, ingen finisher, ingen nakke. Rød (knap): kun Open & Strong; `session_completed.status = 'red'`, `done = false`.
- Motor: gul → `base 30 min`; rød som ovenfor. Var gårsdagens `club_logged.hardness = 'hard'`, og har dagen intervaller (30/15, kamp-runder, sprints), er rolig base standard med valget »Kør intervallerne alligevel« (s. 31: »var onsdagen brutal, så tag den rolige base«; P25).
- Boss-udfordring og intervaller kun ved grøn.

### 5.3 Logning og opdatering af et pas

1. `session_started` skrives, når trafiklyset er besvaret. Passet gemmes løbende; lukkes appen, genoptages samme `sessionId` samme dag.
2. »Som planlagt« skriver `set_logged` med `reps/seconds = target`, `rir = plan`, `asPlanned = true`. I uger med »1–2 i reserve« (`rirPlan = 1`) er planen 2, når `target` er trinnets max, så et hit er muligt; under max er den 1 (P10). Afvigelser skrives med de rettede tal. Hold-timere skriver selv, når tiden er gået.
3. `pain: 'sharp' \| 'stop'` afslutter blokken for det spor; resten af passet fortsætter.
4. Ved »Færdig« skrives `session_completed`, derefter kører progressionen (5.4) og regressionen (5.5) for hvert spor i passet og skriver eventuelle `step_changed`. Opsummeringen viser forklaringerne.
5. Et pas, der ikke er startet ved dagens udgang, får `session_skipped(reason: 'missed')`, når næste dag beregnes; næste dag tilbyder »Flyt« (kun gyldige dage efter 5.9; skriver `session_moved`) eller »Spring over«.

### 5.4 Progression

**R-DP-TARGET (reps, hold, fixed-load):** efter et kvalificerende pas: hvis alle sæt ≥ `target` og alle `rir ≥ week.rirPlan` → `target = min(max, target + 1)` (hold: `+ 5` sek). Ellers `target` uændret. Præcisering: PDF'en siger »læg reps til fra gang til gang« og »+5 sek pr. pas« uden at sige, hvad der sker ved et dårligt pas; valget er at gentage.

**R-DP-STEPUP:** hit → `hits += 1`, miss → `hits = 0`. Ved `hits = 2` skrives `step_changed(to = næste trin, reason: 'progression')`, `target = min` på det nye trin, `hits = 0`. Trin uden næste (boss) forbliver. Forklaring: »Trin {n} næste gang: du ramte {sæt} × {max} med 2 i reserve to pas i træk.«

**R-HOLD:** som R-DP med sekunder. Præcisering: PDF'en nævner kun +5 sek; trinskift følger samme to-pas-regel.

**R-POWER:** `block_result.result = { quality: boolean }` (»alle reps lige høje og hurtige«). Kvalificerende pas med `quality` og alle sæt ≥ `target` → `target + 1` (inden for trinnets interval). Hit = `quality` og alle sæt ≥ max → to i træk → næste trin. `quality = false` → `hits = 0`. Præcisering: reps inden for intervallet styres af `quality`, ikke af reserve.

**R-EMOM:** `block_result.result = { clean: boolean, rest20: boolean }`. Kvalificerende A-pas med begge sande → `emom.pendingUp = true`. Ved næste EMOM-pas: hvis `pendingUp` og `lastStepUpWeek ≠ (round, pw)` → trin = `min(current + 1, week.emomCap)`, `lastStepUpWeek = (round, pw)`, `pendingUp = false`. Ellers samme trin. Uge 1: loft E1. Let uge: burpee-test, loftet er `'test'`, `pendingUp` bevares. Præcisering: oprykningen sker i næste uges pas, ikke i samme.

**R-CLUB (klubsekvensen):** trin C1 `2 × 1`, C2 `2 × 2`, C3 `1 × 3`, C4 `5 i træk`, C5 `5 på knoer`, C6 `5 som diamond`. `block_result.result = { clean: boolean }`. To rene B-pas i træk (ikke let uge) → næste trin. Præcisering.

**R-NECK:** `block_result.result = { feel: 'easy' \| 'ok' \| 'hard' }`. To `easy` i træk i grønne pas → næste trin. `stop` (snurren/svimmelhed) → blokken stopper, advarsel »Søg læge, hvis det ikke går over«; to `stop` → advarslen gentages på I dag.

**R-LOAD (`calf`, `backpack_row`, `sl_rdl`):** R-DP-TARGET inden for intervallet; hit to gange i træk → `load += 2` kg (brugeren kan rette), `target = min`, intet trinskift (sporene har kun ét trin). Præcisering af »senere med rygsæk« og »læg mere i tasken, når du rammer 15«. `legs.3` (Bulgarsk med rygsæk) er ikke et load-spor: trinnet følger R-DP-STEPUP til `legs.4` som resten af stigen, og rygsækkens vægt er et felt, brugeren selv sætter.

**R-W3 (`wallsit.W3`):** runder = ugens sæt-tal (2 eller 3); `block_result.result = { clean }`; to rene pas med 3 runder → W4. `W5` har intet næste trin.

**R-VARIANT (`burpee_skill`):** manuel: »Næste variant« tillades, når `emom.stepId ≥ E6`; varianten øves i EMOM'ens 2 sidste minutter eller i kamp-runder (visning, ingen tællere).

**R-ONE:** motoren ændrer én ting pr. pas pr. spor: enten `target` eller trin, aldrig begge (trinskift sætter `target = min`).

**R-USER-STEP:** brugeren kan vælge et andet trin (`step_changed by: 'user'`); `hits = 0`, `target = min`. Opad vises advarslen »Det sværeste trin med dårlig form lærer dig dårlig form« én gang pr. spor.

### 5.5 Regression

**R-PAIN-LIGHT:** `pain: 'light'` logges og vises i historik og søndagstjek; ingen ændring.

**R-PAIN-SHARP:** `pain: 'sharp' \| 'stop'` → `step_changed(to = forrige trin, reason: 'pain', until = date + 7)`; på trin 1 forbliver trinnet med flaget »lettere variant« (fx hænderne på sofaen). `hits = 0`, `target = min`. Pres med håndledssmerte får cuen »tag dem på knoer«.

**R-PAIN-RESTORE (Tilføjelse T3):** første kvalificerende pas på eller efter `until` uden ny skarp smerte → `step_changed(to = originalStepId, reason: 'restore')`, `target = min`. Ny skarp smerte i perioden → `until` forlænges 7 dage og I dag viser Fysio-rådet »Bliver den værre fra gang til gang, så få den undersøgt«.

**R-PAIN-SUNDAY:** `sunday_check.painTracks` ikke tom → R-PAIN-SHARP for de spor (Præcisering af side 46 + 48). `tooHeavy` → tilbud om ét trin ned (`by: 'user'`).

**R-ABSENCE-3:** tre på hinanden følgende kalenderuger uden gennemført uge → alle stiger ét trin ned (ikke under trin 1), EMOM ét trin ned, klubsekvens ét trin ned, `hits = 0`, `target = min`, én gang pr. fraværsperiode. Forklaring: »Tre uger uden styrkepas: alle stiger ét trin ned.« (uden sidetal, A2).

### 5.6 Lette uger og målinger

- Let uge = programuge 4, 8, 12: `strengthSets = 2`, `rirPlan = 3`, `powerSets = 2`, klubsekvens 1 runde, alle pas neutrale for progression.
- Målinger i programuge 1 (kun runde 1), 4, 8 og 12. Placering (data i `measures.json`): tirsdag `wall_test` før opvarmning, `pushups` = første sæt i pres-blokken (uanset trin, som almindelig push-up), `table_rows` = første sæt i træk-blokken, `burpee_3min` erstatter EMOM, `nordic_depth` spørges efter bagkæde-blokken (kun ved `posterior.4+`); torsdag `base_check` (uge 1) eller `cooper` (valgfri, ellers base-check); fredag `pike` = første sæt i skulder-blokken, `hollow` som selvstændig blok før Mave 2, `side_plank` = første sæt i Mave 2 side, `wall_sit` = første sæt i wall sit-blokken, `balance` efter nakke.
- Et målesæt logges med `rir = 0` og tæller ikke som sæt i progressionen.
- Efter ugens sidste pas i uge 4/8/12 viser appen »Ryk op«-oversigten: spor med `hits = 2` opnået før den lette uge er allerede rykket (R-DP-STEPUP sker løbende); oversigten viser kun status. Præcisering: »bagefter rykker du op« implementeres som løbende oprykning, fordi lette uger er neutrale og aldrig kan skabe et hit.
- Målbrættets niveau for en værdi: højeste tærskel nået (`wall_test` omvendt). `legs`-niveau afledes: Basis = `legs.1` med hit, Stærk = `legs.2` med hit, Imponerende = `legs.6` med ≥ 5 reps pr. ben logget.

### 5.7 Uger, programuge og fravær

**R-WEEK-DONE:** som defineret i afsnit 4. Rejsepas tæller (Tilføjelse T4) men er neutralt for progression.

**R-PW (programuge-markøren):**
```
pw[0] = 1, round[0] = 1
for k ≥ 1:
  if completed[k-1]:  pw[k] = next(pw[k-1])     // next(12) = 5 og round + 1 (R-ROUND2)
  else:               pw[k] = lastCompletedPw (pw for den seneste gennemførte kalenderuge; 1 hvis ingen)
```
Konsekvens: én sprunget uge koster to kalenderuger (den sidste gennemførte uge gentages, så den sprungne tages). Det er PDF'ens regel (side 47) og brugerens valg. Uger fra onboardingens `completedWeeks` behandles som gennemførte. Den igangværende uge kender kun sin egen `pw`; `completed` er `null`, til ugen er slut.

**R-ABSENCE-3:** se 5.5. Udløses, når den tredje uge i træk afsluttes uden at være gennemført, og gælder også ved `ill` og `holiday`.

**R-ILL:** `status: ill` → alle dage røde: kun Open & Strong og gåtur. »Kun forkølet over halsen« er brugerens vurdering; appen viser teksten. Ugerne under sygdom er ikke gennemførte.

**R-TRAVEL:** `status: travel` → på A- og B-dage vises rejsepasset (push-ups, rygsæk-row, split squats, 6 min EMOM på `min(E3, emom.stepId)`), neutral for progression, gennemfører ugen.

**R-HOLIDAY:** `status: holiday` → hvile; ugerne er ikke gennemførte (brugeren kan i stedet lade appen køre som normalt, hvis han vil træne).

### 5.8 Kalender-overlejringer (runde 1, datobundne)

| ID | Dato/uge | Forslag (standard) | Alternativ |
|---|---|---|---|
| `xmas_2026_motor` | Kalenderugen med 23/12 | Motor onsdag 23/12 som rolig base | Torsdag som normalt |
| `xmas_2026_B` | Samme uge | Styrke B lørdag 26/12 | Søndag 27/12 |
| `newyear_2026_measure` | Kalenderugen fra 28/12, kun hvis `pw` er let uge | Målinger 29–30/12 | 2–3/1 |
| `club_closed` (status) | Brugerens interval | Muay Thai-dage → 4–5 kamp-runder hjemme | – |

Overlejringer er forslag med »OK«/»Vælg anden« (`overlay_choice`). De gælder kalenderdatoen, uanset `pw`, fordi de handler om klubbens lukning og helligdage.

### 5.9 Flytning af pas (R-MOVE, R-REST)

`validMoveDays(kind, date)` returnerer dage i samme kalenderuge (til og med søndag), hvor alle gælder:
1. Dagen har ikke allerede A eller B. En motor-dag er gyldig for A og B: motoren udgår så den uge (»Motor-passet ryger først«, s. 47), og I dag viser »valgfri rolig tur« på en fri dag, hvis der er en. Motor kan kun flyttes til en fri dag.
2. Dagen er ikke en klubdag – undtagen som »kort version« (30 min, par 1 og 2) om morgenen, som tilbydes separat.
3. Dagen er ikke dagen før en begivenhed, hvis `kind ∈ {A, motor-intervaller}` eller passet indeholder Nordic-trin.
4. Efter flytningen er der stadig mindst én hel hviledag uden klub og uden sekundært pas (R-REST). En dag i ugen, der er gået uden pas og uden klub, tæller som hviledag.
5. A og B samme dag er ikke tilladt. A og B på to dage i træk tillades med advarslen »B skal efterlade dig frisk«.
Ingen gyldige dage → »Spring over« eller »Kort version«. To pas kan aldrig lande på samme dag; det, der flyttes, taber.

### 5.10 Ekstra Muay Thai-pas (R-EXTRA-MT)

`layoutFor(clubDays)`:
1. Hviledag = første frie dag i rækkefølgen [søn, lør, man, …] uden klub.
2. Kandidater til A, B, motor = frie dage minus hviledag i rækkefølgen [tir, tor, fre, man, ons, lør].
3. A = første kandidat; B = den næste med mindst én dag imellem, ellers den næste; motor = næste resterende, ellers udgår motor (I dag viser »valgfri rolig tur« på hviledagen før klub).
4. Færre end to kandidater: A og B bliver »kort version« om morgenen på klubdage med størst afstand; motor udgår.
5. Open & Strong altid. Begivenheder og R-REST gælder oven i.

### 5.11 Flad i klassen (R-FLAT)

En kalenderuge er flad, hvis en `club_logged` i ugen har `freshness = 'flat'`, eller lørdagens `technique ≤ 4`. To flade uger i træk → næste kalenderuge får `volumeFactor = 0.67` på styrkesæt og power-sæt (rund ned, mindst 2), og EMOM rykker ikke op den uge. Gælder ikke i let uge (skubbes til ugen efter). Herefter starter tællingen forfra. Præcisering af »flad« (side 39).

### 5.12 Turbo, boss, sidegrene, imponer-katalog, hero

- **R-TURBO:** fra `pw ≥ 5`; én øvelse; dagstæller 0–5; neutral for motoren; teksten »halvdelen af dit max, aldrig til udmattelse«.
- **R-BOSS:** tilbydes på A-dagen, når `round = 1 ∧ pw ≥ 11` eller `round ≥ 2`, højst én pr. 28 dage, kun grøn dag, ikke dagen før en begivenhed. Erstatter EMOM; `boss_logged` med niveau fra tabellen (side 45). EMOM-trinnet er uændret bagefter.
- **R-SIDE:** sidegrene med adgangskrav: `knuckles` altid; `diamond` ved måling `pushups ≥ 25`; `deficit` ved `press ≥ 2`; `pseudo_planche` ved `press ≥ 2` og `last` på trin 2 med 3 × 10. Højst én aktiv; vises som valgfri 5-minutters blok efter klubsekvensen.
- **R-IMPRESS:** adgangskrav som data (`impress.json`): fx `t_pushup: pushups ≥ 25`, `plank_punch: core_front.3 med 3 × 30 sek`, `wall_walks: shoulder ≥ 2`, `free_handstand: shoulder ≥ 5`, `archer_typewriter: press.4 med 3 × 8`, `superman: power_upper.4 med 4 × 5`, `pistol_knee: legs.6 ≥ 5 reps`, `split_jump_knee: power_legs ≥ 4`, `one_leg_wallsit_punch: wallsit ≥ W4`, `side_plank_teep: core_side ≥ S3`, `burpee_switch_kick: burpee_skill ≥ V3`, `sprawl_teep: burpee_skill ≥ V2`, `seal_burpee: burpee_3min ≥ 50`, `slow_kick/knuckle/situp_elbows: altid`. Ulåst = krav opfyldt i `State`. »Rammer du Stærk, må du bruge den sværere variant i klassen« vises som tekst ved niveau Stærk.
- **R-HERO:** tolv felter; `checked` er brugerens erklæring; motoren viser hint, når loggen opfylder kravet (fx `press.6` med 3 reps pr. side logget; `power_upper.4` med 5 reps; `shoulder.6` med 5; `pull.6` med 5; `legs.7` med 5; `posterior.5` med 5; `core_situp.6` med 5; `core_side.S4` med 45 sek; `groin.4` med 45 sek; `core_front.6` med 5; `burpee_emom.E9` ren; `club_sequence.C5` ren).

### 5.13 Efter uge 12 (R-ROUND2)

Når kalenderugen med `pw = 12` er gennemført: `round += 1`, `pw = 5`, `emom.stepAtRoundStart = emom.stepId`. I runde ≥ 2: `emomCap(pw) = max(tabellens loft, stepAtRoundStart)`; ingen uge-1-målinger; lette uger 8 og 12 med målinger; boss tilladt. I dag viser »Runde 2 · uge 5« og en sammenligning uge 1 → uge 12.

### 5.14 Tidsmaskinen (R-TIME)

`simulate(events, simulatedToday)` kører motoren på en kopi af loggen i hukommelsen; alle skrivninger går til kopien; lagerlaget er låst (`storage.readOnly = true`), og »Afslut« kasserer kopien. Testen `S-TIME-02` verificerer, at antallet af hændelser i lageret er uændret efter en simuleret uge med pas.

## 6. Beslutningstabeller

### 6.1 Trafiklys (side 7, 28, 31)

| q1 | q2 | q3 | Resultat | Pas |
|---|---|---|---|---|
| ja | ja | ja | grøn | planlagt |
| 1–2 × nej | | | gul | par 1 + par 2, 2 sæt, reserve 3; ingen power/finisher/nakke; motor → base 30 |
| rød-knap (syg, feber, skarp smerte eller under 4 timers søvn), eller `status: ill` | | | rød | Open & Strong + gåtur; `done = false` |

### 6.2 Progression pr. sporstype

| Sporstype | Hit | Target-regel | Trinskift | Nulstil |
|---|---|---|---|---|
| reps/hold | alle sæt ≥ max, rir ≥ 2 | +1 rep / +5 sek ved alle sæt ≥ target og rir ≥ ugens plan | 2 hits i træk | miss |
| power | quality ∧ alle sæt ≥ max | +1 rep ved quality | 2 hits i træk | quality = false |
| emom | clean ∧ rest20 | – | +1 trin ved næste EMOM-pas, ≤ ugens loft, højst 1 pr. programuge | – |
| rounds (klub, W3) | clean (3 runder for W3) | – | 2 hits i træk | miss |
| neck | feel = easy | – | 2 hits i træk | feel ≠ easy |
| load | alle sæt ≥ max, rir ≥ 2 | +1 rep | 2 hits → +2 kg, target = min | miss |
| manual (varianter, sidegrene) | – | – | brugeren, med adgangskrav | – |

### 6.3 Ugetabel (side 37–38) som data

| pw | Fase | Let | Sæt par 1–2 | Sæt øvrige | Reserve-plan | Power-sæt | Motor | EMOM-loft |
|---|---|---|---|---|---|---|---|---|
| 1 | fundament | nej | 2 | 2 | 3 | 2 | base 30 (base-check) | E1 fast |
| 2 | fundament | nej | 3 | 3 | 3 | 3 | base 35 | E2 |
| 3 | fundament | nej | 3 | 3 | 2 | 3 | base 40 + 4 stigningsløb | E3 |
| 4 | let | ja | 2 | 2 | 3 | 2 | cooper/base-check | test |
| 5 | opbygning | nej | 3 (+1 valgfrit) | 3 | 2 | 3 (+1 valgfrit) | 30/15: 2 × 10 | E4 |
| 6 | opbygning | nej | 4 | 3 | 1 | 4 | 30/15: 2 × 13 | E5 |
| 7 | opbygning | nej | 4 | 3 | 1 | 4 | 30/15: 3 × 10 | E6 |
| 8 | let | ja | 2 | 2 | 3 | 2 | cooper/base-check | test |
| 9 | kampform | nej | 3 | 3 | 2 | 4 (maks fart) | kamp-runder 5 × 3 | E7 |
| 10 | kampform | nej | 3 | 3 | 2 | 4 | 6 × 3 + 2 × 6 sprints | E8 |
| 11 | kampform | nej | 3 | 3 | 2 | 4 | 6 × 3 + 2 × 6 sprints | E9 / boss |
| 12 | let | ja | 2 | 2 | 3 | 2 | cooper | test |

Præcisering: »3–4 sæt« i uge 5 er 3 med en valgfri +1 på par 1–2; »4 sæt på par 1 og 2« i uge 6–7 giver 3 på øvrige blokke; »1–2 i reserve« giver `rirPlan = 1` (hit kræver stadig 2, og »Som planlagt« logger 2, når arbejdstallet er trinnets max; se 5.3). Blokke med interval (tri-sæt 2–3, Nordic 2–3, wall sit 2–3) får `min(interval.max, sæt øvrige)`.

### 6.4 Uger og fravær (side 47)

| Situation | Regel | Effekt |
|---|---|---|
| Uge uden A/B/rejse `done` | R-PW | Næste uge = sidste gennemførte programuge |
| 3 uger i træk uden | R-ABSENCE-3 | Alle stiger –1, EMOM –1, klub –1; én gang |
| `ill` | R-ILL | Røde dage |
| `travel` | R-TRAVEL | Rejsepas, uge gennemført, neutral |
| `holiday` | R-HOLIDAY | Hvile |
| `club_closed` | 5.8 | Kamp-runder i stedet for klub |
| Begivenhed i morgen | R-EVENT | Let udgave; boss/intervaller spærret |

### 6.5 Smerte (side 7, 46, 48)

| Input | Effekt |
|---|---|
| `light` | log + synlig i søndagstjek |
| `sharp` / `stop` | –1 trin i 7 dage, hits = 0 |
| Søndag: »gør ondt, ikke væk« | som `sharp` for sporet |
| Ny `sharp` i perioden | +7 dage, Fysio-råd |
| Nakke `stop` | blok stopper, lægeadvarsel |
| Efter perioden uden ny smerte | trin gendannes, target = min |

## 7. Dataskema

### 7.1 Programindhold (TypeScript)

```ts
export type ISODate = string;                 // 'YYYY-MM-DD', Europe/Copenhagen
export type Level = 'basis' | 'staerk' | 'imponerende' | 'boss';
export type SessionKind = 'A' | 'B' | 'motor' | 'os' | 'travel';
export type Dose =
  | { kind: 'reps';  sets: [number, number]; reps: [number, number]; perSide?: boolean; load?: 'backpack' }
  | { kind: 'hold';  sets: [number, number]; seconds: [number, number]; perSide?: boolean; perDirection?: boolean }
  | { kind: 'power'; sets: [number, number]; reps: [number, number]; perSide?: boolean }
  | { kind: 'fixed'; sets: number; reps: number; perSide?: boolean }
  | { kind: 'rounds'; rounds: [number, number]; description: string }
  | { kind: 'emom';  minutes: number; reps: number }
  | { kind: 'always'; description: string };
export interface Step {
  id: string; key: string; name: string; level?: Level; dose: Dose;
  execution: string; cues: string[]; picto?: string; pdfPage: number; note?: string;
}
export interface Track {
  id: string; name: string; pdfPage: number;
  progression: 'double' | 'hold' | 'power' | 'emom' | 'rounds' | 'neck' | 'load' | 'manual';
  steps: Step[];
}
export interface Block {
  id: string; trackId: string;
  role: 'warmup' | 'power' | 'pair' | 'triset' | 'finisher' | 'neck';
  group?: string;                      // 'pair1' | 'pair2' | 'triset' | 'pair3'
  setsRule: 'par12' | 'other' | 'power' | 'fixed';
  fixedSets?: [number, number]; restSec?: number; inYellow: boolean;
}
export interface SessionTemplate {
  id: SessionKind; name: string; defaultWeekday: number; durationMin: [number, number]; blocks: Block[];
}
export interface Week {
  pw: number; phase: 'fundament' | 'opbygning' | 'kampform' | 'let'; light: boolean;
  sets: { par12: number; other: number; optionalPlusOne?: boolean }; rirPlan: 1 | 2 | 3; powerSets: number;
  motor: { type: 'base' | 'base_check' | 'intervals_30_15' | 'fight_rounds' | 'cooper_or_base'; minutes?: number; series?: number; reps?: number; strides?: number; rounds?: number; sprints?: boolean };
  emomCap: string | 'test' | 'fixed:E1'; measurements: boolean; bossAllowed?: boolean; note?: string;
}
export interface Measure {
  id: string; name: string; unit: 'cm' | 'reps' | 'sec' | 'm' | 'depth'; weekday: 2 | 4 | 5;
  placement: { type: 'replace_first_set'; trackId: string } | { type: 'standalone'; after: string } | { type: 'before_warmup' };
  levels?: { basis: number; staerk: number; imponerende: number; lowerIsBetter?: boolean };
  weeks: 'all_light_and_1' | 'light_only'; optional?: boolean;
}
export interface Overlay { id: string; dates: ISODate[]; sessionKind: SessionKind; default: ISODate; alternative?: ISODate; onlyIfLight?: boolean; label: string }
export interface Program {
  programVersion: string; startDate: ISODate; tracks: Track[]; sessions: SessionTemplate[]; weeks: Week[];
  measures: Measure[]; overlays: Overlay[]; impress: Requirement[]; heroes: Requirement[]; sideBranches: Requirement[]; bosses: Boss[];
}
export type Requirement = { id: string; name: string; how: string; requires:
  | { type: 'always' } | { type: 'step'; trackId: string; minStep: string }
  | { type: 'measure'; measureId: string; min: number }
  | { type: 'performance'; trackId: string; stepId: string; sets: number; reps?: number; seconds?: number } };
export interface Boss { id: string; name: string; how: string; staerk: string; imponerende: string }
```

### 7.2 Eksempel: pres-stigen (`program/tracks/press.json`)

```json
{ "id": "press", "name": "Pres: push-ups", "pdfPage": 12, "progression": "double",
  "steps": [
    { "id": "press.1", "key": "1", "name": "Push-up med tempo", "level": "basis",
      "dose": { "kind": "reps", "sets": [3, 4], "reps": [6, 12] },
      "execution": "3 sek ned, 1 sek pause lige over gulvet. Kroppen som én planke, albuerne ca. 45° ud. Under 3 × 6: hænderne på sofaen.",
      "cues": ["3 sek ned, 1 sek stille", "Albuerne 45° ud"], "picto": "push_up", "pdfPage": 12 },
    { "id": "press.2", "key": "2", "name": "Fødderne på en stol",
      "dose": { "kind": "reps", "sets": [3, 4], "reps": [6, 12] },
      "execution": "Samme planke. Mere af vægten på armene.", "cues": ["Samme planke", "Hoften i niveau"], "picto": "push_up", "pdfPage": 12 },
    { "id": "press.3", "key": "3", "name": "Skæv push-up",
      "dose": { "kind": "reps", "sets": [3, 4], "reps": [5, 10], "perSide": true },
      "execution": "Den ene hånd på 3–4 bøger, den anden i gulvet. Den nederste arm arbejder mest.", "cues": ["Nederste arm arbejder"], "picto": "push_up", "pdfPage": 12 },
    { "id": "press.4", "key": "4", "name": "Archer push-up", "level": "staerk",
      "dose": { "kind": "reps", "sets": [3, 4], "reps": [4, 8], "perSide": true },
      "execution": "Hænderne i dobbelt skulderbredde. Sænk dig mod den ene hånd; den strakte arm hjælper mindst muligt.", "cues": ["Dobbelt skulderbredde", "Strakt arm hjælper mindst"], "picto": "one_arm_push_up", "pdfPage": 12 },
    { "id": "press.5", "key": "5", "name": "Etarms push-up på skrå",
      "dose": { "kind": "reps", "sets": [3, 4], "reps": [3, 8], "perSide": true },
      "execution": "Hånden på et bord, senere sofa, stol og trappetrin. Fødderne bredt, hoften i niveau.", "cues": ["Fødderne bredt", "Hoften i niveau"], "picto": "one_arm_push_up", "pdfPage": 12 },
    { "id": "press.6", "key": "6", "name": "Etarms push-up", "level": "imponerende",
      "dose": { "kind": "reps", "sets": [3, 4], "reps": [3, 6], "perSide": true },
      "execution": "I gulvet med brede fødder. Den frie hånd på lænden.", "cues": ["Frie hånd på lænden"], "picto": "one_arm_push_up", "pdfPage": 12 },
    { "id": "press.7", "key": "7", "name": "Etarms, samlede fødder", "level": "boss",
      "dose": { "kind": "reps", "sets": [3, 4], "reps": [3, 5], "perSide": true },
      "execution": "Fødderne i hoftebredde. Ingen vridning.", "cues": ["Ingen vridning"], "picto": "one_arm_push_up", "pdfPage": 12 }
  ] }
```

### 7.3 Eksempel: Styrke A (`program/sessions/A.json`)

```json
{ "id": "A", "name": "Styrke A", "defaultWeekday": 2, "durationMin": [50, 55],
  "blocks": [
    { "id": "A.warmup", "trackId": "warmup", "role": "warmup", "setsRule": "fixed", "inYellow": true },
    { "id": "A.power", "trackId": "power_legs", "role": "power", "setsRule": "power", "restSec": 75, "inYellow": false },
    { "id": "A.pair1.press", "trackId": "press", "role": "pair", "group": "pair1", "setsRule": "par12", "restSec": 60, "inYellow": true },
    { "id": "A.pair1.pull", "trackId": "pull", "role": "pair", "group": "pair1", "setsRule": "par12", "restSec": 60, "inYellow": true },
    { "id": "A.pair2.legs", "trackId": "legs", "role": "pair", "group": "pair2", "setsRule": "par12", "restSec": 60, "inYellow": true },
    { "id": "A.pair2.posterior", "trackId": "posterior", "role": "pair", "group": "pair2", "setsRule": "other", "fixedSets": [2, 3], "restSec": 60, "inYellow": true },
    { "id": "A.triset.groin", "trackId": "groin", "role": "triset", "group": "triset", "setsRule": "other", "fixedSets": [2, 3], "restSec": 30, "inYellow": false },
    { "id": "A.triset.core_front", "trackId": "core_front", "role": "triset", "group": "triset", "setsRule": "other", "fixedSets": [2, 3], "restSec": 30, "inYellow": false },
    { "id": "A.triset.calf", "trackId": "calf", "role": "triset", "group": "triset", "setsRule": "fixed", "fixedSets": [2, 2], "restSec": 30, "inYellow": false },
    { "id": "A.finisher", "trackId": "burpee_emom", "role": "finisher", "setsRule": "fixed", "inYellow": false },
    { "id": "A.neck", "trackId": "neck", "role": "neck", "setsRule": "fixed", "inYellow": false }
  ] }
```

Opus konverterer resten fra `PROGRAM_KILDE.md`. Testen `program.spec.ts` tjekker trin-antal pr. spor mod kilden: press 7, shoulder 7, pull 7, legs 7, wallsit 5, posterior 6, core_front 7, core_side 5, core_rot 4, core_situp 7, groin 5, power_legs 6, power_upper 5, burpee_emom 9, burpee_skill 5, club_sequence 6, neck 6, calf 1, sl_rdl 1, backpack_row 1; uger 12; målinger 12; sidegrene 4; imponer-varianter 17; hero 12; boss 6.

### 7.4 Brugerdata

Hændelserne i 3.1 som `Event`-union; lager `{ schemaVersion: 1, events: Event[] }`. Eksportfil: `{ app: 'comeback', schemaVersion, programVersion, exportedAt, events }`. Migrationer: `migrations/v{n}_to_v{n+1}.ts`, rene funktioner med tests.

## 8. Testscenarier (givet / når / så)

Alle scenarier er automatiske tests i `src/engine/__tests__`. Datoer er Europe/Copenhagen.

**Dobbelt progression**
- **S-DP-01** Givet `press.1`, target 6, pw 2 (3 sæt, reserve 3). Når 3 sæt logges 6/rir 3. Så target = 7, hits = 0.
- **S-DP-02** Givet target 12 (max), hits 0, pw 3. Når 3 sæt logges 12/rir 2. Så hits = 1, trin uændret.
- **S-DP-03** Givet hits 1. Når 3 sæt logges 12/rir 2 i næste grønne pas. Så `step_changed press.1 → press.2`, target = 6, hits = 0, `explanation` ≠ tom.
- **S-DP-04** Givet hits 1. Når sættene logges 12, 12, 11. Så hits = 0, target uændret (12).
- **S-DP-05** Givet hits 1. Når sættene logges 12/rir 1 (alle). Så hits = 0, target 12.
- **S-DP-06** Givet hits 1. Når passet er gult. Så hits = 1 uændret, target uændret.
- **S-DP-07** Givet hits 1, pw 4 (let). Når 2 sæt logges 12/rir 3. Så hits = 1, target uændret.
- **S-DP-08** Givet `press.3` (pr. side), target 10. Når venstre 10, 10, 10 og højre 10, 10, 9. Så ingen hit, target uændret.
- **S-DP-09** Givet pw 6 (rirPlan 1), target 8. Når 4 sæt logges 8/rir 1. Så target = 9, hits = 0.
- **S-DP-10** Givet `press.7` (boss), hits 1. Når hit igen. Så ingen `step_changed`, hits = 2 forbliver.
- **S-DP-11** Givet et grønt pas afbrudt efter par 1. Når pres var logget fuldt, ben ikke. Så pres behandles normalt, ben neutralt; `status = 'green'`, `aborted = true`, `done = true`.
- **S-DP-12** Givet pw 6 (rirPlan 1), `press.2`, target 12 (max), hits 1. Når »Som planlagt« trykkes på alle 4 sæt. Så logges 12/rir 2, det er et hit, og `press.2 → press.3`.
- **S-DP-13** Givet pw 6 (rirPlan 1), target 9. Når »Som planlagt« trykkes på alle sæt. Så logges 9/rir 1, og target = 10.

**Hold, power, EMOM, klub, nakke, load**
- **S-HOLD-01** Givet `core_front.2` hollow, target 20. Når 3 × 20 sek logges. Så target = 25.
- **S-HOLD-02** Givet target 45 (max), hits 1. Når 3 × 45 logges. Så `core_front.2 → core_front.3`, target = 15.
- **S-HOLD-03** Givet hold-timeren. Når brugeren stopper ved 17 af 20 sek. Så sættet logges 17, `asPlanned = false`, target uændret.
- **S-HOLD-04** Givet `shoulder.3` (P17). Når Styrke B planlægges. Så går trin 2-dosis (fødderne på en stol, ugens sæt × 10) forud for håndstandsholdet i par 1, og kun holdet tæller i progressionen. (Tilføjet ved selvreview F1.)
- **S-POW-01** Givet `power_legs.1`, target 3, pw 2. Når 3 sæt 3 og quality = true. Så target = 4.
- **S-POW-02** Givet target 5, hits 1. Når 3 × 5 og quality = true. Så `power_legs.1 → power_legs.2`.
- **S-POW-03** Givet hits 1. Når quality = false. Så hits = 0, target uændret.
- **S-EMOM-01** Givet E1 i pw 1. Når clean ∧ rest20. Så `pendingUp = true`, trin stadig E1 i samme uge.
- **S-EMOM-02** Givet pendingUp, pw 2 (loft E2). Når A startes. Så trin = E2, `lastStepUpWeek = (1, 2)`.
- **S-EMOM-03** Givet E3, pendingUp, pw 4 (let). Når A startes. Så blokken er burpee-test, pendingUp bevaret; i pw 5 trin = E4.
- **S-EMOM-04** Givet E2 og pendingUp, A flyttet til samme programuge som en tidligere oprykning. Når A startes. Så trin uændret.
- **S-EMOM-05** Givet runde 2, pw 5, stepAtRoundStart E7. Når planen beregnes. Så loft = E7, ikke E4.
- **S-EMOM-06** Givet `pendingUp`. Når EMOM rykker ned (tre uger uden, skarp smerte eller eget valg). Så `pendingUp = false`, og næste A-pas rykker ikke op. (Tilføjet ved selvreview F2.)
- **S-VARIANT-01** Givet EMOM E5. Når brugeren vælger burpee-variant V2. Så afvises valget (R-VARIANT: »Næste variant« først fra E6); givet E6 → V2 er valgt, og V3 kræver V2 først. (Tilføjet ved selvreview F11.)
- **S-CLUB-01** Givet C2, ét rent pas. Når rent igen. Så C3.
- **S-NECK-01** Givet N1, feel easy to gange i grønne pas. Så N2. Givet feel hard. Så hits = 0.
- **S-LOAD-01** Givet `backpack_row`, target 15, hits 1, load 0. Når 3 × 15/rir 2 pr. side. Så load = 2, target = 8, trin uændret.
- **S-W3-01** Givet W3 med 3 runder, ét rent pas. Når rent igen. Så W4.

**Trafiklys og smerte**
- **S-TL-01** Givet alle ja. Så plan = fuld; `session_started.light = 'green'`.
- **S-TL-02** Givet q1 nej. Så plan indeholder kun `inYellow`-blokke med 2 sæt, reserve 3; ingen power, ingen finisher, ingen nakke.
- **S-TL-03** Givet rød. Så planen er Open & Strong + gåtur; `done = false`; ugen tæller ikke gennemført af dette pas.
- **S-TL-04** Givet `pain: sharp` i går. Når trafiklyset vises. Så q2 standard = nej.
- **S-TL-05** Givet `club_logged.hardness = 'hard'` i går. Så hinten vises; svar uændrede.
- **S-TL-06** Givet motor-dag, gul. Så motor = base 30 min uanset fase.
- **S-TL-07** Givet pw 5 (30/15), grøn torsdag og `club_logged.hardness = 'hard'` onsdag. Så er motorplanen rolig base med valget »Kør intervallerne alligevel«. Givet hårdhed »Middel« → intervaller som planlagt.
- **S-PAIN-01** Givet `legs.3`. Når `pain: sharp` logges. Så `step_changed legs.3 → legs.2, until = +7 dage`, hits = 0, target = min.
- **S-PAIN-02** Givet tempDown, dag 8, grønt pas uden smerte. Så `step_changed legs.2 → legs.3 (restore)`, target = min.
- **S-PAIN-03** Givet tempDown. Når ny sharp dag 4. Så until = +7 fra dag 4; Fysio-råd flagges.
- **S-PAIN-04** Givet `press.1`. Når sharp. Så trin forbliver `press.1` med flaget »lettere variant«.
- **S-PAIN-05** Givet søndagstjek med painTracks = [`groin`]. Så `groin` behandles som sharp.
- **S-PAIN-06** Givet `pain: light`. Så ingen `step_changed`; historik viser flaget.

**Uger, fravær, kalender**
- **S-WEEK-01** Givet k0 gennemført (A grønt). Så pw(k1) = 2.
- **S-WEEK-02** Givet k0 og k1 gennemført, k2 uden A/B. Så pw(k3) = pw(k1) = 2; pw(k4) = 3, hvis k3 gennemføres.
- **S-WEEK-03** Givet kun et gult A i ugen. Så ugen er gennemført.
- **S-WEEK-04** Givet kun et rødt A og Open & Strong. Så ugen er ikke gennemført.
- **S-WEEK-05** Givet tre uger uden gennemført. Når den fjerde uge beregnes. Så alle spor –1 trin (ikke under trin 1), EMOM –1, én `step_changed` pr. spor med reason `absence`, og forklaringen slutter med »Tre uger uden styrkepas: alle stiger ét trin ned.« uden sidetal; pw = sidste gennemførte.
- **S-WEEK-06** Givet fire uger uden. Så kun ét sæt absence-ændringer (ikke to).
- **S-WEEK-07** Givet `status: ill` 10–16/11. Så alle dage i intervallet er røde, og ugen er ikke gennemført.
- **S-WEEK-08** Givet `status: travel`. Når tirsdag beregnes. Så rejsepas med EMOM `min(E3, trin)`; når det logges `done`, er ugen gennemført, og `hits` uændrede.
- **S-WEEK-09** Givet onboarding 30/11 med completedWeeks = [9/11, 16/11] og ikke 23/11. Så pw(30/11) = 2 og trin fra `step_set`.
- **S-WEEK-10** Givet pw 12 gennemført. Så næste uge pw = 5, round = 2, ingen uge-1-målinger.
- **S-WEEK-11** Givet tre uger uden gennemført og rygsæk-row med 4 kg, target 15, hits 1. Når den fjerde uge beregnes. Så vægten er 2 kg, target = min og hits = 0 på læg, etbens RDL og rygsæk-row (ét trin ned svarer til −2 kg, ikke under 0). (Tilføjet ved selvreview F6.)
- **S-WEEK-12** Givet rejse og `legs.5`. Når tirsdag beregnes. Så er rejsepassets ben split squat-trinnet `legs.3` (dit trin, højst `legs.3`) med arbejdstal = min. (Tilføjet ved selvreview F7.)
- **S-XMAS-01** Givet dato 21/12 2026, pw 7. Så overlejringer `xmas_2026_motor` (23/12) og `xmas_2026_B` (26/12) foreslås.
- **S-XMAS-02** Givet uge fra 28/12 med pw 8. Så målinger foreslås 29–30/12; med pw 6 foreslås ingen målinger.
- **S-XMAS-03** Givet `club_closed` 24/12–3/1. Så Muay Thai-dage viser kamp-runder.
- **S-EVENT-01** Givet begivenhed »Kamp« 20/1. Når planen for 19/1 beregnes. Så ingen power-ben, ingen ben-stige, ingen Nordic-trin, ingen intervaller, ingen boss; flaget vises.
- **S-EVENT-02** Givet en begivenhed fredag i pw 3 og i pw 4. Når torsdagens motor beregnes. Så er den rolig base uden stigningsløb og uden Cooper-test. (Tilføjet ved selvreview F5.)
- **S-FLAT-01** Givet standardforløbet (k4 = pw 5, k5 = pw 6, k6 = pw 7), freshness flat i k4 og technique 4 i k5. Så k6 får volumeFactor 0.67: 4 sæt → 2 (rund ned, min 2), 3 → 2; EMOM rykker ikke op i k6; k7 normal.
- **S-FLAT-02** Givet flad i k5 og k6 i standardforløbet, så k7 er let uge (pw 8). Så skubbes reduktionen til k8 (pw 9).

**Flytning og ugeplan**
- **S-MOVE-01** Givet standardplan, A ikke logget tirsdag. Når onsdag beregnes. Så er de fulde flyttedage torsdag (motoren udgår den uge med forklaring; advarslen om A og B to dage i træk vises) og søndag (tirsdag blev hviledag, så R-REST holder). Onsdag og lørdag tilbydes kun som »Kort version« (klubdage), fredag slet ikke (B). »Spring over« tilbydes altid.
- **S-MOVE-02** Givet B flyttes til lørdag (klubdag). Så kun »kort version« tilbydes.
- **S-MOVE-03** Givet flytning, der fjerner den sidste hviledag. Så dagen er ugyldig (R-REST).
- **S-MOVE-04** Givet to pas forsøgt på samme dag. Så det flyttede afvises.
- **S-EXTRA-01** Givet clubDays = [1, 3, 5, 6]. Så layout: hviledag søn, A tir, B tor, motor udgår med »valgfri rolig tur«.
- **S-EXTRA-02** Givet clubDays = [1, 2, 3, 4, 5, 6]. Så A og B som kort version om morgenen på to klubdage med størst afstand; hviledag søn; motor udgår.

**Målinger, niveauer, katalog**
- **S-MEAS-01** Givet pw 4 tirsdag. Så planen har wall_test før opvarmning, pushups som første sæt i pres, table_rows som første sæt i træk, burpee_3min i stedet for EMOM; målesæt har rir 0 og tæller ikke i hits.
- **S-MEAS-02** Givet `pushups = 52`. Så niveau = Stærk; `wall_test = 1` → Stærk (lowerIsBetter).
- **S-MEAS-03** Givet runde 1, pw 1. Så base_check torsdag og målinger tirsdag/fredag; runde 2 pw 5 → ingen.
- **S-MEAS-04** Givet `wallsit.W3` i pw 4. Når fredag beregnes. Så er wall sit-målingen første sæt i wall sit-blokken, og runderne er én færre. (Tilføjet ved selvreview F3.)
- **S-MEAS-05** Givet pw 4 og et gult A tirsdag uden målinger. Så tilbydes væg-test, push-ups og bord-rows ved næste grønne A (pw 5); burpee-testen ikke, fordi den kun erstatter EMOM'en i en let uge. En måling, der logges under et pas, ændrer ikke samme dags plan; fra næste dag er den taget. (Tilføjet ved selvreview F4.)
- **S-IMP-01** Givet `press.2` og `shoulder.2`. Så `deficit` og `wall_walks` ulåst, `diamond` låst indtil pushups ≥ 25. Givet `shoulder.1` → `wall_walks` låst.
- **S-IMP-02** Givet 3 × 10 på `press.2` logget og derefter `press.1`. Så er pseudo-planche låst, til pres igen er på mindst trin 2. (Tilføjet ved selvreview F8.)
- **S-HERO-01** Givet `press.6` med 3 reps pr. side logget. Så hint for »Etarms push-up« vises; `checked` forbliver false, til brugeren krydser af.
- **S-HERO-02** Givet indfasning på `press.7` og `legs.7` uden loggede sæt. Så vises ingen Hero-hints og intet ben-niveau på Målbrættet; de kræver loggede sæt. (Tilføjet ved selvreview F9.)
- **S-BOSS-01** Givet pw 11, grøn, ingen begivenhed i morgen. Så boss tilbydes; givet pw 10 → ikke; givet boss logget for 20 dage siden → ikke.
- **S-TURBO-01** Givet pw 4. Så Turbo skjult; pw 5 → synlig.

**Tid, data, simulering**
- **S-DATE-01** Givet `now = 2026-11-10T23:30:00Z` (00:30 dansk tid 11/11). Så today = `2026-11-11` uanset browserens tidszone.
- **S-DATE-02** Givet pas startet 23:55 og afsluttet 00:10. Så passet hører til startdatoen.
- **S-DATE-03** Givet 2027-03-28 (overgang til sommertid). Så datoerne tæller korrekt uden spring.
- **S-DATA-01** Givet en log med 300 hændelser. Når `deriveState` kører to gange. Så resultatet er identisk (deterministisk).
- **S-DATA-02** Givet eksport → import (erstat). Så `events` er identiske og `deriveState` ens.
- **S-DATA-03** Givet import med overlappende `id`. Når der flettes. Så dubletter ignoreres, og rækkefølgen er efter `at`.
- **S-DATA-04** Givet schemaVersion 1-data og migration til 2. Så en kopi `backup_before_migration` findes, og alle hændelser er bevaret.
- **S-DATA-05** Givet programVersion 1 → 2, hvor `press.3` omdøbes men beholder id. Så brugerens `stepId` virker uændret; et fjernet trin mapper til nærmeste lavere via `program.migrations`.
- **S-TIME-01** Givet simulering fra 24/12. Når en uge logges i simuleringen. Så `planFor` giver de forventede jule-forslag.
- **S-TIME-02** Givet simulering. Så lagerets antal hændelser er uændret bagefter.
- **S-TIME-03** Givet simulering afsluttet. Så I dag viser den rigtige dato og tilstand.
- **S-BACKFILL-01** Givet onboarding med `press.2`, target 9. Så første plan viser pres trin 2 med 9 reps.

**Open & Strong**
- **S-OS-01** Givet 4 gennemførte uger (≥ 5 `os_done` pr. uge). Så Y-løft-cuen skifter til »med to små vandflasker«.

## 9. Sporbarhed (PDF-side → regel → afsnit → scenarier)

| Side | Indhold | Regel/sektion | Scenarier |
|---|---|---|---|
| 3 | Byggesten, udstyr | Visning (Stiger, Hvorfor) | – |
| 4 | Hvorfor det virker | »Hvorfor«-tekster i pas | – |
| 6 | Din uge | `layout`, 5.1, R-EXTRA-MT | S-EXTRA-01/02 |
| 7 | Trafiklys, smerteregel | 5.2, 6.1, R-PAIN-* | S-TL-01..06, S-PAIN-01..06 |
| 8 | Dobbelt progression, reserve, hold +5, power, én ting, stop-reglen | R-DP-*, R-HOLD, R-POWER, R-ONE; stop-reglen som cue | S-DP-01..13, S-HOLD-01..03, S-POW-01..03 |
| 9 | Starttrin, tempo, hastigheder, film dig selv | Onboarding 4.1 (SPEC), cues; film = påmindelse i søndagstjek hver anden uge | S-BACKFILL-01 |
| 11 | Ét trin pr. stige, sidegrene | `TrackState.stepId`, R-SIDE | S-IMP-01 |
| 12 | Pres-stigen | `press.json` | S-DP-* |
| 13 | Klubsekvensen, sidegrene | R-CLUB, R-SIDE | S-CLUB-01, S-IMP-01, S-IMP-02 |
| 14 | Skuldre | `shoulder.json`; trin 3 = hold + trin 2-dosis (Præcisering) | S-HOLD-* |
| 15 | Træk, rygsæk-row i B | `pull.json`, `backpack_row`, R-LOAD | S-LOAD-01 |
| 16 | Ben, knæ-til-væg | `legs.json` (trin 3 følger R-DP; rygsækkens vægt er et felt); fysio-tekst som »Hvorfor« | S-PAIN-01..02 |
| 17 | Wall sit, lægge | `wallsit.json`, `calf`, R-W3, R-HOLD | S-W3-01 |
| 18 | Bagkæde, RDL | `posterior.json`, `sl_rdl`, R-EVENT (Nordic) | S-EVENT-01 |
| 19–21 | Mave front/side/rotation/sit-ups | `core_*.json`, R-HOLD, R-DP | S-HOLD-01..02 |
| 22 | Lyske | `groin.json` | S-PAIN-05 |
| 23 | Power: ben | `power_legs.json`, R-POWER | S-POW-01..03 |
| 24 | Power: overkrop | `power_upper.json`, R-POWER | S-POW-* |
| 25 | EMOM-trappen, loft, ét trin pr. uge | R-EMOM, 6.3 | S-EMOM-01..06 |
| 26 | Burpee-teknik og varianter | `burpee_skill.json`, R-VARIANT | S-VARIANT-01 |
| 28 | Opvarmning, trafiklys-trin 4 | `warmup`, 5.2 q3 | S-TL-01 |
| 29 | Styrke A, gul dag | `A.json`, 6.1 | S-TL-02, S-DP-11 |
| 30 | Styrke B, mave 2 + 2, imponer efter klubsekvens | `B.json`, R-SIDE, R-IMPRESS | S-IMP-01 |
| 31 | Motoren, intervaller kun grønne dage, »var onsdagen brutal« | `weeks[].motor`, 5.2 | S-TL-06, S-TL-07 |
| 32 | Kamp-runden, sprints | motor-timer (SPEC 3.2) | – |
| 33 | Open & Strong, vandflasker efter 4 uger | R-OS | S-OS-01 |
| 34 | Nakke-stigen | R-NECK | S-NECK-01 |
| 36 | Faser, lette uger, Turbo, ny runde fra uge 5 | 6.3, R-TURBO, R-ROUND2 | S-TURBO-01, S-WEEK-10 |
| 37–38 | Ugetabel, jul, nytår | 6.3, 5.8 | S-XMAS-01..03, S-EMOM-* |
| 39 | Belastning, burpee-loft, flad i klassen | 6.3, R-EMOM, R-FLAT | S-FLAT-01..02 |
| 40 | Målinger, lørdagskarakter | 5.6, `club_logged.technique` | S-MEAS-01..05 |
| 41 | Målbrættet, i klassen ved Stærk | R-LEVELS, R-IMPRESS-tekst | S-MEAS-02 |
| 42 | Hero-tavlen | R-HERO | S-HERO-01..02 |
| 43–44 | Imponer-kataloget | R-IMPRESS | S-IMP-01 |
| 45 | Boss-udfordringer | R-BOSS | S-BOSS-01 |
| 46 | Reglerne, comeback-fælden | R-PAIN-*, R-USER-STEP (advarsel), cues (knoer, nakke) | S-PAIN-* |
| 47 | Flere Muay Thai-pas, motoren ryger først, tunge ben før en begivenhed, rejse, sygdom, sprungne uger | R-EXTRA-MT, R-MOVE, R-EVENT, R-TRAVEL, R-ILL, R-PW, R-ABSENCE-3, R-REST | S-WEEK-02..08, S-WEEK-11..12, S-EXTRA-*, S-MOVE-01, S-MOVE-03, S-EVENT-01..02 |
| 48 | Restitution, søndagstjek | `sunday_check`, R-PAIN-SUNDAY | S-PAIN-05 |
| 49 | Log | Historik (SPEC 3.6), eksport | S-DATA-02 |
| 51–54 | Bag om programmet, kilder | »Hvorfor« i appens egne ord (`content/explain/`, `SPEC.md` 9.1); appen viser ingen kilder (`DECISIONS.md` A2) | – |

Afvigelser og tilføjelser: A1 (begivenheder i stedet for sparring), T1 (klublog), T2 (indfasning), T3 (gendannelse efter smerte-uge), T4 (rejsepas tæller ugen). Alle Præciseringer er markeret i teksten og samlet i `DECISIONS.md`.
