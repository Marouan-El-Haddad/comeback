# Review af NAT-2 P0 – Diagnose måler kun en ren opstart fra ikonet

2026-11-05 · commits `424db8a..ba4cf6f` (5615f0f, 42be8dc, cec1e7a, 5e29c99, 279b63c, 5d0281f, ba4cf6f)

Metode: Koden er læst mod `docs/runs/NAT-2-TASKS.md` (P0), `docs/runs/NAT-2-PHONE.md`, `docs/SPEC.md` 3.6, 7 og 8 og `docs/DECISIONS.md` D34 og D35. Kontrollerne og hele Playwright-suiten er kørt i worktreen. Desuden er der kørt scratch-tests i `pixel9a`-profilen mod et build af ba4cf6f (ikke committet): browserfane, tilbage/frem, genoptaget pas som første skærm, genoptagelse uden net, en ny udgivelse med »Opdatér« og en før/efter-måling mod 424db8a. Endelig er der lavet en mutationskørsel i en scratch-kopi.

## Resultat

0 høj, 0 middel og 4 lav.

Acceptkriterierne 1–5 er opfyldt. Kriteriet for en ren opstart er implementeret, som SPEC 7 og D34 beskriver det, og hvert grænsetilfælde opfører sig rigtigt (se tabellen nedenfor). Data er ikke i fare. Passet og Open & Strong virker uden net, også når et halvt pas genoptages. Opstarten er ikke blevet langsommere.

De fire fund handler om to huller i testene og to sjældne tilfælde, hvor tallet på Diagnose stadig kan vildlede.

## Fund

1. **L1 (lav)**: Testen »tidsmaskinen giver ingen måling« prøver ikke tidsmaskine-reglen.
   - Hvor: `e2e/diagnose.spec.ts:107–134`, `src/ui/model.ts:106` (`noteTimeMachine()`).
   - Hvorfor: NAT-2-TASKS P0, Grønt (»tidsmaskine … giver ingen«), SPEC 7 betingelse (4) og D34.
     - I første halvdel er dommen allerede faldet ved indfasningen, før tidsmaskinen åbnes.
     - Anden halvdel viser kun, at en senere tidsmaskine ikke tilføjer en måling.
     - Med `noteTimeMachine()` fjernet består testen stadig (mutationskørsel, 5/5 grønne). Appen opfører sig rigtigt: tidsmaskinen kan først åbnes fra Om, efter I dag er målt, så betingelsen er et værn uden nogen vej i appen i dag. Testens navn lover bare mere, end den prøver.
   - Rettelse:
     - Omdøb testen til »tidsmaskinen tilføjer ingen måling«.
     - Assertér i første halvdel, at `startup-this` er »Denne opstart tæller ikke: indfasningen var i brug.«.
     - Skriv i D34, at betingelse (4) for tidsmaskinen er et værn uden nuværende vej.

2. **L2 (lav)**: Ingen test viser, at et faneblad i browseren ikke tæller, og ingen viser det for tilbage/frem.
   - Hvor: `e2e/diagnose.spec.ts`. Alle tests, der læser dommen, kalder `pretendInstalled` (linje 60, 108 og 137). Koden er `src/ui/startup.ts:112–118` (`standalone()`) og `122–132` (`navigationType()`).
   - Hvorfor: P0-målet (»… et faneblad i browseren tæller ikke«) og SPEC 7 betingelse (1) og (2).
     - Med `standalone()` sat til altid at give `true` består både `diagnose.spec.ts` og `tabs.spec.ts` (mutationskørsel), så et brud her ville ikke blive opdaget.
     - Adfærden er rigtig i dag, verificeret med scratch-tests:
       - Faneblad: »Denne opstart tæller ikke: ikke åbnet som installeret app.«, og der gemmes ingen måling.
       - Mere → Programmet → tilbage: Firefox indlæser siden igen med typen `back_forward`. Der står »åbnet med tilbage«, og der kommer ingen ny måling.
   - Rettelse: Tilføj to korte tests i `diagnose.spec.ts`:
     - (a) Uden `pretendInstalled`: `goto` → `onboard` → `openFromIcon`. Forvent `storedStarts` = 0 og dommen »… ikke åbnet som installeret app.«.
     - (b) Med `pretendInstalled`: én ren opstart → Mere → »Programmet« → `page.goBack()`. Forvent stadig 1 måling.

