# CLAUDE.md – Comeback

Offline PWA til én bruger på en Pixel 9a (IronFox-PWA, portræt 414 × 847 CSS-px), som træner til et 12-ugers program. Programmet er den faglige sandhed; korrekt træningslogik vejer tungere end features; ingen data må gå tabt. Brugeren er ikke udvikler: han læser kun dine opsummeringer og tester på telefonen.

Dansk prosa og UI-tekst; kode, filnavne, identifikatorer og commit-beskeder på engelsk.

## Kilder (læs det afsnit, opgaven handler om – ikke hele filen)

- `docs/SPEC.md` – produktet: skærme, flows, designsystem (afsnit 5, inkl. forbudte mønstre), data og backup (afsnit 9).
- `docs/ENGINE.md` – alle træningsregler, hændelser, algoritmer, testscenarier (afsnit 8) og sporbarhed (afsnit 9).
- `docs/PLAN.md` – milepæle med acceptkriterier og tjeklister; tjeklisterne laves som Playwright-flows i tidsmaskinen (`docs/DECISIONS.md` D40). `docs/DECISIONS.md` – beslutningslog; afsnit 6 er rettelser, der går forud for ældre tekst.
- `docs/PROGRAM_KILDE.md` – programindholdet, som `program/*.json` konverteres fra. `docs/KICKOFF.md` – beskedskabeloner.
- Regler i disse filer gentages ikke her. Er noget i strid, gælder `docs/DECISIONS.md` afsnit 6, derefter `docs/ENGINE.md` og til sidst `docs/PROGRAM_KILDE.md`. Præciseringer og afvigelser i `docs/ENGINE.md` er bevidste; ret dem ikke tilbage til PDF'ens ordlyd.

## Teknisk ramme

- TypeScript `strict`, Preact, Vite med `base: '/comeback/'`, vite-plugin-pwa med `registerType: 'prompt'`, Vitest, Playwright, eslint + prettier, fake-indexeddb i tests.
- Ingen UI-, animations- eller dato-biblioteker. Nye afhængigheder kræver en linje i `docs/DECISIONS.md`; ingen afhængighed må kræve netværk ved kørsel.
- Budget: ≤ 150 kB gz JavaScript, ≤ 30 kB CSS. Telefonens browser har JIT slået fra: lille bundle, lidt arbejde ved start.
- Det, I dag ikke bruger, hentes efter start (`docs/SPEC.md` 7): kode (passet, øvelseskortet, figurerne) med `lazy()` fra `src/ui/lazy.tsx`, og forklaringer og figurer som JSON-filer med `src/content/load.ts`, som kun importeres fra kode, der hentes med `lazy()`. `npm run build` fejler, hvis startfilerne henviser til indholdet.
- Farver kun som CSS-variabler med navnene fra `docs/SPEC.md` afsnit 5, hentet fra `src/ui/design-tokens.json`. Fonte selvhostet fra `public/fonts/`.
- Udgivelse: push til `main`; GitHub Actions bygger og udgiver til Pages. Udgiv aldrig manuelt, og ændr ikke repoets indstillinger eller git-identiteten.

## Kommandoer

```
npm install                       # engangs
npx playwright install firefox chromium   # engangs, før første e2e-kørsel
npm run dev                       # lokal udvikling
npm test                          # vitest: motor, program, lager
npm run test:e2e                  # playwright-projekterne pixel9a og pixel9a-utc
npm run typecheck                 # tsc --noEmit
npm run lint                      # eslint + prettier --check
npm run build                     # produktion; udskriver bundle-størrelser
npm run check                     # test + typecheck + lint + build – skal være grøn før hver commit
npm run simulate                  # scripts/simulate.ts: 12 uger med en syntetisk bruger
node scripts/check-explain.ts <fil>   # tjekker én forklarings- eller figurfil i content/; uden fil: alle
```

## Mapper

```
docs/                 specifikationer og kilder (se ovenfor)
program/              programdata som json: tracks/, sessions/, weeks.json, measures.json, overlays.json, impress.json, heroes.json, bosses.json, pictos.json
content/              forklaringer (explain/) og figurer (figures/), én fil pr. spor og pr. rutine (docs/SPEC.md 9.1)
src/engine/           ren TypeScript uden DOM: types, derive, plan, progression, regression, weeks, moves, layout, simulate, migrations/
src/engine/__tests__/ ét testnavn pr. scenarie-ID fra docs/ENGINE.md afsnit 8
src/content/          typer, validering og indlæsning af content/, og refs.ts (henvisninger til PDF, sider og kilder)
src/storage/          indexeddb, mirror, export, import
src/ui/               screens/, components/, timers/, audio, wakelock, theme.css, design-tokens.json
public/fonts/  public/pictos/ (+ white/)
probe/                milepæl 0, eget Vite-projekt
scripts/              simulate.ts, convert-program.ts, check-explain.ts, bundle-size.ts
tools/pictos/         Python-motoren til piktogrammerne; figursystemet i appen er en TypeScript-udgave af den (milepæl 6)
e2e/  screenshots/    playwright-tests og seneste skærmbilleder
```

## Motoren (`src/engine`)

- Ingen DOM, ingen `Date.now()`, ingen `new Date()` uden argument, ingen tilfældighed (eslint håndhæver de tre i `src/engine/`). `today`/`now` er altid parametre; datoer er `YYYY-MM-DD` i Europe/Copenhagen via `Intl` med `timeZone: 'Europe/Copenhagen'`; visning med `da-DK`.
- Koden kender ingen øvelser ved navn; alt indhold kommer fra `program/*.json` med de ID'er, `docs/ENGINE.md` afsnit 2 fastlægger. Forklaringer og figurer ligger i `content/` med de samme ID'er og ændrer aldrig navne, doser, tempo eller regler.
- Tests før kode: en regel implementeres ved først at skrive scenariets test med scenarie-ID'et som testnavn (fx `S-EMOM-02`), så koden. Ingen ændring i motoren uden en test, der beskriver den.
- Motorens beslutninger skrives som `step_changed`-hændelser med `explanation` på dansk.

