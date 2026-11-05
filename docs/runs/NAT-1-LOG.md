# NAT-1 – log

Én linje pr. færdigt delmål: klokkeslæt (dansk tid), delmål og resultat.

| Kl.   | Delmål | Resultat |
| ----- | ------ | -------- |
| 18:29 | M0 afsluttet: RESULTS.md, D19–D29, O1–O5 lukket, Playwright-profil 414 × 847/JIT fra, pixel9a-utc, SW-test | Grøn: npm run check, Playwright 2/2; pushet (c83bc29, d3dda73) |
| 19:05 | M1: motor, programdata, alle 83 scenarier, program.spec + kildesammenligning, simulering, /program | Grøn: npm run check (302 tests), simulering: alle 13 stiger/power-spor rykker op |
| 19:17 | M1 udgivet på Pages (app, /program, probe svarer 200); selvreview startet | Grøn: Actions-kørsel 42080976367 |
| 19:41 | M1 selvreview: 12 fund (0 alvorlige, 4 middel, 8 små) rettet med 10 nye scenarier | Grøn: npm run check (325 tests); pushet |
| 20:04 | M2 kerne + tidsmaskine + resten (Uge, Stiger, Mere/Backup, Om/Diagnose, B, motor, Open & Strong) | Grøn: npm run check (338 tests), Playwright 16/16 i pixel9a + UTC; SK1 varm offline: I dag 46 ms (median); pushet |
| 20:19 | M2 udgivet på Pages efter en hængende GitHub-udrulning (genkørt); røgtest mod den udgivne adresse: indfasning, I dag, service worker, /program | Grøn: Actions 42090360263; varm start 48 ms |
| 20:44 | Designgennemgang M2: 17 fund (3 høje, 7 middel, 7 lave) rettet; Historik; genoptagelse fra loggen; W3/W5-runder | Grøn: npm run check (338 tests), Playwright 18/18 (6 efter genkørsel pga. Firefox-lukkefejl); SK1 I dag 41 ms; pushet |
| 20:56 | Rapport (`docs/runs/NAT-1-REPORT.md`); I dag læser startdatoen fra loggen i stedet for en fast tekst | Grøn: npm run check (338 tests), Playwright m2 + faner 9/9 og UTC 1/1; pushet |
