# Review af NAT-2 P2 – Øvelseskortet og forklaringerne, del 1

2026-11-06 · indhold: b4095b6, af819c9, 78bb300 (og P51) · kortet: dd9f017, 95119f3, 0c78d61, aa7c8d6

Metode: De 22 filer i `content/explain/` (54 punkter) er læst punkt for punkt mod `docs/PROGRAM_KILDE.md` (sporenes afsnit, »Start rigtigt«, »Trafiklyset«, opvarmningen, Open & Strong og nakke-stigen), `program/tracks/*.json`, `program/routines.json`, `program/sessions/A.json` og `B.json`, `docs/ENGINE.md` 5.4–5.6 og `docs/DECISIONS.md` P47, P49–P51. Kortet er læst mod `docs/SPEC.md` 3.5, 3.8, 5, 6, 7 og 9.1 og D41 og D43. Skærmbillederne af alle 54 kort (`npm run shots:cards`) er gennemgået. Desuden scratch-tests uden for worktreen (ikke committet): tilgængelighed, kilder og bredde på alle 54 kort og et pas i `pixel9a`, hvor kortet står åbent over en pause før et hold.

## Resultat

0 høj, 4 middel og 11 lav.

- **Indholdet** er godt. Udgangsstillinger, nummererede trin, cues og typiske fejl er konkrete, og en nybegynder kan lave de fleste øvelser ud fra teksten alene. Positionerne i ord giver led, vinkler og kontakt med gulv, væg, stol, sofa og seng, så figurerne kan bygges. Jeg har ikke fundet led, der bøjer forkert, eller kontakter, der ikke passer. Navne, doser og tempo er uændrede: `program/` er ikke rørt, alle tider i programmet findes som faser, og alle faser med »N sek« i teksten har den varighed. Sikkerheden er god: nakkens stopregel står på alle seks trin, bordet prøves før bord-row, stolen står mod væggen, sofaen tjekkes, og der er plads og fodtøj til hop. Ingen henvisninger til PDF, sider eller kildenavne. Ét middel fund: to øvelser skifter side hver gentagelse, mens passet logger siderne hver for sig (I1).
- **Trænernes valg** holder alle. Se afsnittet nedenfor. Klubsekvensens lettere variant og P51 mangler hver en sætning (I2, I8).
- **Kortet** følger SPEC 3.8: navn og dosis fra programmet, piktogram med faser, de fire synlige afsnit, folderne, udstyret i foldens overskrift og »Hvorfor« fra `content/`. Uden forklaring er der ingen tomme overskrifter, og et lånt piktogram får sin tekst. Alle 54 kort holder 18 px, 7:1 og 56 px. Kortet hentes efter start og virker offline, og passets ure kører videre under det. Men et hold kan starte og blive logget, mens kortet er åbent (K1). Mange kort kan kun åbnes, mens passet kører, og fem kan slet ikke åbnes (K2). Og Androids tilbage-gestus lukker appen (K3).
- **`e2e/no-source-refs.spec.ts`** er ikke blevet svagere. `exact: true` gør kun klikket på »Tilbage« præcist. Den gamle kontrol af, at programmets evidensboks blev vist uden kilde, er erstattet af en kontrol af, at sporets egen tekst vises, og at evidensboksen og »Pareja-Blanco« ikke gør. `expectNoRefs` læser stadig samme skærme, og kortet selv tjekkes med `findSourceRef` i `card.spec.ts`. Programmets tekster uden kilder tjekkes stadig af `no-source-refs.test.ts` i Vitest.

## Trænernes valg

- **Sideplanke S1 som ét sæt pr. side (P51): forsvarligt.** Programmet skriver »pr. side« ved hold i rotationsstigen (R2 og R3), men ikke ved S1, S3 og S4. Appen kører 2 hold, og kortets »Tag næste sæt på den anden side« passer med passets »Sæt 1 af 2« og »Sæt 2 af 2«. Dokumentationen mangler noget (I8).
- **Nakke N6 med samme fire retninger som N3/N4: godt.** »Pr. retning« betyder fire retninger efter tur (P49). Bevægelsen er sikker med »så langt, det føles behageligt« og »bagud er det nok, at blikket peger skråt op«.
- **N5, hvor hånden støtter hovedet ved hvert skift: godt.** Det beskytter nakken, når man vender sig med hovedet ude over kanten, og det ændrer ikke dosis. Rækkefølgen ryg, mave, venstre og højre side passer med passets »retning 1–4 af 4«. Skiftet skal ske i pausen på 10 sek (P49); det er stramt på en seng, men muligt.
- **groin.2 med frit nederste ben: godt.** Opstillingen er den samme som i trin 4 (»Foden på sofaen i stedet for knæet. Det nederste ben hænger frit«), og »Lettere« giver foden i gulvet.
- **Burpee V3 med de 2 knæ fra det bageste ben: godt.** Det er det kraftigste knæ, og landingen i garde giver én fast stilling. **V5 uden hop: godt.** Programmet nævner intet hop (»op igen på samme ben«), og det skåner ankel og knæ på ét ben.
- **Den lettere variant til C1 (hænderne på sofaen):** belastningen er fornuftig og svarer til programmets egen »Under 3 × 6: hænderne på sofaen« i pres trin 1, men se I2.
- **Open & Strong os.1 med »3 positioner« for håndklædet: godt.** Tre steder langs brystryggen er den gængse udførelse (nederst, midt og øverst på skulderbladene, aldrig under lænden eller nakken), og det passer med programmets piktogram. Tempoet passer dog ikke til uret (I7).

