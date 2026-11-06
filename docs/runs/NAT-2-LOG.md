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
| 02:40 | Kortets rettelser K1–K6: passet står stille, mens kortet er åbent (D47), »Øvrige« i Stiger, tilbage-gestus lukker kortet; trænernes tolkninger P53–P60 logget | Grøn: npm run check (477 tests), Playwright 42 bestået; JS 68,8 kB gz |
| 02:45 | P1 færdig og udgivet; P2-opfølgning, review af forklaringer del 2 og P3 (figursystemet) startet | Grøn: Actions 42145649687 |
| 03:15 | P2-opfølgning: 14 af 15 rettet, alle 4 middel; review af forklaringer del 2: 0 høje, 2 middel (press.5 mod motoren, sideplanke og balance med ét ur), 8 lave (`docs/reviews/nat2-p5-forklaringer-2.md`); rettelsesrunde sendt til 8 trænere | – |
| 03:20 | P2 færdig og udgivet | Grøn: Actions 42149465609 |
| 03:26 | Rettelserne til forklaringerne (P5 F1–F10, P2 N1–N2) committet; P53–P56 og P59 passer til kortene, P61 tilføjet | Grøn: check-explain 26/26, npm run check i ren worktree (533 tests) |
| 03:43 | P3 bygget: figurmotoren som TypeScript-udgave af `tools/pictos`, animation i tempoet, slowmotion, stillbilleder, tekstalternativ, figurtjek i `check-explain`, kontaktark uden server; tre referencefigurer; L7 rettet | Grøn: npm run check (534 tests), Playwright 47/47; JS 75,6 kB gz, startfilerne uændrede |
| 03:50 | P3-review, F2 (sideplanke og balance med to ure) og 9 figuragenter til del 1 startet | – |
| 04:01 | F2 rettet: sideplanke og balance måles med et ur pr. side, og den korteste tid gemmes (SPEC 4.8, D49), uden ændring af hændelser eller skema | Grøn: npm run check (538 tests), Playwright 50 bestået |
| 04:02 | Opfølgning på review af forklaringer del 2 og P6 (passet: »Dagens pas«, »Nu og næste«, pause og introkort) startet | – |
| 04:12 | Opfølgning på forklaringer del 2: alle 10 fund rettet, ét nyt lavt (N1) | Grøn: check-explain 26/26, Playwright measure.spec 3/3 |
| 04:17 | P3-review: 1 høj (knæet knækker midt i en push-up, fordi hoften interpoleres lige), 3 middel (tjekket fanger ikke forkert `facing`, strakte led tegnet bøjede, vejledningen), 4 lave (`docs/reviews/nat2-p3-figurer.md`); rettes af P3-agenten efter P6 | – |
| 04:34 | Figurerne del 1 committet: 54 af 129 punkter i 22 figurfiler med kontaktark i `screenshots/figures/` | Grøn: check-explain 45/45, npm run check i ren worktree (550 tests) |
| 04:38 | Figurerne del 2 (75 punkter, også de 12 målinger) startet hos de 9 figuragenter, mens P6 bygger | – |
| 05:02 | Alle figurer committet: 129 af 129 trin, rutinepunkter og målinger har figur; strakte led rettet (P3-review M2). Figuragenterne har listet de steder, hvor motorens grænser tvang en dårligere udgave (kontakt på albue og ryg, hop, skridt) | Grøn: check-explain 46/46, npm run check i ren worktree (550 tests) |
| 05:10 | Stoppet: brugerens ugentlige forbrug er ved at slippe op. P6 er stoppet midt i arbejdet (ucommittet i arbejdsmappen); rapport og P3-brief committet | Grøn: npm run check på 3cdd417 (550 tests) |
