# Review af NAT-3 P5a – Livet: søndagstjek og klublog med lørdagskarakter

2026-11-09 · 2bddb08 (motoren), ea476fd, 0c647e4, 49c287e, 20f6e78 og e133e30 · worktree på de76ce6 (`git show 2bddb08` og `git diff 118ec40 de76ce6`)

Metode:

- **Læst** mod:
  - P5a i `docs/runs/NAT-3-TASKS.md` og pakke 5 i `docs/runs/NAT-3.md`;
  - SPEC 3.1, 3.3, 3.7, 4.6, 4.7, 5 og 6;
  - ENGINE 3.1, 5.2, 5.5 (R-PAIN-*), 5.11, 5.14, 6.5, 8 (S-PAIN-07 og S-PAIN-08) og 9;
  - PROGRAM_KILDE s. 9 (»Film dig selv«), s. 46 (comeback-fælden) og s. 48 (»Søndagens tjek«);
  - DECISIONS D47, D57, D61, D63, P23, P25 og R26.
- **Kørt** i worktreen:
  - `npm test`: 750/750. `npm run typecheck`: exit 0.
  - `e2e/life.spec.ts` i `pixel9a` og `pixel9a-utc` (`E2E_PORT=4185`, Firefox uden JIT): 18/18.
  - I dag-specs, fordi I dag er ændret: `e2e/m2.spec.ts`, `tabs.spec.ts` og `design.spec.ts` i `pixel9a`: 11/11.
  - `node scripts/bundle-size.ts`: JavaScript 111,1 kB gz, heraf `index` 28,5 kB og `LifeForm` 3,3 kB, som hentes efter start. CSS 4,3 kB. Startfilerne henviser ikke til indholdet.
- **Egne flows** i `pixel9a`. De er scratch og ikke committet.
  - Med det rigtige ur og uden tidsmaskine: I dag tirsdag 10/11, søndag 15/11 og mandag 16/11 (`screenshots/review-p5a-tirsdag-klubkort.png`, `review-p5a-soendag-i-dag.png` og `review-p5a-mandag-aften.png`). »Se dagens pas« og »Tag søndagstjekket« står over fanerne, også med gårsdagens klubkort over hovedkortet.
  - Grænserne i begge projekter (6/6): mandag kl. 00.30, lørdag kl. 11.30 (klubtiden 10–11) og søndag kl. 23.50 → mandag kl. 00.05.
  - a11y-målingen fra `e2e/a11y.ts` ved hver rulleposition af søndagstjekket med »Ja«: 0 problemer.
  - »Afslut« i tidsmaskinen med klubloggen og søndagstjekket åbne (H1).
  - »Ret søndagstjekket« med svarene fjernet (M2).
  - Lørdagskarakteren i tjekket med lørdagens klublog ulogget (M3).
  - »+1 dag« efter en klublog logget dagen efter (L1).
  - Historikken, når skærmene åbnes (L2).
- **Motoren** med et scratch-script på testenes `Log`: »For tungt« på et spor i en smerteperiode, en rettelse fra smerte til for tungt, og EMOM'en under »For tungt?«.

## Resultat

1 høj, 3 middel og 4 lav.

- **Det virker:**
  - **Datoerne:**
    - klubloggen har klubdagens dato, også dagen efter;
    - tjekket har søndagens dato og ugens mandag, også mandag;
    - I dag og klubtiden følger København, også med uret i UTC;
    - kortet kommer selv kl. 19.30 uden genindlæsning.
  - **Motoren** gør det, S-PAIN-07 og S-PAIN-08 beskriver:
    - S-PAIN-07 og S-PAIN-08 står i ENGINE 8 og 9 og i tabellen 6.5, og testene har scenarie-ID'erne som navn;
    - et tjek gemt to gange forlænger ikke smerten og giver ikke Fysio-rådet;
    - spørgsmål 2 læser det nyeste tjek.
  - **Hændelserne:** kun tilføjede hændelser og intet nyt felt. Det gamle tjek bliver i loggen, og kun den afledte tilstand afløser det.
  - **Dobbelttryk og tidsmaskinen:** dobbelttryk-spærren (D61) og det halve sekund (D57) virker på alle knapper, der skriver. Tidsmaskinen skriver ikke i de flows, testene går (se H1 for det, de ikke går).
  - **Designkravene:** trykflader, 8 px mellemrum, tekst ≥ 16 px i skalaen og kontrast holder. Der er ingen dialog og ingen placeholder i stedet for en label, og der er ingen henvisninger til kilder.
  - **P25:** »Kør intervallerne alligevel« kan nås fra I dag og bliver stående, når det er sat.