3. **L3 (lav)**: En opstart, hvor appen kom i baggrunden, før I dag blev tegnet, tæller som ren med en oppustet tid.
   - Hvor: `src/ui/startup.ts:165–185` (`markTodayVisible`) og `34–44` (`notClean`), `docs/SPEC.md` 7.
   - Hvorfor: Brugerens beslutning (NAT-2-PHONE punkt 5) og P0-målet: Diagnose må kun vise tal fra en ren opstart.
     - `requestAnimationFrame` kører ikke, mens siden er skjult. Mærket `cb-today` sættes derfor først, når appen er synlig igen.
     - Tiden gemmes og vises som »Seneste«. Det er den samme slags misvisende tal som de 75.735 ms i telefonfundet.
     - Det er sjældent: man skal skifte væk i løbet af de ca. 4 sekunder, starten tager. Medianen dæmper det.
   - Rettelse:
     - Først SPEC 7 og D34: tilføj betingelse (5) »appen var synlig, til I dag var tegnet«.
     - I `startup.ts`: sæt `hidden` til `document.visibilityState === 'hidden'`, når modulet indlæses, og lad en `visibilitychange`-lytter sætte `load.hidden = true`, indtil målingen er taget.
     - `notClean` skal give »appen var i baggrunden«.
     - Tilføj et tilfælde i `startup.test.ts`.

4. **L4 (lav)**: Målinger fra forskellige versioner blandes i »Median af 5«.
   - Hvor: `src/ui/startup.ts:13–20` (`StartupTime`) og `75–77`, `src/ui/screens/More.tsx:357–409` (`StartupTimes`).
   - Hvorfor: NAT-2-TASKS, Fælles krav: »Opstarten må ikke blive langsommere (Diagnose og `e2e/perf.spec.ts`)«.
     - Efter en udgivelse indeholder listen starter fra både den gamle og den nye version. Det er verificeret i en scratch-test med to udgivelser, der gav versionerne A, A og B i samme liste.
     - Skærmen siger ikke, hvilken version en måling kommer fra.
     - Medianen kan derfor først vise, om en ny version er blevet langsommere, når 3 af de 5 starter er fra den.
   - Rettelse:
     - Først SPEC 7 og D34.
     - Gem versionen (`__APP_VERSION__`) i hver måling. Ældre målinger uden version læses som »ukendt«.
     - Vis »Seneste« og medianen kun for den aktuelle version, fx »Median af 3 (denne version)«. Er der ingen måling for den aktuelle version, vises teksten »Ingen måling endnu. Luk appen helt, og åbn den fra ikonet.«.

## Verificeret

### Kriteriet og grænsetilfældene

D34 læser »i samme indlæsning« som »før I dag er synlig«. Det holder: målingen er færdig, når I dag er tegnet, og tidsmaskinen kan først åbnes bagefter fra Om. SPEC 7, D34, `notClean` og teksterne på Diagnose stemmer overens.

| Tilfælde                                                   | Resultat                                                                                                                                                         | Prøvet med                           |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Ren opstart (standalone, `navigate`, I dag først)          | Gemmes. Diagnose viser »Denne opstart er talt med.« og begge tider                                                                                               | `diagnose.spec.ts`, skærmbillede     |
| Første indlæsning efter installation                       | Med indfasning: tæller ikke. Er indfasningen lavet før (fx i browserfanen), er det en rigtig start fra ikonet og tæller                                          | `diagnose.spec.ts`, koden            |
| Indfasning                                                 | »indfasningen var i brug«, ingen måling                                                                                                                          | `diagnose.spec.ts`                   |
| Tidsmaskine                                                | Tilføjer ingen måling. En ren måling fra før tidsmaskinen beholdes (D34)                                                                                         | `diagnose.spec.ts` (se L1)           |
| Genindlæsning                                              | »genindlæsning«, ingen måling                                                                                                                                    | `diagnose.spec.ts`                   |
| Tilbage/frem (Mere → Programmet → tilbage)                 | `back_forward`, »åbnet med tilbage«, ingen ny måling                                                                                                             | scratch-test (se L2)                 |
| Faneblad i browseren                                       | »ikke åbnet som installeret app«, ingen måling                                                                                                                   | scratch-test (se L2)                 |
| Genoptaget pas som første skærm                            | Ingen måling (»I dag var ikke første skærm«)                                                                                                                     | scratch-test, `startup.test.ts`      |
| Ny udgivelse (service worker)                              | En start med den gamle version fra cachen tæller. »Opdatér« genindlæser siden, som så ikke tæller (»genindlæsning«). Næste start fra ikonet tæller med den nye version | scratch-test med to udgivelser       |
| Appen i baggrunden under starten                           | Tæller med en oppustet tid                                                                                                                                       | koden (se L3)                        |

### Datasikkerhed

- Pakken ændrer intet i `src/storage/`, `src/engine/` eller `program/`. `DB_VERSION` og `SCHEMA_VERSION` er stadig 1.
- Målingerne ligger i `localStorage['comeback.startup']` med højst 5 × ca. 70 byte. De ligger uden for loggen, spejlet, eksporten og backuppen, og skrivningen er pakket ind i try/catch.
- Spejlets status bliver kun læst (`model.real.mirrorStatus`).
- Tidsmaskinen sætter kun et flag i hukommelsen. I simuleringen tegnes I dag igen, men det giver ingen ny måling (`diagnose.spec.ts`, anden halvdel).

