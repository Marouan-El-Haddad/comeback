# Review af NAT-3 P4 – Designløftet

2026-11-09 · 2cddf14, 49222e6, 42401d1, 8512af0, 68c7888, 542980d, 8671a02 og d92a6e2 · worktree på d92a6e2 (`git diff ece1f42 d92a6e2`)

Metode:

- **Læst** mod:
  - P4 i `docs/runs/NAT-3-TASKS.md` og pakke 4 og brugerens feedback i `docs/runs/NAT-3.md`;
  - SPEC 3.1–3.6, 3.8, 4.1, 5, 6 og 8;
  - DECISIONS D33, D44, D47, D51, D54, D57 og D59;
  - L4 i P0-reviewet (`docs/reviews/nat3-p0-passet.md`).
- **Kørt** i worktreen:
  - `npm run check`: exit 0 og 719 tests. JavaScript 101,9 kB gz (ece1f42: 100,5), CSS 4,2 kB (3,7). Startfilerne henviser ikke til indholdet.
  - Hele Playwright-suiten i `pixel9a` og `pixel9a-utc` (`E2E_PORT=4185`): 80/80 uden flaky på 23,5 min.
  - `e2e/perf.spec.ts` to gange alene for hver version, med første tegning og I dag synlig som median:

    | | Første tegning | I dag synlig |
    |---|---|---|
    | P4 | 37 og 35 ms | 41 og 39 ms |
    | ece1f42 | 35 og 34 ms | 39 og 39 ms |

    Forskellen ligger inden for støjen, for de enkelte kørsler spænder over 32–48 ms.
- **Egne flows** i `pixel9a` (Firefox uden JIT og med animerede figurer). De er scratch og ikke committet.
  - Tre hele pas med »Som planlagt«, alle introkort lukket med »Luk« og pauserne sprunget over:
    - Styrke A tirsdag 10/11 og Styrke B fredag 13/11 i en frisk profil uden tidsmaskine;
    - Styrke A tirsdag i tidsmaskinen.
  - På hver skærm blev det målt, om følgende ender over den faste bundblok:
    - introkortets »Gør klar« og trin;
    - pausens »Gør klar«;
    - »Nu«s cues og mål.
  - »✓ Logget« og delenes tal blev holdt op mod headerens »Del N af M«.
  - De samme flows kørte på ece1f42, bygget fra `git archive`, som udgangspunkt.
- **Set** før og efter skærm for skærm:
  - `screenshots/nat3-foer/` og `nat3-efter/`;
  - ece1f42's egne skærmbilleder;
  - mine egne fra begge versioner.

## Resultat

0 høj, 2 middel og 2 lav.

- **Er det mærkbart bedre? Uden for passet: ja.**
  - I dag har plakatens bånd, røde doser og »ca. 55 min« stort.
  - Uge er en tabel med farvede chips med navn og »i dag« i ord.
  - Stiger har trinnet i rødt. Stigen har »Dit trin« i et rødt mærke.
  - Opsummeringen har lyset som ord og navnet først.
  - Mere siger, hvad der er bag hver række.
  - Velkomsten har bånd, og indfasningen har afsnit i stedet for ens kort.
  - Trafiklysets spørgsmål står lavt.
- **I passet er P4's egen ændring mindre, end før-billederne viser.** `nat3-foer/pas-skridt.png` og `pausetimer.png` er fra før P0, så side om side tæller de også P0's »Nu og næste« og figuren i pausen med.
  - **Nyt fra P4 i passet:**
    - delens store røde tal;
    - »NU« og »NÆSTE« som par;
    - »✓ Logget« i pausen;
    - større navn, cues og figurer.
  - **Målt mod det rigtige udgangspunkt (ece1f42)** er pausen og introkortet blevet sværere at bruge. Netop det, man skal læse i pausen, står nu under bundblokken (M1, M2).
- **Det virker:**
  - **Designkravene:** typeskalaen, 8 px mellem trykflader, kontrast, 56/64 px og tekststørrelser holder på alle skærme, og suiten måler dem nu (D59 (6)).
  - **»Som planlagt« (D33):** knappen står samme sted på hvert sæt. Bundblokkens top er 542 px på alle 40 sæt i begge pas, som på ece1f42.
  - **»✓ Logget«** siger det rigtige i alle tre pas:
    - sæt og antal;
    - »højre side« og »højre ben« pr. side;
    - »måling« for en max-test.
  - **Delens tal:** tallet over introkortet og ved »Næste« (»Del 4 · Par 1«) er det samme, som headeren viser, når øvelsen kommer. Det gælder del 2–8 tirsdag og del 1–9 fredag.
  - **SK3:** hold, nakke, klubsekvens og introkort kører stadig uden berøring (suiten).
  - **Reduceret bevægelse:** intet glider ind.
  - **Data:** intet er ændret i motor, hændelser, lager, programdata eller tidsmaskinen.
