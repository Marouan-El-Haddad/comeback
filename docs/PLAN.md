# PLAN.md – Milepæle

Version 1.1 · 5. november 2026. Rækkefølgen er fast; en milepæl er færdig, når acceptkriterierne er opfyldt, testene er grønne, og du har gennemgået tjeklisten på telefonen. Opus laver alt i milepælen og ikke mere; fund uden for den rapporteres som forslag i opsummeringen.

**Hosting:** offentligt GitHub-repo `comeback`, GitHub Pages fra `main` via Actions, Vite `base: '/comeback/'`. Hver milepæl ender med en URL, du åbner i IronFox, og en kort tjekliste.

**Reviews med Fable:** efter M1 (motoren, før UI bygges på den), efter M2 (første brugbare version, efter en uges brug) og efter M5 (før »færdig«). Send mig `ENGINE.md`-afvigelser, testrapporten og dine noter fra tjeklisterne.

**Tidslinje:** du træner efter PDF'en fra 9/11. M0 og M1 kan køre parallelt i samme session (M1 afhænger ikke af telefonen). M2 er den første brugbare version og har førsteprioritet efter M1.

## Milepæl 0 – Teknisk afprøvning på telefonen

**Mål:** afgøre platformen med en lille probe-side, før noget stort bygges.

**Med:** et separat Vite-projekt i `probe/` (eget manifest, egen service worker, udgivet på `/comeback/probe/`). Siden viser én række pr. test med grøn/rød og en kort forklaring, som du kan læse op for mig:
1. Installation: er siden installerbar (manifest + service worker), og starter den i fuldskærm fra ikonet? (Vises som tekst: »Installér fra menuen, og åbn fra ikonet – står der STANDALONE her?«)
2. Lager: skriver et tal + tidsstempel i IndexedDB og localStorage ved første besøg og viser begge ved hvert besøg. Viser `navigator.storage.persisted()` og resultatet af `persist()` efter tryk på en knap.
3. Offline: knap »Test offline« → beder dig slå flytilstand til og genindlæse; siden skal stadig åbne.
4. Opdatering: proben har et synligt versionsnummer. Opus udgiver først v1, du installerer; så udgiver Opus v2 (ændret farve og nummer), og siden skal vise »Ny version klar«, opdatere ved tryk og stadig vise det gemte tal.
5. Wake Lock: knap starter `navigator.wakeLock.request('screen')` og viser status; fallback-video kan slås til separat. Du lægger telefonen i 3 minutter uden berøring.
6. Lyd: knap afspiller tik/go/slut-tonerne via Web Audio; vibration: knap kører 100 ms og 300 ms.
7. Tid og sprog: viser `Intl.DateTimeFormat().resolvedOptions().timeZone`, `navigator.language`, »i dag« beregnet med Europe/Copenhagen og `da-DK`, og klokken lokalt.
8. Ydelse: tid fra sidens start til første tegning, og et lille benchmark (afspilning af 1.000 syntetiske hændelser) i millisekunder.
9. Filer: »Eksportér« downloader en JSON-fil; »Importér« læser den igen og viser indholdet; »Del« prøver Web Share med en fil.
10. Viewport: `innerWidth × innerHeight`, `devicePixelRatio`.
Samme probe køres i Vanadium, hvis punkt 1, 2 eller 4 fejler i IronFox.

**Ikke med:** appen selv, design, motor.

**Acceptkriterier:** proben er udgivet i to versioner; alle ti punkter viser resultat (grønt eller rødt med forklaring); `probe/RESULTS.md` indeholder en tabel, du udfylder, og en beslutningsregel: alt grønt på 1, 2, 3, 4 → IronFox-PWA; 1, 2 eller 4 rødt → Vanadium; begge rødt → Capacitor-APK (M2 får da et ekstra trin: Capacitor-opsætning og APK via Actions).

**Automatiske tests:** ingen ud over lint og build. Playwright-røgtest: proben åbner og viser ti rækker.