### Opstart og offline

- Service workeren precacher alle de nye filer: `engine`, `index`, `Runner`, `OpenStrong` og `timers` (tjekket i `dist/sw.js`).
- Passet og Open & Strong starter uden net (`offline.spec.ts`).
- Et pas, der blev lukket midtvejs, genoptages uden net på samme sæt. Det virker også ud fra loggen alene via »Fortsæt passet« (scratch-test).
- Mens en ny version venter, leverer den gamle service worker stadig den gamle versions filer til passet. De slettes først, når den nye version aktiveres, og det sker sammen med genindlæsningen.
- Bundle:
  - Før: 58,4 kB gz (index 56,2 + workbox 2,2).
  - Efter: 62,6 kB i alt. Ved start indlæses 52,9 kB (engine 26,5 + index 24,2 + workbox 2,2). De resterende 9,8 kB hentes efter 1 sek (Runner 7,6, timers 1,2, OpenStrong 1,0).
  - Under budget.
- Før/efter-målingen er lavet i Firefox med JIT slået fra i `pixel9a`-profilen, uden net og med service worker. 424db8a og ba4cf6f blev målt på skift i samme browser i 2 kørsler med 40 og 50 starter pr. variant. Medianer:

| Indlæsning     | Første tegning før → efter     | I dag synlig før → efter       |
| -------------- | ------------------------------ | ------------------------------ |
| Genindlæsning  | 39 → 31 ms og 39 → 33 ms       | 47 → 41 ms og 46 → 44 ms       |
| Ny navigation  | 37 → 34 ms og 41 → 34 ms       | 47 → 46 ms og 52 → 46 ms       |

Opstarten er ikke blevet langsommere, men en anelse hurtigere. Telefonens start på ca. 3,8 sek er ikke målt.

### Kommandoer

- `npx vitest run`: 343 bestået (17 filer).
- `npx tsc --noEmit`: 0 fejl. `npx eslint .` og `npx prettier --check .`: rene.
- `npm run build`: JS 62,6 kB gz, CSS 3,1 kB.
- `E2E_PORT=4181 npx playwright test`: 24 bestået (22 i `pixel9a`, 2 i `pixel9a-utc`) på 8,3 min.
- Mutationskørsel i en scratch-kopi, hvor `noteTimeMachine()` er fjernet og `standalone()` altid giver `true`: `diagnose.spec.ts` og `tabs.spec.ts` består stadig (5/5). Det understøtter L1 og L2.

### Skærmbilleder

- `screenshots/diagnose.png` er committet.
- To nye skærmbilleder fra revieweren:
  - `screenshots/review-p0-diagnose-ingen-maaling.png` viser tilstanden uden måling.
  - `screenshots/review-p0-diagnose-talt-med.png` viser en ren opstart på 36 og 39 ms.
- Al tekst er mindst 16 px. »Seneste«, »Median« og rækkenavnene står i `--c-muted` på hvid (5,4:1). Der er ingen forbudte mønstre.
- Teksterne er korte og ens med resten af appen (»Luk appen helt, og åbn den …«). Diagnose bruges ikke under et pas.

## Til telefonen

1. Luk appen helt, og åbn den fra ikonet. Gå til Mere → Om → Diagnose. Står der »Denne opstart er talt med.« og tal under »Opstart fra ikonet«? Står der i stedet »navigationstypen er ukendt« eller »ikke åbnet som installeret app«, virker kriteriet ikke i IronFox.
2. Står der under Spejl »N hændelser · gemt kl. …«?

## Uden for pakken (ikke fund i P0)

- Om: »Kilderne står i programmets side 54.« (`More.tsx:252`). Det hører til P1.
- Diagnose: `toFixed` giver »Lagerplads 1.0 MB af 10737 MB« (`More.tsx:307`). SPEC 8 kræver da-DK, altså »1,0 MB af 10.737 MB«. Fejlen har været der siden M2.
- Åbnes appen, mens den allerførste service worker stadig installerer, viser den »Ny version klar«, fordi vite-plugin-pwa ser det som en installation udefra. Fejlen har været der siden M2 og er harmløs, fordi »Opdatér« bare genindlæser.
- Passet gemmer sin position i en effekt, der kører efter tegningen. En ny indlæsning inden for samme billede genoptager derfor ved pausen før sættet (set i en scratch-test). Det har været sådan siden M2 og betyder intet i praksis, men det forklarer rettelsen i 5d0281f.
- `cancel-in-progress: true` (cec1e7a) er lavet som bestilt. En aflyst kørsel står som »cancelled«, så det er den nyeste kørsel, der skal være grøn.