## Fund: Indhold (indholdsagenterne)

1. **I1 (middel)**: Dead bug og planke med skulder-tap skifter side hver gentagelse, men passet viser venstre og højre side som to sæt.
   - Hvor: `content/explain/core_front.json:17` og `:19` (core_front.1, trin 4 og tempo), `content/explain/core_rot.json:16` og `:19` (core_rot.R1). Skærm: sættet »Sæt 1 af 2 · Venstre side · mål 6 reps« og derefter »Højre side« (`src/ui/session/Runner.tsx:1007–1010`).
   - Hvorfor: DECISIONS P47 (øvelser pr. side logges venstre, så højre, ét tryk pr. side, uden pause imellem) og doserne »3 × 6–10 pr. side« og »2 × 10–20 pr. side« (`docs/PROGRAM_KILDE.md:370` og `:404`).
     - Kortet siger »skift side hver gang«, men passet viser først venstre side med »mål 6« og derefter højre side.
     - Midt i passet kan man ikke se, om »mål 6« betyder 6 i alt (3 pr. side) eller 6 pr. side, og om højre side skal laves igen. Resultatet bliver halv eller dobbelt mængde, eller en side logges anderledes, end den blev lavet.
     - Alle andre øvelser pr. side (S2, groin.1, legs, pull.1, posterior.1, calf.1, sl_rdl.1) siger »Tag alle gentagelser, og skift så« og passer med passet.
   - Rettelse: Behold skiftevis, og sig, hvordan det logges. Fx core_front.1, trin 4: »Skift side hver gang, til du har målet på begge sider. Tryk så »Som planlagt« for venstre og højre side.« Det samme i core_rot.R1, trin 3. Alternativt én side ad gangen som de andre øvelser. Skriv valget ved P47 i DECISIONS.

2. **I2 (lav)**: Den lettere variant til klubsekvensen C1 kan rykke dig op til C2 på sofaen.
   - Hvor: `content/explain/club_sequence.json:37` (club_sequence.C1, `easier`).
   - Hvorfor: R-CLUB (`docs/ENGINE.md` 5.4): to rene B-pas i træk giver næste trin, og passet spørger »Ren runde?« (`Runner.tsx:696`). Varianten står ikke i programmet, og appen ved ikke, at runden blev taget på sofaen. Svarer man ja efter en ren runde på sofaen, rykker motoren op til C2, som er 2 × 2 runder i gulvet.
   - Rettelse: »Hænderne på sofaen, til du kan lave en ren runde i gulvet. Så længe du bruger sofaen, svarer du nej til »Ren runde?«.«

3. **I3 (lav)**: Smertereglen står med forskellige ord og uden »væk næste morgen«.
   - Hvor: `why` i `power_legs.json:7`, `power_upper.json:7`, `posterior.json:7`, `legs.json:7`, `wallsit.json:7` og `neck.json:7`; `easier` i `burpee_emom.json:37` og `:123`.
   - Hvorfor:
     - Programmets regel (`docs/PROGRAM_KILDE.md:107`): »Smerte op til 3 ud af 10 under en øvelse er i orden, hvis den er væk næste morgen. Skarp eller stigende smerte i et led: stop øvelsen, og gå et trin ned i en uge.«
     - Passets knapper hedder »Let (≤3)« og »Skarp eller i et led« (SPEC 3.2).
     - Kortene skriver i stedet »Let ømhed er i orden«, »Ømme muskler er i orden«, »Brændende lår er i orden« og »smerte i knæet«. Ingen af dem nævner »væk næste morgen«, som søndagstjekket bygger på (SPEC 4.7), og »et trin ned« står både med og uden »i en uge«.
     - Teksterne lover ikke mere end programmet, men det er ikke samme regel med samme ord.
   - Rettelse: Én fast sætning i alle filer, fx »Smerte op til 3 af 10 er i orden, hvis den er væk næste morgen. Skarp smerte eller smerte i et led: stop, og tryk »Smerte«. Så går appen et trin ned i en uge.« I nakken: »tryk »Stop««.