**Tjekliste på telefonen:**
1. Åbn URL'en i IronFox; installer fra menuen; åbn fra ikonet. Står der STANDALONE?
2. Notér tallet under »Lager«. Luk appen helt (swipe væk), åbn igen: samme tal?
3. Genstart telefonen; åbn igen: samme tal?
4. Tjek IronFox: Settings → Delete browsing data on quit. Er den slået til? Hvilke punkter er markeret? Notér, og test punkt 2 igen med den slået fra, hvis den var til.
5. Tryk »Persist« og notér, om der kom en prompt, og hvad resultatet blev.
6. Flytilstand til, luk og åbn appen: åbner den?
7. Når jeg siger, at v2 er ude: åbn appen, vent på »Ny version klar«, opdatér. Samme tal under »Lager«?
8. Wake Lock: tryk, læg telefonen 3 minutter. Slukkede skærmen? Prøv fallback.
9. Lyd med telefonen på gulvet 1 meter væk; vibration med telefonen på et tæppe.
10. Læs tidszone, sprog, »i dag« og benchmark-tallet op. Eksportér, importér, del.

**Færdig når:** `probe/RESULTS.md` er udfyldt og platformen er valgt i `DECISIONS.md`.

## Milepæl 1 – Motoren og programdata

**Mål:** en komplet, testet motor og alt programindhold som data, uden UI.

**Med:** `src/engine` (typer, `deriveState`, `planFor`, `applyTrafficLight`, progression, regression, uger, flytning, layout, overlejringer, tidsmaskine-funktion, migrationer), `program/*.json` konverteret fra `PROGRAM_KILDE.md` (alle spor, trin, pas-skabeloner, uger, målinger, niveauer, sidegrene, imponer-katalog, hero, boss, overlejringer, piktogram-kortlægning), alle scenarier fra `ENGINE.md` afsnit 8 som Vitest-tests, `program.spec.ts` (trin-antal pr. spor mod tabellen i `ENGINE.md` 7.3), en simulering `scripts/simulate.ts`, der kører 12 uger med en syntetisk bruger og udskriver trin pr. uge. Telefon-leverance: en skrivebeskyttet side `/program` på Pages, der viser alle stiger og trin fra data, så du kan sammenligne med PDF'en.

**Ikke med:** I dag, guidet pas, lager i browseren.

**Acceptkriterier:** alle scenarier i `ENGINE.md` 8 findes som tests med samme ID i testnavnet; alle grønne; `program.spec.ts` grøn; simuleringen kører uden fejl og viser mindst ét trinskift pr. stige for en bruger, der rammer max hver gang; `ENGINE.md` 9 (sporbarhed) har ingen rækker uden test, bortset fra dem markeret »–«.

**Automatiske tests:** Vitest for motor og program; typecheck; lint.

**Tjekliste på telefonen:**
1. Åbn `/program`; slå tre tilfældige stiger op, og sammenlign dosis og udførelse med PDF'en.
2. Tjek, at ugetabellen viser 12 uger med sæt, reserve, power, motor og EMOM-loft som side 37–38.
3. Tjek, at målinger og niveauer stemmer med side 40–41.
4. Tjek, at imponer-kataloget og Hero-tavlen har 17 og 12 punkter.
5. Rapportér afvigelser til mig (ikke til Opus) – jeg reviewer motoren her.

**Færdig når:** Fable-review 1 er gennemført, og rettelser er indarbejdet i `ENGINE.md` og tests.

## Milepæl 2 – Første brugbare version

**Mål:** appen kan bruges til hvert pas fra og med dagen, den udgives.

**Med:** lagerlag (IndexedDB + spejl, skemaversion, `persist()` efter første pas), onboarding med indfasning (SPEC 4.1), I dag (3.1) med »pas i går blev ikke logget«-kortet, Uge (kun visning), guidet pas (3.2) for Styrke A, Styrke B, Motor (alle faser), Open & Strong, nakke og opvarmning, trafiklys (3.3) inkl. udledte svar og hint fra klublog (klublog-dialogen selv kommer i M3; hinten viser blot intet før), logning med »som planlagt«, reserve og smerte, hold-/pause-/EMOM-/klubsekvens-timere med lyd, vibration og Wake Lock, opsummering med motorens forklaringer, Stiger-fanen (visning + »vælg selv et trin«), Mere → Backup (eksport/import/»Sidste backup«), Om med version, opdateringsbanner, PWA-installation, designsystemet (SPEC 5) med fonte og piktogrammer.

**Ikke med:** historik ud over listen, målinger (uge 4 er først 30/11 – men tag dem med, hvis M2 er færdig før 27/11), lette uger (samme), Hero, imponer, boss, Turbo, klublog, søndagstjek, flytning, status, overlejringer, .ics, tidsmaskine.

