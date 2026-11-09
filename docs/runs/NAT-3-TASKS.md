# NAT-3 – tjekliste

Opgaven: `docs/runs/NAT-3.md`. Tidslinjen: `docs/runs/NAT-3-LOG.md`. Arbejdsformen er den fra `docs/runs/NAT-2.md` (»Sådan arbejder du i nat« og »Gangen i hver pakke«).

Gangen i hver pakke: pakken beskrives her → underagenten bygger eller skriver og verificerer → orkestratoren tjekker `npm run check` (exit 0) og `git log --stat` → `comeback-reviewer` skriver `docs/reviews/nat3-<pakke>.md` → høje og middel fund rettes af den agent, der lavede arbejdet, og tjekkes af revieweren → rapporten committes, der pushes, og udgivelsen i GitHub Actions skal være grøn → kryds her og en linje i loggen.

Status: `[ ]` ikke startet · `[~]` i gang · `[x]` færdig (reviewet og udgivet) · `[-]` udskudt (med begrundelse).

Baner: kode bygges af én `comeback-builder` ad gangen i arbejdsmappen. Indhold (forklaringer og figurdata) skrives parallelt i kopier i scratchpad uden commits; orkestratoren validerer i en ren worktree og committer. Reviews kører i egne worktrees med `E2E_PORT`.

## Fælles krav (alle pakker)

- `CLAUDE.md` gælder fuldt ud. Brugeren logger rigtige pas fra tirsdag 10/11: hans data på telefonen må aldrig gå tabt. Ændringer i lager eller hændelser kun med migration, backup og test, og et gemt pas (`comeback.run`) fra den forrige version må ikke få appen til at fejle.
- Programmets indhold (navne, doser, tempo og regler) ændres ikke; `program-source.spec.ts` holder.
- Alt nyt dækkes af Playwright i `pixel9a` og `pixel9a-utc` (datoer mærkes `@date` og styres med tidsmaskinen). Hele suiten køres grøn på den endelige `main`.
- JavaScript under 150 kB gz; startfilerne vokser ikke uden grund, og opstarten bliver ikke langsommere (`e2e/perf.spec.ts`).
- Ingen henvisninger til PDF, sidetal eller kilder i appen. Skærmbilleder af ændrede skærme i `screenshots/`.
- Brugerens feedback på NAT-2 er målestokken: det skal være helt tydeligt, præcis hvordan øvelsen udføres; byg videre på det, der findes.

## Pakker

### [x] P0 – Passet færdigt fra arbejdsmappen (opgavens pakke 0)

- Status: bygget 04:30 (73213a6, 62e3ca9, 504feea, 6f0d761, 3c91d73). Review `docs/reviews/nat3-p0-passet.md`: 1 høj, 1 middel, 6 lave; H1, M1, L1–L3, L5 og L6 rettet (61ad9fb–46ba00f, D57, R21) og tjekket i »Opfølgning« uden nye fund; L4 er et forslag. Udgivet 08:17 (Actions 42578277569).
- Agent: `comeback-builder`. Frist: udgivet før tirsdagens Styrke A (10/11).
- Udgangspunkt: NAT-2's P6 stoppede midt i arbejdet. SPEC 3.2 og D50–D53 er committet; koden (`src/ui/session/DayPlan.tsx`, `NowNext.tsx`, `Intro.tsx`, `outline.ts`, `exercise.ts`, `session.css`, ændringer i `Runner.tsx`, `OpenStrong.tsx`, `timers.tsx`, `App.tsx`, `Today.tsx` m.fl.), testene (`e2e/session.spec.ts`, `src/ui/__tests__/outline.test.ts`, rettede specs) og skærmbillederne ligger ucommittet i arbejdsmappen sammen med et tillæg til D53. Det kasseres ikke.
- Mål: »Dagens pas« før start (D50), »Nu« og »Næste« og fremdriften altid synlige (D51), figuren følger passets ur (D52), næste øvelse stort med animation og »Gør klar« i pausen, introkortet første gang (D44, D51), »Hold pause« til fanerne (D53). Desuden:
  - P54: skiftevise øvelser (skater-hop, split jumps) vises og logges som ét sæt; P54 og forklaringerne, der i dag siger »tryk Som planlagt to gange«, rettes med;
  - N3 fra NAT-2's P2-review: en test af boksen »Lettere variant i dag«.