4. **I4 (lav)**: Tre »Hvorfor«-tekster henviser stadig til undersøgelser.
   - Hvor: `wallsit.json:6` (»i en stor samlet analyse«), `groin.json:6` (»En nyere samlet analyse«), `posterior.json:6` (»en ny analyse af de samme tal«).
   - Hvorfor:
     - A2 og SPEC 9.1, tekstreglerne: ingen henvisning til kilder, og »Hvorfor« skal stå i appens egne ord.
     - P1-reviewets L2 regnede »i en stor metaanalyse«, »En metaanalyse fra 2025« og »en genanalyse« som rester, P2 skulle fjerne. Ordene er skiftet, men sætningerne henviser stadig til en undersøgelse, brugeren ikke kan se.
     - »Ny« og »nyere« bliver forkert med tiden.
   - Rettelse: Skriv påstanden uden undersøgelsen:
     - Wall sit: »Wall sit er en af de øvelser, der sænker blodtrykket i hvile mest.«
     - Lyske: »Hos fodboldspillere gav Copenhagen-øvelsen færre lyskeproblemer. Om den forebygger skader, er usikkert, men styrken får du under alle omstændigheder.«
     - Bagkæde: »Nordic er blandt de bedst undersøgte øvelser mod baglårsskader, men hvor meget den forebygger, er usikkert.«

5. **I5 (lav)**: Sideplanke med benløft (S2) har et tempo, programmet ikke har.
   - Hvor: `content/explain/core_side.json:85` (tempo), `:87` (cue), `:99` (fejl) og `:129–130` (faser), core_side.S2.
   - Hvorfor: Programmet siger »Løft det øverste ben langsomt op og ned« og har ét tempo for styrkesæt: »3 sek ned, 1 sek stille i bunden, kontrolleret op« (`docs/PROGRAM_KILDE.md:148`). groin.1 er samme slags benløft på siden og bruger »sænk på 3 sek«. »2 sek op, 2 sek ned« står som cue, så det ligner en regel fra programmet, og de to kort giver hver sit tempo til den samme bevægelse.
   - Rettelse: Brug programmets tempo som i groin.1: »Løft langsomt, og sænk på 3 sek« (faser: »Løft langsomt« på 2 sek og »3 sek ned« på 3 sek). Ret cue og fejl, så de passer.

6. **I6 (lav)**: Den lettere variant på stigernes første trin er ikke dækket af SPEC 9.1.
   - Hvor: `easier` i core_side.S1, core_front.1, core_situp.1, power_upper.1, legs.1, posterior.1, wallsit.W1, groin.1, neck.N1, calf.1, sl_rdl.1, burpee_emom.E1, burpee_skill.V1 og club_sequence.C1. Desuden `docs/SPEC.md:348`.
   - Hvorfor:
     - SPEC 9.1 siger »Nabotrinnet eller programmets egen variant«. Et første trin har ingen nabo nedad, og kun pres trin 1 har en variant i programmet.
     - Trænerne har skrevet egne lettere udgaver. De er fornuftige og ændrer ikke dosis.
     - Det er også dem, man skal lave, når passet viser »· lettere variant« efter skarp smerte på trin 1 (ENGINE 5.5, R-PAIN-SHARP; `Runner.tsx:998`), men det står ingen steder.
   - Rettelse: Tilføj i SPEC 9.1: »For et spors første trin: en lettere udgave af samme øvelse uden ændret dosis. Den er også »lettere variant« efter smerte på trin 1 (R-PAIN-SHARP).« Forslag til byggeagenten: lad »lettere variant« i passet åbne kortet ved »Lettere«.

7. **I7 (lav)**: Brystryggens tempo passer ikke til Open & Strongs ur.
   - Hvor: `content/explain/os.json:20–21` (os.1, `tempo` og `breathing`).
   - Hvorfor:
     - P49 giver punktet 60 sek i Open & Strongs ur, som kører uden berøring (SPEC 1, SK3, og 4.4).
     - Ni dybe vejrtrækninger med »cirka dobbelt så lang« udånding og to flytninger tager 80–100 sek i roligt tempo. Uret skifter derfor til åben bog midt i anden position.
     - De andre fem punkter passer til deres tid (45, 80, 40, 56 og 95 sek).
   - Rettelse: Sæt tempoet i `breathing` (her bliver det ikke til faser), fx »Ånd ind på ca. 2 sek, og pust langsomt ud på ca. 4 sek. Så når du alle 3 positioner på et minut.«