- **Det virker ikke:**
  - En skærm åbnet i tidsmaskinen skriver i den rigtige log efter »Afslut« (H1).
  - »For tungt?« kan tage et spor to trin ned (M1).
  - Efter »Ret søndagstjekket« siger kortet, at intet er ændret, selv om sporene stadig står nede (M2).
  - Lørdagens karakter i tjekket lukker lørdagens klublog (M3).

## Fund

### H1 (høj): Klubloggen og søndagstjekket bliver stående efter »Afslut« i tidsmaskinen og gemmer i den rigtige log

- **Hvor:**
  - `src/ui/screens/Today.tsx:124` og `:145–166`: skærmen er I dags egen tilstand (`form`), og intet lukker den, når tidsmaskinen slutter.
  - `src/ui/App.tsx:54–62` og `:97–110`: verdensskiftet og »Afslut« giver slip på passet (`setRun(null)`, `setAway`, `setOs`), men ikke på I dags skærm.
  - `src/ui/life/LifeForm.tsx:154–158` og `:268–283`: »Gem«, »Jeg var der ikke« og »Gem søndagstjekket« skriver med `model.commit` i `model.store`, som efter »Afslut« er det rigtige lager.
  - Skærm: `screenshots/review-p5a-afslut-tjek-aabent.png`. Det røde banner er væk, og »Søndagstjek · søndag 15. november« står stadig åbent.
- **Hvorfor:**
  - **Kilderne:**
    - CLAUDE.md: »Tidsmaskinen arbejder på en kopi i hukommelsen og skriver aldrig til lageret«.
    - SPEC 4.7: »Tidsmaskinen skriver kun i sin kopi«.
    - SPEC 3.7: »Intet skrives til den rigtige log … »Afslut« kasserer kopien«. ENGINE 5.14 (R-TIME) siger det samme.
    - D57: et pas hører til sin verden, og App giver slip på det ved »Afslut«.
    - PLAN M3, tjekliste 4: »er dine rigtige data uændrede?«.
  - **Gentaget:**
    1. Indfasning med Ben på trin 3.
    2. Tidsmaskinen på 15/11, »Tag søndagstjekket« og »Ben · trin 3« under »For tungt?«.
    3. »Afslut«. Skærmen bliver stående.
    4. »Gem søndagstjekket«. Det rigtige lager går fra 17 til 19 hændelser: et `sunday_check` dateret 2026-11-15 og `step_changed legs.3 → legs.2`. Stiger i den rigtige app siger nu »Ben · trin 2«.
  - **Klubloggen:** tidsmaskinen på 11/11, »Hvordan var det?«, »Afslut« og så »Jeg var der ikke«. Det giver et rigtigt `club_logged` med `attended: false` for 11/11. Onsdag siger kortet så »✓ Logget: du var der ikke«, og onsdagens rigtige træning kan ikke logges, for en klubtræning logges én gang (D63 (1)).
  - **Konsekvensen:** loggen er tilføj-kun, så hændelserne kan ikke fjernes. Brugeren tester netop klubloggen i tidsmaskinen (PLAN M3, tjekliste 8).
- **Rettelse:**
  1. Luk skærmen, når verden skifter. I `App.tsx` kan det være `<Today key={model.sim ? 'sim' : 'real'} …>`. Alternativt kan `Today` kalde `setForm(null)` og `setSaved(null)` i en effekt på `model.sim !== null`.
  2. Lad også `LifeForm` huske verden fra åbningen (`useRef(model.sim)`) og afvise at skrive, hvis `model.sim` er en anden, når der trykkes. Så kan en skærm, der hænger, aldrig skrive i den anden verden.
  3. Test i e2e:
     - søndagstjekket og klubloggen åbnet i tidsmaskinen og så »Afslut«: skærmen er væk, og `storedEventCount` er uændret;
     - det samme ved »+1 dag«: skærmen lukker eller skriver kun i kopien.
  4. Samme rettelse bør gælde de skærme, P5b lægger i stedet for I dag og Uge (`src/ui/lifeScreen.ts` i hovedmappen, ikke reviewet her).

