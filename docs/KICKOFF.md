# KICKOFF.md – Beskeder til Opus 5.5 i Claude Code

Afsnit 1 er din første besked til Opus, klar til at kopiere. Afsnit 2 er skabelonen til de næste milepæle, afsnit 3 til fejlrapporter fra telefonen, afsnit 4 til reviews hos mig.

## 0. Før du sender den første besked (Claude Code på din pc)

1. Installer én gang: Git, Node.js (LTS), GitHub CLI (`gh`) og Claude Code. Log ind med `gh auth login`.
2. GitHub → Settings → Emails: slå »Keep my email addresses private« og »Block command line pushes that expose my email« til, og notér din noreply-adresse. Så kommer din e-mail ikke med i det offentlige repo.
3. Opret og klon det tomme, offentlige repo med `gh repo create comeback --public --clone` (ingen README, ingen licens – Opus laver dem), og gå ind i mappen. Sæt repoets identitet: `git config user.name "<dit GitHub-brugernavn>"` og `git config user.email "<din noreply-adresse>"`.
4. Slå GitHub Pages til: repoets Settings → Pages → Source: »GitHub Actions«. Opus prøver selv, men kan mangle rettighed.
5. Læg `CLAUDE.md`, `SPEC.md`, `ENGINE.md`, `PLAN.md`, `DECISIONS.md`, `KICKOFF.md` og `comeback_starter_kit.zip` i en mappe `comeback-handoff` ved siden af repoet, ikke inden i det.
6. Start Claude Code i repo-mappen med `claude --model claude-opus-5-5 --effort max`. Max gælder kun for den session, så brug samme kommando hver gang. Beskederne nedenfor indeholder bevidst ingen instruktioner om at »tænke grundigt« og beder aldrig om tankegang i svaret.

## 1. Første besked (kopiér alt herunder)

```
Du bygger »Comeback«: en offline PWA til én bruger, der overtager tænkearbejdet i et 12-ugers træningsprogram. Jeg er ikke udvikler; jeg læser dine opsummeringer og tester på min telefon (Pixel 9a, IronFox). Du kører i Claude Code på min pc i repoet `comeback`, som er tomt og klonet fra GitHub. `gh` er logget ind, og repoets git-identitet er sat, så den skal du ikke ændre.

Dokumenterne `CLAUDE.md`, `SPEC.md`, `ENGINE.md`, `PLAN.md`, `DECISIONS.md`, `KICKOFF.md` og `comeback_starter_kit.zip` ligger i `../comeback-handoff/` uden for repoet. Læs `CLAUDE.md` først; den gælder i hver session. Læs derefter `PLAN.md` (milepæl 0) og `SPEC.md` afsnit 2 og 9. `ENGINE.md` skal du kun kende overfladisk i dag; den er milepæl 1.

Opgaven i denne session er to ting, i rækkefølge:

1. Sæt projektet op præcis efter `CLAUDE.md`: mappestruktur, scripts, TypeScript strict, Preact, Vite med `base: '/comeback/'`, vite-plugin-pwa, Vitest, Playwright-projekt `pixel9a`, eslint + prettier, GitHub Actions-workflow der bygger `main` og udgiver til Pages. Læg dokumenterne i `docs/` og `CLAUDE.md` i roden. Pak starter-kittet ud i sin egen mappe uden for repoet, og kopiér ind: `PROGRAM_KILDE.md` → `docs/`, piktogrammerne → `public/pictos/` (inkl. `white/`), fontene → `public/fonts/`, `design-tokens.json` → `src/ui/`, Python-koden → `tools/pictos/`. PDF'en må du læse, men den committes ikke (tilføj den til `.gitignore`), fordi den indeholder personlige oplysninger. Repoet må ikke indeholde navne, klub eller logdata. Første commit skal bygge grønt.

2. Byg milepæl 0 fra `PLAN.md`: probe-siden i `probe/`, udgivet som version 1 på `/comeback/probe/`. Forbered version 2 (andet versionsnummer og en anden baggrundsfarve) som en færdig commit på en gren `probe-v2`, men flet den ikke, før jeg skriver »udgiv v2«. Skriv `probe/RESULTS.md` med en tom resultattabel for de ti punkter og beslutningsreglen fra `PLAN.md`.

Sådan arbejder du i denne session: Jeg ser ikke med i realtid og kan ikke svare undervejs, så spørgsmål som »skal jeg …?« stopper arbejdet. Handlinger, der følger af opgaven og kan gøres om, udfører du uden at spørge. Stop kun, når du er blokeret på noget, kun jeg kan afgøre, eller før en handling, der ikke kan gøres om (sletning, force-push, ændringer i repoets indstillinger ud over Pages). Afslut ikke en tur med en plan, en liste over næste skridt eller en sætning som »nu vil jeg …« – gør det i stedet, også hvis det kræver at prøve igen efter en fejl eller selv finde manglende information. Afslut ikke, fordi sessionen har været lang, eller fordi en milepæl føles som et godt sted at rapportere. Statusnoter undervejs er velkomne, men i samme besked som dit næste værktøjskald.

Omfang: alt i opsætningen og milepæl 0, og ikke mere. Ser du noget uden for milepælen, der burde laves, så skriv det som forslag i opsummeringen i stedet for at lave det. Er noget tvetydigt, så vælg den læsning, dokumenterne mest direkte støtter, skriv antagelsen i `docs/DECISIONS.md`, og fortsæt. Redigér filer målrettet i stedet for at omskrive dem. Tests kun hvor milepælen beder om det.

Kommunikation: Start med én linje om, hvad du er ved at gøre. Slut med en kort, selvstændig opsummering på dansk, som en, der kun læser den sidste besked, kan handle på:
- Hvad der er lavet (opsætning, probe v1, gren til v2).
- Hvad der er verificeret (lint, typecheck, build, Playwright-røgtest, at Pages-udgivelsen lykkedes med URL).
- Hvad jeg skal teste på telefonen: tjeklisten fra milepæl 0 i `PLAN.md`, punkt for punkt, med URL'en.
- Hvad der ikke kunne gøres og hvorfor (fx hvis Pages skal slås til manuelt, eller Playwright kun fik Chromium).
- Forslag uden for milepælen.
- »Ændrede filer« som liste og linjen »Motoren rørt: ja/nej«.
Korte forklaringer; ingen gengivelse af din tankegang; ingen manieret prosa.
```

