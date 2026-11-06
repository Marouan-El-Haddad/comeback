# NAT-2 – log

Én linje pr. færdigt delmål: klokkeslæt (dansk tid), delmål og resultat.

| Kl.   | Delmål | Resultat |
| ----- | ------ | -------- |
| 21:55 | Start: opgaven kopieret til `docs/runs/NAT-2.md`; repoet kortlagt; pakkelisten P0–P15 skrevet i `NAT-2-TASKS.md`. Agenterne i `.claude/agents/` findes og bruges | – |
| 22:50 | P0 bygget: Diagnose tæller kun ren opstart fra ikonet (D34), spejlets status, `cancel-in-progress`, startkoden i to filer og passet hentet senere (D35) | Grøn: npm run check (343 tests), Playwright 24/24; JS 62,6 kB gz; varm start første tegning 31–32 ms (før 35–37) |
| 22:57 | `E2E_PORT` i Playwright-konfigurationen, så et review kan køre i en worktree (i scratchpad) ved siden af en byggeagent; P0-review og P1-bygning startet | Grøn: npm run check; sw-scope-flowet på port 4180 |
| 23:29 | P0 færdig: review 0 høje, 0 middel, 4 lave (`docs/reviews/nat2-p0-diagnose.md`); reviewer kørte Playwright 24/24 i worktree | Grøn: Actions 42121795936 |
| 23:55 | P1 bygget: retningen i SPEC/DECISIONS/PLAN/CLAUDE.md (A2, T7–T9, D36–D41), datamodellen `content/` med `check-explain`, ingen PDF-/side-/kildehenvisninger i appen, indhold som JSON efter start | Grøn: npm run check (428 tests); JS 63,1 kB gz |
| 23:58 | P1-review startet; P0's lave fund sendt tilbage til P0-agenten; 7 trænere skriver del 1 (44 trin + opvarmning og Open & Strong) i scratchpad | – |
| 00:10 | P0's lave fund L1–L4 rettet (4308d9b, ec6fa13; D42) | Grøn: npm run check (429 tests), Playwright 28 bestået |
| 00:19 | Forklaringer del 1, første 14 filer (34 af 117 punkter) committet (b4095b6); P51 om sideplanken; kortbyggeren til P2 startet | Grøn: check-explain 14/14, npm run check |
| 00:22 | Forklaringer del 1 færdige: 22 filer, 54 af 117 punkter (trin 1–2 i alle spor, burpee-teknik, nakke, opvarmning, Open & Strong); valideret i en ren worktree før hver commit | Grøn: check-explain 22/22, npm run check (429 tests) |
| 00:39 | P1-review: 0 høje, 5 middel (introkortet mod SK3, gentagne delbevægelser, tempotjek, målinger, »Potensér«), 6 lave (`docs/reviews/nat2-p1-kilder.md`) | – |
| 01:04 | P2's øvelseskort bygget: fra Stiger og passet, foldbare detaljer, uden forklaring uden tomme felter, hentet efter start; `npm run shots:cards` til review | Grøn: npm run check (446 tests), card.spec i pixel9a og pixel9a-utc; JS 67,0 kB gz; første tegning uændret |
| 01:05 | P1-rettelserne sendt til P1-agenten; P2-review (indhold + kort) startet i worktree | – |
| 01:35 | P1-rettelser M1–M5 og L1–L6 færdige: introkortet i pausen (D44, SK3 holder), `repeat`, labeltjek, målinger og »Potensér« i datamodellen (D45), strammere kildeværn (D46) | Grøn: npm run check (472 tests), Playwright 38 bestået i pixel9a og pixel9a-utc; JS 67,6 kB gz |
| 01:40 | P2-review: 0 høje, 4 middel (I1 sideskift pr. gentagelse, K1 hold logget bag kortet, K2 kort, der ikke kan åbnes, K3 Androids tilbage-gestus), 11 lave (`docs/reviews/nat2-p2-forklaringer-1.md`); P51 udvidet, P52 tilføjet | Grøn: npm run check |
| 01:42 | Startet parallelt: P1-opfølgningsreview, kortets rettelser (K1–K6), 8 trænere med rettelser til del 1 og del 2 (63 trin) samt forklaringer til de 12 målinger | – |
| 01:58 | P1-opfølgning: alle 11 fund rettet; ét nyt lavt fund (L7, labeltjekket afviser »Hold 10 sek«) | Grøn: Vitest 472, Playwright 38 i worktree |
| 02:04 | Forklaringerne færdige: alle 129 trin, rutinepunkter og målinger i 23 filer; fundene I1–I9 fra P2-reviewet rettet | Grøn: check-explain 23/23, npm run check i ren worktree (472 tests) |
