# Selvreview af milepæl 1

2026-11-05

Omfang og metode: `src/engine/` (inkl. `__tests__/`) og `program/*.json` læst mod `DECISIONS.md` afsnit 6, `ENGINE.md`, `PROGRAM_KILDE.md` og P1–P46; `npx vitest run src/engine` (13 filer, 302 grønne) og `node scripts/simulate.ts` (1226 hændelser, alle 13 stiger og power-spor rykker op) kørt; hvert fund er efterprøvet med et engangsscript uden for repoet, medmindre andet står.

## Fund

1. **F1 (middel)** – Skulder trin 3 er i data og plan kun håndstandsholdet; trin 2-dosis (pike med fødderne på en stol), som trinnet skal udføres efter, findes ingen steder.
   - Sted: `program/tracks/shoulder.json:35`, `src/engine/plan.ts:417`
   - Regel: ENGINE 9 (side 14: »trin 3 = hold + trin 2-dosis«), P17, PROGRAM_KILDE side 14 (»+ håndstand mod væggen«)
   - Eksempel: `shoulder.3`, pw 2, fredag → `B.pair1.shoulder` = 3 × 20 sek hold og intet andet → forventet trin 2's pike-sæt (fødderne på stol) efterfulgt af 3 × 20 sek håndstand.
   - Bekræftet ved kørsel.

2. **F2 (middel)** – `emom.pendingUp` ryddes kun ved oprykning, ikke ved fraværs-nedrykning eller brugerens eget trinvalg, så næste A-pas rykker EMOM'en straks op igen.
   - Sted: `src/engine/derive.ts:212-218`, `src/engine/session.ts:224-229`
   - Regel: ENGINE 5.5 R-ABSENCE-3 (»EMOM ét trin ned … hits = 0«), 5.4 R-USER-STEP (»hits = 0«), princip 5
   - Eksempel: rent A i pw 1; pw 2 E1→E2 og urent; pw 3 rent (pendingUp); k3–k5 uden pas → fravær E2→E1 → første A i k6 (pw 3) skriver E1→E2 før `session_started` → forventet E1. Også: brugeren vælger E3→E2 efter et rent pas → første EMOM-pas i pw 5 skriver E2→E3 → forventet E2.
   - Bekræftet ved kørsel (begge tilfælde).

3. **F3 (middel)** – Wall sit-målingen forsvinder, når sporet står på W3 eller W5, fordi runde-grenen afslutter blokken, før målingen lægges ind som første sæt.
   - Sted: `src/engine/plan.ts:427-443` (`continue` før `firstSet` i linje 452)
   - Regel: ENGINE 5.6 (»wall_sit = første sæt i wall sit-blokken«), PROGRAM_KILDE side 40
   - Eksempel: pw 4 fredag med `wallsit.W3` (eller W5) → målinger `pike, hollow, side_plank, balance` → forventet også `wall_sit` (som med W1). Samme i uge 1.
   - Bekræftet ved kørsel.

4. **F4 (middel)** – Et gult pas i en måleuge fjerner dagens målinger, og de tilbydes ikke igen, selv om P31 siger, at de »kan tages ved næste grønne pas«.
   - Sted: `src/engine/plan.ts:657-663` (gul fjerner måleblokke og `measureId`), `src/engine/plan.ts:237` (målinger er bundet til ugedagens pas)
   - Regel: ENGINE 5.6 (målinger i uge 1, 4, 8, 12; push-ups og bord-rows er første sæt i par 1, som også køres på gul dag), P31
   - Eksempel: pw 4, gult A tirsdag → ingen væg-test, push-ups, bord-rows eller burpee-test i ugens øvrige planer eller i pw 5; ingen `pushups`-måling for pw 4 → forventet målingerne tilbudt ved næste grønne pas.
   - Bekræftet ved kørsel.

