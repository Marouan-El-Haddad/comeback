# NAT-1 – milepæl 0 afsluttes, milepæl 1 og 2 bygges

Kører uden opsyn fra torsdag 5/11 om aftenen. Brugeren sover og kan ikke svare. `CLAUDE.md` gælder fuldt ud. Kopiér først denne fil til `docs/runs/NAT-1.md`.

## Rækkefølge og prioritet

1. Afslut milepæl 0 (kort).
2. Milepæl 1 med selvreview.
3. Milepæl 2, så appen kan bruges fra programstarten mandag 9/11.

Når du ikke kan nå det hele, er en grøn og udgivet M1 vigtigere end en halv M2. En udgivet M2-kerne (onboarding, I dag og Styrke A) er vigtigere end resten af M2.

## 1. Afslut milepæl 0

Telefonresultater, IronFox 159.0.1 på Pixel 9a, 5/11:

- 1 Installation GRØN: STANDALONE, åbnet fra ikonet, service worker styrer siden.
- 2 Lager GRØN: samme tal efter lukning og efter genstart. »Delete browsing data on quit« er slået fra. `persist()` gav en prompt, brugeren tillod, persisted = ja.
- 3 Offline: ikke gyldigt testet, fordi wifi var tændt i flytilstand (»Net lige nu: online«). »Klar til offline: ja«. Offline er en bonus for brugeren og ikke et krav, så punktet afgør ikke platformen. Ret D18, og behold offline-funktionen.
- 4 Opdatering GRØN: »Ny version klar« kom af sig selv, og v2 viste samme tal.
- 5 Wake Lock GRØN: både API'et og fallback-videoen holdt skærmen tændt i 3 min.
- 6 Lyd GRØN: alt kunne høres fra gulvet 1 m væk. Vibration RØD: `navigator.vibrate` findes ikke.
- 7 Tid og sprog GRØN: tidszone Europe/Copenhagen, sprog en-US (spoofet). da-DK og en-CA virker, når de angives eksplicit.
- 8 Ydelse RØD: first-contentful-paint 2.050 ms, afspilning 1,4 ms i snit over 771 kørsler, urets opløsning 16,7 ms.
- 9 Filer: eksport til Downloads og import virker. Web Share findes ikke.
- 10 Viewport 414 × 847, devicePixelRatio 2 (standalone).

Gør:

- Udfyld `probe/RESULTS.md`. Skriv i `docs/DECISIONS.md`: platform = IronFox-PWA; ingen vibration (kun lyd); ingen »Del«-knap; `persist()` viser en prompt og kaldes efter første loggede pas som planlagt. Luk O1–O5.
- Ret Playwright-projektet `pixel9a` og teksterne i `CLAUDE.md` og `docs/SPEC.md` til de målte værdier: viewport 414 × 847, DPR 2, locale en-US, timezone Europe/Copenhagen, og Firefox med JIT slået fra via præferencer. Tilføj en kørsel med timezone UTC til datotestene. Det er M0-forslaget, og det er godkendt.
- Find ud af, om probens egen afspilning eller indlæsningen af fonte forsinker første tegning, og skriv konklusionen i `RESULTS.md`. Appens krav er SK1, og det måles i milepæl 2.
- Sørg for, at appens service worker ikke overtager `/comeback/probe/`.

## 2. Milepæl 1 – motoren og programdata

Som beskrevet i `docs/PLAN.md` og i tilføjelsen til milepæl 1 i `docs/KICKOFF.md` afsnit 2. Desuden:

- Godkendt M0-forslag: en lint-regel, der forbyder `Date.now()`, `new Date()` uden argument og `Math.random` i `src/engine/`.
- En test sammenligner navn, niveau, dosis og udførelse for hvert trin i `program/*.json` med tabellerne i `docs/PROGRAM_KILDE.md`. Den gør det samme for ugetabellen, Målbrættet, Hero-tavlen, imponer-kataloget, sidegrenene og boss-listen. Så skal `/program` ikke tjekkes i hånden.
- Selvreview, når acceptkriterierne er opfyldt: lad en subagent i frisk kontekst, som ikke har set koden blive skrevet, gennemgå `src/engine/` og `program/` mod `docs/ENGINE.md` og `docs/PROGRAM_KILDE.md`. Den rapporterer kun fejl i korrekthed og afvigelser fra kilderne, ikke stil. Gem rapporten i `docs/reviews/m1-selfreview.md`. Ret fundene efter ændringsprotokollen, og begrund dem, du ikke retter.
- Fable-review 1 sker efter natten og bygger på dette resultat. Skriv i `docs/DECISIONS.md`, at milepæl 2 bygges i samme nat for at nå programstarten, og at rettelser fra review 1 indarbejdes bagefter.