- Kilder: SPEC 3.2, 3.3, 4.2–4.5, 4.8, 5 og 6; DECISIONS D44, D47, D50–D53, P47 og P54; `docs/reviews/nat2-p2-forklaringer-1.md` (N3).
- Accept:
  1. Tirsdag 10/11 (uge 1 med målinger som nulpunkt), Styrke B, motor og Open & Strong kan gennemføres i tidsmaskinen med »Dagens pas«, »Nu«, »Næste«, pausen og introkortet.
  2. Et pas kan klares uden at røre skærmen, hvor SPEC lover det (SK3).
  3. Skater-hop og split jumps er ét sæt med ét »Som planlagt«; motoren får det, den forventer, uden ændring i hændelser eller skema (ellers ENGINE først, scenarie, test, kode).
  4. »Hold pause« viser fanerne; »Fortsæt passet« vender tilbage til samme trin med uret, hvor det stod.
  5. Et gemt pas fra den forrige version giver ingen fejl.
- Grønt: `npm run check`; `e2e/session.spec.ts` og hele suiten i `pixel9a` og `pixel9a-utc`; opstarten ikke langsommere.
- Skærmbilleder: `dagens-pas*.png`, `pas-nu-og-naeste.png`, `pause.png`, `introkort.png`, `hold-pause.png`, `os-*.png`.

### [~] P1a – Figurmotoren rettet (opgavens pakke 1)

- Status: bygget 06:25 (a2b48c7–ac78155; D56, R20). Review `docs/reviews/nat3-p1a-figurmotor.md`: 2 høje, 2 middel, 2 lave, alle rettet (279d015–9d009de; D56, R22) og tjekket i »Opfølgning«; nyt H3 (`via` målt mod sig selv) rettet i P1b (8b0de82) og tjekket i P1b's opfølgning. Venter på udgivelse.
- Agent: `comeback-builder`. Brief: `docs/runs/NAT-2-P3-FIX.md` (H1, M1–M3, L1–L4 og motorens grænser 1–6), reviewet i `docs/reviews/nat2-p3-figurer.md`.
- Accept:
  1. H1: leddenes vinkler interpoleres med forlæns kinematik fra det punkt, der står fast; segmenterne holder længden, strakte led forbliver strakte, intet går gennem gulvet, og hælen drejer om tåen. Tests for alle figurer: intet led bøjer mere end i nabopositionerne, intet går gennem en flade midt i en fase, segmenterne holder længden.
  2. M1–M3 og L1–L4 som i briefen.
  3. Grænserne: kontakt på side, ryg og mave betyder det, den siger; rekvisitter på ryggen; et lem kan løftes i en fase (skridt og hop), og en gentagelse kan flytte figuren frem; albuens retning i omvendte stillinger; ryggens krumning og ansigtets retning, hvis det er billigt; kontaktarkets celler overlapper ikke.
  4. Resuméet lister præcist, hvilke figurer (fil og punkt) der nu fejler eller kan tegnes bedre.
- Grønt: `npm run check`; `node scripts/check-explain.ts`; `e2e/figure.spec.ts` og en test af, at en push-up ikke knækker midt i en fase; startfilerne uændrede.

### [~] P1b – Figurmotoren: vinkler, markeringer, fejl og bevægelse (opgavens pakke 2, motordelen)