### M1 (middel): »For tungt?« på en stige i en smerteperiode tager den to trin ned og fjerner gendannelsen

- **Hvor:**
  - `src/engine/session.ts:616–635`: løkken over `tooHeavy` ser ikke på `t.tempDown`, men går til trinnet under det midlertidige trin.
  - `src/engine/derive.ts:199–200`: `user_choice` sletter `tempDown`, så R-PAIN-RESTORE aldrig gendanner.
  - `src/ui/life/choices.ts:59–64`: knappen tilbyder det midlertidige trin (»Ben · trin 2«).
- **Hvorfor:**
  - **Kilderne:**
    - PROGRAM_KILDE s. 46: »Skarp smerte eller ledsmerte: stop øvelsen, og gå et trin ned i en uge«.
    - PROGRAM_KILDE s. 48: »er noget for tungt?«.
    - ENGINE R-PAIN-SUNDAY: »For tungt« er ét trin ned, »ikke for et spor, der også står i `painTracks`, for det går ned efter smertereglen«. Spor, som smerten allerede har taget ned, holdes altså ude.
    - ENGINE R-PAIN-RESTORE og D63: »samme smerte tæller én gang pr. uge«.
  - **Gentaget i motoren** (uge 2 i scriptet):
    1. `legs.3` og skarp smerte i ben tirsdag giver `legs.2` med `tempDown` (oprindeligt `legs.3`, til 24/11).
    2. Søndagstjekket med `tooHeavy = [legs]` skriver `step_changed legs.2 → legs.1 (user_choice)`, og `tempDown` er væk.
    3. To uger og to grønne pas senere står ben stadig på `legs.1`.

    Ugens ene problem med trin 3 koster altså to trin for altid.
  - **Omvendt:**
    1. Første tjek har smerte i ben (`legs.3 → legs.2` midlertidigt).
    2. Rettelsen siger »Nej« til smerte og »For tungt: Ben«. Den skriver intet (`handled`), og perioden gendanner ben til `legs.3`, altså det trin, brugeren lige har kaldt for tungt.
  - **Testene:** S-PAIN-07 og S-PAIN-08 starter begge uden `tempDown` og ser ingen af delene.
- **Rettelse** (ændringsprotokollen: først ENGINE, så test, så kode):
  1. **ENGINE R-PAIN-SUNDAY:** »For tungt« på et spor i en smerteperiode gør det sænkede trin til dit trin: `step_changed` fra og til samme trin med `by: 'user'` og `reason: 'user_choice'`. Det fjerner gendannelsen, uden at sporet går længere ned. Det gælder også, når smerten kom fra et tidligere tjek for ugen.
  2. **Nyt scenarie S-PAIN-09:**
     - legs.3 med skarp smerte tirsdag og `tooHeavy = [legs]` søndag giver `legs.2` uden `tempDown` og ingen `legs.1`;
     - en rettelse fra smerte til for tungt giver det samme.
  3. **Koden:** i løkken over `tooHeavy` i `submitSundayCheck`: spring et spor i `painTracks` over som nu; har sporet `tempDown`, så skriv `step_changed` fra og til `t.stepId` (`user_choice`) og fortsæt, også når sporet står i `handled`; først derefter `handled` og `previousStep`. Et tredje tjek finder intet `tempDown` og skriver intet.
  4. **Knappen:** vis trinnet før smerten (»Ben · trin 3«) for sådan et spor, og skriv ved den: »Ben bliver på trin 2«.

### M2 (middel): Efter »Ret søndagstjekket« lover skærmen ændringer, der ikke sker, og kortet skjuler dem, der står

