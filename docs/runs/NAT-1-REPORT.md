# NAT-1 – rapport

Natten 5.–6. november 2026. Opgaven: `docs/runs/NAT-1.md` (milepæl 0 afsluttes, milepæl 1 og 2 bygges) med brugerens tilføjelse om tidsmaskinen i milepæl 2. Tidslinjen står i `docs/runs/NAT-1-LOG.md`.

## 1. Hvad er lavet

**Milepæl 0 (afsluttet).** `probe/RESULTS.md` er udfyldt med telefonens resultater. Platform = IronFox-PWA (D19); D18 er rettet, så offline ikke afgør platformen (D20); ingen vibration (D21); ingen »Del«-knap (D22); `persist()` efter første loggede pas (D23); O1–O5 er lukket. Playwright-profilen `pixel9a` er nu telefonen som målt: 414 × 847, DPR 2, en-US, Europe/Copenhagen, Firefox med JIT slået fra; `pixel9a-utc` kører datotestene i UTC, og Vitest kører datotestene i begge tidszoner. Første tegning på 2.050 ms skyldes hverken probens afspilning eller fonte (målt og forklaret i `RESULTS.md`). En test sikrer, at appens service worker ikke overtager `/comeback/probe/`.

**Milepæl 1 (grøn, udgivet, selvreviewet).** Motoren i `src/engine` (afspilning af loggen, dagens plan, trafiklys, progression, regression, uger og programuge, fravær, flad-reglen, flytning, ugeplan, overlejringer, katalog, eksport/import/fletning, migrationer, tidsmaskinens kopi) og alt programindhold i `program/*.json`, konverteret fra `PROGRAM_KILDE.md` med `scripts/convert-program.ts`. Alle scenarier i `ENGINE.md` afsnit 8 er tests med deres ID. `program.spec.ts` tjekker trin-antal mod `ENGINE.md` 7.3, og `program-source.spec.ts` sammenligner hvert trin, ugetabellen, Målbrættet, Hero-tavlen, imponer-kataloget, sidegrenene, boss-listen, opvarmningen og Open & Strong ord for ord med kilden. `scripts/simulate.ts` kører 12 uger. `/program` viser alle data på Pages. Lint-reglen mod ur og tilfældighed i motoren er på plads (D26). Selvreviewet (`docs/reviews/m1-selfreview.md`) fandt 12 fejl (0 alvorlige, 4 middel, 8 små); alle er rettet med 10 nye scenarier efter ændringsprotokollen (R12).

**Milepæl 2 (udgivet).** Lagerlaget (IndexedDB + spejl, skemaversion, backup før migration og import, skrivebeskyttet tilstand). Indfasning, I dag (med »blev ikke logget«-kortet og backup-linjen), guidet pas for Styrke A og B, motor, Open & Strong, opvarmning og nakke med trafiklys, ét tryk pr. sæt, hold-, pause-, EMOM-, klubsekvens- og wall sit-timere med lyd og Wake Lock, målinger i uge 1 (og de lette uger) med forrige værdi og niveau, opsummering med motorens forklaringer. Tidsmaskinen (lige efter kernen, brugerens tilføjelse) kører på en kopi i hukommelsen med skrivebeskyttet lager. Fanerne Uge (visning), Stiger (visning og »vælg selv et trin«) og Mere med Backup (eksport, import med forhåndsvisning, »Sidste backup«, varigt lager), Om med version og Diagnose (T6). Opdateringsbanner, PWA-installation med eget ikon, designsystemet med fonte og piktogrammer.

## 2. Hvad er verificeret