8. **I8 (lav)**: P51 mangler sin begrundelse i tabellen og dækker kun S1.
   - Hvor: `docs/DECISIONS.md:136`.
   - Hvorfor:
     - Tabellen i afsnit 4 har tre kolonner, men P51 har fire celler, så begrundelsen vises ikke. `CLAUDE.md` kræver beslutning, alternativer, begrundelse og konsekvens.
     - P51 siger »sæt 1 på venstre side«, men kortet siger kun »Tag næste sæt på den anden side«.
     - S3 (2 × 15–30 sek) og S4 (2 × 15–45 sek) har samme dosis uden »pr. side«, så del 2 kan ende med at vælge noget andet.
   - Rettelse: Flyt begrundelsen ind i tredje kolonne, og lad P51 gælde S1, S3 og S4. Vælg enten »venstre først« på kortet eller »valgfri side først« i P51.

9. **I9 (lav)**: Kortene til burpee-teknikken lover valg, appen ikke har.
   - Hvor: `content/explain/burpee_skill.json`: `why[2]` (»Den næste variant kan du vælge«), V1 `harder` (»Den kan du vælge«), `:128`, `:198` og `:446` (»i imponer-kataloget kan du vælge«).
   - Hvorfor: NAT-2 siger, at appen skal stå på egne ben. Der findes ingen knap til »Næste variant« (R-VARIANT), og imponer-kataloget (SPEC 4.9, milepæl 4) findes kun som liste på datasiden.
   - Rettelse: Skriv det som programmets regel uden at love en knap, fx »Næste variant øver du fra trin E6 i EMOM'ens 2 sidste minutter« og »Sprawl med teep er en imponer-variant, som kræver dette trin«.

Henvisninger til P1-fund, som ikke er nye fund:

- **M2** (`repeat`): Klubsekvensen C1/C2 viser én mikro-pump på 0,8 sek med labelen »10 mikro-pumps: kort ned«. Wall sit W2 holder garden i hele dose-fasen og slår derefter ét slag pr. arm. Åben bog (os.2) har sine fem gentagelser skrevet ud som 11 faser.
- **M4** (målinger): Væg-testen, Hollow hold (selvstændig måling i Styrke B) og Balance har intet kort. core_front.2 er forklaret, men målingen peger ikke på det.
- **M5** (»Potensér«): warmup.4 viser pogo-hop og deres faser hver dag, også fredag. Teksten »dagens første power-øvelse, som har sit eget kort« peger på et kort, der ikke kan åbnes fra opvarmningen.

## Fund: Kort (byggeagenten)

10. **K1 (middel)**: Et hold starter og logges »som planlagt«, mens kortet er åbent, og kortet skjuler passets ur.
    - Hvor: `src/ui/session/Runner.tsx:598–624` (»Næste« i pausen åbner kortet), `:1164–1186` (`HoldTimer` starter selv og logger) og `:130–137` (`withCard`). Skærm: `screenshots/review-p2-kort-i-pausen.png` og `screenshots/review-p2-efter-kortet.png`.
    - Hvorfor: SPEC 3.2 (et hold logger selv »som planlagt«, når tiden er gået) og D43 (kortet vises i stedet for passet, og timerne kører videre).
      - Scratch-test i `pixel9a`: Styrke B fredag 20/11 (programuge 2). Kortet blev åbnet fra »Næste: Mave side · Sideplanke på albuen« i pausen og læst i 80 sek.
      - Imens løb pausen ud, og »klar – 5« og holdet på 20 sek kørte bag kortet. `set_logged` for core_side.S1 blev skrevet med `asPlanned: true, seconds: 20`, og da kortet blev lukket, stod passet i næste pause.
      - Et hold, der ikke blev taget, tæller altså med i R-HOLD (+5 sek og hits), og loggen kan ikke rettes.
      - Kortet viser heller ikke, hvor meget der er tilbage af pausen.
      - D41 har allerede reglen for introkortet: ved hold og EMOM starter nedtællingen først, når kortet er lukket.
    - Rettelse: Ret D43 og SPEC 3.8 først: »Åbnes kortet fra passet, viser det øverst passets ur (»Pause 0:32«, »Hold 0:14«) og »Hold pause«. Slutter pausen, mens kortet er åbent, starter næste hold, klubsekvens, W3-runde eller nakke først, når kortet lukkes (som introkortet, D41).« Byg det, og tilføj et Playwright-flow: kortet åbnes fra »Næste« før et hold, og uret køres forbi pausen. Der må ikke skrives nogen `set_logged`, før kortet er lukket.