**Acceptkriterier:** SK1, SK2, SK3, SK4 (minus opdateringstest, som gentages i M5), SK5, SK8, SK9 i `SPEC.md`; Playwright-flows: onboarding → I dag → Styrke A grøn start-til-slut med »som planlagt« på alle sæt → opsummering med forklaring; samme med gul; Open & Strong start-til-slut uden tryk (timere simuleret); eksport/import.

**Automatiske tests:** motor-tests uændrede og grønne; Playwright (Firefox-motor i 412 × 915; Chromium, hvis Firefox ikke kan installeres i miljøet – sig det i opsummeringen); lagertest med fake-indexeddb; visuel røgtest: skærmbilleder af I dag, pas-skridt, trafiklys, pause-timer gemmes i `screenshots/` og vedhæftes opsummeringen.

**Tjekliste på telefonen:**
1. Installer appen; gennemfør onboarding under 5 minutter med dine rigtige trin og uger.
2. Åbn fra ikonet: viser I dag det rigtige pas og den rigtige programuge?
3. Kør tirsdagens Styrke A fra start til slut. Skulle du røre skærmen under en hold-øvelse eller en pause?
4. Kunne lyden høres med telefonen på gulvet? Slukkede skærmen?
5. Log ét sæt med færre reps og »Skarp smerte« – giver opsummeringen en forklaring, og viser Stiger det midlertidige trin?
6. Luk appen midt i et pas, og åbn igen: fortsætter den samme sted?
7. Eksportér en backup; find filen i Downloads; importér den igen.
8. Genstart telefonen: er alt der?
9. Fredag: kør Styrke B inkl. klubsekvensen og nakke.
10. Notér alt, der føles klodset, i én liste til mig.

**Færdig når:** du har brugt appen en hel uge, og Fable-review 2 er gennemført.

## Milepæl 3 – Livet og tidsmaskinen

**Mål:** appen holder, når ugen ikke går som planlagt, og du kan teste kalenderlogikken selv.

**Med:** klublog-dialog og lørdagskarakter (SPEC 4.6), søndagstjek (4.7), sprunget pas/uge/tre uger (ENGINE 5.7), status syg/rejse/ferie/klubben lukket, begivenheder og »dagen før«-reglen, jul- og nytårsoverlejringer, flytning af pas (5.9), ugeplan med ekstra Muay Thai-dage (5.10), flad-reglen (5.11), rejsepas, smerte-gendannelse efter 7 dage, .ics-download, tidsmaskinen (SPEC 3.7) med skrivebeskyttet lager, historik-listen med klubtræninger.

**Ikke med:** målinger/lette uger (M4, medmindre de blev taget i M2), Hero, imponer, boss, Turbo.

**Acceptkriterier:** alle scenarier S-WEEK, S-XMAS, S-EVENT, S-FLAT, S-MOVE, S-EXTRA, S-TIME, S-TL-07, S-PAIN-02/03/05 er grønne og dækket af UI; tidsmaskinen kan ikke skrive til lageret (Playwright-test tæller hændelser før og efter); .ics-filen importeres korrekt i en kalender (valideret med en ics-parser i test).

**Automatiske tests:** motor; Playwright for klublog, søndagstjek, flytning, status, tidsmaskine.

**Tjekliste på telefonen:**
1. Åbn tidsmaskinen (langt tryk på versionen), sæt datoen til 21/12 2026: foreslår appen motor 23/12 og Styrke B 26/12?
2. Spring videre til 28/12: foreslår den målinger 29–30/12 (hvis programugen er 8)?
3. Simulér to uger uden pas: gentager den sidste gennemførte uge? Tre uger: rykker alle stiger ned med forklaring?
4. Afslut simuleringen: er dine rigtige data uændrede (samme »Sidste pas« i historikken)?
5. Sæt »Syg« i to dage: viser I dag kun Open & Strong?
6. Tilføj en begivenhed i morgen: fjerner appen power-ben, ben-stigen, Nordic og intervaller fra dagens pas?
7. Lad tirsdagens Styrke A gå uden at logge den: tilbyder appen onsdag torsdag (motoren udgår) og søndag som fulde dage og onsdag og lørdag kun som kort version?
8. Log onsdagens klubtræning som »Hård«: viser torsdagens trafiklys hinten, og foreslår motoren rolig base i stedet for intervaller (fra uge 5)?
9. Download .ics og importér i kalenderen: ligger tirsdag, torsdag, fredag og søndag rigtigt?
10. Tilføj en ekstra klubdag i ugeplanen: giver det en fornuftig uge?