- Status: bygget 10:55 (8b0de82–ece1f42; D58, R23, R24). Review `docs/reviews/nat3-p1b-figurmotor.md`: 2 høje, 3 middel, 3 lave, alle rettet (41e813e–3d04bba; D60, R25) og tjekket i »Opfølgning«; 2 nye lave (L4, L5) er åbne. Venter på udgivelse.
- Agent: `comeback-builder`.
- Mål: det, figurerne i P2 skal kunne vise, findes i formatet, motoren, tjekket, kontaktarket, øvelseskortet og »Nu« i passet:
  1. Vinkel: en figur kan tegnes fra siden eller forfra, og med to vinkler side om side, hvor én ikke er nok.
  2. Markeringer på det rigtige tidspunkt: bevægelsesretningen som pil, en vinkel ved et led og én kort cue ved en position (fx ved bunden). De står også i tekstalternativet og i stillbillederne ved reduceret bevægelse.
  3. Typiske fejl som figur: rigtigt og forkert side om side (fx hængende hofte i en push-up), knyttet til forklaringens typiske fejl og vist ved fejlen i kortet.
  4. Ingen stillestående figurer: `check-explain` afviser en figur, der ikke bevæger sig synligt (som »etbens bounds« i dag).
  5. Kontaktark for alle figurer med vinkler, markeringer, fejl og billedet midt i bevægelsen.
- Kilder: `docs/runs/NAT-3.md` pakke 2; SPEC 3.2, 3.8 og 9.1; D48.
- Grønt: `npm run check`; `e2e/figure.spec.ts` udvidet (vinkler, markeringer, fejl, reduceret bevægelse); højst 30 billeder i sekundet uden JIT; startfilerne uændrede.

### [~] P2 – Alle figurer i høj kvalitet (opgavens pakke 2)

- Status: første omgang (stillinger og bevægelse) og anden omgang (vinkler, markeringer, fejlpar) hos 6 figuragenter, flettet i 196bb1e. Review i tre dele (`docs/reviews/nat3-p2-figurer-1.md`, `-2.md`, `-3.md`): 108 af 146 figurer godkendt, 38 afvist; 3 høje, 30 middel, 24 lave. Rettet af figuragenterne og trænerne og i motorrunde 2 (7a300af–2e0909b, D62), flettet i 2e0909b; opfølgningerne godkendte 138 af 146; de sidste 8 rettet af orkestratoren og G5 med reviewernes afprøvede værdier (a749ca1, 118ec40). Begrundet: legs.1 og legs.2 vises midlertidigt uden vinkel forfra (to vinkler gør split squat for lille i »Nu«, og sofaen kan ikke stå bag figuren forfra), og fejlparrene i neck.N1 og os.5 er fjernet, fordi forskellen ikke kan ses med hovedets model.
- Agenter: `comeback-builder` × 6 parallelt på datafiler (ingen kodeændringer, ingen commits), med trænernes figurbrief fra P3 som input. Grupper:
  - P2.1 press, pull, backpack_row, shoulder
  - P2.2 legs, sl_rdl, calf, posterior, wallsit
  - P2.3 core_front, core_side, core_situp, core_rot
  - P2.4 power_legs, power_upper, burpee_skill, burpee_emom
  - P2.5 groin, neck, os
  - P2.6 warmup, club_sequence, measures
- Accept: hver øvelse er animeret; vinklen viser det vigtige (forfra for sideværts bevægelser og knæ over tæer, fra siden for hofte- og rygvinkler, to vinkler hvor én ikke er nok); rekvisitter, gulv og kontaktpunkter er rigtige; markeringerne står på det rigtige tidspunkt; de typiske fejl i trin 1 og 2 vises som rigtigt og forkert side om side; kontaktark for alle figurer i `screenshots/figures/`.
- Review: `comeback-reviewer` gennemgår hver figur mod forklaringens positioner og anatomien og afviser alt, der ikke er tydeligt (`docs/reviews/nat3-p2-figurer-*.md`). Pakken er først færdig, når de afviste figurer er rettet og godkendt.
- Grønt: `node scripts/check-explain.ts` (alle filer); `npm run check`.

### [x] P3 – Skærpede forklaringer (opgavens pakke 3)

