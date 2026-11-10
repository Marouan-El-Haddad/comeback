# NAT-3 – rapport

Kørslen 9.–10. november 2026, uden opsyn. Opgaven står i `docs/runs/NAT-3.md`, tjeklisten i `docs/runs/NAT-3-TASKS.md` og tidslinjen i `docs/runs/NAT-3-LOG.md`. Arbejdsformen var NAT-2's: orkestrator med `comeback-builder`, `comeback-coach` og `comeback-reviewer`, én byggeagent ad gangen i arbejdsmappen, indhold i kopier i scratchpad, reviews i egne worktrees og et push efter hvert grønt review.

## 1. Hvad er lavet

| Pakke | Status | Indhold |
| --- | --- | --- |
| P0 Passet færdigt | Færdig og udgivet mandag kl. 08.17, før tirsdagens Styrke A | NAT-2's ucommittede arbejde er gjort færdigt: »Dagens pas«, »Nu« og »Næste«, pausen med »Gør klar«, introkortet og »Hold pause«. Skater-hop og split jumps er ét sæt (P54, D54), uge 1 har ingen burpee-test (R19), et gemt pas fra den forrige version genoptages, og et dobbelttryk efter introkortet kan ikke længere logge nakkens »Stop« (D57). |
| P1a Figurmotoren rettet | Færdig og udgivet | Kroppen bevæger sig ud fra det, der står stille, så knæ og albuer ikke knækker, og intet går gennem gulvet. Tjekket ser også billederne mellem positionerne. Desuden skridt og hop (`lift`, `advance`, `via`), ryggens krumning, ansigtet og kontakt på side, ryg og mave (D56, R20, R22). |
| P1b Vinkler, markeringer og fejl | Færdig og udgivet | En figur kan vise to vinkler, markeringer på det rigtige tidspunkt (pil, vinkel, kort cue og hjælpelinje) og typiske fejl som rigtigt og forkert side om side i kortet. En figur, der står stille, afvises. Hovedet kan nikke, og kroppen kan dreje (D58, D60, D62). |
| P2 Alle figurer i høj kvalitet | Færdig og udgivet | Alle 146 figurer (129 trin, rutinepunkter og målinger) er tegnet om i to omgange efter trænernes figurbrief og gennemgået figur for figur. 38 blev afvist i første runde, og alle er rettet. Etbens bounds springer nu fremad og står animeret øverst i kortet. 132 figurer har markeringer, og trin 1–2 og målingerne har fejlpar. Kontaktark for alle i `screenshots/figures/`. |
| P3 Skærpede forklaringer | Færdig og udgivet mandag kl. 08.17 | Alle 129 kort er læst med brugerens blik: præcis opstilling derhjemme, et nyt felt »Mærk« (D55) og »Lettere« og »Sværere« med et signal for, hvornår de gælder. Tolkningerne står i P62–P68. |
| P4 Designløft | Færdig og udgivet | Én typeskala med ni størrelser, afstande i trin af 8 px, navy plakatbånd på I dag, delenes store røde tal i passet og i »Dagens pas«, »✓ Logget« i pausen, Uge som tabel og Stiger i Kanit (D59). Pausens »Gør klar« og introkortets trin står over knapperne, og alle knapper i passet, der skriver, har en dobbelttryk-spærre (D61). |
| P5a Søndagstjek og klublog | Færdig og udgivet | »Hvordan var det?« efter klubtiden og dagen efter, lørdagskarakter og »Jeg var der ikke«. Søndagstjekket vises søndag og mandag. Et nyt tjek afløser det gamle uden at tage et spor ned to gange, og »For tungt?« går ét trin ned (D63, D65, D69; S-PAIN-07 til -12). |
| P5b Flyt og spring over | Færdig og udgivet | »Flyt eller spring over« på I dag og i Uge viser kun de dage, motoren tillader, og kort version på klubdage. Glemte pas tilbydes, og »Valgfri rolig tur« vises, når motoren udgår (D64, D66, D68; S-MOVE-04 til -09). |
| P5c Status og begivenheder | Færdig og udgivet | Syg, rejse, ferie og klubben lukket med fra- og til-dato, og en status kan rettes eller afsluttes. Begivenheder kan tilføjes, og dagen før står forklaringen med motorens ord. Syg viser programmets tekst (D67, D70, D71; S-WEEK-13 til -16, S-EVENT-03). |
| P6 Resten af M3 og M4 (valgfri) | Ikke startet | Valgfri ifølge opgaven. |

