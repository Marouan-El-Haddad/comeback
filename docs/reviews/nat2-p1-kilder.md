# Review af NAT-2 P1 – Kilderne først: den nye retning og datamodellen for forklaringer og figurer

2026-11-06 · commits `60f3c10..e3dceb0` (57522ff, f4ce963, f2c1691, 680fb04, 4b71279, 7f7db92, e3dceb0)

Metode: Kilderne er læst mod feedbacken og pakke 1–6 i `docs/runs/NAT-2.md` og mod P1 i `docs/runs/NAT-2-TASKS.md`. Koden er læst mod `docs/SPEC.md` 1, 3, 5–7 og 9.1, `docs/DECISIONS.md` A2, T7–T9 og D36–D41, `docs/ENGINE.md` 1, 5.5, 8 og 9 og `docs/PLAN.md` M5 og M6. Kontrollerne og hele Playwright-suiten er kørt i worktreen. Desuden er der kørt scratch-tests uden for worktreen (ikke committet):

- valideringen mod forklaringer til hold, EMOM, runder, øvelser pr. side og pr. retning og rutinepunkter med flere bevægelser, skrevet ud fra programmets egne tekster;
- `findSourceRef` og `withoutSources` mod danske øvelsestekster og kildehenvisninger;
- et build af e3dceb0 med eksempelindhold i `content/` (testfixturerne til pres): indlæsning, precache, offline og byggetjekket med to mutationer;
- en før/efter-måling af opstarten mod 60f3c10;
- piktogrammernes albuer i `tools/pictos/poses.py`.

## Resultat

0 høj, 5 middel og 6 lav.

- **Retningen** står i SPEC 1, 3.2, 3.5, 3.6, 3.8, 3.9, 4.1, 5, 6, 7, 9.1 og 10, i DECISIONS (A2, T7–T9, D36–D41 og R13), i PLAN (M6 rykket frem og udvidet, tjeklister som Playwright-flows) og i `CLAUDE.md`. Afvigelsen og tilføjelserne er logget i DECISIONS afsnit 3. `program/` er ikke rørt, og `program-source.spec.ts` er grøn, så navne, doser, tempo og regler er uændrede. To dele af retningen mangler: øvelserne uden for spor og rutiner (M4) og sprogreglerne fra pakke 5 (L5).
- **Datamodellen** rummer alle felterne fra pakke 2, og figurformatet passer til `picto.py`, bortset fra at `facing` afløser `bend` i sidebilledet. Valideringen er grundig. I scratch-testene afviste den ingen gyldige hold, EMOM-trin, øvelser pr. side eller pr. retning eller rutinepunkter med flere bevægelser. Men runder kan ikke skrives i programmets tempo, fordi modellen ikke kan gentage en delbevægelse (M2). Desuden har tempotjekket to huller (M3), målingerne har ingen plads (M4), og opvarmningens »Potensér« afhænger af passet (M5).
- **Henvisningerne** er væk fra Om, »Hvorfor«, `/program/`, flad-uge-noten og motorens fraværsforklaring. Vitest læser al tekst i koden og i programdata, og Playwright læser skærmene. Mønstrene afviser dog almindelig øvelsestekst og overser nogle kildeformer (L2).
- **Motorændringen** følger ændringsprotokollen: ENGINE 1, 5.5 og S-WEEK-05 er rettet i samme commit som testen og koden. Testen kræver den nye sætning ordret og ingen henvisning, og SK5-testen tjekker alle `step_changed`- og `load_changed`-forklaringer over en fraværsperiode. Fravær tæller først fra indfasningsugen (P37), så brugerens rigtige log kan ikke rumme en gammel forklaring med »(side 47)«.
- **Indlæsningen** virker med indhold: JSON-filerne udgives for sig, precaches, hentes først af passet og virker uden net. Byggetjekket fanger en startfil, der importerer `load.ts`, men ikke indhold, der importeres direkte (L4). Opstarten er uændret.
- **D41** vælger den forsigtige læsning af »Første gang en øvelse kommer i passet« på det vigtigste punkt: i hvert pas, ikke kun første gang nogensinde. Men beslutningen bryder SK3 uden at rette den, og den siger intet om opvarmningen (M1).