## Data og privatliv

- Brugerdata er en tilføj-kun hændelseslog: aldrig redigering eller sletning af hændelser. Migrationer er rene, testede funktioner, der først gemmer en kopi. Eksport og import skal altid virke.
- Tidsmaskinen arbejder på en kopi i hukommelsen og skriver aldrig til lageret.
- Appen laver ingen netværkskald efter installation, ingen analytics, ingen logins, ingen automatisk genindlæsning (aldrig under et pas).
- Repoet er offentligt: ingen navne, klub, e-mail, logdata, backups, skærmbilleder med personlige data eller PDF'en. `.gitignore` holder PDF'en og backupfiler (`comeback-backup-*.json`, `*.backup.json`) ude.

## Arbejdsmåde

Gælder i alle sessioner, også korte fejlrettelser:

- Brugeren ser ikke med i realtid. Udfør alt, der følger af opgaven og kan gøres om, uden at spørge. Stop kun, når du er blokeret på noget, kun brugeren kan afgøre, eller før noget, der ikke kan gøres om (sletning, force-push, skemaændring uden migration).
- Afslut aldrig en tur med en plan, en liste over næste skridt eller »nu vil jeg …«. Gør det. Prøv igen efter fejl, og find selv manglende information.
- Omfang er opgaven som stillet (milepælen i `docs/PLAN.md` eller fejlen i beskeden), hverken mere eller mindre. Alt andet, du finder, er et forslag i opsummeringen.
- Tvetydighed: vælg den forsigtigste rimelige læsning, skriv den i `docs/DECISIONS.md` (dato, beslutning, alternativer, begrundelse, konsekvens), og fortsæt.
- Redigér filer målrettet; omskriv kun, når det meste ændres. Små commits med én hensigt, besked på engelsk, fx `engine: implement R-EMOM step-up (S-EMOM-01..05)`.
- Tests kun hvor opgaven beder om det, eller hvor repoet allerede tester den slags ændring. Scratch-scripts committes ikke.

## Design og tests

- UI-arbejde: læs `docs/SPEC.md` afsnit 5 og 6 først, og hold dig til dem – særligt listen af forbudte mønstre. Trin uden eget piktogram bruger stigens nærmeste via `program/pictos.json`, aldrig et generisk ikon, indtil trinnet har sin figur.
- Appen henviser aldrig til PDF'en, sidetal eller kilder – hverken i UI-tekst, forklaringer eller motorens forklaringer (`docs/DECISIONS.md` A2). Programmets egen prosa vises gennem `withoutSources()` fra `src/content/refs.ts`; testene `no-source-refs` håndhæver det.
- Playwright-projekt `pixel9a` = telefonen som målt i M0: viewport 414 × 847, `deviceScaleFactor: 2`, `hasTouch`, `locale: 'en-US'`, `timezoneId: 'Europe/Copenhagen'`, Firefox-motor med JIT slået fra via `firefoxUserPrefs` og uden `isMobile` (Playwright afviser `isMobile` i Firefox); kan Firefox ikke installeres, så kør Chromium med `isMobile: true`, og sig det i opsummeringen. `pixel9a-utc` kører testene mærket `@date` igen med tidszone UTC. Server og `baseURL` bruger `127.0.0.1`, ikke `localhost` (Firefox mister 2 sek på IPv4/IPv6). Timere simuleres med `page.clock`.
- Skærmbilleder af ændrede skærme gemmes i `screenshots/` og nævnes i opsummeringen. Telefonen er den endelige test; det, der kræver den, står i milepælens tjekliste.

## Ændringsprotokol

Når noget er forkert, så ret først den kilde, der skulle have forhindret det, og derefter koden:
- forkert træningsadfærd → `docs/ENGINE.md` (regel + scenarie) → test → kode;
- forkert produktadfærd eller udseende → `docs/SPEC.md` → kode → skærmbilleder;
- uklar tolkning → `docs/DECISIONS.md` først;
- gentagen fejl i arbejdsmåden → en linje her i `CLAUDE.md`.
Nævn i opsummeringen, hvilken kilde der blev rettet.

## Opsummering (slut på hver opgave)

Start opgaven med én linje om, hvad du gør. Slut med en kort, selvstændig opsummering på dansk uden gengivelse af tankegang og uden manieret prosa:
1. Hvad er lavet.
2. Hvad er verificeret (kommandoer med resultat, skærmbilleder, udgivet URL).
3. Hvad brugeren skal teste på telefonen, punkt for punkt.
4. Hvad der ikke kunne gøres og hvorfor.
5. Forslag uden for opgaven.
6. »Ændrede filer« som liste, og linjen »Motoren rørt: ja/nej« (ja, hvis `src/engine/` eller `program/` er ændret).

## Windows

- Udvikling sker på Windows. npm-scripts skal virke i både PowerShell og cmd: ingen `rm -rf`, `cp`, `export` eller andre Unix-kommandoer i `package.json`; brug Node-scripts (`node scripts/...`) til filoperationer, og `path.join`/forward slashes i kode.
- `.gitattributes` med `* text=auto eol=lf`; prettier `endOfLine: 'lf'`. Skriv filer som UTF-8 uden BOM.
- Lange kommandokæder køres som npm-scripts, ikke som ad hoc-shell, så de giver samme resultat for brugeren.