11. **K2 (middel)**: Mange forklarede kort kan kun åbnes, mens passet kører, og fem kan slet ikke åbnes.
    - Hvor: `src/ui/screens/Ladders.tsx:22` (`LIST` har kun `ladder` og `power`), `src/ui/session/Runner.tsx:598–611` (»Næste« finder kun `type === 'set'`) og `docs/SPEC.md` 3.5.
    - Hvorfor: SPEC 3.8 (kortet åbnes fra Stiger, »Dagens pas« og passet), D43 (»ved »Næste« i pausen«) og P2's mål (»kan åbnes fra Stiger og fra passet«).
      - Stiger viser de 13 spor fra SPEC 3.5. Kortene til rotation (R1, R2), klubsekvensen (C1, C2), nakken (N1–N6), læg, etbens RDL og rygsæk-row kan derfor kun åbnes i et pas. Burpee-teknikken V1–V5 står kun som tekst på datasiden (Mere → Programmet), så de fem kort kan ikke åbnes overhovedet.
      - »Næste« i pausen leder kun efter almindelige sæt. Før klubsekvensen, nakken og EMOM står der ingen »Næste«, og klubsekvensen og nakken starter selv med »Klar« på 5 sek.
      - Kortet til netop de øvelser, der kræver forberedelse (klubsekvensen og sengen i N5), kan altså kun læses, mens deres ur kører, medmindre man først trykker »Hold pause«.
      - Rotation, klubsekvens og nakke har trin og progression (indfasningen, R-CLUB, R-NECK). Kun I dag-kortet på passets dag viser trinnet, og derfra kan kortet ikke åbnes.
    - Rettelse: Ret SPEC 3.5 først: tilføj en anden liste under de 13, fx »Øvrige spor« som på datasiden (Mave 2 rotation, klubsekvensen, nakke-stigen, burpee-teknik, læg, etbens RDL og rygsæk-row), hvor et tryk åbner sporet med trinene og deres kort. I passet skal »Næste« finde næste øvelse af enhver slags (sæt, EMOM, klubsekvens, runde og nakke) og vise dens kort.

12. **K3 (middel)**: Androids tilbage-gestus lukker appen og ikke kortet.
    - Hvor: `src/ui/card.tsx:37–60` (`useCard` skriver intet i browserens historik) og konsekvensen i D43.
    - Hvorfor: SPEC 6 (svedige fingre, ingen præcise gestus) og NAT-2 (»poleret«).
      - Kortet ligner en ny skærm med »Tilbage« øverst, og på Android lukker man normalt en skærm med tilbage-gestussen. Appen har ingen historik, så gestussen afslutter den installerede app.
      - Midt i et pas skal man så åbne appen fra ikonet igen. Passet fortsætter samme sted (SPEC 4.2), men et kørende hold- eller pauseur starter forfra. Intet data går tabt.
      - Det samme gælder Stigers detaljer, men kortet åbnes langt oftere og bliver også brugt af »Nu«, pausen og introkortet i P6.
    - Rettelse: Kald `history.pushState({ card: id }, '')`, når kortet åbnes, og luk kortet ved `popstate`. Når »Tilbage« lukker kortet, kaldes `history.back()`, så historikken ikke vokser. Ret konsekvensen i D43 og SPEC 3.8, og tilføj et Playwright-flow: kortet åbnes i et pas, `page.goBack()` lukker kortet, og passet står samme sted med uret kørende.

13. **K4 (lav)**: Klubsekvensens og rutinernes dosis står uden forklaring af tallene.
    - Hvor: `src/ui/components/cardItem.ts:59–61` (`rounds` og `always` giver `null`) og `:105` (rutinepunkter giver `null`).
    - Hvorfor: SPEC 3.8 kræver dosis »med en forklaring af tallene«. »2 × 1 runde«, »2 × 2 runder« og »1 × 3 runder« (klubsekvensen), »2 × 8« (Y-løft) og »8 × 5 sek« (hage-ind) står uden. Kortet siger ingen steder, at klubsekvensens første tal er sæt med 2 min pause imellem (P49).
    - Rettelse: `rounds` får »sæt × runder«. For rutinepunkter udledes forklaringen af dosisteksten i `cardItem.ts`: »N × M« giver »sæt × gentagelser«, og »N × M sek« giver »gentagelser × sekunder«. `program/` skal ikke ændres.

