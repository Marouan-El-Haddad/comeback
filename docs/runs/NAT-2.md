# NAT-2 – en træningsoplevelse, der forklarer sig selv

Kører uden opsyn fra torsdag 5/11 om aftenen, til målet er nået. Brugeren sover og kan ikke svare. `CLAUDE.md` gælder fuldt ud. Kopiér først denne fil til `docs/runs/NAT-2.md`.

## Brugerens feedback efter første test (nattens vigtigste opgave)

Brugeren har prøvet appen på telefonen. Alt virker, men oplevelsen er for tynd:

- UX, UI og design føles tomt, simpelt og basalt. Intet er interaktivt, og der er hverken animationer eller forståelige figurer i høj kvalitet.
- Forklaringerne af øvelserne skal være forståelige, konkrete og praktiske. Det gælder teksten, men især det visuelle: figurer, illustrationer, animationer og interaktive elementer.
- Under passet skal det altid være klart, hvad der skal laves nu, og hvad der kommer bagefter, så man ikke bliver overrasket af hver ny øvelse, mens tiden går. Timerne er fine.
- Sproget skal være bedre.
- Appen må ikke henvise til PDF'en, sidetal eller kilder uden for appen. Den skal forklare sig selv og stå på egne ben. Den skal være poleret og lavet med tanke for pædagogik og tilgængelighed.
- Opstartstiden er ikke et problem for brugeren. Den må ikke blive værre, men tiden er bedre brugt på faglighed og pædagogik.

## Sådan arbejder du i nat

Du er orkestrator. Hovedsessionens kontekst skal holdes lille, så kvaliteten holder hele natten.

- Alt substantielt arbejde laves af underagenterne i `.claude/agents/`, alle på Opus 5.5 med max effort:
  - `comeback-builder` bygger kode
  - `comeback-coach` skriver øvelsesforklaringer
  - `comeback-reviewer` reviewer
- Byggeagenter, der ændrer kode, kører én ad gangen. Indholdsarbejde i hver sin fil (fx ét spor pr. agent) må køre parallelt, når agenterne ikke committer; du committer samlet bagefter.
- Du selv: planlægger pakkerne, skriver korte opgavebeskrivelser, verificerer, pusher og fører tjekliste og log. Små rettelser på få linjer må du lave selv. Læs ikke store filer eller lange testlogs ind i din egen kontekst; underagenterne svarer med korte resuméer.
- Tilstanden ligger i filer: `docs/runs/NAT-2-TASKS.md` (tjekliste med pakkerne) og `docs/runs/NAT-2-LOG.md` (én linje pr. delmål med klokkeslæt og resultat). Efter en komprimering læser du dem igen og fortsætter.
- Brug ikke dynamiske workflows eller ultracode i nat. Den første workflow-kørsel kræver brugerens godkendelse.
- Findes agenterne ikke, så brug generelle underagenter med agentfilernes indhold som prompt og modellen `claude-opus-5-5`, og notér det i loggen.
- Commit `.claude/agents/` i første pakke, men aldrig `.claude/settings.local.json`.

## Gangen i hver pakke

1. Skriv pakken i `NAT-2-TASKS.md`: mål, kilder med afsnit, acceptkriterier og de scenarier og Playwright-flows, der skal være grønne.
2. Den rette underagent bygger eller skriver, verificerer og svarer med sit resumé.
3. Du verificerer selv: `npm run check` slutter med exit 0, og `git log --stat` viser pakkens ændringer.
4. `comeback-reviewer` reviewer pakken og skriver `docs/reviews/nat2-<pakke>.md`. Ved indhold og figurer bedømmer den ud fra skærmbilleder, om en, der aldrig har set øvelsen, kan lave den rigtigt.
5. Fund med høj eller middel alvor bliver rettet af den agent, der lavede arbejdet, og reviewer tjekker derefter rettelserne. Lave fund retter du, hvis det er billigt; ellers bliver de forslag i rapporten.
6. Commit reviewrapporten, push, og vent på, at udgivelsen i GitHub Actions er grøn. Sæt kryds i tjeklisten, og skriv en linje i loggen.

## Pakker i prioriteret rækkefølge

Kortlæg først, hvad der allerede findes. Skriv derefter den endelige pakkeliste i `NAT-2-TASKS.md` inden for omfanget her. Del store pakker, så hver kan laves og reviewes i én frisk kontekst.

0. **Telefonfund** (`docs/runs/NAT-2-PHONE.md`): ret Diagnose, så den kun måler en ren opstart fra ikonet. Lav kun billige forbedringer af opstarten, højst en time.
1. **Kilderne først:** ret `docs/SPEC.md`, `docs/DECISIONS.md`, `docs/PLAN.md` og `CLAUDE.md` til den nye retning, og log den som Afvigelse og Tilføjelse:
   - ingen henvisninger til PDF, sidetal eller kilder i appen; »Hvorfor« forklarer selv, og Om viser ikke kilder
   - øvelseskort med animerede figurer
   - »nu og næste« under passet
   - en forklaring af, hvordan programmet virker
   - milepæl 6 (figurer) rykkes frem og udvides med animation

   Programmets indhold (navne, doser og regler) ændres ikke; forklaringerne er et lag ovenpå. Læg dem i egne filer, så sammenligningen med kilden stadig holder. Definér datamodellen for forklaringer og figurer, før indholdet skrives.
