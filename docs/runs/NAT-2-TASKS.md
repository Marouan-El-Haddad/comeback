# NAT-2 – tjekliste

Opgaven: `docs/runs/NAT-2.md`. Tidslinjen: `docs/runs/NAT-2-LOG.md`. Telefonfundene: `docs/runs/NAT-2-PHONE.md`.

Gangen i hver pakke: pakken beskrives her → underagenten bygger eller skriver og verificerer → orkestratoren tjekker `npm run check` (exit 0) og `git log --stat` → `comeback-reviewer` skriver `docs/reviews/nat2-<pakke>.md` → høje og middel fund rettes af den agent, der lavede arbejdet, og tjekkes af revieweren → rapporten committes, der pushes, og udgivelsen i GitHub Actions skal være grøn → kryds her og en linje i loggen.

Status: `[ ]` ikke startet · `[~]` i gang · `[x]` færdig (reviewet og udgivet) · `[-]` udskudt (med begrundelse).

## Fælles krav (alle pakker)

- `CLAUDE.md` gælder fuldt ud. Brugerens rigtige data må aldrig gå tabt; brugeren har lavet indfasningen på telefonen. Ændringer i lager eller hændelser kun med migration, backup og test.
- Programmets indhold (navne, doser, tempo og regler) ændres ikke. Forklaringer og figurer er et lag ovenpå i egne filer, så `program-source.spec.ts` stadig holder.
- Ny brugerflade dækkes af Playwright-flows i `pixel9a` og i `pixel9a-utc`, hvor datoer indgår (mærket `@date`). Datoen styres med tidsmaskinen. Tjeklisterne i `docs/PLAN.md` for de milepæle, der bygges, bliver Playwright-flows i tidsmaskinen.
- JavaScript under 150 kB gz. Figurer genereres som SVG, ikke som billeder. Opstarten må ikke blive langsommere (Diagnose og `e2e/perf.spec.ts`).
- Ingen henvisninger til PDF, sidetal eller kilder i appen.
- Skærmbilleder af ændrede skærme i `screenshots/`.

## Pakker

### [x] P0 – Diagnose måler kun en ren opstart fra ikonet (opgavens pakke 0)

- Status: færdig 23:29. Review `docs/reviews/nat2-p0-diagnose.md`: 0 høje, 0 middel, 4 lave (L1–L4 rettes billigt af P0-agenten, når P1 er færdig). Udgivet (Actions 42121795936).
- Agent: `comeback-builder`.
- Mål: Diagnose viser kun tal fra en ren opstart: appen åbnet fra ikonet som en ny indlæsning, hvor I dag er første skærm. En indlæsning med indfasning eller tidsmaskine, en genindlæsning eller et faneblad i browseren tæller ikke. Billige forbedringer af opstarten, højst en time. Desuden to småting fra NAT-1: spejlets status (`mirrorStatus`) på Diagnose og `cancel-in-progress: true` i `.github/workflows/deploy.yml`.
- Kilder: `docs/runs/NAT-2-PHONE.md`; `docs/SPEC.md` 1 (SK1), 3.6 og 7; `docs/PLAN.md` M2 (Diagnose); `docs/DECISIONS.md` om ydelse; `src/ui/screens/More.tsx`; `e2e/perf.spec.ts`.
- Accept:
  1. Diagnose viser seneste rene opstart (første tegning og I dag synlig) og medianen af de seneste rene opstarter. Ellers en tekst, der siger, hvordan man får en måling: luk appen helt, og åbn den fra ikonet.
  2. Kriteriet for »ren opstart« står i `docs/SPEC.md` 7 og i `docs/DECISIONS.md`: standalone, navigationstype `navigate`, I dag som første skærm, ingen indfasning og ingen tidsmaskine i samme indlæsning.
  3. Målingerne gemmes uden for hændelsesloggen og kræver ingen migration.
  4. Spejlets status står på Diagnose.
  5. Opstarten er målt før og efter i `e2e/perf.spec.ts` og er ikke blevet langsommere.
- Grønt: `npm run check`; Playwright: ren opstart giver en måling; indfasning, tidsmaskine og genindlæsning giver ingen; hele suiten i `pixel9a` og `pixel9a-utc`.
- Skærmbillede: `screenshots/diagnose.png`.

### [x] P1 – Kilderne først: den nye retning og datamodellen for forklaringer og figurer (pakke 1)

- Status: færdig 02:45. Review `docs/reviews/nat2-p1-kilder.md`: 0 høje, 5 middel, 6 lave, alle rettet og tjekket i »Opfølgning«; ét nyt lavt fund (L7) rettes i P3. Udgivet (Actions 42145649687).
- Agent: `comeback-builder`.
- Mål: `docs/SPEC.md`, `docs/DECISIONS.md`, `docs/PLAN.md` og `CLAUDE.md` rettet til den nye retning og logget i `docs/DECISIONS.md` afsnit 3 som Afvigelse og Tilføjelse:
  - ingen henvisninger til PDF, sidetal eller kilder i appen; »Hvorfor« forklarer selv, og Om viser ikke kilder;
  - øvelseskort med animerede figurer;
  - »Dagens pas« før start, »Nu og næste« under passet, den næste øvelse i pausen og et introkort første gang;
  - »Sådan virker programmet« under Mere og i indfasningen;
  - milepæl 6 (figurer) rykkes frem og udvides med animation;
  - designløftet i PDF'ens identitet og de skærpede krav til tilgængelighed i SPEC 5 og 6 (kontrast 4,5:1 og 7:1 i passet, trykflader ≥ 56 px, tekst ≥ 16 px, tekstalternativ til figurer, intet budskab kun med farve; nye forbudte mønstre: ens kort i gitter og grå tekst på grå baggrund).