## 2. Hvad er verificeret

- **`npm run check`** på e17e5b5 og igen på 85dc0a0: exit 0, 829 Vitest-tests, typecheck, lint og build. JavaScript fylder 120,4 kB gz af 150 og CSS 4,5 kB af 30. Startfilerne henviser ikke til indholdet.
- **Playwright, hele suiten** i `pixel9a` (Firefox uden JIT) og `pixel9a-utc` på e17e5b5 og igen på 85dc0a0: 179 af 179 bestået begge gange, uden fejl og uden gentagne forsøg.
- **Efter den sidste figurrettelse** (ringen i `legs.1`, kun indhold, godkendt af revieweren) køres `npm run check` og hele suiten igen på den endelige commit med denne rapport. Resultatet står i chatten.
- **Opstarten** er ikke blevet langsommere. »I dag synlig« var median 37–42 ms undervejs, mod 36–37 ms før.
- **Udgivet** med GitHub Actions efter hver grøn pakke: 42578277569 (P0 og P3), 42705154428 (P1a, P1b, P2 og P4), 42729966717 (P5a og P5b) og den sidste kørsel med denne rapport, som står i chatten (P5c, slutrunden og rapporten).
- **Testtal:**
  - Vitest: fra 565 efter P0 til 829.
  - Playwright: fra 64 efter P0 til 179 i de to projekter.
  - Nye flows:
    - passet hele vejen tirsdag og fredag, også målt for, at det, der skal læses, står over bundblokken;
    - dobbelttryk;
    - figurer med vinkler, markeringer og fejlpar;
    - klublog og søndagstjek;
    - flyt og spring over;
    - status og begivenheder;
    - tidsmaskinen, der aldrig skriver.
- **Reviewfund i tal** (første review plus nye fund i opfølgningerne). Alle høje og middel er rettet eller begrundet nedenfor:

| Pakke | Høj | Middel | Lav |
| --- | --- | --- | --- |
| P0 | 1, rettet | 1, rettet | 6: 5 rettet, L4 dækket af P4's målinger |
| P1a | 3, rettet (H3 i P1b) | 2, rettet | 2, rettet |
| P1b | 2, rettet | 3, rettet | 5, rettet |
| P2 (tre dele, 146 figurer) | 3, rettet | 35, rettet eller begrundet; alle 146 figurer godkendt | 32, de fleste rettet; resten er forslag |
| P3 (to dele, 129 kort) | 0 | 3, rettet | 17, rettet |
| P4 | 0 | 2, rettet | 6: 5 rettet, N2 som forslag |
| P5a, med slutrunden | 1, rettet | 3, rettet | 9, rettet |
| P5b | 0 | 2, rettet | 7, rettet |
| P5c | 0 | 2, rettet | 7, rettet (2 nye fra rettelsen, også rettet) |
| **I alt** | **10, alle rettet** | **53, alle rettet eller begrundet** | **91** |

- **Høje og middel fund pr. pakke.** Hvert fund er rettet af den agent, der lavede arbejdet, og tjekket af samme reviewer i rapportens »Opfølgning« (eller »Slutstatus« og »Slutrunde«):

