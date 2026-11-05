# DECISIONS.md – Beslutningslog

Kort log over beslutninger, der former appen. Nye rækker tilføjes nederst i hver tabel; intet slettes. Markeringer: **Afvigelse** (A) = ændring af programmet, **Tilføjelse** (T) = funktion uden for programmet, **Præcisering** (P) = entydig regel, hvor PDF'en var tvetydig.

## 1. Arkitektur og platform

| Dato | ID | Beslutning | Alternativer | Begrundelse | Konsekvens |
|---|---|---|---|---|---|
| 2026-11-05 | D1 | PWA i IronFox, GitHub Pages fra offentligt repo. Fallback: Vanadium → Capacitor-APK via Actions | Native Android-app fra start | Nul installation for brugeren; Opus kan bygge og teste alt i skyen; Firefox for Android kan installere PWA'er. Datasikkerhed afgøres i M0 | Platformen er ikke endelig, før `probe/RESULTS.md` er udfyldt. Capacitor bevarer koden, hvis PWA fejler |
| 2026-11-05 | D2 | Preact + TypeScript + Vite + vite-plugin-pwa; motor i ren TS; Vitest + Playwright | Svelte 5; React | JIT er slået fra i IronFox; lille bundle og lidt startarbejde. Preact er React-mønstret, som Opus kender | Budget ≤ 150 kB gz JS. Ingen UI-, animations- eller dato-biblioteker |
| 2026-11-05 | D3 | Program som versioneret JSON med stabile ID'er; brugerdata som tilføj-kun hændelseslog; motorens beslutninger gemmes som hændelser med forklaring | Redigerbart tilstandsdokument | Eksport, import, undo, tidsmaskine og programversion 2 bliver trivielle; regelrettelser ændrer aldrig historikken | Tilstanden afledes ved start; alle motorfunktioner tager `today` som parameter |
| 2026-11-05 | D4 | Startdato fast; programugen rykker kun frem ved gennemført uge; sprunget uge → sidste gennemførte uge gentages (PDF s. 47); tre sprungne → alle stiger ét trin ned | Kalenderlåst 12-ugers-plan | Programmets egen regel og brugerens valg (svar 1) | Slutdatoen flytter sig; jul/nytår er datobundne overlejringer uafhængigt af programugen |
| 2026-11-05 | D5 | Web Audio-toner, vibration som supplement, Screen Wake Lock med video-fallback; hold/EMOM/intervaller uden berøring; ingen tale; ingen notifikationer; valgfri .ics | Lydfiler; TTS; web push | IronFox blokerer notifikationsprompter; TTS-stemme er ikke garanteret; toner er høje og offline | M0 tester lyd på gulv, vibration på tæppe og Wake Lock |
| 2026-11-05 | D6 | PDF'ens identitet (thai-rød, navy, Kanit, Bai Jamjuree) i ét eksplicit lyst højkontrast-tema; forbudte mønstre navngivet | Nyt mørkt tema | IronFox tvinger lyst tema; sollys og gulv kræver kontrast; genbrug sparer en designrunde | Mørkt tema er ikke i v1 |
| 2026-11-05 | D7 | Backup: download til Downloads som standard, Web Share som ekstra knap hvis M0 viser, at den virker; påmindelse efter 7 dage og måleuger; ingen auto-download | Auto-download efter hvert pas | Daglig download-støj ignoreres; brugerens valg (svar 7) | Eksportfilen indeholder hele loggen og programversionen |
| 2026-11-05 | D8 | Rækkefølge: M0 probe → M1 motor → M2 første brugbare version (I dag, pas, logning, trafiklys, indfasning, backup) → M3 livet + tidsmaskine → M4 målinger og mål → M5 polering → M6 piktogrammer (valgfri) | Alt på én gang | Motoren kan være forkert på en måde, brugeren ikke ser; brugeren træner fra 9/11 og skal have en brugbar version hurtigt | Tidsmaskinen flyttes frem til M3 (brugerens ønske) |
| 2026-11-05 | D9 | Offentligt repo uden navn, klub, logdata eller PDF; PDF'en læses lokalt, men committes ikke | Privat repo + Cloudflare Pages | GitHub Pages er gratis kun for offentlige repos; brugerens accept (svar 3) | `.gitignore` holder PDF og backups ude |
| 2026-11-05 | D10 | Playwright kører Firefox-motoren; Chromium som fallback med tydelig besked | Kun Chromium | Telefonen kører Gecko; men miljøet kan mangle Firefox | Telefonen er den endelige test |
| 2026-11-05 | D11 | Hjælpepakker ved opsætningen: `@preact/preset-vite` (Preact i Vite), `workbox-window` (kræves af vite-plugin-pwa's registrering), `typescript-eslint`, `@eslint/js`, `eslint-config-prettier`, `globals` (eslint) og `@types/node` (konfiguration og scripts). TypeScript 6.0 i stedet for 7.0 | TypeScript 7 uden typebevidst lint; Vite uden Preact-preset | Standardopsætning; kun `workbox-window` kommer med i det, browseren henter. typescript-eslint understøtter kun TypeScript < 6.1 | Skift til TypeScript 7, når typescript-eslint understøtter det |
| 2026-11-05 | D12 | TS-scripts (`scripts/*.ts`) køres med Node 24's indbyggede type-stripning (`node scripts/x.ts`). `tsconfig.json` har `erasableSyntaxOnly` og `allowImportingTsExtensions`; kode, som scripts importerer (motoren fra M1), skriver relative imports med `.ts`-endelse | `tsx` som ekstra afhængighed | Ingen ny afhængighed; virker ens i PowerShell, cmd og Actions | Node ≥ 24 kræves (`engines`); ingen `enum` eller `namespace` |
| 2026-11-05 | D13 | Proben er et separat Vite-projekt i `probe/` (egen `vite.config.ts`, deler `node_modules`) og bygges til `dist/probe/` efter appen. Appens service worker udelader `/comeback/probe/` fra precache og navigationsfallback, og appen registrerer ikke sin service worker før M2 | Eget `package.json` til proben; appens service worker aktiv fra start | Proben skal afprøve én service worker ad gangen, uden at appens griber ind | M2 registrerer appens service worker med samme undtagelse, så længe proben er i brug |
| 2026-11-05 | D14 | Probe-rækker, der kræver en handling, viser grå »VENTER«, indtil de er prøvet, derefter GRØN eller RØD. Grænser i punkt 8: første tegning ≤ 1.000 ms (SK1) og afspilning af 1.000 hændelser ≤ 100 ms i snit over mindst 1 sekunds kørsler (uret kan være grovere med IronFox' privatlivsindstillinger). Punkt 10 er altid grønt (kun aflæsning) | Kun grøn/rød fra start | Et punkt, der ikke er prøvet, er hverken bestået eller fejlet | – |
| 2026-11-05 | D15 | Probens build er deterministisk (ingen tidsstempler), så udgivelser, der ikke ændrer proben, ikke viser »Ny version klar«. v2 = versionsnummer 2 og baggrund `--c-blueTint`. Start-URL'en har `?source=pwa`, så proben kan se, at den er åbnet fra ikonet | Byggetid i versionsnummeret | Punkt 4 må kun udløses af den rigtige v2 | Indtil M0 er afsluttet, ændrer andre opgaver ikke `probe/`, `src/ui/design-tokens.json` eller versionerne af `preact` og `workbox-window`; ellers viser v1 »Ny version klar« uden at være v2 |
| 2026-11-05 | D16 | Fallback-videoen i proben er en synlig, tavs 64 × 36 px WebM (VP8 med tavst Opus-spor, 2 sek, `loop`, `muted`) i stedet for 1 × 1 px | 1 × 1 px uden lydspor | Firefox holder efter sin kildekode kun skærmen tændt for video med lydspor (eller fra en mediestrøm); en synlig video viser også, at den kører | M2 bruger den variant, proben viser virker |
| 2026-11-05 | D17 | Lydene i proben: firkantbølge med styrke 0,8; tik 880 Hz i 60 ms; go 660 Hz og 990 Hz à 100 ms (»200 ms« læst som samlet længde); slut tre stigende toner. »Test på gulvet« spiller tik-tik-tik-go-slut efter 5 sek og vibrerer uden nyt tryk, som timerne i appen vil gøre | Sinusbølge; lyd straks ved tryk | Kraftigst mulige lyd uden forvrængning, og telefonen skal kunne ligge på gulvet, når lyden kommer | M2 justerer efter dine noter fra tjeklisten |
| 2026-11-05 | D18 | Beslutningsreglen i M0 nævner ikke punkt 3 alene. Rødt punkt 3 i IronFox behandles som rødt 1, 2 eller 4 (proben køres i Vanadium), og »begge rødt« betyder rødt i både IronFox og Vanadium | Ignorere punkt 3 | Appen skal virke offline; forsigtigste læsning | Står også i `probe/RESULTS.md`. **Rettet af D20** |
| 2026-11-05 | D19 | Platform = IronFox-PWA. Punkt 1, 2 og 4 er grønne i IronFox 159.0.1 på telefonen (`probe/RESULTS.md`); Vanadium og Capacitor bruges ikke. Lukker O1 | Vanadium; Capacitor-APK | Beslutningsreglen i M0 | M2 får intet Capacitor-trin. M0 er afsluttet, så D15's begrænsning for `probe/`, tokens og versioner er ophævet; proben bliver liggende på `/comeback/probe/` |
| 2026-11-05 | D20 | Retter D18: punkt 3 (offline) afgør ikke platformen. Offline er en bonus for brugeren og ikke et krav; appen beholder offline-funktionen (precache, ingen netværkskald) | D18 (punkt 3 som 1, 2 og 4) | Punkt 3 blev ikke gyldigt testet (wifi tændt i flytilstand), og brugeren har afgjort, at offline ikke er et krav (NAT-1) | Offline testes ikke igen som krav; SK1-målingen sker uden netværk |
| 2026-11-05 | D21 | Ingen vibration, kun lyd: `navigator.vibrate` findes ikke i IronFox. Appen kalder ikke vibrationen | Vibration med funktionstjek | M0 punkt 6 | Erstatter »vibration som supplement« i D5 og `SPEC.md` afsnit 5; timere giver kun lyd |
| 2026-11-05 | D22 | Ingen »Del«-knap: Web Share findes ikke i IronFox. Backup er kun download til Downloads og import fra fil. Lukker O2 | Knappen med funktionstjek | M0 punkt 9 | `SPEC.md` 3.6 uden »Del backup« |
| 2026-11-05 | D23 | `persist()` viser en prompt i IronFox (brugeren tillod i M0). Appen kalder den efter første loggede pas, som `SPEC.md` 9 planlægger, og viser resultatet under Mere → Backup. Lukker O3 | Kald ved første start | En prompt midt i onboardingen er forvirrende; efter første pas er der data at beskytte | – |
| 2026-11-05 | D24 | Wake Lock via API'et; fallback-videoen fra D16 bruges kun, hvis API'et afvises eller frigives. Lukker O4 | Kun video | Begge holdt skærmen tændt i 3 min (M0 punkt 5) | – |
| 2026-11-05 | D25 | Telefonens profil er målt: 414 × 847 CSS-px, devicePixelRatio 2 (standalone), sprog en-US (spoofet), tidszone Europe/Copenhagen, JIT slået fra. Playwright-projektet `pixel9a` bruger den (Firefox med `firefoxUserPrefs`, der slår JIT fra); `pixel9a-utc` kører @date-testene igen med tidszone UTC, og Vitest kører datotestene i både Europe/Copenhagen og UTC. Preview-serveren og Playwright bruger `127.0.0.1`. Lukker O5 | 412 × 915, DPR 2,625 fra databladet | M0 punkt 7 og 10; godkendt M0-forslag (NAT-1). Firefox brugte 2 sek på `localhost` (IPv4 før IPv6), hvilket ville forfalske SK1-målingen | Layoutet tegnes til 414 px; `CLAUDE.md` og `SPEC.md` rettet |
| 2026-11-05 | D26 | Lint-regel: `Date.now()`, `new Date()` uden argument og `Math.random` er forbudt i `src/engine/` (eslint `no-restricted-syntax`/`no-restricted-properties`) | Kun kodegennemgang | Godkendt M0-forslag (NAT-1); motoren skal være deterministisk | Hændelses-id'er dannes uden for motoren og gives til den som funktion |
| 2026-11-05 | D27 | Pages-adressen indeholder kontonavnet og skrives ikke i filer i repoet (jf. commit d5c3d32). Rapporter skriver `https://<konto>.github.io/comeback/`; den fulde adresse står kun i chatten | Fuld adresse i rapporten | `CLAUDE.md`: ingen navne i det offentlige repo; NAT-1 beder om URL'erne i rapporten – forsigtigste læsning | – |
| 2026-11-05 | D28 | Milepæl 2 bygges i samme nat som milepæl 1 for at nå programstarten mandag 9/11. Fable-review 1 sker efter natten og bygger på M1-resultatet; rettelser fra review 1 indarbejdes bagefter i `ENGINE.md`, tests og kode | Vente på review 1 før M2 | Brugeren træner fra 9/11 og skal have en brugbar version (NAT-1) | M2 kan få rettelser efter review 1; motoren ændres kun med test |
| 2026-11-05 | D29 | Tidsmaskinen (`SPEC.md` 3.7, `ENGINE.md` 5.14, S-TIME-01..03) flyttes fra M3 til M2 og bygges lige efter kernen (onboarding, I dag, Styrke A). Lagerlaget bygges fra starten, så det kan åbnes skrivebeskyttet, og tidsmaskinen kører på en kopi af loggen i hukommelsen | Tidsmaskinen i M3 som planlagt | Programmet starter først 9/11; uden tidsmaskinen kan brugeren ikke prøve et pas på telefonen før (brugerens tilføjelse til NAT-1) | Med i nattens acceptkriterier (Playwright tæller hændelser før og efter) og i tjeklisten til telefonen; `PLAN.md` M2 og M3 rettet |

## 2. Brugerens svar på fase 1 (2026-11-05)

| Nr. | Beslutning |
|---|---|
| 1 | Programugen skifter efter PDF s. 47: sidste gennemførte uge gentages. Gennemført uge = mindst Styrke A eller B (også gult) |
| 2 | Indfasning under 5 minutter: startdato, gennemførte uger, trin og seneste reps pr. stige, uge-1-målinger. Pas for pas bagud er valgfrit |
| 3 | Offentligt repo uden personlige oplysninger |
| 4 | Ingen fast sparring. »Dagen før sparring« gælder kun begivenheder, brugeren selv lægger ind (A1). Klubtræning logges valgfrit med indhold og hårdhed (T1) som input til næste dags trafiklys |
| 5 | Fremmøde antages; klublog og lørdagskarakter i samme dialog |
| 6 | Gule pas og lette uger er neutrale for progression; kun grønne pas tæller og nulstiller. Egne trinvalg logges med én advarsel |
| 7 | Backup til Downloads; Web Share som ekstra, hvis M0 bekræfter |
| 8 | Søndagstjek som ugens eneste faste rutine; valgfri .ics-knap (tirsdag, torsdag, fredag, søndag) |

## 3. Afvigelser og tilføjelser

| ID | Type | Beslutning | Begrundelse |
|---|---|---|---|
| A1 | Afvigelse | »Aldrig tunge ben, Nordic eller intervaller dagen før sparring« (s. 47) gælder kun dagen før en begivenhed, brugeren har lagt ind (fx kamp). »Tunge ben« = power-ben og ben-stigen | Sparring kendes først bagefter; enhver klubtræning kan være hård, og Styrke A/B er bygget til det med reserve og trafiklys |
| T1 | Tilføjelse | Klublog efter hver klubtræning: indhold, hårdhed, overskud, lørdagskarakter | Programmet nævner kun karakteren; de øvrige felter giver trafiklyset en hint og gør flad-reglen (s. 39) entydig |
| T2 | Tilføjelse | Indfasning med gennemførte uger, trin, seneste reps og målinger | Appen tages i brug efter programstart |
| T3 | Tilføjelse | Automatisk gendannelse af trinnet 7 dage efter en skarp-smerte-nedrykning, hvis ingen ny smerte | »Gå et trin ned i en uge« (s. 7, 46) siger ikke, hvordan man kommer op igen |
| T4 | Tilføjelse | Rejsepasset tæller ugen som gennemført, men er neutralt for progression | Programmets minimum på rejse (s. 47) skal ikke koste en gentaget uge |
| T5 | Tilføjelse | Tidsmaskine på en kopi af loggen med skrivebeskyttet lager | Brugerens testbehov; aldrig risiko for de rigtige data |
| T6 | Tilføjelse | Mere → Om → »Diagnose«: version, service worker, varigt lager, lagerplads, Wake Lock, lydtilstand, viewport, tidszone, sprog og tiden til første tegning og til I dag | En fejl kan rapporteres med ét skærmbillede (NAT-1) |

## 4. Præciseringer af programmets regler

| ID | Regel (PDF-side) | Præcisering |
|---|---|---|
| P1 | Dobbelt progression (8) | Hit = alle sæt (begge sider) ≥ trinnets max med reserve ≥ 2 i et grønt, fuldt logget pas uden for let uge. Miss = kvalificerende pas uden hit → tælleren nulstilles. Gult, rødt, rejse, afbrudt-før-blokken og let uge er neutrale. To hits i træk → næste trin, arbejdstal = min |
| P2 | »Læg reps til fra gang til gang« (8) | Arbejdstallet stiger med 1 rep (hold: 5 sek), når alle sæt ≥ arbejdstal og reserve ≥ ugens plan; ellers gentages det. 12-12-11 er ikke et hit; reserve 1 ved max er ikke et hit, men stiger arbejdstallet i uger med reserve-plan 1 |
| P3 | Hold +5 sek (8) | Trinskift for hold-øvelser følger samme to-pas-regel som reps |
| P4 | Power (8, 23, 24) | Ét spørgsmål pr. pas: »alle reps lige høje og hurtige«. Ja → +1 rep i intervallet; ja ved max to gange i træk → næste trin; nej → tæller nulstilles |
| P5 | EMOM (25) | Oprykning sker ved næste EMOM-pas, aldrig i samme; højst én pr. programuge; ≤ ugens loft. Uge 1 er låst til E1. Let uge er burpee-test; en ventende oprykning bevares. I runde ≥ 2 er loftet mindst trinnet ved rundens start |
| P6 | Klubsekvensen (13) | Trin C1–C6 (2×1, 2×2, 1×3, 5 i træk, 5 på knoer, 5 som diamond). To rene B-pas i træk → næste trin |
| P7 | Nakke (34) | »Let« to gange i træk i grønne pas → næste trin. »Stop« afbryder blokken med lægeadvarsel |
| P8 | »Senere med rygsæk« / »læg mere i tasken« (15, 17, 18) | Læg, rygsæk-row og RDL (spor med ét trin): to hits i træk → +2 kg (kan rettes), arbejdstal = min. Bulgarsk med rygsæk (`legs.3`) følger stigen som andre trin (to hits → `legs.4`); rygsækkens vægt er brugerens eget felt |
| P9 | Wall sit W3 (17) | Runder = ugens sæt-tal; to rene pas med 3 runder → W4 |
| P10 | Ugetabellen (37–38) | »3–4 sæt« i uge 5 = 3 med valgfri +1 på par 1–2. »4 sæt på par 1 og 2« i uge 6–7 = 3 på øvrige blokke. »1–2 i reserve« = plan 1, men hit kræver 2, og »Som planlagt« logger 2, når arbejdstallet er trinnets max. Interval-blokke får `min(interval.max, ugens øvrige sæt)` |
| P11 | »Bagefter rykker du op« i lette uger (36) | Oprykning sker løbende, når kriteriet er nået; lette uger er neutrale, så oversigten efter en let uge er en status, ikke en handling |
| P12 | Flad i klassen (39) | En uge er flad ved klublog »Flad« eller lørdagskarakter ≤ 4. To i træk → næste uge 2/3 sæt (rund ned, min 2) på styrke og power, ingen EMOM-oprykning; udskydes forbi lette uger |
| P13 | Smerte (7, 46, 48) | Let (≤ 3) logges kun. Skarp eller i et led → ét trin ned i 7 dage, tæller nulstilles; ny skarp smerte forlænger 7 dage og viser Fysio-rådet. Søndagstjekkets »gør ondt, ikke væk« behandles som skarp |
| P14 | Gennemført uge og »missede du en uge« (47) | Gennemført = A, B eller rejsepas med status grøn/gul/rejse og par 1 fuldt logget. Programugen for næste kalenderuge = sidste gennemførte programuge, hvis ugen ikke blev gennemført. Tre uger i træk uden → alle stiger, EMOM og klubsekvens ét trin ned, én gang pr. fraværsperiode. Sygdom og ferie tæller som ikke gennemførte uger |
| P15 | Ny runde fra uge 5 (36) | Starter mandagen efter gennemført uge 12; ingen uge-1-målinger; målinger i uge 8 og 12 |
| P16 | Boss-udfordringer (45) | Fra uge 11 i runde 1 og hele runde 2; højst én pr. 28 dage; kun grøn; ikke dagen før en begivenhed |
| P17 | Skuldre trin 3 (14) | Trinnet er håndstandsholdet 3 × 20–45 sek, udført efter trin 2-dosis (fødderne på en stol); holdet er det, der progredierer |
| P18 | Rejsepas (47) | Push-ups, rygsæk-row, split squats og 6 min EMOM på `min(E3, dit trin)` |
| P19 | Målinger (40) | Erstatter første sæt i den målte øvelse; hollow og balance er selvstændige blokke; måle-sæt tæller ikke i progressionen |
| P20 | Flytning og hviledag (47) | Ingen to pas samme dag; aldrig på klubdag undtagen som kort version; A og B må tage motorens dag, og så udgår motoren den uge (»motor-passet ryger først«); mindst én hel hviledag, og en forbigået dag uden pas og klub tæller; A og B på to dage i træk tillades med advarsel |
| P21 | Flere Muay Thai-dage (47) | Hviledag først, så A, B, motor i rækkefølgen tir, tor, fre, man, ons, lør; motor udgår først; A og B som kort version på klubdage, hvis der ikke er plads |
| P22 | Burpee-varianter (26), sidegrene (13), Hero (42) | Varianter og sidegrene vælges manuelt med adgangskrav; Hero-felter krydses af af brugeren, appen viser kun hints |
| P23 | »Film dig selv hver anden uge« (9) | Påmindelse i søndagstjekket hver anden uge; ingen videooptagelse i appen |
| P24 | Datoer (SPEC 8) | Et pas hører til startdatoen; »i dag« beregnes i Europe/Copenhagen uanset browserens tidszone |
| P25 | »Var onsdagen brutal, så tag den rolige base« (31) | Klublog »Hård« dagen før en motor-dag med intervaller → rolig base som standard med valget »Kør intervallerne alligevel« |
| P26 | Pas-planen (ENGINE 3.1, 5.3) | `session_started` gemmer passets plan (blok, trin, sæt, arbejdstal, reserve-plan), så afspilningen vurderer passet mod det, der var planlagt, og et genoptaget pas bruger samme plan. Tilføjet felt (M1, 5/11) |
| P27 | Ugeplan (ENGINE 5.10) | Standardugen (A tirsdag, motor torsdag, B fredag) bevares, når de tre dage er frie, og der er en hviledag. Algoritmen i 5.10 bruges kun ved ekstra klubdage; uden undtagelsen ville den lægge B om torsdagen i standardugen |
| P28 | »done = alle sæt i par 1 logget« (ENGINE 4) | En blok, som smerte-reglen stoppede (skarp eller stop), tæller som logget for `done`, så et pas, der blev afbrudt efter reglerne, stadig kan gennemføre ugen |
| P29 | Trinnets dosis (ENGINE 7.1–7.2) | `dose` gemmes som i stigens tabel (fx 3 × 6–12, 2–3 × 3–5). Antal sæt i et pas kommer fra ugetabellen og blokken (6.3). Eksemplet i 7.2 med `sets: [3, 4]` følges ikke, så data kan sammenlignes ord for ord med kilden |
| P30 | »3 (+1 valgfrit)« (37) | Kun de planlagte sæt (pr. side) tæller for progression; et valgfrit ekstra sæt kan hverken give eller tage et hit |
| P31 | Målinger på en gul dag (40) | På en gul dag udgår målingerne (ingen max-forsøg på en dårlig dag). Målinger, der ikke blev taget i måleugen ved et logget pas, tilbydes ved næste grønne pas af samme slags ugen efter (ikke burpee-testen og motorens distance). Rettet ved selvreview F4 (S-MEAS-05) |
| P32 | Klubsekvensen i let uge (ENGINE 5.6) | 1 runde i alt (1 sæt × 1 runde) |
| P33 | Boss i lette uger (45) | Ingen boss-udfordring i lette uger, hvor EMOM'en allerede er erstattet af burpee-testen |
| P34 | Ny skarp smerte (ENGINE 6.5) | Så længe et midlertidigt trin er aktivt (også efter `until`, indtil det er gendannet), forlænger ny skarp smerte med 7 dage fra den nye dag og viser Fysio-rådet; trinnet går ikke længere ned. Forlængelsen skrives som `step_changed` med samme `from` og `to` |
| P35 | Nakke-stigen (ENGINE 6.2) | Arbejdstallet bliver på trinnets minimum (6.2 har ingen target-regel for nakke); trinskift sker kun efter »let« to gange i træk |
| P36 | EMOM-oprykning (ENGINE 5.4) | Et kvalificerende A-pas sætter `pendingUp = ren ∧ 20 sek pause`; et urent pas annullerer en ventende oprykning. Oprykningen sker kun, når pasets plan indeholder EMOM'en (ikke gul dag, ikke boss), aldrig over ugens loft, aldrig ned, og ikke i en uge med reduceret mængde (R-FLAT) |
| P37 | Tre uger uden (ENGINE 5.5, 5.7) | Tæller kun uger fra onboarding-ugen. Alle spor med trin (stigerne, power, EMOM, klubsekvens, nakke) får én `step_changed` med årsag `absence`; spor på trin 1 bliver på trin 1 med arbejdstal = min. Læg, etbens RDL og rygsæk-row får −2 kg (ikke under 0), arbejdstal = min og hits = 0 via `load_changed`. Burpee-varianter ændres ikke. Rettet ved selvreview F6 (S-WEEK-11) |
| P38 | Rejsepas (47, P18) | Rejsepasset bruger dine egne trin på pres og rygsæk-row; benene er split squat-trinnet, højst `legs.3`, med arbejdstal = min, når dit trin er højere; ugens sæt og 6 min EMOM med reps fra `min(E3, dit trin)`. Rettet ved selvreview F7 (S-WEEK-12) |
| P39 | Motor-faser (31–32) | Base-uger er ét samlet ur (uge 3: base 40 min, derefter 4 stigningsløb). Intervaller og kamp-runder: 10 min opvarmning, 3 stigningsløb (uden fast længde i kilden: brugeren trykker, når de er gjort), hoveddel, 5 min nedjogging. Sprints: 2 serier af 6 × (8 sek + 30 sek gang) med 3 min pause. Rolig base i stedet for intervaller er 30 min |
| P40 | Et pas, der aldrig blev afsluttet | Et pas, der står åbent fra en tidligere dag, afsluttes som afbrudt ved næste dags beregning, så dets sæt tæller (S-DP-11's regel) |
| P41 | Adgangskrav (ENGINE 5.12) | Et præstationskrav i imponer-kataloget og sidegrenene (fx »3 × 8 archer pr. side«) er opfyldt, når sættene er logget eller dit trin er højere, og kun så længe dit nuværende trin mindst er kravets trin. Hero-hints og Målbrættets ben-række kræver loggede sæt. Rettet ved selvreview F8–F9 (S-IMP-02, S-HERO-02) |
| P42 | Rygsækkens vægt (P8, R-LOAD) | Ny hændelse `load_changed` til motorens +2 kg og brugerens egen rettelse af vægten (ENGINE 3.1 har ingen hændelse til vægt) |
| P43 | Burpee-trappens niveauer (11) | E1 er Basis og E9 Imponerende (side 11: »Start« og »Imponerende« for Burpees); E2–E8 har intet niveau |
| P44 | Overlejringer (ENGINE 5.8) | Forslaget gælder, indtil brugeren vælger »Vælg anden«; planen viser altså standardløsningen fra start |
| P45 | »B uden etbens-RDL med rygsæk« (ENGINE 5.1) | Dagen før en begivenhed udgår etbens RDL kun, når der er vægt i rygsækken |
| P46 | Konvertering af programdata (M1) | Navne, doser og udførelse er ordret fra kilden (fed skrift fjernet). Spor uden tabel: læg = »Etbens tåløft på et trappetrin«, etbens RDL = »Etbens RDL«, rygsæk-row = træk trin 1's tekst + »Læg mere i tasken, når du rammer 15.«; EMOM-trin hedder »EMOM 4 × 3« osv. (side 11) med udførelsen »N minutter med M burpees i starten af hvert minut«; klubsekvensens fem dele står i sporets note. Cues er de første én–to sætninger af udførelsen. Coach-, Fysio- og Evidens-bokse hører til sidens tabel-spor. Hero-felterne har kravet i `ready`. Nordic-målingens »Sådan« er taget fra posterior.4, fordi side 40 ingen har. Piktogrammer: kun stigens egne eller nærmeste |
| P47 | Sæt pr. side (SK2, SPEC 3.2) | Øvelser pr. side/ben logges side for side: venstre, så højre, hver med ét tryk på »Som planlagt« og uden pause imellem; pausen kommer efter højre side. Ét tryk logger altså én side |
| P48 | Trafiklys før motoren (SPEC 3.3) | Motoren har ingen opvarmning med trin 4, så alle tre spørgsmål stilles før start. Ved styrkepas kommer spørgsmål 3 efter opvarmningens trin 4, og `session_started` skrives først da |
| P49 | Timere uden fast længde i kilden (SPEC 3.2) | Klubsekvensen: 5 sek klar, holdene 3 sek, mikro-pumps 8 sek, »helt ned og helt op« 4 sek, 2 min pause mellem sæt. Nakke-stigen: 10 sek pause mellem hold; »pr. retning« = fire retninger efter tur. Stigningsløb har ingen længde i kilden: brugeren trykker »Videre«. Open & Strong: 60, 45, 80, 40, 56 og 95 sek. Max-tid (hollow, sideplanke, wall sit, balance) måles med et stopur |
| P50 | Målinger i pas (5.6) | En måling, der erstatter første sæt, vises som eget skridt med forrige værdi og Målbrættets niveau og kan springes over; så tæller de planlagte arbejdssæt alene |

## 5. Åbne punkter (afgøres af M0 eller senere)

| ID | Punkt | Afgøres af | Status |
|---|---|---|---|
| O1 | Endelig platform (IronFox-PWA, Vanadium eller Capacitor-APK) | `probe/RESULTS.md` | Lukket 5/11: IronFox-PWA (D19) |
| O2 | Web Share som backup-knap | M0 punkt 9 | Lukket 5/11: ingen »Del«-knap (D22) |
| O3 | Om `persist()` giver en prompt på Android | M0 punkt 2 | Lukket 5/11: prompt; kaldes efter første loggede pas (D23) |
| O4 | Wake Lock i IronFox eller fallback-video | M0 punkt 5 | Lukket 5/11: API'et, video som fallback (D24) |
| O5 | Faktisk viewport-højde (fanelinje + indhold) | M0 punkt 10 | Lukket 5/11: 414 × 847 CSS-px, DPR 2 (D25) |
| O6 | Mørkt tema | Efter M5, hvis brugeren ønsker det | Åben |

## 6. Rettelser efter gennemgang mod PDF'en (2026-11-05, version 1.1)

| ID | Fil og sted | Rettelse | Grund |
|---|---|---|---|
| R1 | ENGINE 5.4, P8 | `legs.3` er ikke længere et load-spor | Som load-spor kom ben-stigen aldrig videre fra trin 3, så pistol (trin 6) og Målbrættets »5 pistols« var uopnåelige |
| R2 | ENGINE 5.9, S-MOVE-01, P20, SPEC 3.1, PLAN M3 | A og B må tage motorens dag; en forbigået dag uden pas tæller som hviledag | PDF'en prioriterer A og B over motoren (s. 47). S-MOVE-01 modsagde regel 4 og tjeklisten i M3 |
| R3 | ENGINE 3.1, S-DP-11 | `aborted` er et separat felt; `status` er stadig trafiklyset | Med `status: 'aborted'` kunne et afbrudt pas hverken give progression eller gennemføre ugen, som S-DP-11 kræver |
| R4 | ENGINE 5.3, 6.3, S-DP-12/13, P10 | »Som planlagt« logger reserve 2 ved max i uger med »1–2 i reserve« | Ellers nulstillede hvert »Som planlagt« ved max tælleren i uge 6–7 |
| R5 | ENGINE 5.2, S-TL-07, SPEC 3.3, PLAN M3, P25 | Klublog »Hård« før en interval-dag gør rolig base til standard | PDF s. 31: »var onsdagen brutal, så tag den rolige base« |
| R6 | ENGINE 5.1, S-EVENT-01, A1, PLAN M3 | Dagen før en begivenhed udgår også ben-stigen | »Tunge ben« (s. 47) er ben-stigen, ikke kun power-ben |
| R7 | ENGINE 6.1, SPEC 3.3 | Rød dag omfatter »under 4 timers søvn« | PDF s. 7 |
| R8 | ENGINE 8: S-IMP-01, S-FLAT-01/02 | Rettede forudsætninger | Wall walks kræver skulder trin 2, ikke pres trin 2. I standardforløbet er k7 en let uge, så S-FLAT-01 og S-FLAT-02 modsagde hinanden |
| R9 | SPEC 4.1 | Indfasningen omfatter rotation, klubsekvens og nakke samt uge 4-målinger | Brugeren har trænet efter PDF'en i flere uger, når appen tages i brug |
| R10 | SPEC 5 | Tokens-navnene står eksplicit; `--c-sand` er fjernet | Navnet findes ikke i `design-tokens.json` og lagde op til en cremetone |
| R11 | KICKOFF 0, 1 og 2 | Tilpasset Claude Code på brugerens pc | Repoet klones lokalt, og filerne ligger i `../comeback-handoff/` i stedet for at blive vedhæftet |
| R12 | ENGINE 8 og 9, P31, P37, P38, P41 | Nye scenarier fra selvreviewet af M1: S-HOLD-04, S-EMOM-06, S-VARIANT-01, S-WEEK-11, S-WEEK-12, S-EVENT-02, S-MEAS-04, S-MEAS-05, S-IMP-02, S-HERO-02; S-WEEK-07 og S-TIME-02 prøver mere. Sporbarheden i afsnit 9 er opdateret, og side 26 (R-VARIANT) har nu et scenarie | `docs/reviews/m1-selfreview.md` F1–F12: reglerne stod i ENGINE.md, men intet scenarie forhindrede afvigelsen |