- `npm run check`: grøn på `main` (338 Vitest-tests i 16 filer – motor, programdata og lager; dato-, uge- og flytningstestene kører i både Europe/Copenhagen og UTC – plus typecheck, eslint, prettier og build).
- Scenarier: 93 scenarie-ID'er i `ENGINE.md` afsnit 8, hvert som én grøn test med ID'et i navnet; sporbarhedstesten tjekker afsnit 8 og 9.
- Programdata: `program.spec.ts` og `program-source.spec.ts` grønne (106 tests).
- Simulering: 12 uger, alle 13 stiger og power-spor rykker op; alle beslutninger har en forklaring (SK5).
- Playwright i `pixel9a` (Firefox, JIT fra) og `pixel9a-utc`: 18 flows grønne: probe, /program, appens service worker lader proben være, SK1, indfasning → I dag → Styrke A grøn med opsummering og forklaring, Styrke A gul, ét tryk pr. sæt (SK2), Open & Strong uden tryk, eksport/import, tidsmaskinen, luk og genåbn midt i et pas, uge 1 tirsdag (målinger og E1), torsdag (base-check) og fredag (Styrke B med målinger), Styrke B med W3-runder, fanerne Uge, Stiger, Mere og Diagnose, og datotesten også i UTC. I den sidste fulde kørsel fejlede seks tests med en intern Firefox-fejl ved lukning af testkonteksten (»_maybeDontRestoreTabs«), efter at flowet var nået i mål; ved genkørsel var alle seks grønne. Konfigurationen giver nu ét genforsøg, og rapporten viser den slags som »flaky«.
- SK1 (varm start uden net, 5 kørsler i profilen): første tegning median 36 ms, I dag synlig median 41 ms. Mod den udgivne adresse med net: I dag synlig efter 48 ms. Pc'en er ikke telefonen; Diagnose viser telefonens egne tal.
- SK2 (ét tryk pr. sæt, to ved afvigelse), SK5, SK8 (eksport/import byte for byte og i appen), SK9 (58,4 kB gz JavaScript af 150, 3,1 kB CSS af 30): grønne.
- Tidsmaskinen: S-TIME-01..03 grønne; Playwright logger et helt pas i simuleringen, og antallet af hændelser i IndexedDB er det samme før og efter.
- Designgennemgang af skærmbillederne mod SPEC 5 og 6: 17 fund (3 høje, 7 middel, 7 lave), alle rettet (`docs/reviews/m2-design-review.md`, SPEC 3.3 rettet først, D33). Det vigtigste: i et pas står »Som planlagt« og de andre handlinger i en fast bundblok, og et klodset dobbelttryk kan ikke længere logge et sæt eller starte et rødt pas.
- Udgivet med GitHub Actions: appen `https://<konto>.github.io/comeback/` og programmet `https://<konto>.github.io/comeback/program/` (den fulde adresse står i chatten, D27).
- Skærmbilleder i `screenshots/`: probe, i-dag, trafiklys, pas-skridt, pausetimer, opsummering, onboarding, uge, stiger, backup, diagnose, program.

## 3. Tjekliste til telefonen (ja/nej)

1. Installér appen fra menuen i IronFox, åbn fra ikonet, og gennemfør indfasningen. Viser I dag »Programmet starter mandag 9. november«?
2. Tidsmaskinen: Mere → Om → hold fingeren på versionen i 2 sek → tirsdag 10/11 → Start simulering → kør Styrke A med telefonen på gulvet. Kunne du høre lyden, og holdt skærmen sig tændt under hold og pauser uden at du rørte den?
3. Tryk »Afslut« i det røde banner. Viser I dag igen den rigtige dato og intet logget pas?
4. Tirsdag 10/11: kør Styrke A for alvor; luk appen midt i passet, og åbn den igen. Fortsætter den samme sted?
5. Mere → Backup → Eksportér, genstart telefonen, og importér filen fra Overførsler (Erstat alt). Er alt der bagefter?
6. Mere → Om → Diagnose: står »I dag synlig« under 1.000 ms? Send et skærmbillede af siden med.

## 4. Hvad der ikke kunne gøres

- SK3 (uden berøring) og SK4 (ingen datatab efter genstart og opdatering) kræver telefonen; de står i tjeklisten.
- Opdateringsbanneret er ikke prøvet automatisk, fordi det kræver to udgivne versioner; det gentages i M5's opdateringstest.
- Klublog, søndagstjek, flytning, status, begivenheder og overlejringer har motor og tests, men ingen skærme endnu (M3). Hero, imponer-katalog, boss og Turbo kommer i M4. »I går blev ikke logget«-kortet tilbyder derfor kun »Spring over« (»Flyt« er M3).
- GitHub Pages: udrulningen af selvreview-rettelserne hang i 10 minutter hos GitHub og blokerede den næste. Den blev løst ved at genkøre samme workflow (ingen manuel udgivelse, ingen ændring af indstillinger).

## 5. Forslag uden for opgaven