- **Det virker ikke:**
  - I pausen står »Gør klar« under »Spring pausen over« (M1).
  - På introkortet står trinene under »Luk« (M2).
  - I tidsmaskinen ligger andet cue oftere under »Næste« (L1).
  - Ingen test ser nogen af delene (L2).

## Fund

### M1 (middel): I pausen står »Gør klar« under »Spring pausen over« i 26 af 32 pauser (ece1f42: 8 af 33)

- **Hvor:**
  - `src/ui/session/Runner.tsx:1373–1377` og `:1392`: »✓ Logget« er en ny linje over ringen med 16 px luft.
  - `src/ui/session/session.css:233–239`: figuren i pausen og på introkortet er 160 px (stående 176 px), før 130 (150).
  - `src/ui/session/session.css:387–392`: »Næste« står under en navy streg på 4 px med 16 px luft.
  - Skærm: pausen efter første squat jump tirsdag uden tidsmaskine. `screenshots/review-p4-pause-foer.png` (ece1f42) viser hele »Næste« med 40 px til overs. `review-p4-pause-efter.png` (d92a6e2) har »Gør klar« skåret over af bundblokken.
- **Hvorfor:**
  - **Kilderne:**
    - D51 lover: »Pausen viser »Næste« stort uden at rulle på 414 × 847«.
    - SPEC 3.2 (Pausen): »Næste« har navn, mål, figuren, »Gør klar« og »Sådan gør du«.
    - SPEC 6: telefonen ligger på gulvet, og pausen er der, hvor man læser, hvad man skal gøre klar.
  - **Målt uden tidsmaskine** (bundblokkens top er 766 px):

    | | Tirsdag | Fredag |
    |---|---|---|
    | P4 | 12 af 15 pauser, højst 106 px under (»Læg · Etbens tåløft på et trappetrin«) | 14 af 17 pauser, højst 121 px under (»Rygsæk-row«) |
    | ece1f42 | 4 af 16 pauser, højst 76 px under | 4 af 17 pauser, højst 52 px under |

  - **Fra undtagelse til regel:** P0-reviewets L4 fandt fejlen i to pauser. Nu er det reglen, og det rammer de sætninger, der siger, hvordan rygsækken pakkes og stolen stilles.
  - **I tidsmaskinen**, som telefonens tjekliste bruger: 16 af 16 pauser, op til 178 px (ece1f42: 15 af 16, op til 148 px).
- **Rettelse:**
  1. Giv pausen de 30–120 px tilbage:
     - figuren 130 px som før, eller en højde, der følger skærmens højde;
     - 8 px i stedet for 16 over og under »✓ Logget« og over »Næste«.
  2. Er det ikke nok, så stil »Gør klar« før figuren. Så er det figurens fødder og ikke teksten, der kan gå under bundblokken.
  3. Krav: »Gør klar« ender over `.fixed-actions` i hver pause tirsdag og fredag på 414 × 847 uden banner. Det testes som i L2.

### M2 (middel): Introkortets trin står under »Luk«: 6 af 48 trin ses tirsdag og 6 af 60 fredag (ece1f42: 23 af 48 og 31 af 60)