## 2. Skabelon til de næste milepæle

Udskift det i klammer. Send `CLAUDE.md` ikke igen; den ligger i repoet.

```
Næste opgave: milepæl [N] – [titel] fra `docs/PLAN.md`. Læs `CLAUDE.md`, milepælens afsnit i `docs/PLAN.md`, og de afsnit i `docs/SPEC.md` og `docs/ENGINE.md`, milepælen henviser til.

Resultater fra sidste tjekliste på telefonen:
[punkt for punkt: hvad virkede, hvad gjorde ikke, med de ord du brugte]

Beslutninger siden sidst (skriv dem i `docs/DECISIONS.md` først):
[fx: platform = IronFox-PWA; Web Share virker ikke → skjul knappen]

Sådan arbejder du: samme regler som i den første besked – jeg ser ikke med; udfør det, der følger af opgaven; stop kun, hvis du er blokeret eller før noget, der ikke kan gøres om; afslut aldrig en tur med at annoncere næste skridt i stedet for at tage det. Alt i milepælen og ikke mere; fund uden for den er forslag. Tests før kode i motoren, med scenarie-ID'erne som testnavne. Ret kilden før koden, når noget er forkert (ændringsprotokollen i `CLAUDE.md`).

Slut med den danske opsummering: lavet, verificeret (tests, build, skærmbilleder i `screenshots/`), tjekliste til telefonen med URL, hvad der ikke kunne gøres, forslag, ændrede filer, »Motoren rørt: ja/nej«.
```

Milepæl 1 afhænger ikke af telefonen: send den, så snart M0 er udgivet, og skriv »Kommer senere« under resultaterne. Afslut Claude Code først (`/exit`), og start igen med samme kommando som i afsnit 0, så sessionen er ren og kører på max.

Til milepæl 1 tilføjes: »Alle scenarier i `docs/ENGINE.md` afsnit 8 skal findes som tests med samme ID, og `program.spec.ts` skal tjekke trin-antallet mod tabellen i `ENGINE.md` 7.3. Når du finder en regel, der ikke kan gøres entydig, så vælg den forsigtigste læsning, skriv den i `docs/DECISIONS.md` som Præcisering, og markér den i opsummeringen, så jeg kan sende den til review.«

Til milepæl 2 tilføjes: »Udgiv en brugbar version så tidligt som muligt i milepælen (I dag + Styrke A fra start til slut), og fortsæt derefter med resten; skriv URL'en i opsummeringen. Gem skærmbilleder af I dag, et pas-skridt, trafiklyset og pausetimeren i `screenshots/`, og nævn filerne i opsummeringen.«

## 3. Skabelon til en fejlrapport fra telefonen

```
Fejl fra telefonen ([dato], [skærm/pas]):
- Hvad jeg gjorde: [...]
- Hvad jeg forventede: [...]
- Hvad der skete: [...]
- Skærmbillede: [vedhæftet / ingen]

Ret kilden først (`docs/ENGINE.md` eller `docs/SPEC.md`, eventuelt `docs/DECISIONS.md`), derefter test og kode. Kun denne fejl; andet er forslag. Skriv i opsummeringen, hvilken kilde du rettede, og om motoren blev rørt.
```

## 4. Reviews hos mig (Fable)

Send mig efter milepæl 1, 2 og 5 (se `PLAN.md`):
1. Opus' opsummering af milepælen (kopiér den).
2. Listen af Præciseringer, Opus har tilføjet i `docs/DECISIONS.md`.
3. Testrapporten (antal tests, grønne/røde) og evt. `scripts/simulate.ts`-udskriften for milepæl 1.
4. Dine noter fra tjeklisten på telefonen, uredigeret.
5. Efter milepæl 2 og 5: skærmbillederne fra `screenshots/` og eventuelt et foto af appen på telefonen i sollys.

Jeg svarer med rettelser til `ENGINE.md`/`SPEC.md` som ændrede afsnit, du kan give videre til Opus med skabelonen i afsnit 2.