14. **K5 (lav)**: Trinene og cues ligger under første skærm.
    - Hvor: `src/ui/components/ExerciseCard.tsx:133–154` (rækkefølgen). Skærm: alle 54 kort.
    - Hvorfor: P2's mål er, at kortet kan skimmes midt i et pas.
      - Scratch-måling i 414 × 847: de nummererede trin starter 514–1011 px nede og cues 785–1367 px nede.
      - Første skærm viser navn, dosis, tegning, faser, »Træner« og »Udgangsstilling«. I en pause på 30–60 sek skal man rulle en skærm ned for at se, hvordan øvelsen laves.
      - På nakke N3/N4 ligger trinene helt under første skærm.
    - Rettelse: Ret rækkefølgen i SPEC 3.8 til figur, »Udgangsstilling«, »Sådan gør du«, »Cues« og derefter »Træner«, eller læg »Træner« i en fold.

15. **K6 (lav)**: Testene dækker hverken Open & Strong, holdet under kortet eller tilbage-gestussen.
    - Hvor: `e2e/card.spec.ts`.
    - Hvorfor: D43 nævner Open & Strong, men kortet derfra (`src/ui/session/OpenStrong.tsx:90` og `:139`) har intet flow, og SK3 (Open & Strong uden berøring) er ikke prøvet med kortet åbent. Et flow ville have fanget K1 og K3.
    - Rettelse: Lav et flow i Open & Strong: kortet åbnes ved punkt 1, uret kører videre, »Tilbage til Open & Strong« fører til det aktuelle punkt, og `os_done` skrives som før. Tilføj desuden flowene fra K1 og K3.

## Verificeret

### Kommandoer

- `node scripts/check-explain.ts`: alle 22 filer er OK, og 54 af 117 trin og rutinepunkter er forklaret.
- `npx vitest run`: 446 bestået (22 filer).
- `npx tsc --noEmit`: 0 fejl. `npx eslint .` og `npx prettier --check .`: rene.
- Bygget (`scripts/bundle-size.ts`):
  - JavaScript 67,0 kB gz af 150. Startfilerne er index 24,7 kB og engine 26,5 kB (efter P1: 24,1 og 26,5) og indeholder intet indhold. Kortets kode er 2,1 kB for sig.
  - CSS 3,7 kB. Content JSON 50,4 kB i 22 filer.
- `E2E_PORT=4183 npx playwright test e2e/card.spec.ts e2e/no-source-refs.spec.ts e2e/content.spec.ts`: 7 bestået i `pixel9a` og `pixel9a-utc`.
- Hele Playwright-suiten (`E2E_PORT=4183 npx playwright test`): 34 bestået, heraf 3 i `pixel9a-utc`, på 9,0 min. Ingen flaky og ingen sprunget over. Skærmbillederne, som suiten skrev igen, er sat tilbage til de committede.
- `CARDS_PORT=4184 npm run shots:cards`: 54 skærmbilleder i `screenshots/cards/` (ignoreres af git).

### Scratch-tests (ikke committet)

- **Alle 54 kort** på reviewsiden med alle folder åbne, målt mod `SESSION_RULES` (18 px, 7:1, 56 px): 0 problemer. `findSourceRef` fandt intet, og intet kort er bredere end 414 px.
- **Faserne:** alle labels med »N sek« har den varighed. Alle gentagelser slutter, hvor de startede, undtagen os.1 og os.6, som er hold.
- **Kort over en pause før et hold:** se K1.

### Skærmbilleder

- `screenshots/kort-*.png`, `stige.png`, `pas-skridt.png` og `pausetimer.png` fra pakken viser kortet, som SPEC 3.8 beskriver. »Sådan gør du« ligger i passet ved piktogrammet, langt fra »Som planlagt«.
- Nye fra revieweren: `screenshots/review-p2-kort-i-pausen.png` og `screenshots/review-p2-efter-kortet.png`.

## Til telefonen (efter rettelserne)

1. Stiger → Pres → tryk på trin 1. Lukker Androids tilbage-gestus kortet, så du står på stigen igen?
2. Styrke B: åbn »Sådan gør du« ved »Næste« i pausen før sideplanken, og vent. Venter holdet, til kortet er lukket?
3. Kan du læse kortet til klubsekvensen og nakken før fredagens pas?

## Uden for pakken (ikke fund i P2)