- **Hvor:**
  - `src/ui/session/Intro.tsx:87–89` (`IntroCard`): over kortet står nu tre ting:
    - »✓ Logget« (`above`);
    - uret;
    - `PartHead` med 64 px tal, navn og noten »Et sæt af hver øvelse efter tur, med pause imellem« på to linjer, i alt ca. 90 px plus 16 px luft.
  - `src/ui/session/Runner.tsx:1378–1387` (pausens introkort), `:821` (introkort med egen nedtælling) og `:1789` (EMOM'ens kort).
  - `src/ui/session/session.css:323`: urets tal er gået fra 48 til 64 px.
  - `src/ui/session/session.css:233`: figuren er gået fra 130 til 160 px.
  - Skærmbilleder af Split squat tirsdag uden tidsmaskine:
    - `screenshots/review-p4-introkort-foer.png` (ece1f42): »Gør klar« og trin 1–2 ses.
    - `review-p4-introkort-efter.png` (d92a6e2): »Gør klar« er skåret over midt i sætningen, og intet trin ses.
  - EMOM'ens kort: `review-p4-emom-foer.png` og `-efter.png`.
  - I tidsmaskinen: `review-p4-introkort-tidsmaskine.png`.
- **Hvorfor:**
  - **Kilderne:**
    - SPEC 3.2 (Introkort, D44, D51): kortet viser »Ny øvelse«, navnet, målet, figuren, »Gør klar« og de nummererede trin. Uret står på én linje øverst, og D51 lagde det på én linje, netop for at kortet kunne ses.
    - Kortet lukker af sig selv, når pausen slutter (SK3), og ved et tryk på kortet. Trinene skal derfor kunne læses uden at røre skærmen.
  - **Målt uden tidsmaskine:**

    | | Tirsdag | Fredag |
    |---|---|---|
    | P4 | intet helt trin på 7 af 12 introkort; »Gør klar« skåret over på 3 (Split squat 30 px, Liggende adduktorløft 14 px, EMOM'en) | intet helt trin på 10 af 15 kort |
    | ece1f42 | 0 af 12 kort uden et helt trin | 0 af 15 kort uden et helt trin |

  - **I tidsmaskinen:**

    | | Helt synlige trin | Kort med »Gør klar« skåret over |
    |---|---|---|
    | P4 | 1 af 48 | 8 af 12 |
    | ece1f42 | 11 af 48 | 0 |

  - **Tirsdag 10/11 er første rigtige pas.** Alle øvelser er nye, og passet har 12 introkort med trin (fredag 15).
- **Rettelse:**
  1. Stil delens nummer og navn i urets linje (»4 · Par 1« til venstre for »Pause 1:00«), ikke som eget hoved over kortet. Noten hører til i »Dagens pas« og ved »Næste«.
  2. Vis »✓ Logget« i pausen, når kortet er lukket, eller i urets linje. Det skal ikke være en ekstra linje over introkortet.
  3. Figuren på introkortet skal være 130 px som før.
  4. Ret SPEC 3.2 (»En ny del«) og D59 (2), så de siger, hvor tallet står.
  5. Krav: trin 1 ender over `.fixed-actions` på hvert introkort tirsdag og fredag uden banner (L2).

### L1 (lav): I tidsmaskinen står andet cue i »Nu« under »Næste« på 15 af 26 skærme (ece1f42: 9)

- **Hvor:**
  - `src/ui/app.css:366–369`: navnet er gået fra 24 til 28 px.
  - `src/ui/session/session.css:294–300`: cues er gået fra 19 til 20 px.
  - Kommentaren i `src/ui/app.css:33–37` siger, at 8 px »keeps the cues above the fixed actions, also under the time machine's banner«. Det holder ikke.
- **Hvorfor:**
  - **Kilderne:** SPEC 3.2 (Nu og næste) og D51 kræver, at »Nu« har 2 cues synlige.
  - **Målt i tidsmaskinen:**
    - »Liggende adduktorløft« og »Dead bug, langsom« står nu på to linjer ved »Sådan gør du«. Andet cue ender 9 px under strimlen (`screenshots/review-p4-nu-tidsmaskine.png`).
    - Ved »Etbens tåløft på et trappetrin« er det 49 px (før 31).
  - **Uden tidsmaskine** står begge cues over strimlen på alle 47 »Nu«-skærme (mindst 23 px). Det rammer altså kun tjeklisten på telefonen.
  - P0-reviewets L4 fandt fejlen ved split squat.
- **Rettelse:**
  1. Lad »Sådan gør du« stå under navnet, når navnet fylder to linjer, eller giv figuren i »Nu« 8–16 px mindre.
  2. Ret kommentaren i `app.css`.

### L2 (lav): Testene ser hverken, om bundblokken dækker, eller »✓ Logget« og delens tal på skærmen

- **Hvor:**
  - `e2e/session.spec.ts:363`, `:387` og `:408`: `toBeVisible()` og `toContainText()` på introkortets trin og pausens »Gør klar«.
  - `e2e/a11y.ts:114–157`: afstanden måles kun mellem trykflader.
  - `src/ui/__tests__/outline.test.ts:118–170`: kun de rene funktioner testes.
- **Hvorfor:**
  - **Kilderne:** D51, D59 (2), (5) og (6) og SPEC 3.2 (Pausen og En ny del).
  - **`toBeVisible()`** ser ikke, at bundblokken dækker. Derfor gik M1 og M2 igennem 80 grønne tests. P0-reviewets L4 (rettelse 2) er stadig åben.
  - **Ingen Playwright-test læser** følgende på skærmen:
    - `rest-logged`;
    - `.day-part-number` over introkortet;
    - `.next-part-name`.
  - **Teksterne er rigtige i dag** (se Resultat). En fejl i `steps[run.stepIndex - 1]` (`Runner.tsx:932`) eller i `partOf` ville dog ikke blive fanget.
- **Rettelse:**
  1. Lav en hjælper `expectAboveActions(page, selectors)` i `e2e/helpers.ts`.
     - Den kaldes fra `driveChecking` i tirsdagens og fredagens pas, både uden og med banner.
     - Den tjekker hvert introkort (`.intro-steps li:first-child` og `.get-ready`), hver pause (`.next-up .get-ready`) og hvert sæt (`.now-cues li:last-child`).
  2. Forvent følgende i »Styrke A i tidsmaskinen«:
     - `rest-logged` er »✓ Logget: sæt 1 af 2 · 3 reps« efter første squat jump;
     - i pausen efter power er `.intro .day-part-number` »4« og `.next-part-name` »Del 4 · Par 1«;
     - ved målingen står »Del 4 af 8« i headeren.

## Tjekket uden fund

- **Forbudte mønstre (SPEC 5):**
  - Ingen af disse findes: creme, kursiv, »01/02«, monospace, piller (mærkerne har 6–8 px hjørner), gradienter, emojis, placeholders eller tekst under 16 px.
  - **Grå på grå:** ugens fakta står i blæk på panel.
  - **Ens kort:**
    - Ugens dage er rækker i en tabel, ikke kort.
    - Indfasningen har fået afsnit.
    - Mere og Stiger er lister med forskelligt indhold i én kolonne, ikke et gitter.
  - **»✓«:** tegnet i »✓ Logget« og »✓ Logget i dag (grønt)« er ikke et dekorativt ikon. Det er et statustegn ved siden af ordet, samme konvention som SPEC 3.4 bruger i Uge (»✓ logget, ◐ gult«), og det bærer intet budskab alene. U+2713 har ingen emoji-visning.
- **Kontrast:**
  - Alle skærme består i suiten.
  - Selv regnet:
    - hvid på blå (motor-chippen): 7,8:1;
    - hvid på navy: 13,6:1;
    - hvid på rød (»NU«, »Dit trin«): 7,5:1;
    - rød på hvid (doser, »Del 4 · Par 1«): 7,5:1;
    - navy på rød tint (Muay Thai): 11,6:1.
- **Trykflader, 8 px og 64 px:** fanerne er ca. 94 × 64 px med 8 px imellem. »Tilbage« er 120 × 56 px, og menuens rækker er 72 px høje.
- **Intet budskab kun med farve (SPEC 6):**
  - Uge-chippene har navnet.
  - Dagen i dag har »i dag«.
  - Opsummeringens lys står som ord.
  - Stigens trin har »Dit trin«.
  - Fremdriften har »Del N af M«.
- **Dansk:**
  - Teksterne er korte og ens: »Dine pas med dato, trafiklys og sæt« i Mere og »… med dato, trafiklys og sæt« i Historik.
  - »reps« står kun som enhed ved tal.
  - Ingen tekst henviser til PDF eller kilder (`no-source-refs` er grøn).

## Opfølgning

2026-11-09 · rettelserne 3f2b7af, e43f056, ee0c7ad, 1057099, d2a1745 og d5e9ad7 (D61) og dobbelttryk-spærren a307dab, ec71934 og f4597bf · worktree på f4597bf

Metode:

- **Kørt** i worktreen:
  - `npm run check`: exit 0 og 712 tests. JavaScript 103,9 kB gz, CSS 4,2 kB. Startfilerne henviser ikke til indholdet.
  - Hele Playwright-suiten i `pixel9a` og `pixel9a-utc` (`E2E_PORT=4185`): 103/103 uden flaky på 28,1 min, inklusive `e2e/fit.spec.ts` og de fire nye dobbelttryk-tests.
- **Mine flows fra reviewet** kørte igen på f4597bf (i en kopi bygget fra `git archive`, `pixel9a`, figurerne i bevægelse):
  - Styrke A tirsdag 10/11 og Styrke B fredag 13/11 uden tidsmaskine;
  - Styrke A tirsdag i tidsmaskinen.
- **Egne dobbelttryk** på en frisk profil, så hændelserne kunne tælles i IndexedDB:
  - knapperne »GRØN – kør passet«, »Som planlagt«, »Spring pausen over« og power-spørgsmålets »Ja«;
  - 60, 180 og 300 ms mellem trykkene, og skrivninger, der tager 0, 400 og 900 ms ekstra;
  - desuden et enkelt tryks svartid og Open & Strong's »Videre«.

### Målt

Uden tidsmaskine:

| | Introkort: helt synlige trin | Kort uden et helt trin | »Gør klar« skåret over på kortet | Pauser med »Gør klar« under bundblokken | »Nu« med cue eller mål under |
|---|---|---|---|---|---|
| Tirsdag, ece1f42 | 23 af 48 | 0 af 12 | 0 | 4 af 16 | 0 af 26 |
| Tirsdag, d92a6e2 | 6 af 48 | 7 af 12 | 3 | 12 af 15 | 0 af 24 |
| Tirsdag, f4597bf | 22 af 48 | 0 af 12 | 0 | 0 af 16 | 0 af 26 |
| Fredag, ece1f42 | 31 af 60 | 0 af 15 | 0 | 4 af 17 | 0 af 22 |
| Fredag, d92a6e2 | 6 af 60 | 10 af 15 | 0 | 14 af 17 | 0 af 22 |
| Fredag, f4597bf | 29 af 60 | 0 af 15 | 0 | 0 af 17 | 0 af 22 |

I tidsmaskinen (tirsdag):

| | Helt synlige trin | Kort uden et helt trin | »Gør klar« skåret over på kortet | Pauser med »Gør klar« under | Andet cue under »Næste« |
|---|---|---|---|---|---|
| ece1f42 | 11 af 48 | 3 af 12 | 0 | 15 af 16 | 9 af 26 |
| d92a6e2 | 1 af 48 | 11 af 12 | 8 | 16 af 16 | 15 af 26 |
| f4597bf | 10 af 48 | 4 af 12 | 0 | 0 af 16 | 0 af 26 |

Ingen skærm ruller vandret.

### Status for fundene

- **M1 er rettet.** »Gør klar« står over bundblokken i alle 33 pauser tirsdag og fredag, også i tidsmaskinen. Før P4 stod den under i 8 af 33.
- **M2 er rettet.**
  - Over introkortet står kun uret, med delens tal og navn i urets linje (»5 · Par 2 · Pause 1:00«, `screenshots/review-p4-opf-introkort.png`). EMOM'ens kort har delen i overlinjen (`review-p4-opf-emom.png`).
  - Uden tidsmaskine viser hvert introkort »Gør klar« og mindst ét helt trin. I tidsmaskinen er det på niveau med ece1f42 (4 mod 3 kort uden et helt trin).
  - »✓ Logget« står i pausen, når kortet er lukket. SPEC 3.2 er rettet til det.
- **L1 er rettet.** Et navn på over 16 tegn står i 22 px. Andet cue står over »Næste« på alle 26 »Nu« i tidsmaskinen.
- **L2 er rettet.**
  - `e2e/fit.spec.ts` måler det, jeg målte, i begge pas: introkortets »Gør klar« og første trin, pausens »Gør klar«, målingens felt og det sidste cue. Med banneret måler den cues.
  - `session.spec.ts` læser »✓ Logget«, delens tal i urets linje, »Del 4 · Par 1« og »Del 4 af 8« på skærmen.

### Dobbelttryk-spærren (D61)

- **Den virker.** Alle mine kombinationer gemte én gang og sprang intet over:
  - »GRØN« gav ét `session_started`, og introkortet kom.
  - »Som planlagt« gav ét `set_logged`, og pausen kom, ikke næste sæt.
  - »Spring pausen over« gav intet `set_logged` og stod på »Sæt 2 af 3«.
  - »Ja« gav ét `block_result` og stod på »Push-up med tempo · Sæt 1 af 3«.
- **Suiten:** de nye tests med 400 ms langsommere skrivninger består (spørgsmål 3, »Rød«, svarene, væg-testen, nakkens »Stop« og »Afslut passet«). Det gør de gamle dobbelttryk på introkortets »Luk« også (D57).
- **Et almindeligt tryk virker med det samme:**
  - »Som planlagt« viste pausen efter 51 ms.
  - Et tryk 600 ms efter skiftet virkede efter 74 ms.
  - Spærren efter et skift er stadig et halvt sekund (D33) og ikke længere.
- **SK3:** hold, nakke, klubsekvens og introkort kører stadig uden berøring (suiten).
- **Koden:** `once` (`src/ui/session/Runner.tsx:241–266`) sætter en ref og `settling` ved første tryk.
  - Ref'en nulstilles, når skærmen skifter, og en fejlet skrivning frigiver skærmen igen.
  - Alle de spærrede handlinger skifter skærm, når de lykkes (`begin`, `finish`, `advance`, `nextPre`), så spærren kan ikke blive hængende.

### Nye fund

0 høj, 0 middel og 4 lav.

#### N1 (lav): I Open & Strong springer et dobbelttryk på »Videre« næste øvelse over

- **Hvor:**
  - `src/ui/session/OpenStrong.tsx:57–67` (`next`) og `:251` (»Videre« står samme sted på hvert punkt).
  - Open & Strong har ikke passets halve sekunds spærre (D33). D61 spærrer kun, at dagen gemmes to gange.
- **Hvorfor:**
  - SPEC 6: knapper tåler et klodset tryk, og der er ingen hurtigt skiftende knapper på samme sted.
  - Opfølgningens krav: et dobbelttryk springer aldrig over.
  - **Målt:** et dobbelttryk på punkt 1's »Videre« med 180, 300 og 450 ms imellem gav alle tre gange »Øvelse 3 af 6«. Punkt 2 blev sprunget over, og der er ingen vej tilbage.
  - Ingen data går tabt.
- **Rettelse:**
  1. Giv Open & Strong passets spærre: `settling` i en `useLayoutEffect` på `index`, og klassen `settling` på `.session`. Reglen `.session.settling button` findes allerede i `src/ui/app.css:1066`.
  2. Lav en Playwright-test med et dobbelttryk på »Videre«.

#### N2 (lav): Figuren i pausen kan miste op til halvdelen af sig selv under bundblokken

- **Hvor:**
  - `src/ui/session/NowNext.tsx:255–262`: »Gør klar« står før figuren.
  - `src/ui/session/session.css:234–240`: pausens figur er 144 px, stående 160 px.
- **Hvorfor:**
  - **Kilderne:** SPEC 3.2 (Pausen) beskriver »figuren i øvelsens tempo«, og SPEC 5 gør figuren til hovedpersonen. D61 vælger bevidst, at figurens fødder går under, og det var også mit andet forslag.
  - **Målt uden tidsmaskine:** figuren med sin fase ender under bundblokken i 10 af 16 pauser tirsdag og 7 af 17 fredag. De værste:
    - Ved rygsæk-row er det 80 px. Kun overkroppen ses, og stol, ben og gulv er væk (`screenshots/review-p4-opf-pause-rygsaek.png`).
    - Ved »Læg · Etbens tåløft på et trappetrin« er det 65 px, netop trinnet og hælen, som øvelsen handler om (`review-p4-opf-pause-laeg.png`).
  - **Samme valg i »Nu«:** en stående figur er 152 px (før P4: 190), også uden tidsmaskine, hvor der er plads.
- **Rettelse:**
  1. Lad figuren i pausen tage den højde, der er tilbage over bundblokken. Den skal være det, der krymper i `.rest`, med en mindste højde på ca. 96 px, så hele figuren ses, bare mindre.
  2. Mål figurens bund i `fit.spec.ts`'s pausetjek.

#### N3 (lav): Det nye »efter«-billede af velkomsten er hvidt

- **Hvor:**
  - `screenshots/nat3-efter/onboarding.png` og `screenshots/onboarding.png` er 3 kB i d5e9ad7.
  - De tages af `e2e/tabs.spec.ts:9` lige efter `openApp`, før appen har tegnet noget.
- **Hvorfor:** P4 og NAT-3's slutrapport skal have før- og efterbilleder af de vigtigste skærme. Velkomstens »efter« er nu en tom hvid skærm.
- **Rettelse:** vent på `getByTestId('onboarding')` før skærmbilledet, og tag `nat3-efter/onboarding.png` igen.

#### N4 (lav): SPEC 5 siger stadig, at delens tal står under en navy streg over introkortet

- **Hvor:** `docs/SPEC.md:268` (Plakatstil).
- **Hvorfor:** D61 og SPEC 3.2 (En ny del) har flyttet tallet ind i urets linje, så SPEC 5 modsiger nu SPEC 3.2.
- **Rettelse:** Skriv i SPEC 5, at delens store røde nummer og navn står i urets linje over introkortet, hvor en ny del begynder. På EMOM'ens kort står de i overlinjen.