1. M3's skærme for klublog og søndagstjek: motoren er klar, og de styrer trafiklysets hint og smerte-reglen.
2. Håndvalgte cues, hvor den mekaniske regel læser mærkeligt, fx ben trin 3 »Eller 3 sek pause i bunden« og burpee-variant 4 »Eller + klap push-up«.
3. »Hold pause« som en vej tilbage til fanerne midt i et pas (SPEC 3), så man kan slå op i Stiger og vende tilbage.
4. `cancel-in-progress` i deploy-workflowet, så en hængende Pages-udrulning ikke blokerer den næste.
5. Spejlets status (`mirrorStatus`) på Diagnose.

## 6. Nye præciseringer (til Fable-review 1)

Alle står i `docs/DECISIONS.md` afsnit 4 og 1:

- P26 `session_started` gemmer pasets plan. P27 standardugen bevares i ugeplanen. P28 en blok stoppet af smerte tæller for `done`. P29 trinnets dosis som i kildens tabel. P30 et valgfrit ekstra sæt tæller ikke. P31 målinger på en gul dag tilbydes ved næste grønne pas. P32 klubsekvensen i let uge = 1 runde. P33 ingen boss i lette uger. P34 ny skarp smerte forlænger, går ikke længere ned. P35 nakkens arbejdstal bliver på minimum. P36 regler for EMOM-oprykning. P37 tre uger uden: også −2 kg på vægtspor. P38 rejsepassets ben højst `legs.3`. P39 motor-faser. P40 et pas, der står åbent fra i går, afsluttes som afbrudt. P41 adgangskrav. P42 ny hændelse `load_changed`. P43 E1 Basis og E9 Imponerende. P44 overlejringer gælder fra start. P45 RDL dagen før en begivenhed kun med vægt. P46 konverteringen af programdata. P47 sæt pr. side logges side for side. P48 motorens trafiklys før start. P49 timere uden længde i kilden. P50 målinger i pas.
- Rettelser i `ENGINE.md` fra selvreviewet: R12 (nye scenarier S-HOLD-04, S-EMOM-06, S-VARIANT-01, S-WEEK-11, S-WEEK-12, S-EVENT-02, S-MEAS-04, S-MEAS-05, S-IMP-02, S-HERO-02).
- Beslutninger: D19–D33.

## 7. Ændrede filer

- Dokumenter: `CLAUDE.md`, `docs/DECISIONS.md`, `docs/ENGINE.md`, `docs/PLAN.md`, `docs/SPEC.md`, `docs/reviews/m1-selfreview.md`, `docs/reviews/m2-design-review.md`, `docs/runs/NAT-1.md`, `docs/runs/NAT-1-LOG.md`, `docs/runs/NAT-1-REPORT.md`, `probe/RESULTS.md`
- Programdata: `program/program.json`, `program/sessions/{A,B,motor,os,travel}.json`, `program/tracks/*.json` (20 spor), `program/{weeks,measures,overlays,impress,heroes,side_branches,bosses,pictos,routines}.json`
- Motor: `src/engine/{types,program,lookup,dates,derive,weeks,plan,session,moves,layout,catalog,explain,format,data,simulate,index}.ts`, `src/engine/migrations/index.ts`, `src/engine/__tests__/*` (12 testfiler og 2 hjælpere)
- Lager: `src/storage/{idb,mirror,store,persist}.ts`, `src/storage/__tests__/store.test.ts`
- App: `src/main.tsx`, `src/env.d.ts`, `src/ui/{App.tsx,model.ts,hooks.ts,ids.ts,format.ts,audio.ts,wakelock.ts,sw.ts,persist.ts,theme.css,app.css}`, `src/ui/timers/clock.ts`, `src/ui/components/Picto.tsx`, `src/ui/screens/{Onboarding,Today,Week,Ladders,More,History,ProgramPage}.tsx`, `src/ui/session/{Runner,OpenStrong,Summary,MeasureInput,timers}.tsx`, `src/ui/session/steps.ts`
- Byg og test: `package.json`, `index.html`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `eslint.config.js`, `scripts/{convert-program,simulate,copy-routes,make-icons}.ts`, `e2e/{helpers,m2.spec,week1.spec,tabs.spec,perf.spec,program.spec,sw-scope.spec}.ts`
- Filer: `public/icon-192.png`, `public/icon-512.png`, `public/keep-awake.webm`, `screenshots/*.png` (12)

Motoren rørt: ja.