**Færdig når:** tjeklisten er gennemgået, og de fejl, du fandt, er rettet med test.

## Milepæl 4 – Målinger, mål og motivation

**Mål:** lette uger, målinger og de langsigtede mål virker, og runde 2 kan starte.

**Med:** lette uger med målinger indbygget i passene (ENGINE 5.6), målinger med forrige værdi og Målbrættets niveau, »Ryk op«-oversigten, Hero-tavlen med hints, imponer-kataloget med adgangskrav og fredagens 5-minutters variant, sidegrene, burpee-varianter, boss-udfordringer, Turbo, fremgangskurver (trin over tid pr. stige, målinger U1/U4/U8/U12), runde 2 efter uge 12 med sammenligning.

**Ikke med:** nye øvelser, deling af resultater.

**Acceptkriterier:** S-MEAS, S-IMP, S-HERO, S-BOSS, S-TURBO, S-WEEK-10, S-EMOM-05 grønne og dækket af UI; en måleuge kan gennemføres uden at ændre nogen `hits`.

**Automatiske tests:** motor; Playwright for en komplet uge 4 (tirsdag, torsdag, fredag) i tidsmaskinen.

**Tjekliste på telefonen:**
1. I tidsmaskinen: gå til uge 4, kør tirsdagens pas: kommer væg-test, push-ups max, bord-rows max og burpee-test de rigtige steder?
2. Fredag: pike, hollow, sideplanke, wall sit, balance?
3. Viser målingerne forrige værdi og niveau?
4. Er imponer-kataloget låst/ulåst korrekt for dine trin?
5. Kryds et Hero-felt af og fjern det igen.
6. Vælg en boss-udfordring i uge 11 (simuleret) og log den.
7. Turbo: vælg en øvelse, og tæl tre sæt.
8. Gå til uge 13 i tidsmaskinen: starter runde 2 fra uge 5 med dine trin og sammenligningen?

**Færdig når:** tjeklisten er gennemgået uden åbne fejl.

## Milepæl 5 – Polering og afslutning

**Mål:** appen føles som et færdigt produkt og tåler opdateringer.

**Med:** ydelsespas mod budgettet (SPEC 7), designgennemgang af alle skærme mod SPEC 5 og listen af forbudte mønstre, lyd og haptik justeret efter dine noter, alle tomme tilstande og fejl (SPEC 4.13), opdateringstest (ny version uden datatab) med skemamigration v1→v2 (en reel, lille ændring), eksport-påmindelser, gennemgang af alle UI-tekster for sprog og konsistens, `README.md` med installation og opdatering.

**Ikke med:** nye funktioner.

**Acceptkriterier:** alle SK1–SK9; ingen åbne fejl fra M2–M4; build-rapport under budget; Playwright-sæt grønt; migrationstest S-DATA-04 grøn i UI.

**Tjekliste på telefonen:**
1. Opdatér appen fra den gamle version: banner, opdatering, alle data intakte.
2. Opstart fra ikonet under 1 sekund (varm) – tag tid.
3. Gennemgå alle skærme i sollys og på gulvet: kan alt læses?
4. Kør et helt pas uden at røre skærmen, hvor det er lovet.
5. Prøv alle fejlsituationer, du kan fremkalde (flytilstand, fuld lagerplads er svær – spring over).
6. Send mig din liste med alt, der stadig generer.

**Færdig når:** Fable-review 3 er gennemført, og `DECISIONS.md` er opdateret med den endelige platform og de åbne ønsker.

## Milepæl 6 (valgfri) – Manglende piktogrammer

**Mål:** alle trin har eget piktogram i PDF'ens stil.

**Med:** Opus bruger Python-motoren fra starter-kittet til at tegne de trin, der i `program/pictos.json` er markeret `fallback: true`, ét ad gangen, og lægger dem i `pictos/` med samme navnekonvention. Hvert piktogram leveres som PNG-forhåndsvisning til dig; du godkender eller afviser med en kort kommentar, før det tages i brug.

**Acceptkriterier:** `pictos.json` har ingen `fallback: true` tilbage; alle nye SVG'er bruger tokens-farverne; UI-tests grønne.

**Tjekliste:** gennemse hvert nyt piktogram i appen på det rigtige trin.

## Skabelon for en milepæl-besked til Opus

Se `KICKOFF.md` afsnit 2.