- Status: P3a (feltet »Mærk«, D55) bygget 05:00 (0a6b352, 77072e3, 112ef68); forklaringerne flettet 05:05 (3648b6b) med tolkningerne P62–P67 (d0cb7cc); review i to dele: A (`docs/reviews/nat3-p3-forklaringer-a.md`) 0 høje, 1 middel, 10 lave og B (`-b.md`) 0 høje, 2 middel, 7 lave; alle rettet af trænerne (c1685a6, P63, P64) og tjekket i »Opfølgning« uden nye fund, undtagen A F2 (figurerne i shoulder.4–7), som er flyttet til P2.1 (P68). Koden fra P3a er reviewet med P1a uden fund. Udgivet 08:17 (Actions 42578277569).
- Agenter: `comeback-coach` × 6 parallelt i kopier i scratchpad (samme grupper som P2), ingen commits. Feltet »Mærk« (`feel`) i datamodellen og kortet bygges af `comeback-builder` (P3a).
- Mål: hvert kort læst med brugerens blik: præcis hvordan øvelsen laves derhjemme med gulv, stol, væg og rygsæk; hvad han skal mærke (»Mærk«); hvornår det er for let eller for svært (i »Lettere« og »Sværere«, i tråd med motorens regler for reserve og trin). Teksten skæres ned, hvor det kan lade sig gøre, og gøres mere konkret, hvor det er nødvendigt. Navne, doser og regler ændres ikke; bevægelsernes positioner, faser og ID'er ændres kun i ordlyden. Hver træner skriver desuden et figurbrief pr. punkt til P2 (vinkel, markeringer og tidspunkt, fejl til rigtigt/forkert, hvordan bevægelsen ser ud).
- Grønt: `node scripts/check-explain.ts` (alle filer); `npm run check`; `no-source-refs`; review `docs/reviews/nat3-p3-forklaringer.md`.

### [~] P4 – Designløft (opgavens pakke 4)

- Status: bygget 12:55 (2cddf14–d92a6e2, D59). Review `docs/reviews/nat3-p4-design.md`: 0 høje, 2 middel, 2 lave, alle rettet (3f2b7af–d5e9ad7, D61) plus dobbelttryk-spærren i passet (a307dab–f4597bf) og tjekket i »Opfølgning«; 4 nye lave (N1–N4) er åbne. Før- og efterbilleder i `screenshots/nat3-foer/` og `nat3-efter/`.
- Agent: `comeback-builder`.
- Mål: alle skærme gennemgået mod SPEC 5 og 6 og listen over forbudte mønstre: hierarki, den typografiske skala, luft, PDF'ens plakatidentitet, figuren som hovedperson og overgange, der viser, hvad der ændrede sig. Før- og efterbilleder af de vigtigste skærme (før = `main` ved NAT-3's start, 2894827).
- Grønt: hele Playwright-suiten; skærmbilleder af alle skærme; kontrast, trykflader og tekststørrelser tjekket.

### [~] P5a – Livet: søndagstjek og klublog med lørdagskarakter (opgavens pakke 5)

- Agent: `comeback-builder`. Frist: søndagstjekket virker søndag 15/11.
- Kilder: SPEC 4.6 og 4.7, ENGINE (R-PAIN-SUNDAY, klubtræning), DECISIONS P25, PLAN M3.
- Grønt: scenarierne; Playwright i tidsmaskinen (`@date`), bl.a. søndag 15/11.

### [ ] P5b – Livet: flyt og spring over

- Agent: `comeback-builder`. Kilder: ENGINE 5.9 (R-MOVE, R-REST), SPEC 3.1 og 4.11, PLAN M3.
- Grønt: scenarierne for R-MOVE og R-REST; Playwright i tidsmaskinen (`@date`).

### [ ] P5c – Livet: syg, rejse, ferie, klubben lukket og begivenheder

- Agent: `comeback-builder`. Kilder: ENGINE 5.7 og R-EVENT, SPEC 4.11, PLAN M3.
- Grønt: scenarierne for S-WEEK og S-EVENT dækket af UI; Playwright i tidsmaskinen (`@date`).

### [ ] P6 (valgfri) – Resten af milepæl 3, derefter milepæl 4

- Jul og nytår (5.8), ugeplan med ekstra Muay Thai-dage (5.10), flad-reglen og smerte-gendannelsen synlige, .ics-fil, historik med klubtræninger; derefter PLAN M4.