- **Hvor:**
  - `src/ui/life/LifeForm.tsx:248–250` og `:256`: tjekket åbner med de gemte svar (»Ja« og »Lyske«, »Ben · trin 2« valgt).
  - `:363` og `:401` står uændret ved dem: »Øvelsen går ét trin ned i en uge« og »Den valgte stige går ét trin ned, når du gemmer«. Ingen af delene sker igen (S-PAIN-08).
  - `src/ui/screens/Today.tsx:425–447` (`SundaySummary`): kortet viser kun det nyeste tjeks svar.
  - Skærme: `screenshots/review-p5a-ret-tjek-for.png` og `review-p5a-ret-tjek-efter.png`.
- **Hvorfor:**
  - **Kilderne:**
    - SPEC 4.7: »Gemt siger kortet søndag og mandag »✓ Gemt« med svarene og det, de ændrede«.
    - D63 (3) og ENGINE R-PAIN-SUNDAY: et spor, det nye tjek ikke nævner, »bliver, hvor det er«, og trinnet kan vælges under Stiger. Det skal brugeren kunne se.
  - **Gentaget** i tidsmaskinen 15/11:
    1. Tjekket gemmes med smerte i Lyske og »For tungt: Ben · trin 3«.
    2. Under »Ret søndagstjekket« vælges »Nej«, og Ben fravælges.
    3. Kortet siger nu »Intet gør ondt, og intet er for tungt.«, men Stiger siger »Lyske · trin 1 … Lettere variant til 22. november (smerte)« og »Ben · trin 2«.

    Brugeren tror, han har fortrudt, og tirsdagens pas er lettere uden forklaring på I dag.
- **Rettelse:**
  1. **Skærmen:** marker de spor, et tidligere tjek for ugen har taget ned (»Ben · trin 2 – ned fra trin 3 i søndagstjekket«, »Lyske – lettere variant til 22. november«). Skriv under dem: »Fjerner du valget, bliver øvelsen, hvor den er. Trinnet kan vælges under Stiger.«
  2. **Kortet:** `SundaySummary` skal vise ugens trinskift fra tjekkene, altså `state.decisions` i ugen med `reason: 'pain'` eller `user_choice` fra et søndagstjek, og ikke kun det nyeste tjeks svar.
  3. **Test:** e2e-flowet »Ret søndagstjekket« fjerner et svar og læser, at kortet stadig nævner Lyske og Ben.

### M3 (middel): Lørdagskarakteren i søndagstjekket lukker lørdagens klublog

- **Hvor:**
  - `src/ui/life/LifeForm.tsx:270–274`: karakteren gemmes som lørdagens `club_logged` (`attended: true`, `technique`).
  - `src/ui/life.ts:74–86` og `:120–123`: enhver klublog for dagen tæller som logget, så »Muay Thai i går« forsvinder.
  - Skærme: `screenshots/review-p5a-soendag-i-dag.png` (før) og `review-p5a-soendag-efter-tjek.png` (efter).
- **Hvorfor:**
  - **Kilderne:**
    - SPEC 4.6: »Efter klubtidens slutning (eller næste dag) viser I dag-kortet »Hvordan var det?««, med indhold, hårdhed og overskud.
    - ENGINE 5.11 (R-FLAT): overskuddet »Flad« gør ugen flad.
  - **Gentaget** med det rigtige ur søndag 15/11:
    1. I dag viser »Muay Thai i går« over hovedkortet »Søndagstjek«.
    2. Tjekket gemmes med lørdagskarakter 4.
    3. Kortet er væk, og lørdagens indhold, hårdhed og »Flad« kan aldrig logges.
  - **Hvorfor det sker:** søndagens røde knap er »Tag søndagstjekket«, så det er den naturlige rækkefølge.
- **Rettelse:**
  1. Lad »Muay Thai i går« blive stående, når lørdagens eneste log er karakteren fra tjekket (kun `technique`).
  2. Lad klubloggens skærm vise karakteren som givet (»4 · fra søndagstjekket«) og gemme resten uden `technique`, så flad-reglen læser én karakter.
  3. Skriv valget i D63 (5), og føj søndagens rækkefølge (tjek først, klublog bagefter) til `e2e/life.spec.ts`.