5. **F5 (lille)** – Dagen før en begivenhed bliver kun intervaller og kamp-runder til rolig base; Cooper-testen (uge 4, 8, 12) og stigningsløbene (uge 3) bliver stående.
   - Sted: `src/engine/plan.ts:491-505`
   - Regel: ENGINE 5.1 trin 5 (»motor som rolig base«), PROGRAM_KILDE side 47
   - Eksempel: »Kamp« fredag i pw 4 → torsdagens motor = »Cooper eller base-check« med måling `cooper`; i pw 12 »Cooper-test«; i pw 3 »Base 40 min + 4 stigningsløb« → forventet rolig base.
   - Bekræftet ved kørsel.

6. **F6 (lille)** – Fraværsreglen springer læg, etbens RDL og rygsæk-row over (P37), så arbejdstal, hits og vægt er urørte efter tre uger væk, og første pas tilbage kan lægge 2 kg på.
   - Sted: `src/engine/session.ts:429`, `src/engine/session.ts:457`
   - Regel: ENGINE 8 S-WEEK-05 (»alle spor … én step_changed pr. spor«), 5.5 R-ABSENCE-3 (»hits = 0, target = min«), princip 5; P37 undtager sporene
   - Eksempel: `backpack_row` target 15, hits 1, 4 kg; k2–k4 uden gennemført uge → ingen ændring for sporet; første B (3 × 15, reserve 2) → `load_changed` 4→6 kg → forventet hits 0, target 8 og ingen +2 kg.
   - Bekræftet ved kørsel.

7. **F7 (lille)** – Rejsepasset bruger brugerens eget ben-trin (P38), så det fra `legs.4` viser pistol-øvelser i stedet for split squats.
   - Sted: `program/sessions/travel.json:33`, `src/engine/plan.ts:417`
   - Regel: ENGINE 5.7 R-TRAVEL (»push-ups, rygsæk-row, split squats, 6 min EMOM«), P18, PROGRAM_KILDE side 47
   - Eksempel: status rejse og `legs.5` → rejsepassets benblok = `legs.5` (pistol-negativer) → forventet split squat (`legs.1`–`legs.3`).
   - Bekræftet ved kørsel.

8. **F8 (lille)** – Pseudo-planche låses op af et 3 × 10 på `press.2` et sted i historikken, også når pres-trinnet nu er under 2.
   - Sted: `src/engine/catalog.ts:58-63`, `program/side_branches.json:24`
   - Regel: ENGINE 5.12 R-SIDE (»press ≥ 2 og last på trin 2 med 3 × 10«)
   - Eksempel: 3 × 10 på `press.2`, derefter skarp smerte (eller eget valg) → `press.1` → `pseudo_planche` ulåst → forventet låst.
   - Bekræftet ved kørsel.

9. **F9 (lille)** – P41's »højere trin opfylder kravet« bruges også til Hero-hints og Målbrættets ben-række, så de vises uden et eneste logget sæt.
   - Sted: `src/engine/catalog.ts:30-33`, `src/engine/catalog.ts:59`, `src/engine/catalog.ts:116-131`
   - Regel: ENGINE 5.12 R-HERO (»hint, når loggen opfylder kravet«), 5.6 (»Basis = legs.1 med hit, Stærk = legs.2 med hit, Imponerende = legs.6 med ≥ 5 reps pr. ben logget«)
   - Eksempel: indfasning på `press.7`, `shoulder.7`, `pull.7`, `legs.7` og nul pas → hints for etarms push-up, HSPU og etarms bord-row og ben-niveau Imponerende; `legs.3` uden log → Stærk → forventet ingen hints og intet ben-niveau.
   - Bekræftet ved kørsel.