2. **Øvelsesforklaringer** (`comeback-coach`): for hvert trin skrives
   - hvad trinnet træner
   - udgangsstilling
   - 2–4 nummererede trin
   - tempo og vejrtrækning
   - de 2–3 vigtigste cues
   - typiske fejl med rettelse
   - lettere og sværere variant
   - udstyr
   - en »Gør klar«-tekst til pausen før øvelsen
   - positionerne i ord, som figurerne bygger på

   Først de øvelser, som trin 1 og 2 bruger, plus opvarmning, burpee-teknik, nakke og Open & Strong; derefter resten. Doser og regler ændres ikke.
3. **Figurer og animation:** byg et figursystem i appen ud fra Python-motoren i `tools/pictos/`, i samme stil som piktogrammerne:
   - Positionerne fra forklaringerne bliver til keyframes, og appen animerer mellem dem i øvelsens tempo, fx push-up: 3 sek ned, 1 sek stille, op.
   - Faserne vises som tekst under figuren.
   - Et tryk på figuren afspiller i slowmotion.
   - Ved reduceret bevægelse vises positionerne som stillbilleder side om side.
   - Rækkefølgen er den samme som for forklaringerne.

   Kravene til kvaliteten:
   - mindst som piktogrammerne
   - led, der bøjer den rigtige vej
   - rigtig kontakt med gulv, væg og stol
   - tempo som dosis
4. **Passet – hvad nu, hvad næste:**
   - »Dagens pas« på ét blik før start: blokke, øvelser med figur, sæt × reps, pauser, udstyr og forventet tid.
   - Under passet er »Nu« (figur, mål, 2 cues) og »Næste« (figur, navn, mål) altid synlige, og det samme er fremdriften i passet.
   - I pausen vises den næste øvelse stort med animation og »Gør klar«-tekst.
   - Første gang en øvelse kommer i passet, vises et kort introkort med animation og trin, før timeren går. Et tryk lukker det.
   - Bevægelse i brugerfladen bruges kun, hvor den viser, hvad der ændrede sig.
5. **Design og sprog:**
   - Løft hele appen visuelt i PDF'ens identitet: thai-rød og navy, Kanit og Bai Jamjuree, store tal, plakatstil og navy skillere med store røde tal mellem blokkene. Appen skal føles poleret, ikke tom.
   - Øvelsen og figuren er hovedpersonen.
   - Undgå alt på listen over forbudte mønstre i `docs/SPEC.md` afsnit 5, og desuden ens kort i gitter og grå tekst på grå baggrund.
   - Gennemgå alle tekster: konkret og kort, du-form, samme ord for det samme overalt og ingen fagudtryk uden forklaring.
   - Tilgængelighed:
     - kontrast mindst 4,5:1 (7:1 i passet)
     - trykflader mindst 56 px
     - tekst mindst 16 px
     - figurer og animationer har et tekstalternativ
     - intet budskab vises kun med farve
6. **Sådan virker programmet:** et kort, interaktivt afsnit under Mere og i indfasningen. Det forklarer trafiklyset, reserve, dobbelt progression, ugerne og de lette uger med små dynamiske grafikker i stedet for tekstmure.
7. **Livet** (det vigtigste fra M3):
   - flyt og spring over (ENGINE 5.9)
   - søndagstjek (SPEC 4.7)
   - syg, rejse, ferie, klubben lukket og begivenheder (ENGINE 5.7 og R-EVENT)
   - klublog med lørdagskarakter (SPEC 4.6, P25)
8. **Resten af M3:**
   - jul og nytår (5.8)
   - ugeplan med ekstra Muay Thai-dage (5.10)
   - flad-reglen og smerte-gendannelsen gjort synlige
   - .ics-fil
   - historik med klubtræninger
   - småtingene fra NAT-1: `cancel-in-progress`, `mirrorStatus` og »Hold pause« tilbage til fanerne
9. **Valgfri:** milepæl 4.

Pakke 9 er valgfri. Andre pakker må kun udskydes, hvis de er blokeret af noget, som kun brugeren kan afgøre. Udskudte pakker skrives i rapporten.

## Krav til alle pakker

- Brugerens rigtige data må aldrig gå tabt. Brugeren har lavet indfasningen på telefonen. Ændringer i lager eller hændelser kun med migration, backup og test.
- Ny brugerflade dækkes af Playwright-flows i `pixel9a` og `pixel9a-utc`, hvor datoer indgår. Brug tidsmaskinen til at styre datoen.
- Gør tjeklisterne i `docs/PLAN.md` for de milepæle, der bygges, til Playwright-flows i tidsmaskinen, så brugeren ikke skal gennemføre dem i hånden.
- JavaScript forbliver under 150 kB gz. Figurer genereres som SVG, ikke som tunge billeder.

## Slutrapport

Skriv `docs/runs/NAT-2-REPORT.md` med opsummeringen fra `CLAUDE.md`. Medtag desuden:
- færdige og udskudte pakker
- reviewfund i tal (fundet og rettet pr. alvor)
- testtal og bundle-størrelser
- URL'erne
- de vigtigste nye skærmbilleder
- en tjekliste til telefonen med højst seks ja/nej-punkter, der kan klares i tidsmaskinen på ti minutter

Commit og push rapporten, og skriv opsummeringen i chatten.