| Pakke og rapport | Høje og middel | Status |
| --- | --- | --- |
| P0, `docs/reviews/nat3-p0-passet.md` | H1, M1 | Rettet og godkendt i »Opfølgning« |
| P1a og P3a, `nat3-p1a-figurmotor.md` | H1, H2, M1, M2 og det nye H3 | H1–M2 rettet og godkendt i »Opfølgning«. H3 er rettet i P1b og godkendt i P1b's »Opfølgning«. P3a har ingen fund |
| P1b, `nat3-p1b-figurmotor.md` | H1, H2, M1–M3 | Rettet og godkendt i »Opfølgning« |
| P2, `nat3-p2-figurer-1.md`, `-2.md` og `-3.md` | 3 høje og 35 middel, med de nye i opfølgningerne og i »Slutstatus« (ringen i `legs.1`) | Rettet; alle 146 figurer er godkendt i de tre »Slutstatus«. Begrundet frem for rettet, med reviewerens egen løsning: split squats (`legs.1`, `legs.2`) uden vinkel forfra, fordi to vinkler gjorde figuren ca. 50 × 62 px i »Nu«, og sofaen kan ikke stå bag figuren forfra. Fejlparret fra siden er bevaret |
| P3, `nat3-p3-forklaringer-a.md` og `-b.md` | A F1, B M1 og M2 | Rettet og godkendt i »Opfølgning« |
| P4, `nat3-p4-design.md` | M1, M2 | Rettet og godkendt i »Opfølgning« |
| P5a, `nat3-p5a-livet.md` | H1, M1–M3 | Rettet og godkendt i »Opfølgning«. Slutrundens egen regression (lav) er rettet og godkendt i »Slutrunde« |
| P5b, `nat3-p5b-flyt.md` | M1, M2 | Rettet og godkendt i »Opfølgning« |
| P5c, `nat3-p5c-status.md` | M1, M2 | Rettet og godkendt i »Opfølgning«. De to regressioner fra rettelsen (lave) er rettet og godkendt i »Kort tjek af N1 og N2« uden nye fund |

- **Kun lave fund står åbne** som forslag (afsnit 4). Desuden er fejlparrene i nakke N1 og `os.5` fjernet (lavt fund O3), fordi forskellen ikke kan ses tydeligt med hovedets model.
- **Før og efter** (`screenshots/nat3-foer/` → `screenshots/nat3-efter/`, samme navne): `i-dag.png`, `uge.png`, `stiger.png`, `stige.png`, `kort-skimmet.png`, `kort-foldet-ud.png`, `kort-fra-passet.png`, `pas-skridt.png`, `pausetimer.png`, `trafiklys.png`, `opsummering.png`, `onboarding.png`, `program.png`, `om.png` og `hvorfor.png`. Nye skærme: `dagens-pas.png`, `pas-nu-og-naeste.png`, `pause.png`, `introkort.png`, `kort-fejlpar.png`, `kort-figur-vinkler.png`, `klublog.png`, `soendagstjek.png`, `flyt.png`, `status.png`, `begivenhed.png` og `i-dag-syg.png`.
- **URL:** appen ligger på `https://<konto>.github.io/comeback/`. Den fulde adresse står i chatten (D27).

## 3. Tjekliste til telefonen

Ca. 10 minutter i tidsmaskinen (langt tryk på versionen). Afslut simuleringen til sidst.

1. Tirsdag 10/11: »Se dagens pas« → »Start passet«. Står »Nu« og »Næste« hele tiden på skærmen, og står »Gør klar« for den næste øvelse over knapperne i pausen? (ja/nej)
2. Tryk »Sådan gør du« ved squat jumps. Bevæger figuren sig med en markering, fx »Over tæerne«, og står rigtigt og forkert side om side under »Typiske fejl«? (ja/nej)
3. Stiger → Power ben → etbens bounds. Springer figuren fremad, animeret øverst i kortet? (ja/nej)
4. Søndag 15/11: kan søndagstjekket udfyldes og gemmes på under to minutter? (ja/nej)
5. Tirsdag 10/11: »Flyt eller spring over« → flyt Styrke A til onsdag. Står passet om onsdagen i Uge? (ja/nej)
6. Mere → Status → »Syg« i to dage fra i dag. Viser I dag kun Open & Strong og programmets tekst om feber? Afslut derefter simuleringen: er dine rigtige data uændrede? (ja/nej)