10. **F10 (lille)** – `startSession` ser bort fra status syg, så et pas på en syg dag bliver grønt og gennemfører ugen; S-WEEK-07's »ugen er ikke gennemført« prøves ikke, fordi testen ikke logger noget pas.
    - Sted: `src/engine/session.ts:214`, `src/engine/__tests__/weeks.test.ts:126`
    - Regel: ENGINE 6.1 (»status: ill → rød«), 5.7 R-ILL (»Ugerne under sygdom er ikke gennemførte«)
    - Eksempel: syg 10.–16/11, A startet 10/11 med tre ja → `session_completed` status green, done true, uge 0 gennemført, pw(k1) = 2 → forventet rødt pas, uge ikke gennemført, pw(k1) = 1. (`planFor` viser dagen rød, så UI'et tilbyder ikke passet.)
    - Bekræftet ved kørsel.

11. **F11 (lille)** – R-VARIANT findes ikke i motoren: `variant_set` accepteres på ethvert EMOM-trin og låser straks imponer-varianter op.
    - Sted: `src/engine/derive.ts:441-443`
    - Regel: ENGINE 5.4 R-VARIANT (»Næste variant« tillades, når `emom.stepId ≥ E6`)
    - Eksempel: EMOM E1, `variant_set burpee_skill.V3` → `burpeeVariant` = V3, `burpee_switch_kick` ulåst → forventet afvist (eller et motortjek, UI'et kan bruge).
    - Bekræftet ved kørsel.

12. **F12 (lille)** – S-TIME-02 prøver ikke lageret: det falske `store` gives aldrig til simuleringen, så `store.writes === 0` er sandt per konstruktion; testen viser kun, at simuleringen ikke ændrer det array, den fik.
    - Sted: `src/engine/__tests__/data.test.ts:157-187`
    - Regel: ENGINE 5.14 og 8 S-TIME-02 (»lagerets antal hændelser er uændret«, `storage.readOnly`)
    - Eksempel: en simulering, der skrev til et rigtigt lager, ville stadig give grøn test → forventet en test mod lagerlaget (fake-indexeddb eller Playwright, M2).
    - Ikke kørt; læst.

## Gennemgået uden fund

- Programdata mod PROGRAM_KILDE: alle 20 spor (navne, niveauer, doser, udførelse, noter, Coach/Fysio/Evidens) side 12–34 bortset fra F1; EMOM-trappen (appendiks A) og E1/E9-niveauer (side 11, P43); klubsekvensen C1–C6 (side 13); ugetabellen (side 37–38 og ENGINE 6.3); målinger og Målbrættet (side 40–41); Hero (side 42); imponer-kataloget, 17 punkter (side 43–44); sidegrene (side 13); boss (side 45); opvarmning og Open & Strong (side 28, 33); Styrke A og B mod side 29–30 og ENGINE 7.3 (rækkefølge, sætregler, pauser, `inYellow`); rejsepasset; overlejringerne (ENGINE 5.8); tags for Nordic, tunge ben og RDL med vægt.
- Progression: R-DP-TARGET og R-DP-STEPUP (hit ved max og reserve ≥ 2, target-regel mod ugens plan, to hits i træk, boss-trin bliver), R-HOLD (+5 sek), R-POWER, R-LOAD (+2 kg, target = min), R-W3, R-CLUB, R-NECK, R-ONE, »Som planlagt« med reserve 2 ved max i plan 1-uger (R4), valgfrit ekstra sæt (P30), målesæt tæller ikke, neutrale pas (gul, rød, rejse, afbrudt før blokken, let uge).
- R-EMOM i øvrigt: pendingUp fra rent A-pas, oprykning ved næste EMOM-pas, højst én pr. programuge (også i gentaget uge), loft og fast E1 i uge 1, let uge bevarer pendingUp, ingen oprykning i reduceret uge, på gul dag eller ved boss; runde 2-loftet fra `stepAtRoundStart`.
- Regression: R-PAIN-SHARP (trin ned i 7 dage, trin 1 som lettere variant, hits 0, target min), forlængelse og Fysio-flag (P34), R-PAIN-RESTORE, R-PAIN-SUNDAY, let smerte uden ændring, nakke-stop.
- Uger: R-WEEK-DONE (A, B eller rejse; grøn, gul eller rejse; par 1 logget; P28), R-PW med indfasningens uger, R-ABSENCE-3 for stiger, power, EMOM, klubsekvens og nakke (én gang pr. periode, fra indfasningsugen), R-ROUND2 (pw 12 → 5, ingen uge 1-målinger, målinger i uge 8 og 12), R-FLAT (to flade uger, rund ned og mindst 2, skubbes forbi let uge, tæller forfra).
- Dagens plan: trafiklys (gul, rød, gul motor = base 30, udledte svar, hint, P25 med »Kør intervallerne alligevel«), R-EVENT for A og B, R-BOSS (pw ≥ 11 eller runde 2, 28 dage, grøn, ikke let uge), R-TURBO, syg, ferie, rejse og lukket klub i `planFor`, placering af de øvrige målinger, jule- og nytårsdatoer.
- Flytning og ugeplan: R-MOVE regel 1–5 og R-REST (inkl. forbigået dag som hviledag), `layoutFor` (ENGINE 5.10 og P27).
- Katalog: R-IMPRESS og R-SIDE for trin- og målekrav, Målbrættets niveauer (væg-test omvendt), Open & Strong-cuen efter fire uger.
- Data og determinisme: ingen `Date.now()`, `new Date()` uden argument eller `Math.random` i `src/engine`; datoer via `Intl` i Europe/Copenhagen og dagtal uden sommertidsspring; hændelser muteres ikke (normalisering laver kopier, tidsmaskinen kloner); fletning efter `at` uden dubletter; eksport og import byte for byte; migration med kopi først; omdøbte og fjernede trin (S-DATA-05); koden bruger kun ID'er fra ENGINE 2, ingen øvelsesnavne.
- Scenarietestene i ENGINE 8: alle findes én gang med ID i testnavnet og prøver det, scenariet beskriver, bortset fra S-WEEK-07 og S-TIME-02 (F10, F12).

## Opfølgning (rettet samme aften)

Alle fund er rettet efter ændringsprotokollen i `CLAUDE.md`: nyt scenarie i `docs/ENGINE.md` afsnit 8 (og sporbarheden i afsnit 9), derefter test, derefter kode. Præciseringer, der blev rettet, står i `docs/DECISIONS.md` (P31, P37, P38, P41 og R12).

| Fund | Rettelse | Scenarie |
| --- | --- | --- |
| F1 | `shoulder.3` har `with: shoulder.2` i data; planen lægger trin 2-dosis (ugens sæt × 10) før håndstandsholdet i samme par. Smerte i en af de to blokke tæller for sporet; kun holdet progredierer | S-HOLD-04 |
| F2 | Enhver EMOM-ændring, der ikke er en oprykning (fravær, smerte, eget valg), rydder `pendingUp` | S-EMOM-06 |
| F3 | Wall sit-målingen erstatter første runde på W3/W5 (runderne er én færre) | S-MEAS-04 |
| F4 | Målinger, der ikke blev taget i måleugen ved et logget pas (fx gul dag), tilbydes ved næste grønne pas af samme slags ugen efter; ikke burpee-testen og motorens distance. Uger, der kun er erklæret gennemført ved indfasningen, giver ingen udskudte målinger | S-MEAS-05 |
| F5 | Dagen før en begivenhed er motoren altid rolig base: ingen stigningsløb, ingen Cooper-test | S-EVENT-02 |
| F6 | Fraværsreglen giver læg, etbens RDL og rygsæk-row −2 kg (ikke under 0), target = min og hits = 0 | S-WEEK-11 |
| F7 | Rejsepassets ben er højst `legs.3` (split squat) med arbejdstal = min, når dit trin er højere | S-WEEK-12 |
| F8 | Præstationskrav til imponer-kataloget og sidegrene kræver også, at dit nuværende trin mindst er kravets trin | S-IMP-02 |
| F9 | Hero-hints og Målbrættets ben-række kræver loggede sæt; et højere trin alene giver ingen hint | S-HERO-02 |
| F10 | `startSession` gør et pas på en syg dag rødt, uanset svarene; S-WEEK-07 prøver det nu | S-WEEK-07 |
| F11 | `variant_set` gælder kun ned eller ét trin op ad gangen og først fra E6 | S-VARIANT-01 |
| F12 | Motor-testen S-TIME-02 prøver nu kun motorens del (kopien ændrer aldrig loggen, den fik). Lagerets del dækkes af `src/storage/__tests__/store.test.ts` (»S-TIME-02: lagerets antal hændelser er uændret, mens tidsmaskinen kører«) og af Playwright-testen i `e2e/m2.spec.ts`, der tæller hændelserne i IndexedDB før og efter et pas i tidsmaskinen | S-TIME-02 |