## Fund

1. **M1 (middel)**: D41 bryder SK3 uden at rette den, opvarmningen er ikke afgjort, og PLAN M6 siger noget andet.
   - Hvor: `docs/DECISIONS.md:49` (D41), `docs/SPEC.md:17` (SK3) og `:105` (introkortet), `docs/PLAN.md:113` (M6's acceptkriterier).
   - Hvorfor: NAT-2 pakke 4 og SPEC 1, SK3.
     - At vise kortet ved første sæt i hvert pas er rigtigt: brugeren må aldrig blive overrasket af en ny øvelse, mens tiden går.
     - SK3 lover stadig, at hold, EMOM og Open & Strong kører »uden berøring af skærmen fra start til slut«. I dag starter hold, klubsekvens og nakke af sig selv efter pausen (`src/ui/session/Runner.tsx:1015–1036`, `1212–1230` og `1257–1298`). Efter D41 venter nedtællingen på et tryk. I Styrke B på trin 1 er det fire tryk midt i passet (sideplanke, wall sit, klubsekvens og nakke), og de kommer, lige når man skal i position.
     - D41 omtolker SK3 til »fra nedtællingen« i konsekvens-kolonnen, men SK3 er ikke rettet.
     - Opvarmningen er ikke nævnt. Dens fire punkter kører i dag som timere uden tryk, og »Mobilisér« og »Aktivér« rummer seks øvelser på fem minutter. P6 må gætte, om hvert punkt skal have et kort med tryk.
     - PLAN M6 kræver »Styrke A, Styrke B, motor og Open & Strong … med »Nu«, »Næste«, pause og introkort«, mens D41 siger, at Open & Strong og motoren intet introkort har.
   - Rettelse:
     - D41 og SPEC 3.2: vis introkortet i pausen før øvelsens første sæt, og lad det lukke ved et tryk eller af sig selv, når pausen slutter. Er der ingen pause (første øvelse efter opvarmningen), får kortet en kort »Gør klar«-nedtælling. EMOM'ens kort kan lukkes med »Start EMOM«. Så kører hold, klubsekvens og nakke stadig uden tryk, og SK3 holder. Vælges tryk-varianten alligevel, så ret SK3 ordret.
     - Skriv opvarmningen ind i D41, fx ét kort for hele opvarmningen, der lukker af sig selv, før den første timer går.
     - PLAN M6: »… med »Nu«, »Næste«, pause og introkort (introkortet kun i styrkepassene, D41)«.

2. **M2 (middel)**: Datamodellen kan ikke vise gentagne delbevægelser i programmets tempo.
   - Hvor: `docs/SPEC.md:351–359`, `src/content/types.ts:85–105` (`Phase`, `Movement`) og `src/content/validate.ts:86` (højst 12 faser).
   - Hvorfor: NAT-2 pakke 3 (»animerer mellem dem i øvelsens tempo«, »tempo som dosis«), `docs/PROGRAM_KILDE.md:229` og `:324–325` og DECISIONS P49.
     - Klubsekvensen (C1–C6, fredagens finisher) har »10 hurtige mikro-pumps i midten« på 8 sek (P49). Med de tre hold og vejen ned og op giver det 28 faser, og valideringen afviser over 12 (scratch-test: »skal have 1–12 faser (har 28)«). Den eneste anden vej er én `"dose"`-fase, men den er en stillestående stilling, så figuren står stille, mens timeren siger »pumps«.
     - Wall sit W2, »Hold garden, og slå rolige lige slag«: et hold kræver en `"dose"`-fase, og slagene kan ikke ske under den. Figuren holder stille i garden, så man kan tro, at armene også skal holde stille.
     - Samme mangel i W3 (»45 sek wall sit og direkte 20 kontrollerede squats«) og i opvarmningens »2 × 10 pogo-hop«.
     - SPEC 9.1 siger ikke, hvor længe en `"dose"`-fase varer i kortets animation, der kører i ring (et hold på 45–90 sek).
   - Rettelse: Tilføj `repeat` på en fase i SPEC 9.1, typerne og valideringen: `"repeat": 10` betyder frem og tilbage mellem forrige position og `to` 10 gange, og `"repeat": "dose"` betyder så længe holdet varer (slagene i W2). Fastlæg, at en `"dose"`-fase varer fx 2 sek i kortet og dosisens tid i passet. Læg klubsekvensen og W2 ind som eksempler i `validate.test.ts`.

3. **M3 (middel)**: Tempotjekket overser rutinernes dosis og fasernes egne labels.
   - Hvor: `src/content/validate.ts:57–64` (`subjectOf`: et rutinepunkt får kun `execution`) og `:323–327` (en label tjekkes kun for ord og tegn).
   - Hvorfor: SPEC 9.1, »Tempoet i dosis« (`docs/SPEC.md:359`), og NAT-2 pakke 3 (»tempo som dosis«).
     - Hage-ind i Open & Strong har dosis »8 × 5 sek« (`program/routines.json:80`), men dosis-teksten læses ikke. En forklaring, hvor hagen kun holdes i 2 sek, består (scratch-test).
     - En fase med label »3 sek ned« og `"seconds": 1` består, når en anden fase varer 3 sek (scratch-test). Teksten under figuren modsiger så animationen.
   - Rettelse: Tag `i.dose` med i `texts` for rutinepunkter, og kræv, at en label med »N sek« har `seconds` lig N (eller `"dose"`, når N er over 10). Tilføj begge tilfælde i `validate.test.ts`.

4. **M4 (middel)**: Målingerne i passet kan ikke få en forklaring eller en figur.
   - Hvor: `docs/SPEC.md:9`, `:169`, `:323` og SK11 (`:25`); `src/content/validate.ts:44–66` (`subjectOf`) og `:909–934` (`coverage`).
   - Hvorfor: SPEC 1 (»hver øvelse har et øvelseskort med en animeret figur«), SPEC 3.2 (»Nu« og »Næste« med figur og introkortet under hele passet) og SPEC 4.8 (målingerne ligger i passene i uge 1, 4, 8 og 12).
     - Væg-testen kommer før opvarmningen, og Hollow hold og Balance er egne skridt i Styrke B (`program/measures.json`, P19, P50, `e2e/week1.spec.ts`). Burpees 3 min afløser EMOM'en i de lette uger. I dag viser de kun programmets »Sådan« (`src/ui/session/MeasureInput.tsx:46`) og intet piktogram.
     - `subjectOf` kender kun spor og rutiner, så `content/explain/measures.json` bliver afvist, og SK11 tæller målingerne ikke med. P6 møder det med det samme, for Playwright-flowene for uge 1 starter med Væg-testen.
     - Det samme gælder senere imponer-varianterne (SPEC 4.9), boss-udfordringerne og sidegrenene.
   - Rettelse: Gør målingerne til et emne i SPEC 9.1, `subjectOf` og `coverage`, med `content/explain/measures.json`, `content/figures/measures.json` og ID'erne `measures.<id>`. En måling af et trin kan pege på trinnets forklaring og figur (fx `"like": "core_front.2"` for Hollow hold), og Væg-testen, Balance og Burpees 3 min skrives for sig. Føj dem til SK11 og til P2's liste.

5. **M5 (middel)**: Opvarmningens »Potensér« afhænger af passet, og modellen kan ikke udtrykke det.
   - Hvor: `program/routines.json:31–35` (`warmup.4`), `docs/SPEC.md` 3.8 og 9.1.
   - Hvorfor: `docs/PROGRAM_KILDE.md:564` og `:582` (»2 × 3 af dagens første power-øvelse … Tirsdag også 2 × 10 pogo-hop«) og NAT-2 pakke 2 (doser og regler ændres ikke).
     - Dagens første power-øvelse er power ben i Styrke A og power overkrop i Styrke B, og rejsepasset har ingen. Pogo-hop hører kun til tirsdag.
     - En forklaring har faste bevægelser. Træneren må derfor tegne én bestemt øvelse, og så viser »Nu« under fredagens opvarmning fx squat jump og pogo-hop, som ikke skal laves den dag.
     - Koden må ikke kende øvelser ved navn (`CLAUDE.md`), så P6 kan ikke rette det uden et felt i data.
   - Rettelse: Tilføj to valgfrie felter på en bevægelse i SPEC 9.1, typerne og valideringen: `"from": "power"` (bevægelsen er passets første power-trin, og kortet viser det trins navn, figur og faser) og `"sessions": ["A"]` (bevægelsen hører kun til de pas). Uden power-blok udelades bevægelsen.

6. **L1 (lav)**: `facing` er valgfri i sidebilledet.
   - Hvor: `src/content/types.ts:267–273`, `src/content/validate.ts:833–837`, `docs/SPEC.md:366–368` og fixturen `CORE_FRONT_FIGURES`, der udelader den.
   - Hvorfor: SPEC 9.1 lader albuer og knæ bøje »den anatomiske vej ud fra `facing`« men siger ikke, hvad der gælder uden. En spejlet push-up (hovedet til venstre) uden `facing` består (scratch-test). Bruger figursystemet 1 som standard, bøjer albuerne bagud, og P3's test »led bøjer den rigtige vej« kan ikke se det, fordi den bruger samme `facing`.
   - Rettelse: Gør `facing` påkrævet i sidebilledet (type, validering og SPEC 9.1), og lad kontaktarket vise brystets retning med en lille pil.

7. **L2 (lav)**: `findSourceRef` afviser almindelig øvelsestekst og overser nogle kildehenvisninger.
   - Hvor: `src/content/refs.ts:6–21`.
   - Hvorfor: A2 og SPEC 9.1, tekstreglerne.
     - »Skift side 2 gange«, »Hold 5 sek på hver side 3 gange« og »Læg dig på højre side 1 gang til« bliver afvist som sidetal.
     - »(Edwards et al. 2023)«, »(Edwards m.fl. 2023)«, »Ifølge Harøy 2019 …« og »En metaanalyse fra 2025 …« slipper igennem, og `withoutSources` fjerner ikke »(… et al. 2023)«.
     - Den midlertidige »Hvorfor« viser stadig »i en stor metaanalyse« (wall sit), »En metaanalyse fra 2025« (lyske) og »en genanalyse« (bagkæde). Det forsvinder, når P2 skriver sporenes egen `why`.
     - Vitest læser kun tekst, der står i koden. En skærm, der viser `pdfPage` (»side {track.pdfPage}«), fanges kun, hvis Playwright besøger den.
   - Rettelse: Lad et tal efter »side« ikke tælle som sidetal, når det efterfølges af »gang«, »gange« eller »sæt«. Tillad »et al.« og »m.fl.« i citatmønstret, afvis årstal (19xx og 20xx) i `content/`, og lad `no-source-refs.test.ts` fejle, hvis `src/ui/` læser `pdfPage`. Tjek i P2, at alle 20 spor får egen `why`.

8. **L3 (lav)**: Nakken kan ikke markeres rød.
   - Hvor: `src/content/types.ts:258` (`Segment`) og `src/content/validate.ts:562–567`.
   - Hvorfor: SPEC 5, Figurer (»thai-rød på de muskler, der arbejder«). Nakke-stigen (N1–N6) og hage-ind i Open & Strong træner nakken, men `Segment` har kun overkrop og lemmer, og mindst ét segment skal være rødt (scratch-test: »ukendt segment »neck««). Figuren må derfor markere en forkert muskel.
   - Rettelse: Tilføj `neck` til `Segment` og til figursystemet (en kort linje mellem skuldrene og hovedet).

9. **L4 (lav)**: Byggetjekket ser ikke indhold, der importeres direkte i en startfil.
   - Hvor: `scripts/bundle-size.ts:74–92`.
   - Hvorfor: SPEC 7 og D37 (»bygget fejler, hvis startfilerne henviser til en af dem«) og NAT-2 (opstarten må ikke blive værre).
     - Mutation A, `useExplain` importeret i `Today.tsx`: bygget fejler som lovet (»… is a start file and refers to content«, exit 1).
     - Mutation B, `import pressExplain from '../../../content/explain/press.json'` i `Today.tsx`: indholdet bliver lagt ind i `index-*.js` (24,1 → 24,9 kB), og bygget består med »(no content)«.
     - Tjekket prøver desuden intet, før der ligger filer i `content/`, og `e2e/content.spec.ts` springes over indtil da.
   - Rettelse: Afvis direkte import af `content/` med eslint (`no-restricted-imports` med mønsteret `**/content/**`), så kun `import.meta.glob` i `load.ts` kan nå filerne. Eller lad `bundle-size.ts` fejle, når en JavaScript-fil indeholder en nøgle, der kun findes i indholdet (fx `getReady`).

10. **L5 (lav)**: Sprogreglerne fra pakke 5 og »Dagens pas« mangler nogle steder.
    - Hvor: `docs/SPEC.md:308` (8) og `:197` (4.2), `docs/PLAN.md:108` og `docs/ENGINE.md` 9, sidste linje.
    - Hvorfor: NAT-2 pakke 5 (»samme ord for det samme overalt og ingen fagudtryk uden forklaring«) og SPEC 3.2.
      - SPEC 8 siger kun »dansk, du, korte sætninger, ingen udråbstegn«, og PLAN M6 peger på SPEC 5 og 6, hvor sproget ikke står.
      - SPEC 4.2 går stadig »Start passet → trafiklys«, mens 3.2 lægger »Dagens pas« før start.
      - ENGINE 9's liste over afvigelser nævner ikke A2.
    - Rettelse: Skriv de to regler i SPEC 8, gerne med en kort ordliste (pas, sæt, trin, reserve, hold). Ret PLAN M6 til »SPEC 5, 6 og 8« og SPEC 4.2 til »Dagens pas → Start passet → trafiklys …«, og føj A2 til ENGINE 9.

11. **L6 (lav)**: `like` deler også »Lettere« og »Sværere«.
    - Hvor: `docs/SPEC.md:334` og `:346`, `src/content/types.ts:142–146`.
    - Hvorfor: SPEC 9.1: »Lettere« og »Sværere« er »nabotrinnet«. Med `"like": "burpee_emom.E1"` viser E5's kort E1's naboer, og intet forhindrer det.
    - Rettelse: Skriv i SPEC 9.1, at `like` kun bruges, når alle felter passer ordret til begge trin, og at »Lettere« og »Sværere« så skrives uden trinnavne. Alternativt viser kortet programmets nabotrin, når punktet er `like`.

## Verificeret

### Kommandoer

- `npx vitest run`: 428 bestået (21 filer).
- `npx tsc --noEmit`: 0 fejl. `npx eslint .` og `npx prettier --check .`: rene.
- `npm run build` (via Playwright): JS 63,1 kB gz. Ved start indlæses 52,8 kB (engine 26,5, index 24,1 og workbox 2,2) mod 52,9 kB efter P0; Runner er vokset fra 7,6 til 8,1 kB. CSS 3,1 kB. »Content JSON 0.0 kB (0 files)«.
- `E2E_PORT=4182 npx playwright test`: 24 bestået, 1 flaky og 1 sprunget over (`content.spec.ts`) på 13,1 min. Den flaky test er »Styrke B med wall sit W3« (`week1.spec.ts:96`), som bestod ved gentagelsen (se Uden for pakken).

### Datamodellen

| Tilfælde (scratch-test mod `validateExplainFile` og `validateFigureFile`)               | Resultat                                                                       |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Fixturerne: pres trin 1, EMOM E1 med E2 som `like`, Y-løft, RKC-planke og to figurer     | Består                                                                         |
| Opvarmningens »Mobilisér« med tre bevægelser og en figur pr. bevægelse (én forfra)      | Består                                                                         |
| Nakke N3 med fire retninger som fire hold                                               | Består                                                                         |
| Klubsekvensen C1 med hold på 3 sek og pumps som `"dose"`, C2 som `like`                  | Består, men figuren står stille under pumps (M2)                               |
| Klubsekvensen med 10 rigtige pumps                                                      | Afvist: 28 faser (M2)                                                          |
| Wall sit W2 med slag og hold                                                            | Består, men slagene kan ikke ske under holdet (M2)                             |
| Hage-ind med 2 sek hold (dosis 8 × 5 sek)                                               | Består (M3)                                                                    |
| Label »3 sek ned« på en fase på 1 sek                                                   | Består (M3)                                                                    |
| Spejlet push-up uden `facing`                                                           | Består (L1)                                                                    |
| Bulgarsk med rygsæk uden pausen på 3 sek                                                | Afvist. Programmet nævner pausen som alternativ, så det er en rimelig stramhed  |
| »Under 3 × 6: hænderne på sofaen.« i `easier`                                           | Afvist som dosis. Kan skrives om, som fixturen gør                             |

`node scripts/check-explain.ts` på fixturerne i en scratch-kopi giver »OK … (1 trin)«, »OK … (1 figur)« og »Forklaret: 1 af 117 trin og rutinepunkter. Med figur: 1.«.

### Indlæsningen med indhold

Scratch-build af e3dceb0 med `content/explain/press.json` og `content/figures/press.json`:

- Vite udgiver to JSON-filer (`assets/press-*.json`). `sw.js` precacher begge, kun `Runner-*.js` nævner dem, og bundle-size skriver »Content JSON 1.2 kB (2 files …)« og »Start files: … (no content)«.
- `e2e/content.spec.ts` består: hver fil hentes uden net fra service workeren.
- Scratch-flow i `pixel9a`: ingen JSON hentes ved start eller i sekunderne efter. Uden net startes et pas, og »Hvorfor« på pres trin 1 viser sporets egen `why` fra `content/`. Filen hentes først der og kommer fra service workeren. Skærmbillede: `screenshots/review-p1-hvorfor-fra-content.png` (teksten er testfixturen, ikke rigtigt indhold).
- Mutation A og B: se L4.

### Opstarten

Før/efter i `pixel9a` (Firefox uden JIT): varm start uden net, 25 genindlæsninger pr. kørsel, 60f3c10 og e3dceb0 med indhold på skift. Medianer:

| Kørsel | Første tegning før → efter | I dag synlig før → efter |
| ------ | -------------------------- | ------------------------ |
| 1      | 32 → 31 ms                 | 36 → 36 ms               |
| 2      | 31 → 31 ms                 | 35 → 36 ms               |

Opstarten er ikke blevet langsommere.

### Henvisningerne

- Om, `/program/`, flad-uge-noten og fraværsforklaringen er rettet, og `src/ui/` læser ikke `pdfPage`.
- `no-source-refs.test.ts` læser alle strenge og JSX-tekster i `src/` og alle strenge i `program/`. Henvisningerne findes kun i sporenes `why` (5 citater og »(side 37)«), og `withoutSources` fjerner dem alle.
- `no-source-refs.spec.ts` læser I dag, Uge, de 13 stiger, Mere, Historik, Backup, Om, Diagnose, trafiklyset, opvarmningen, »Hvorfor« i passet og `/program/`.
- Eksportfilen (`src/engine/data.ts`) rummer kun app, versioner, tidspunkt og hændelser. Forklaringerne i hændelserne kommer fra motoren.

### Data

Pakken rører hverken `src/storage/`, hændelsestyperne eller `program/`. Indlæsningen af indhold læser kun og gemmer intet.

### Skærmbilleder

- `screenshots/om.png`, `hvorfor.png` og `program.png` viser ingen kilder og ingen sidetal. De ændrede tekster bruger ingen forbudte mønstre, og teksten i passet står i `--c-ink` (`.session .muted`).
- Nye fra revieweren: `screenshots/review-p1-hvorfor-fra-content.png` og `screenshots/review-p1-piktogrammer-albuer.png`.

## Til telefonen

1. Mere → Om: står der kun version, programversion og »Diagnose«, uden kilder?
2. Start et pas, og åbn »Hvorfor« ved første sæt: er der hverken sidetal eller forskernavne?

## Uden for pakken (ikke fund i P1)

- Tre af piktogrammerne, som appen viser i dag, har albuer, der bøjer bagud: `squat_jump` (power ben trin 1, 2 og 5), `bulgarian` (ben trin 2–3) og `chin_tuck` (alle nakketrin og hage-ind). `poses.py` giver armene `bend=+1`, hvor en figur, der vender mod højre, skal have −1 (`screenshots/review-p1-piktogrammer-albuer.png`). Reglen i SPEC 9.1 om bøjning ud fra `facing` retter det i figurerne, men P4 må ikke kopiere piktogrammernes `bend`, og piktogrammerne vises, indtil trinnet har sin figur.
- `week1.spec.ts:96` (W3) er flaky: `runSessionToSummary` læser overskriften »Rene runder?« og prøver at klikke »Ja«, efter at skærmen er gået videre til »Alt er logget«. Testen bestod ved gentagelsen.

## Opfølgning

2026-11-06 · rettelserne 5fa5852, 5687a4f, 95f8453, 11e2fce, 231a78f og 833c54f (D44–D46 og R15), tjekket på 972f292.

Kørt i worktreen:

- `npx vitest run`: 472 bestået (22 filer). `npx tsc --noEmit`, `npx eslint .` og `npx prettier --check .`: rene.
- `node scripts/check-explain.ts`: alle 22 filer er i orden; forklaret 54 af 129 trin, rutinepunkter og målinger.
- `E2E_PORT=4185 npx playwright test`: 38 bestået, heraf 3 i `pixel9a-utc`, på 8,5 min. Ingen er flaky, og ingen er sprunget over. Skærmbillederne, som suiten skrev igen, er sat tilbage til de committede.
- Bygget: JS 67,6 kB gz. »Content JSON 50.4 kB (22 files)«, og startfilerne indeholder intet indhold.
- Scratch-tests uden for worktreen (ikke committet): valideringen mod nye eksempler, `check-explain` med en målingsfil og en eslint-mutation i en kopi af 972f292.

| Fund | Status | Gjort og prøvet |
| ---- | ------ | --------------- |
| M1 | Rettet | D44, SPEC 3.2 og PLAN M6: introkortet står i pausen før øvelsens første sæt og lukker ved et tryk eller af sig selv, når pausen slutter. Uden pause har det en »Gør klar«-nedtælling på 10 sek, EMOM'ens kort lukkes med »Start EMOM«, og opvarmningen får ét kort, der lukker af sig selv. Hold, klubsekvens og nakke starter stadig af sig selv, så SK3 holder uden rettelse. Selve kortet bygges i P6. |
| M2 | Rettet i modellen | `repeat` (2–30 eller `"dose"`) og en `"dose"`-fase på 2 sek i kortet. Scratch: klubsekvensen med `"repeat": 10` à 0,8 sek, W2 med slagene som `"repeat": "dose"` og W3 med 45 sek og 20 squats består. Indholdet bruger det ikke endnu: C1–C2 viser én pump, og W2 holder stille, før den slår (også nævnt i P2-reviewet). |
| M3 | Rettet | Rutinernes dosis læses: hage-ind med 2 sek hold afvises (»programmet siger »5 sek««). En label med »N sek« skal passe med fasen: »3 sek ned« på 1 sek afvises. Se dog L7. |
| M4 | Rettet | `measures` er et emne (129 punkter i dækningen, SK11 og PLAN M6). En måling i passet åbner sit eget kort (Playwright: Væg-testen; `screenshots/review-p1-kort-maaling.png`), og `like` på tværs af filer virker i `check-explain` (`measures.hollow` som `core_front.2`: OK). Forklaringerne til målingerne er ikke skrevet endnu. |
| M5 | Rettet | `"from": "power"` og `"sessions": ["A"]` i `warmup.4`. Kortet viser squat jump og pogo-hop i Styrke A og kun hurtig push-up i Styrke B (Playwright og `screenshots/kort-potenser.png`). |
| L1 | Rettet | `facing` er påkrævet i sidebilledet, og en figur uden afvises. |
| L2 | Rettet | »side 2 gange« og »side 3 sæt« er ikke sidetal. »et al.« og »m.fl.« fanges og fjernes. `src/ui/` må ikke læse `pdfPage`, og forklaringerne afviser årstal og ord som metaanalyse og studie. Ordlisten fanger dog ikke »samlet analyse« og »bedst undersøgte«, som står i tre `why` (P2-reviewets I4). |
| L3 | Rettet | `neck` kan markeres rødt. |
| L4 | Rettet | eslint afviser `../../../content/explain/press.json`, `/content/explain/press.json` og `…?url` i `Today.tsx` (scratch-mutation: 3 fejl). |
| L5 | Rettet | SPEC 8 har sprogreglerne og en ordliste, PLAN M6 peger på SPEC 5, 6 og 8, SPEC 4.2 starter med Dagens pas, og ENGINE 9 nævner A2. |
| L6 | Rettet | SPEC 9.1 og valideringen: en `like`, hvor »Lettere« eller »Sværere« nævner et trin (»Trin E2«), afvises, mens »hold 2 sek« ikke giver en falsk fejl. |

### Nyt fund

12. **L7 (lav)**: Labeltjekket afviser rigtige labels på hold på 10 sek og tider pr. gentagelse, og dets råd kan ikke følges.
    - Hvor: `src/content/validate.ts:474–484` (`checkLabel`) og `docs/SPEC.md` 9.1 (»En "dose"-fase kan kun have en tid over 10 sek i sin label«).
    - Hvorfor: SPEC 9.1 (labelen viser fasens tid) og kravet om, at valideringen ikke afviser gyldigt indhold.
      - »Hold 10 sek« på holdet i nakke N1 og N3 (10 sek) og »Hold 10–30 sek« i nakke N2 og rotation R2–R3 afvises med »giv den "seconds": 10«. Følger træneren rådet, mangler holdet sin `"dose"`-fase og afvises igen.
      - Tiden for én gentagelse afvises: »Et slag hver 2 sek« med `"repeat": "dose"` (rådet siger »giv den "seconds": 2«, men det har den allerede) og »0,8 sek pr. pump« med `"repeat": 10`.
      - Indholdet i dag undgår det med »Hold« og »Pres og hold« uden tid, så ingen fil fejler.
    - Rettelse: Godkend en tid på en `"dose"`-fase, når den passer med dosisens sekunder eller er over 10 sek. Godkend både tiden for én gentagelse og den samlede tid på en `repeat`-fase, og giv et råd, der kan følges. Ret SPEC 9.1 og `validate.test.ts` tilsvarende.

### Til orkestratoren

- P6 i `docs/runs/NAT-2-TASKS.md` beskriver stadig D41: kortet lukkes med »et tryk«, og »Grønt« kræver introkort i motor og Open & Strong. Ret den til D44, før P6 begynder.
- Forslag: hintet »Dagens første power-øvelse« i opvarmningen vælges stadig med `item.key === '4'` i `Runner.tsx`. Nu kan det læses fra `"from": "power"` i data, så koden ikke kender punktet.