- De tre piktogrammer med albuer, der bøjer bagud (P1-reviewet), vises nu i 382 × 180 px på kortet: `squat_jump` (power ben trin 1–2), `bulgarian` (ben trin 2) og `chin_tuck` (N1–N6 og hage-ind). Figurerne fra P4 erstatter dem.
- Passet viser stadig programmets cues, fx »4 minutter med 3 burpees i starten af hvert minut« og »Hold nakken neutral liggende på ryg, mave og begge sider«, ikke forklaringernes korte cues. Det hører til »Nu« i P6.
- Passet siger »reps«, mens kortet og forklaringerne siger »gentagelser«. Det hører til ordlisten i P8.

## Opfølgning

2026-11-06 · worktree på 4a828d6 · kortet: 94963b5, c0c279c og e878579 (D47, R16; SPEC 3.2, 3.5, 3.8 og 9.1) · indholdet: 05263df (del 1-rettelser og del 2) og 972f292 (P51, P52) · trænernes tolkninger: P53–P60

Metode: Rettelserne er læst mod fundene. De 54 punkter fra del 1 er sammenlignet felt for felt med aa7c8d6. Skærmbillederne fra `npm run shots:cards` er gennemgået. Scratch-testene fra reviewet er kørt igen mod 4a828d6 (ikke committet): holdet bag kortet og tilbage-gestussen i et pas, og SPEC 6, kilder, bredde og første skærm på de 54 kort. En ny scratch-test prøver »Lettere variant i dag« i tidsmaskinen.

Resultat: 14 af 15 fund er rettet, og I8 er delvis rettet. Der er 3 nye fund, alle lave.

Indhold:

- **I1 (middel): rettet.** Dead bug og skulder-tap laves nu med én side pr. sæt. »Venstre side« er venstre arm og højre ben (dead bug) og venstre hånd (skulder-tap). Figuren viser kun den ene side, og cuen »skift hånd« er væk. P54 er rimelig: skater-hop og split jumps kan ikke laves på én side, så de laves skiftevis med »Som planlagt« ved begge sider.
- **I2 (lav): rettet.** C1 siger »Så længe du bruger sofaen, svarer du nej til »Ren runde?««. Power ben og overkrop trin 1 har fået samme sætning om deres spørgsmål.
- **I3 (lav): rettet.** Programmets egen smertesætning står nu i alle otte »Hvorfor«, der nævner smerte, med appens knapper og »Stop« i nakken. E1 og E2 har ikke længere deres egen formulering.
- **I4 (lav): rettet.** Der er ingen »analyse« eller andre undersøgelser tilbage i del 1.
- **I5 (lav): rettet.** S2 har »Løft langsomt, og sænk på 3 sek« i tempo, cue, fejl og faser, og P55 gør det generelle tempo til regel.
- **I6 (lav): rettet.** SPEC 9.1 og 3.8 siger, at »Lettere« på et første trin er trænerens egen udgave, og kortet viser den øverst som »Lettere variant i dag«. Scratch-test i tidsmaskinen: efter skarp smerte på squat jump tirsdag 10/11 viser sættet 17/11 »· lettere variant«, og kortet viser »Lettere variant i dag: Hop lavere og i halv fart …«. Se dog N1 og N3.
- **I7 (lav): rettet.** os.1 siger »Ånd ind på ca. 2 sek, og pust langsomt ud på ca. 4 sek«, så de tre positioner passer til minuttet.
- **I8 (lav): delvis.**
  - Rettet: P51 dækker S1, S3 og S4, og kortet siger venstre side i sæt 1 og højre i sæt 2.
  - Ikke rettet: begrundelsen står stadig i en fjerde celle, mens tabellen i DECISIONS afsnit 4 kun har tre kolonner (`docs/DECISIONS.md:88`). GitHub viser derfor ikke begrundelsen, og det gælder også de nye P52–P60.
  - Rettelse: tilføj kolonnen »Begrundelse« i tabellens overskrift og skillelinje.
- **I9 (lav): rettet.** Der står ikke længere »kan du vælge«. Varianterne »øver du«, og imponer-varianterne »kræver dette trin«.

Kort:

- **K1 (middel): rettet.** Løsningen er en anden end den foreslåede, men den er dækkende: med D47 står passet stille, mens kortet er åbent. Scratch-testen fra reviewet giver nu 0 sæt for core_side.S1 efter 80 sek med kortet åbent. Pausen står på 0:45, og kortet viser »Passet står stille.«. Når kortet er lukket, kører pausen videre, og holdet logges som før.
- **K2 (middel): rettet.** Stiger har nu »Øvrige« med de syv spor, opvarmningen, Open & Strong og målingerne, så også V1–V5 kan åbnes. »Næste« viser alle slags øvelser, også ved spørgsmålene.
- **K3 (middel): rettet.** Kortet lægger sig i browserens historik. `page.goBack()` lukker kortet i Stiger og i passet, både i e2e-testene og i scratch-testen, og passet står samme sted.
- **K4 (lav): rettet.** Dosis forklares nu også som »sæt × runder«, »sæt × gentagelser« og »gentagelser × sekunder«.
- **K5 (lav): rettet.** På alle 54 kort står første cue og første trin på første skærm. På os.1 begynder første trin på første skærm, men slutter ved 869 px.
- **K6 (lav): rettet.** Der er nye flows for holdet bag kortet, Open & Strong (står stille, derefter uden tryk og med `os_done`), tilbage-gestussen, »Øvrige« og »Næste«.

Nye fund:

- **N1 (lav):** »Lettere variant i dag« kan begynde med »Det er stigens første trin.«.
  - Hvor: `content/explain/core_front.json:36` og `content/explain/core_situp.json:36` (`easier`).
  - Hvorfor: SPEC 9.1 (ny): »Lettere« på et første trin er trænerens konkrete, lettere udgave, og kortet viser teksten øverst efter skarp smerte. Indledningen siger ikke, hvad du skal gøre i dag.
  - Rettelse: Fjern »Det er stigens første trin.«, så teksten er selve varianten.
- **N2 (lav):** Bord-row siger ikke, hvad du gør med dagens sæt, når bordet vipper.
  - Hvor: `content/explain/pull.json:76`, `:95` og `:98` (pull.2). Samme tekst står i pull.3–7, som hører til del 2.
  - Hvorfor:
    - Teksten er ændret fra »lav rygsæk-row« til »stop, og vælg trin 1 under Stiger efter passet«. Det er bedre for progressionen, men midt i passet står bord-row-sættene stadig på skærmen.
    - Trykker man »Som planlagt« for at komme videre, logges sæt, der ikke blev lavet, og de kan tælle som hit (ENGINE 5.4).
    - Programmet siger »bliv på rygsæk-row« (`docs/PROGRAM_KILDE.md:287`).
  - Rettelse: Sig, hvad du gør i dag, fx »Vipper bordet, så stop. Tag rygsæk-row resten af passet, og sæt bord-row-sættene til 0 reps. Vælg trin 1 under Stiger efter passet.« Forslag til byggeagenten: lad »Hold pause« føre til Stiger (P6).

- **N3 (lav):** »Lettere variant i dag« er ikke dækket af nogen test.
  - Hvor: `e2e/card.spec.ts` og `src/ui/__tests__/card.test.ts`; koden er `src/ui/session/Runner.tsx` (`lighter: true` ved »Sådan gør du«) og `src/ui/components/ExerciseCard.tsx:117–123`.
  - Hvorfor: NAT-2's fælles krav siger, at ny brugerflade dækkes af Playwright-flows. Boksen vises kun efter skarp smerte på trin 1, så den bliver ikke set i de andre flows.
  - Rettelse: Lav et flow i tidsmaskinen som scratch-testen. Først skarp smerte på første sæt i Styrke A 10/11 og passet kørt færdigt. Derefter »+1 dag« syv gange, Styrke A igen og »Sådan gør du« ved første sæt. Forvent »· lettere variant« og boksen.

Verificeret:

- `npx vitest run`: 477 bestået. `npx tsc --noEmit`: 0 fejl. eslint og prettier: rene.
- `node scripts/check-explain.ts`: 23 filer er OK, og 129 af 129 punkter er forklaret.
- `CARDS_PORT=4188 npm run shots:cards`: 129 kort. Ifølge værktøjet har alle første cue og første trin på første skærm.
- Scratch, 54 kort fra del 1 med alle folder åbne: 0 problemer mod 18 px, 7:1 og 56 px. Ingen kilder og intet bredere end 414 px.
- Hele suiten (`E2E_PORT=4187 npx playwright test`): 40 bestået og 2 flaky. Begge flows for Styrke B i uge 1 timede ud ved første forsøg, mens mine scratch-tests kørte ved siden af. Alene bestod alle fire uge 1-flows uden gentagelse (7,7 min). Årsagen ligger i testhjælperen, ikke i appen: `runSessionToSummary` klikker »Som planlagt«, mens knappen er `disabled` (`busy`), og venter derefter i realtid på næste sæt.
- Nye skærmbilleder: `screenshots/review-p2-opf-kort-i-pausen.png`, `screenshots/review-p2-opf-efter-tilbage.png` og `screenshots/review-p2-opf-lettere-variant.png`.