- Datamodellen defineres, før indholdet skrives: filer adskilt fra `program/*.json`, TypeScript-typer, en valideringstest (alle trin-ID'er findes, felterne fra opgavens pakke 2, 2–4 trin, cues på højst seks ord, ingen PDF-, side- eller kildehenvisninger, ingen emojis eller udråbstegn) og et kommandolinjetjek af én fil, som indholdsagenterne kan køre: `node scripts/check-explain.ts <fil>`. Figurernes keyframes og faser defineres samme sted, så figursystemet kan bygge på dem.
- Koden: de henvisninger til PDF, sidetal og kilder, som brugeren kan se i appen i dag, fjernes (Om, »Hvorfor«, motorens forklaringer). En test fejler, hvis UI-tekst henviser til PDF, sidetal eller kilder. Ændres motorens forklaringer, sker det efter ændringsprotokollen (ENGINE først, så test, så kode).
- Kilder: `docs/runs/NAT-2.md`; SPEC 3, 5 og 6; PLAN M5 og M6; DECISIONS 3 og 6; ENGINE 7.1 og 9; `CLAUDE.md`.
- Grønt: `npm run check` (inkl. `program-source.spec.ts` uændret); hele Playwright-suiten.

### [x] P2 – Øvelseskortet og forklaringerne, del 1 (pakke 2)

- Status: færdig 03:20. Review `docs/reviews/nat2-p2-forklaringer-1.md`: 0 høje, 4 middel, 11 lave; opfølgningen viser 14 af 15 rettet og alle 4 middel rettet; I8 rettet af orkestratoren. Nye lave fund: N1 og N2 rettes i trænernes runde efter P5-reviewet, N3 (test af boksen »Lettere variant i dag«) laves i P6. Udgivet (Actions 42149465609).
- Agenter: `comeback-coach` × flere parallelt (en gruppe spor pr. agent, hver sin fil, ingen commits) og `comeback-builder` til kortet i appen.
- Mål, indhold: alle felter fra opgavens pakke 2 for trin 1 og 2 i alle spor, alle trin i burpee-teknik og nakke, opvarmningen og de øvrige rutiner i `program/routines.json` samt Open & Strong; desuden sporets »Hvorfor«.
- Mål, app: øvelseskortet (navn, dosis, figur eller piktogram, »Træner«, udgangsstilling, trin, tempo og vejrtrækning, cues, typiske fejl, lettere og sværere, udstyr) kan åbnes fra Stiger og fra passet; detaljer kan foldes ud. Skærmbilleder af kortet for alle trin i del 1.
- Kilder: `docs/PROGRAM_KILDE.md` (sporenes afsnit); datamodellen fra P1; SPEC 3.2 og 3.5.
- Grønt: `node scripts/check-explain.ts` for hver fil; `npm run check`; Playwright-flow, der åbner kortet fra Stiger og fra et pas.

### [~] P3 – Figursystemet og animationen (pakke 3)

- Agent: `comeback-builder`.
- Mål: et figursystem i appen bygget ud fra `tools/pictos/` i samme stil som piktogrammerne: keyframes fra positionerne i forklaringerne, animation mellem dem i øvelsens tempo (fx push-up: 3 sek ned, 1 sek stille, op), faserne som tekst under figuren, et tryk afspiller i slowmotion, ved reduceret bevægelse vises positionerne som stillbilleder side om side, og figuren har et tekstalternativ. Et værktøj, der tegner alle positioner for et spor som et kontaktark (PNG) til review. Figuren vises i øvelseskortet.
- Kvalitet som tests: led bøjer den rigtige vej, kontakt med gulv, væg og stol passer, fasernes varighed svarer til tempoet i dosis.
- Omfang: motoren, kortet og tre referenceøvelser (bl.a. push-up). Resten af figurerne laves i P4 og P5.
- Kilder: `tools/pictos/`; datamodellen fra P1; SPEC 5 og 6.
- Grønt: `npm run check`; Playwright: figuren animerer, tryk giver slowmotion, reduceret bevægelse giver stillbilleder; opstarten er ikke blevet langsommere.

### [~] P4 – Figurerne, del 1 (pakke 3, rækkefølge som forklaringerne)

- Agenter: `comeback-builder` × flere parallelt på datafiler (et spor eller en gruppe pr. agent, ingen kodeændringer, ingen commits).
- Mål: keyframes for alle trin i del 1 ud fra »positioner i ord«; kontaktark i `screenshots/figures/`.
- Grønt: figurtestene; `npm run check`.

### [~] P5 – Forklaringer og figurer, del 2 (pakke 2 og 3, resten)

- Agenter: `comeback-coach` × flere parallelt, derefter `comeback-builder` × flere parallelt på datafiler.
- Mål: forklaringer og keyframes for alle øvrige trin; kontaktark og skærmbilleder af kortene.
- Grønt: `node scripts/check-explain.ts`, figurtestene og `npm run check`.

### [~] P6 – Passet: hvad nu, hvad næste (pakke 4)

- Agent: `comeback-builder`.
- Fra tidligere reviews: N3 fra P2 (en test af boksen »Lettere variant i dag«).
- Mål: »Dagens pas« på ét blik før start (blokke, øvelser med figur, sæt × gentagelser, pauser, udstyr, forventet tid); under passet er »Nu« (figur, mål, 2 cues), »Næste« (figur, navn, mål) og fremdriften altid synlige; i pausen vises næste øvelse stort med animation og »Gør klar«; første gang en øvelse kommer i passet, vises et introkort med animation og trin i pausen før øvelsens første sæt, og det lukker ved et tryk eller af sig selv, når pausen slutter, så SK3 holder (D44, som erstatter D41). Bevægelse kun, hvor den viser en ændring. Desuden »Hold pause« som vej tilbage til fanerne midt i et pas (NAT-1 forslag 3).
- Kilder: SPEC 3.2, 3.3, 4.2–4.5, 5 og 6 (efter P1).
- Grønt: Playwright: Styrke A, Styrke B, motor og Open & Strong gennem tidsmaskinen med »Nu«, »Næste«, pause og introkort; et pas uden berøring, hvor SPEC lover det; opstarten ikke langsommere.

### [ ] P7 – Design: visuelt løft af hele appen (pakke 5, første del)

- Agent: `comeback-builder`.
- Mål: hele appen i PDF'ens identitet (thai-rød og navy, Kanit og Bai Jamjuree, store tal, plakatstil, navy skillere med store røde tal mellem blokkene); øvelsen og figuren er hovedpersonen; ingen forbudte mønstre fra SPEC 5, ingen ens kort i gitter og ingen grå tekst på grå baggrund.
- Grønt: skærmbilleder af alle skærme; hele Playwright-suiten.

### [ ] P8 – Sprog og tilgængelighed (pakke 5, anden del)

- Agent: `comeback-builder`.
- Mål: alle tekster gennemgået (konkret og kort, du-form, samme ord for det samme, fagudtryk forklaret); tilgængelighedskravene fra SPEC 6 tjekket automatisk i Playwright, hvor det kan lade sig gøre (kontrast, trykflader, tekststørrelse, tekstalternativer).
- Grønt: tilgængelighedsflowet; hele Playwright-suiten.

### [ ] P9 – Sådan virker programmet (pakke 6)

- Agent: `comeback-builder`.
- Mål: et kort, interaktivt afsnit under Mere og i indfasningen om trafiklyset, reserve, dobbelt progression, ugerne og de lette uger med små dynamiske grafikker i stedet for tekstmure.
- Grønt: Playwright-flow gennem afsnittet fra Mere og fra indfasningen.

### [ ] P10 – Livet: flyt og spring over (pakke 7)

- Agent: `comeback-builder`. Kilder: ENGINE 5.9, SPEC 3.1 og 4.11, PLAN M3.
- Grønt: scenarierne for R-MOVE og R-REST; Playwright i tidsmaskinen (`@date`).

### [ ] P11 – Livet: søndagstjek og klublog med lørdagskarakter (pakke 7)

- Agent: `comeback-builder`. Kilder: SPEC 4.6 og 4.7, DECISIONS P25, PLAN M3.
- Grønt: Playwright i tidsmaskinen (`@date`).

### [ ] P12 – Livet: syg, rejse, ferie, klubben lukket og begivenheder (pakke 7)

- Agent: `comeback-builder`. Kilder: ENGINE 5.7 og R-EVENT, SPEC 4.11, PLAN M3.
- Grønt: Playwright i tidsmaskinen (`@date`).

### [ ] P13 – Resten af M3: jul og nytår og ugeplan med ekstra Muay Thai-dage (pakke 8)

- Agent: `comeback-builder`. Kilder: ENGINE 5.8 og 5.10, PLAN M3.
- Grønt: Playwright i tidsmaskinen (`@date`).

### [ ] P14 – Resten af M3: flad-reglen og smerte-gendannelsen synlige, .ics-fil og historik med klubtræninger (pakke 8)

- Agent: `comeback-builder`. Kilder: ENGINE 5.5 og 5.11, SPEC 3.6 og 4.11, PLAN M3.
- Grønt: Playwright i tidsmaskinen (`@date`); PLAN M3's tjekliste som flows.

### [ ] P15 (valgfri) – Milepæl 4 (pakke 9)

- Agent: `comeback-builder`. Kilder: PLAN M4, SPEC 4.9 og 4.10, ENGINE 5.12.