## 4. Hvad der ikke kunne gøres og hvorfor

- **En begivenhed kan ikke fjernes**, kun tilføjes. Motoren har ingen hændelse til at fjerne den, og en ny hændelsestype (`calendar_event_removed`) kræver en migration af dine data. Det er din beslutning. Skærmen siger det, før du gemmer.
- **Split squats forfra** er udeladt i denne omgang (se begrundelsen ovenfor). De kan komme tilbage, når »Nu« kan vise én vinkel, hvor to ville gøre figuren mindre.
- **P6 (valgfri)** er ikke startet: jul og nytår, ugeplan med ekstra Muay Thai-dage, .ics-fil, historik med klubtræninger og milepæl 4.
- **Lave fund, der står åbne som forslag:**
  - P4 N2: figuren i pausen kan miste en del af sig selv under bundblokken på små figurer.
  - Fra figur-reviewene, alle lave: markeringer i meget korte faser (del 2 L2); motorens proportioner (del 2 L6); striben med en cue står ved sidebilledet, mens linjen er forfra (del 2 N3); fejlringen i pogo (del 3 L6); skulderens bevægelighed og skulderbladene (del 3 L7, L8); en arm, der går over sin rod set ovenfra (del 3 O4); spidermans støttearm set ovenfra (del 3 O5).

## 5. Forslag uden for opgaven

- Afgør, om en begivenhed skal kunne fjernes (ny hændelse med migration).
- Lad »Nu« vise én vinkel, når to ville gøre figuren mindre, og giv så split squats deres vinkel forfra igen.
- Rygsækkens vægt starter på 0 kg i appen og kan ikke rettes, selv om ENGINE R-LOAD siger, at brugeren kan rette den.
- Tilbage-gestussen lukker appen fra Historik, Backup og Om, som ikke er trin i historikken.
- EMOM'en har ingen smerteknap, og burpee-varianterne kan ikke vælges i appen.
- Talfeltet læser »4.500« som 4,5. Kortene siger »4500 uden punktum«, og feltet bør advare.
- Nakkens »Stop« sætter i koden trinnet ned i en uge, uden at R-NECK siger det.
- Stiger kunne vise figurernes stillbilleder i stedet for piktogrammer (kræver en rettelse af SPEC 3.5).
- Opvarmningens pogo-hop har ingen lettere udgave efter skarp smerte (P62 gælder kun power trin 1).

## 6. Ændrede filer

- `docs/`:
  - SPEC 3, 4, 5, 6 og 9.1;
  - ENGINE 3.1, 5.x, 6.5, 8 og 9;
  - DECISIONS D54–D71, P62–P68 og R19–R34;
  - `runs/NAT-3*.md` og `runs/NAT-3-FIGURES.md`;
  - 12 reviewrapporter i `reviews/nat3-*.md`.
- `content/explain/` (23 filer) og `content/figures/` (23 filer).
- `src/engine/`:
  - `session.ts`, `derive.ts`, `moves.ts`, `plan.ts`, `status.ts` (ny), `types.ts`, `explain.ts` og `index.ts`;
  - nye scenarier S-PAIN-07 til -12, S-MOVE-04 til -09, S-WEEK-13 til -16 og S-EVENT-03.
- `src/figure/` (motor, tjek, markeringer, kontaktark) og `src/content/` (typer og validering).
- `src/ui/`:
  - passet, kortet og figuren;
  - I dag, Uge, Stiger og Mere;
  - klublog, søndagstjek, flyt, status og begivenheder;
  - `hooks.ts` og CSS.
- `e2e/` (nye og udvidede flows), `scripts/`, `tools/pictos/README.md` og `screenshots/` (inkl. `figures/`, `nat3-foer/` og `nat3-efter/`).

Motoren rørt: ja