### L1 (lav): »✓ Klubtræningen i går er logget.« bliver stående næste dag og efter tidsmaskinen

- **Hvor:** `src/ui/screens/Today.tsx:126` og `:150–160`. `saved` nulstilles kun, når I dag afmonteres.
- **Hvorfor:**
  - **Kilden:** SPEC 4.6. Beskeden hører til den dag, loggen blev skrevet.
  - **Gentaget:**
    1. I tidsmaskinen torsdag 12/11 logges onsdagens klubtræning.
    2. »+1 dag«.
    3. Fredag står der stadig »✓ Klubtræningen i går er logget.« (`screenshots/review-p5a-fredag-gammel-besked.png`).
  - **På telefonen:** det samme sker, når PWA'en tages frem næste morgen med I dag åben (`refreshDay` skifter dagen uden at afmontere I dag), og efter »Afslut«.
- **Rettelse:** gem dagen og verden med beskeden (`{ text, today, sim }`), og vis den kun, mens de er de samme. Ellers nulstil den i samme effekt som H1.

### L2 (lav): Androids tilbage-gestus lukker appen i stedet for klubloggen og søndagstjekket

- **Hvor:** `src/ui/screens/Today.tsx:145–166`. Skærmen lægger intet i browserens historik: `history.length` er 1 før og efter »Tag søndagstjekket«.
- **Hvorfor:**
  - **Kilden:** D47 (3). Kortet lægger sig i historikken, så tilbage-gestussen lukker det. De nye skærme står i stedet for I dag med »Tilbage« (SPEC 4.6 og 4.7), men uden en indgang i historikken forlader gestussen PWA'en, og de svar, der er tastet ind, kan gå tabt. Playwright kan ikke udføre Androids gestus, så fundet bygger på koden og D47.
- **Rettelse:** brug samme mekanisme som `src/ui/card.tsx`:
  - `pushState`, når skærmen åbner;
  - `popstate` lukker skærmen;
  - »Tilbage« og »Gem« går tilbage over indgangen, så historikken ikke vokser.

### L3 (lav): To tekster i søndagstjekket passer ikke

- **»Øvelsen går ét trin ned i en uge«** (`src/ui/life/LifeForm.tsx:363`):
  - **Problemet:** på første trin (alle øvelser i uge 1 med standardtrinnene) bliver øvelsen på trinnet med lettere variant (ENGINE R-PAIN-SHARP; SPEC 4.7: »på første trin med lettere variant«).
  - **Rettelse:** »Øvelsen går ét trin ned i en uge (på første trin: lettere variant), og spørgsmål 2 står på »nej« før de næste pas.«
- **»Film dig selv fra siden i et sæt i denne uge«** (`:410–415`):
  - **Problemet:** søndag er ugens sidste dag og har ingen sæt (P23; PROGRAM_KILDE s. 9: »Hver anden uge«).
  - **Rettelse:** »i næste uge« søndag og »i denne uge« mandag.

### L4 (lav): Testene går ikke de veje, hvor fejlene er

- **Hvor:** `e2e/life.spec.ts` og `src/engine/__tests__/light-and-pain.test.ts`.
- **Hvorfor:** testene prøver acceptkriterierne grundigt. Flowene i tidsmaskinen kører 15/11 og 16/11 i begge projekter, med a11y, dobbelttryk med langsom skrivning og uændret lager. S-PAIN-07 og S-PAIN-08 læser `by`, `reason`, target, antallet af tjek og spørgsmål 2. Men ingen test ser:
  - skærmen på tværs af »Afslut« (H1);
  - et spor i en smerteperiode under »For tungt?« (M1);
  - kortet efter en rettelse, der fjerner svar (M2). Mandagens »Ret« lægger kun en smerte til;
  - søndagens rækkefølge med tjekket før klubloggen (M3);
  - stierne med det rigtige ur uden tidsmaskine. Mine kørsler viser, at de virker.
- **Rettelse:** testene nævnt under H1, M1, M2 og M3. Tilføj mindst ét flow med det rigtige ur søndag 15/11 i `@date`.
