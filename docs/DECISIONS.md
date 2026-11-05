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

## 5. Åbne punkter (afgøres af M0 eller senere)

| ID | Punkt | Afgøres af |
|---|---|---|
| O1 | Endelig platform (IronFox-PWA, Vanadium eller Capacitor-APK) | `probe/RESULTS.md` |
| O2 | Web Share som backup-knap | M0 punkt 9 |
| O3 | Om `persist()` giver en prompt på Android | M0 punkt 2 |
| O4 | Wake Lock i IronFox eller fallback-video | M0 punkt 5 |
| O5 | Faktisk viewport-højde (fanelinje + indhold) | M0 punkt 10 |
| O6 | Mørkt tema | Efter M5, hvis brugeren ønsker det |

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