## 3. Milepæl 2 – første brugbare version

Som beskrevet i `docs/PLAN.md`. Start, når milepæl 1 er grøn, udgivet og selvreviewet.

- Udgiv tidligt en brugbar kerne (onboarding, I dag og Styrke A fra start til slut), og fortsæt derefter med resten.
- Brugeren vil teste så lidt som muligt på telefonen. Derfor:
  - Alle M2-flows fra acceptkriterierne kører grønt i `pixel9a`-projektet med IronFox-profilen ovenfor, og datotestene kører også i UTC.
  - Mål tiden til første tegning og til I dag ved varm start i samme profil. SK1 skal holde; ellers skal du optimere. Rapportér tallene.
  - Tilføj Mere → Om → »Diagnose« (Tilføjelse T6). Den viser version, service worker, varigt lager, lagerplads, Wake Lock, lydtilstand, viewport, tidszone, sprog og tiden til første tegning og til I dag. Så kan en fejl rapporteres med ét skærmbillede.
  - Lad en subagent i frisk kontekst gennemgå skærmbillederne i `screenshots/` mod `docs/SPEC.md` afsnit 5 og 6, især listen over forbudte mønstre. Ret fundene.
- Sidst i milepælen, hvis resten er grønt: målingerne i uge 1 efter `docs/ENGINE.md` 5.6, fordi programmet kan starte i appen tirsdag 10/11.
- Nattens acceptkriterier er alt i milepæl 2, der kan verificeres automatisk: SK2, SK5, SK8, SK9, Playwright-flowene og SK1 målt i IronFox-profilen. SK3 og SK4 kræver telefonen og hører til i tjeklisten.

## Arbejdsregler i nat

- `npm run check` skal være grøn før hver commit. Commit og push efter hvert grønt delmål, så Pages altid har den seneste gode version.
- Uafhængigt arbejde må gerne fordeles på subagenter, men kun én skriver til git ad gangen.
- Skriv én linje pr. færdigt delmål i `docs/runs/NAT-1-LOG.md`: klokkeslæt, delmål og resultat.
- Er noget tvetydigt, så vælg den forsigtigste læsning, log den, og fortsæt. Stop kun ved noget, som kun brugeren kan afgøre, eller før noget, der ikke kan gøres om.

## Slutrapport

Skriv `docs/runs/NAT-1-REPORT.md` med opsummeringen fra `CLAUDE.md`. Medtag desuden: nye Præciseringer (til Fable-review 1), testtal, bundle-størrelser, SK1-tallene, URL'erne til appen og `/program`, og tjeklisten til telefonen som højst seks korte ja/nej-punkter. Commit og push rapporten, og skriv opsummeringen i chatten.

## Tilføjelse fra brugeren under kørslen (5/11)

Byg tidsmaskinen (`docs/SPEC.md` 3.7, `docs/ENGINE.md` 5.14, S-TIME-01..03) som en del af milepæl 2, lige efter kernen (onboarding, I dag og Styrke A). Programmet starter først mandag 9/11, så uden den kan brugeren ikke prøve et pas på telefonen før. Den skal køre på en kopi i hukommelsen med skrivebeskyttet lager, så lagerlaget bygges til det fra starten. Ændringen står i `docs/PLAN.md` (M2 og M3) og `docs/DECISIONS.md` (D29).

Derfor er rækkefølgen i milepæl 2: kerne (onboarding, I dag, Styrke A) → tidsmaskinen → resten.

Nattens acceptkriterier for milepæl 2 omfatter desuden: S-TIME-01..03 grønne, og et Playwright-flow, hvor et pas logges i tidsmaskinen, og lagerets antal hændelser er det samme før og efter. Tjeklisten til telefonen får punktet: åbn tidsmaskinen, vælg tirsdag 10/11, kør Styrke A, afslut – er de rigtige data uændrede?
