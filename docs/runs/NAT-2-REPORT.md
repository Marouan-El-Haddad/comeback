# NAT-2 – rapport

Natten 5.–6. november 2026. Opgaven: `docs/runs/NAT-2.md`. Tjeklisten står i `docs/runs/NAT-2-TASKS.md` og tidslinjen i `docs/runs/NAT-2-LOG.md`.

**Kørslen blev stoppet kl. 05:10, fordi brugeren bad om at afslutte nu.** Brugerens ugentlige kvote var ved at slippe op. Det er brugerens beslutning, og resten venter, til brugeren starter en ny kørsel. Rapporten viser derfor det nåede, det manglende og blokeringen.

## 1. Hvad er lavet

| Pakke | Status |
| --- | --- |
| P0 Diagnose | Færdig, reviewet og udgivet. Diagnose måler kun en ren opstart fra ikonet: standalone, `navigate`, I dag som første skærm, ingen indfasning eller tidsmaskine, appen synlig hele tiden og kun målinger fra den kørende version (D34, D42). Spejlets status vises, `cancel-in-progress` er sat, og startkoden ligger i to filer (D35). |
| P1 Kilderne og datamodellen | Færdig, reviewet og udgivet. Den nye retning står i SPEC, DECISIONS, PLAN og CLAUDE.md (A2, T7–T9, D36–D46). Datamodellen i `content/` har forklaringer, figurer, `repeat`, målinger og »Potensér«. `check-explain` tjekker filerne. Appen har ingen henvisninger til PDF, sidetal eller kilder. |
| P2 Øvelseskortet og forklaringer del 1 | Færdig, reviewet og udgivet. Kortet åbnes fra Stiger (med »Øvrige«) og fra passet. Passet står stille, mens kortet er åbent (D47), og tilbage-gestussen lukker kortet. |
| P5, forklaringsdelen | Færdig og reviewet to gange. Alle 129 trin, rutinepunkter og målinger har en forklaring, og alle mellemsvære fund er rettet. Sideplanke og balance måles med et ur pr. side (D49). |
| P3 Figursystemet | Bygget og reviewet, men **rettelserne mangler**. Motoren er en TypeScript-udgave af `tools/pictos`. Den animerer i øvelsens tempo, kører slowmotion ved tryk, viser stillbilleder ved reduceret bevægelse og har tekstalternativ, figurtjek og kontaktark. Figuren følger passets ur. |
| P4 og P5, figurdelen | Alle 129 figurer er tegnet og committet. De er **ikke reviewet**, fordi motorens fejl (H1) skal rettes først. Kontaktarkene til del 2 er ikke committet. |
| P6 Passet | **Stoppet midt i arbejdet.** SPEC 3.2 og D50–D53 er committet. Koden til »Dagens pas«, »Nu og næste«, pausen, introkortet og »Hold pause« ligger ucommittet i arbejdsmappen (56 filer). Den er hverken færdigtestet eller reviewet og er ikke pushet. |
| P7–P14 | Ikke startet. P15 er valgfri. |

## 2. Hvad er verificeret

- `npm run check` exit 0 på main (3cdd417): 550 Vitest-tests, typecheck, lint og build. JavaScript fylder 75,6 kB gz af 150, sidst målt efter P3. Startfilerne er uændrede siden P0. Indholdet (`content/`) ligger som JSON uden for JS-budgettet.
- Playwright: Den seneste fulde kørsel var grøn hos byggeagenterne: 50 bestået i `pixel9a` og `pixel9a-utc` efter F2, og 47/47 efter P3. **Hele suiten er ikke kørt på den endelige main**.
- Opstarten er ikke blevet langsommere. Første tegning ved varm start var 31–36 ms mod 35–37 ms før.
- Udgivet med GitHub Actions efter P0, P1 og P2. Den sidste udgivelse står i chatten.
- Reviewfund i tal:

| Pakke | Høj | Middel | Lav |
| --- | --- | --- | --- |
| P0 | 0 | 0 | 4, alle rettet |
| P1 | 0 | 5, alle rettet | 7, alle rettet |
| P2 | 0 | 4, alle rettet | 14, 13 rettet (N3 venter på P6) |
| P5, forklaringer | 0 | 2, alle rettet | 9, 8 rettet (N1 åben) |
| P3 | 1, ikke rettet | 3, ikke rettet | 4, ikke rettet |
| **I alt** | **1, 0 rettet** | **14, 11 rettet** | **38, 32 rettet** |

- Skærmbilleder i `screenshots/`: `diagnose.png`, `kort-skimmet.png`, `kort-foldet-ud.png`, `kort-fra-passet.png`, `kort-figur*.png`, `stiger-ovrige.png`, `maaling-pr-side.png` og kontaktark for del 1 i `screenshots/figures/`.
- Appen ligger på `https://<konto>.github.io/comeback/`. Den fulde adresse står i chatten (D27).

## 3. Tjekliste til telefonen (tidsmaskinen, ca. 10 min)

1. Luk appen helt, og åbn den fra ikonet. Står der under Mere → Om → Diagnose »Denne opstart er talt med« og en tid?
2. Åbn Stiger → et trin. Kan du forstå øvelsen ud fra kortets tekst og figur? (At figuren knækker lidt midt i bevægelsen, er en kendt fejl.)
3. Gå i tidsmaskinen til tirsdag 10/11, og start Styrke A. Står passet stille, når du åbner »Sådan gør du« under et hold, og fortsætter det bagefter?
4. Lukker tilbage-gestussen kortet og ikke appen, når kortet er åbent?
5. Gå i tidsmaskinen til fredag 13/11, og start Styrke B. Tager sideplanke-målingen tiden på både venstre og højre side og gemmer den korteste?
6. Er der ingen sidetal eller PDF nogen steder i appen, fx under Om og »Hvorfor«?

## 4. Hvad der ikke kunne gøres og hvorfor

- **Blokering:** Brugerens ugentlige forbrug slap op. Kørslen kan først fortsætte, når der er kvote igen.
- **P3:** H1 er ikke rettet. Knæ og albuer knækker midt i bevægelser, og led går gennem gulvet, fordi hoften interpoleres i en lige linje. Det samme gælder M1–M3, L1–L4 og de grænser i motoren, figuragenterne fandt: kontaktreglerne for side, ryg og mave, skridt og hop, rekvisitter på ryggen og ryggens krumning. Briefen ligger klar i `docs/runs/NAT-2-P3-FIX.md`.
- **P4/P5:** Figurerne er ikke reviewet. Hvor motoren tvang dårligere udgaver igennem, er det noteret i figuragenternes svar, og de steder står i briefen.
- **P6:** Arbejdet står ucommittet i arbejdsmappen. Næste kørsel skal enten gøre det færdigt og teste det eller kassere det. Ingen af delene er gjort nu.
- **P7–P14:** Livet og resten af M3 er ikke startet.

## 5. Forslag

- Næste kørsel i denne rækkefølge:
  1. P3-rettelserne;
  2. tjek alle figurer, og ret dem;
  3. review af P4/P5-figurerne og commit af kontaktarkene;
  4. P6 færdig ud fra arbejdsmappen;
  5. P7–P14.
- Skiftevise øvelser (skater-hop, split jumps) bør vises som ét sæt i passet i stedet for to sidesæt (P54).
- Bekræft på telefonen, at introkortet skal vises i pausen før øvelsens første sæt i hvert pas (D44).

## 6. Ændrede filer og motoren

Områder: `docs/` (SPEC, DECISIONS, PLAN, ENGINE, runs, reviews), `CLAUDE.md`, `.claude/agents/`, `content/` (23 forklaringsfiler og 23 figurfiler), `src/content/`, `src/figure/`, `src/ui/` (Diagnose, kort, figur, målinger), `src/engine/explain.ts`, `scripts/` (check-explain, figure-sheet, bundle-size), `e2e/`, `screenshots/`, `playwright.config.ts`, `vite.config.ts` og `.github/workflows/deploy.yml`.

Motoren rørt: ja (`src/engine/explain.ts`, forklaringer uden sidetal, S-WEEK-05).
