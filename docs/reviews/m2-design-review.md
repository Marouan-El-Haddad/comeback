# Designgennemgang af skærmbilleder (milepæl 2)

2026-11-05

Metode: de elleve skærmbilleder i `screenshots/` (414 × 847 CSS-px, én billedpixel = én CSS-pixel; `probe.png` er sprunget over) er gennemgået mod SPEC 3, 5 og 6; positioner er målt på billederne, kontraster beregnet efter WCAG ud fra `src/ui/design-tokens.json`, og `theme.css`, `app.css` og komponenterne er læst, hvor billedet ikke var entydigt – skærme uden billede (opvarmning, spørgsmål 3, gul tilstand, hold- og EMOM-ur) er kun vurderet i koden, og det står i fundet.

## Fund

1. **D1 (høj)** – Knapper skifter under fingeren, så et klodset dobbelttryk kan logge et sæt, der ikke er lavet, eller starte et rødt pas.
   - Skærmbillede: `pas-skridt.png`, `pausetimer.png`; `trafiklys.png` for layoutet af »Spørgsmål 3« (kode).
   - Fejl: »Som planlagt (3 reps)« fylder y = 511–574 px i fuld bredde. Et tryk logger sættet, og pauseskærmen kommer med »Spring pausen over« på y = 514–569 – samme sted. Næste sæt af samme øvelse har igen »Som planlagt« på 511–574. Et dobbelttryk på »Som planlagt« springer altså pausen over, og et dobbelttryk på »Spring pausen over« logger næste sæt som planlagt, uden at det er lavet. Ved sæt pr. side kommer højre side direkte efter venstre uden pause (`steps.ts`), med »Som planlagt« samme sted. Før passet: »Videre« på sidste opvarmningstrin står i `.session-actions` på y ≈ 775–830, og på »Spørgsmål 3« står »Rød: syg, feber …« præcis dér (som i `trafiklys.png`: 775–830). Den knap skriver straks `session_started` med rødt (`begin(true)`), også når nedtællingen selv skifter skærm i det øjeblik, man trykker på »Videre«.
   - Regel: SPEC 6: »knapper tåler et »klodset« tryk (ingen hurtigt skiftende knapper på samme sted; »Som planlagt« ligger altid samme sted)«.
   - Rettelse: (1) Ingen knap på pauseskærmen må ligge inden for »Som planlagt«s flade; med D2's faste plads kan »Spring pausen over« blive under »Næste«-kortet i `.rest` (Runner.tsx, `case 'rest'`). Tilføj en Playwright-kontrol, der sammenligner `boundingBox()` for de to knapper. (2) Kort trykspærre, som også dækker venstre → højre side, hvor SPEC 6 kræver samme plads: når `run.stepIndex`, `run.preIndex` eller `run.phase` skifter, får `.session` klassen `settling` i 500 ms med `.session.settling button { pointer-events: none; }`. (3) Flyt »Videre« i opvarmningen fra `.session-actions` op i `.session-body` under nedtællingen.

2. **D2 (høj)** – »Som planlagt« står midt på skærmen og flytter sig med indholdet.
   - Skærmbillede: `pas-skridt.png`.
   - Fejl: Knappen ligger i `SetStep`s `.stack` inde i `.session-body`, ikke i `.session-actions` (`actions` er `null` for sæt-trin i Runner.tsx). På billedet står den på y = 511–574 med ca. 175 px tom flade under »Trinnets interval«. Dens plads afhænger af navnets længde, antal cue-linjer, »Rygsæk: … kg«, smertevalgene og af, om »▸ Hvorfor« er foldet ud (`<details>` står over knappen). Samme mønster: »Ja«/»Nej« i `Question` (power- og klubspørgsmål står øverst), »Gem« i `EmomQuestions`, »Gem målingen« i `MeasureInput`, »Start EMOM«, »Start uret« og »Stoppede før tid«.
   - Regel: SPEC 5, Layout: »primær handling altid i bunden (tommelfinger) med 64 px højde«; SPEC 6: »»Som planlagt« ligger altid samme sted« og »alt vigtigt i nederste halvdel«.
   - Rettelse: Lad `SetStep` (og de nævnte trin) levere deres knapper til en `.session-actions`-blok, som `Runner` gengiver efter `.session-body`, sådan som trafiklys og opsummering allerede gør. Behold skitsens rækkefølge fra SPEC 3.2 (»Som planlagt«, −/værdi/+/Smerte, Reserve), og giv den nederste række fast 56 px på alle sæt-trin (på power-trin kan den bære »Trinnets interval …«), så »Som planlagt« altid står på y ≈ 639–702. Smertevalgene åbnes i `.session-body`, så intet i bundblokken flytter sig. Skal knappen helt ned (y ≈ 767–830 som »Færdig«), skal skitsen i SPEC 3.2 rettes først.

3. **D3 (høj)** – Timertallet er 72 px, og »Næste«-kortet er tynd tekst.
   - Skærmbillede: `pausetimer.png`.
   - Fejl: »0:45« bruger `.countdown-number` med 72 px (målt 136 px bredt og 47 px versalhøjde; tallet i `pas-skridt.png` har 64 px versalhøjde ved 96 px). Samme klasse bruges til hold-uret (planke, wall sit – telefonen ligger på gulvet), EMOM-uret, motor-faserne, opvarmningen og stopuret. »Næste« og »Sæt 2 af 3 · mål 3 reps« står i vægt 400.
   - Regel: SPEC 6: »Telefonen på gulvet ca. 1 meter væk: tal på 96 px« (72 px ligger inden for SPEC 5's 64–96 px, men er ikke 96); SPEC 6, Sollys: »ingen tynde skrifter under 600 i vægt til vigtig tekst«; SPEC 3.2: »Næste sæt vises under timeren, så man kan læse, mens man hviler«.
   - Rettelse: `app.css`: `.countdown-number { font-size: 96px; }` og `.countdown.big { width: 320px; height: 320px; }` – ringens indre diameter er i dag 224 px, og »10:00« og »35:00« fra motor-faserne bliver ca. 240 px brede ved 96 px. `.next-up p { font-weight: 600; }`.

4. **D4 (middel)** – Den gule trafiklysknap har kontrast 6,76:1.
   - Skærmbillede: `trafiklys.png` (gul tilstand, når et svar står på »Nej«; ikke på billedet, set i koden).
   - Fejl: `.btn.primary.yellow` har `--c-ink` (#26242F) på `--c-amber` (#E3A008): 6,76:1. Knappen viser »GUL – start opvarmningen«, »GUL – minimumsdosis« og »GUL – rolig base 30 min«.
   - Regel: SPEC 6: »kontrast mindst 7:1 for al tekst i pas«.
   - Rettelse: `app.css`: `.btn.primary.yellow { color: var(--c-navyDark); }` giver 7,06:1 (det eneste token over 7:1 på amber). Med mere margin: `background: var(--c-goldTint); border-color: var(--c-amber); color: var(--c-ink);` (13,84:1).

5. **D5 (middel)** – Trykflader på 48 px.
   - Skærmbillede: `pas-skridt.png`, `pausetimer.png`, `trafiklys.png`.
   - Fejl: »Pause« og »Afslut« i pas-headeren er `.btn.small` med `min-height: 48px` (målt y = 8–55). »▸ Hvorfor« har `.why summary { min-height: 48px; }`. `.btn.small` bruges også i Open & Strong-headeren og i alle bannere (»+1 dag« og »Afslut« i simuleringen, »Backup« ved lagerfejl, »OK«, »Opdatér«).
   - Regel: SPEC 5, Layout: »øvrige trykflader mindst 56 × 56 px og 8 px afstand«.
   - Rettelse: `app.css`: `.btn.small { min-height: 56px; min-width: 56px; }` og `.why summary { min-height: 56px; }`. Pas-headeren bliver 72 px høj.

6. **D6 (middel)** – Tekst på 16 px i passet.
   - Skærmbillede: `pas-skridt.png` (»POWER BEN · TRIN 1«, »Trinnets interval: 3–5 reps«, »Pause«, »Afslut«), `pausetimer.png` (»PAUSE«), `trafiklys.png` (»Rød: syg, feber …«, »Afslut«), `opsummering.png` (»TIRSDAG 17. NOVEMBER«).
   - Fejl: `.step-kicker`, `.small-print`, `.btn.small` og `.btn.red-outline` er 16 px, også inde i `.session`.
   - Regel: SPEC 5, Typografi: »Bai Jamjuree 400/600 til tekst (18 px minimum i pas, 16 px ellers)«.
   - Rettelse: `app.css`: `.session .step-kicker, .session .small-print, .session .btn.small, .session .btn.red-outline { font-size: 18px; }`. Rød-knappens to linjer fylder da 47 px og kan stadig være i 56 px.

7. **D7 (middel)** – »Skru op for medielyden« mangler ved første pas-start.
   - Skærmbillede: `trafiklys.png` (første »Start passet« efter onboarding).
   - Fejl: Skærmen har ingen opfordring om lyden, og teksten findes ingen steder i `src/`. Lyden er det eneste signal i pauser og hold, da der ikke er vibration (D21).
   - Regel: SPEC 5, Lyd: »Appen beder ved pas-start: »Skru op for medielyden« første gang«.
   - Rettelse: Runner.tsx, `run.phase === 'light'`: vis `<p class="hint">Skru op for medielyden</p>` øverst første gang, og husk, at den er vist, med `readLocal`/`writeLocal` som for `RUN_KEY`.

8. **D8 (middel)** – Rød-knappen ligger nederst, under primærknappen.
   - Skærmbillede: `trafiklys.png`.
   - Fejl: »Start opvarmningen« står på y = 703–766 og »Rød: syg, feber, skarp smerte eller under 4 timers søvn« nederst på 775–830, hvor tommelfingeren rammer først. Et tryk starter straks et rødt pas uden bekræftelse, og hændelsen kan ikke slettes. Samme rækkefølge på »Spørgsmål 3«.
   - Regel: SPEC 5, Layout: »primær handling altid i bunden«; SPEC 6: »knapper tåler et »klodset« tryk«. Skitsen i SPEC 3.3 har samme rækkefølge som skærmen.
   - Rettelse: Ret skitsen i SPEC 3.3, og byt derefter de to knapper i begge `.session-actions` i trafiklys-delen af Runner.tsx, så primærknappen står nederst (y ≈ 767–830 som »Færdig« og »Kom i gang«) og »Rød: …« over den. Trykspærren fra D1 dækker skiftet fra »Videre« til »Spørgsmål 3«.

9. **D9 (middel)** – Backup: »Eksportér backup« står i øverste halvdel, og advarslen om lageret er tynd grå tekst.
   - Skærmbillede: `backup.png`.
   - Fejl: Primærknappen står på y = 231–294 og »Importér backup« under den; fra y = 367 ned til fanelinjen er skærmen tom. »Varigt lager: nej – browseren kan slette data ved pladsmangel« er `.muted` (#6B6878, vægt 400, 16 px), så skærmens vigtigste advarsel om datatab er dens svageste tekst.
   - Regel: SPEC 5, Layout: »primær handling altid i bunden (tommelfinger)«; SPEC 6: »Én hånd: alt vigtigt i nederste halvdel« og »ingen tynde skrifter under 600 i vægt til vigtig tekst«.
   - Rettelse: `Backup` i More.tsx: læg »Importér backup« og »Eksportér backup« (primær nederst) i en blok med `margin-top: auto`, og giv `.screen.backup { display: flex; flex-direction: column; min-height: calc(100vh - 72px); }`. Når `persisted === false`, vis linjen som `<p class="flag">` (ink i vægt 600 på goldTint, 13,84:1) i stedet for `.muted`.

10. **D10 (middel)** – Stiger: afstanden til næste trin står ikke som tekst, og linjen er rækkens svageste tekst.
    - Skærmbillede: `stiger.png`.
    - Fejl: Rækkerne viser »Arbejdstal 6 af 12« og »Arbejdstal 45 sek af 90 sek«, ikke hvad der skal til for at rykke op; sætningen »… pas mere med alle sæt på 12 og 2 i reserve« kommer først, når arbejdstallet er nået. Linjen er `.muted` i vægt 400.
    - Regel: SPEC 3.5: »afstanden til næste trin som tekst: »1 pas mere med 3 × 12 og 2 i reserve««; SPEC 6, Sollys: »ingen tynde skrifter under 600 i vægt til vigtig tekst«.
    - Rettelse: `distanceText` i Ladders.tsx, grenen `t.target < range.max`: tilføj kravet, fx »Arbejdstal 6 af 12 · derefter 2 pas med alle sæt på 12 og 2 i reserve« (samme ordlyd som grenen ved max). Erstat `class="muted"` på linjen med en egen klasse, fx `.ladder-distance { font-weight: 600; color: var(--c-ink); }`.

11. **D11 (lav)** – I dag: »START PASSET« står kun i nederste halvdel, når kortet har mange linjer.
    - Skærmbillede: `i-dag.png`.
    - Fejl: Knappen følger efter bloklinjerne i hovedkortet. Med Styrke A's 11 linjer står den på y = 424–487 (skærmens midte er 423,5), og der er ca. 80 px tom flade over fanelinjen. På en Motor-dag har kortet én linje (`motor.title`), og knappen lander på ca. y = 176–240 (beregnet ud fra samme CSS).
    - Regel: SPEC 5, Layout: »primær handling altid i bunden (tommelfinger)«; SPEC 6: »Én hånd: alt vigtigt i nederste halvdel«.
    - Rettelse: Behold knappen i kortet (SPEC 3.1), men skub indholdet under datoen ned mod fanelinjen, når der er plads: `.screen.today { display: flex; flex-direction: column; min-height: calc(100vh - 72px); }` og `.today-head { margin-bottom: auto; }`. På en Motor-dag står knappen så omkring y = 462–526.

12. **D12 (lav)** – Uge: grå tekst på grå flade.
    - Skærmbillede: `uge.png`.
    - Fejl: »Styrke«, »Power«, »Motor (tor)« og »Burpees (tir)« er `--c-muted` i vægt 400 på `--c-panel` (`<dl class="week-facts card panel">`): 4,86:1.
    - Regel: SPEC 5, Mønstre der skal undgås: »grå-på-grå«.
    - Rettelse: Week.tsx: fjern `panel` fra `dl` (hvid baggrund som Diagnose-listen, 5,42:1), eller behold panelet og sæt `.week-facts dt { color: var(--c-ink); }` (13,70:1).

13. **D13 (lav)** – Uge: to varigheder for samme motor-pas.
    - Skærmbillede: `uge.png`.
    - Fejl: Faktaboksen siger »Motor (tor): Rolig base, 35 min«, chippen torsdag »Motor · 45 min«. Chippen viser skabelonens maksimum (`durationMin: [30, 45]` i `program/sessions/motor.json`), mens ugens base-pas kun har én fase på 35 min (`motorSession` i `plan.ts`). I dag-kortet viser det samme torsdag: »ca. 45 min« over »Rolig base, 35 min«.
    - Regel: Ensartet ordlyd og tal på samme skærm.
    - Rettelse: Vis motor-passets varighed ud fra ugens indhold (summen af `motor.phases`), fx »Motor · 35 min«, både i chippen (Week.tsx) og i I dag-kortet (Today.tsx). Flyttes beregningen ind i `plan.ts`, skal der først en motortest til.

14. **D14 (lav)** – Pas-headeren: »Pause« betyder to ting, og tælleren passer ikke med sættene.
    - Skærmbillede: `pas-skridt.png`, `pausetimer.png`.
    - Fejl: På pauseskærmen står knappen »Pause« (fryser passet) og overskriften »PAUSE« (hvilen mellem sæt) samtidig. Headeren viser »Power · 1/4«, mens skærmen siger »Sæt 1 af 3« (power-spørgsmålet tælles med), og i pausen står kun »Power«.
    - Regel: Ensartet ordlyd; SPEC 3 og 3.2 kalder knappen »Hold pause«.
    - Rettelse: `SessionHeader` i Runner.tsx: knapteksten »Hold pause« (»Fortsæt«, når passet står stille). Tælleren: tæl kun `type === 'set'` i `groupSteps`, og vis i pausen positionen for næste sæt.

15. **D15 (lav)** – Opsummeringen: interne koder, »motor« i to betydninger, og planen mangler.
    - Skærmbillede: `opsummering.png`.
    - Fejl: (a) Sider står som »8L, 8R, 8L, 8R …« – de interne koder `L`/`R` – mens passet skriver »Venstre side«/»Højre ben« og I dag »pr. side«/»pr. ben«. (b) »Motorens beslutninger« (og »Tryk for at se, hvad motoren beslutter« på sidste skridt) bruger »motor« om appens regler, mens »Motor« alle andre steder er torsdagspasset (`uge.png`). (c) »Burpees trin E1« her, »Burpees EMOM E1« på I dag. (d) »Logget« viser ikke planen ved siden af.
    - Regel: Ensartet ordlyd (SPEC 8: UI-tekst på dansk); SPEC 4.2: »Opsummeringen viser: logget vs. planlagt …«.
    - Rettelse: Summary.tsx: skriv sider som »venstre 8, 8, 8 · højre 8, 8, 8«; omdøb overskriften, fx »Næste gang«, og teksten i Runner.tsx (`case 'finish'`) tilsvarende; skriv burpee-blokken som på I dag (»Burpees EMOM E1«); tilføj planen, fx »Pres trin 1: 6, 6, 6 (plan 3 × 6)«.

16. **D16 (lav)** – Blandet skrivemåde og engelske ord.
    - Skærmbillede: `i-dag.png`, `uge.png`, `diagnose.png`.
    - Fejl: »START PASSET« står i versaler; alle andre primærknapper har almindelige bogstaver (»Start opvarmningen«, »Som planlagt (3 reps)«, »Færdig«, »Kom i gang«, »Eksportér backup«). Datoen står »Tirsdag 17. november« på I dag, men »mandag 16. november« på Uge. Diagnose viser »Lyd: off« og »Wake Lock: API findes · nu: off« (værdierne kan også være `running`, `suspended`, `blocked`, `unsupported`, `lock`, `video` og `failed`), og »Service worker: ingen · klar til offline« lyder selvmodsigende.
    - Regel: Ensartet ordlyd; SPEC 8: »UI-tekst på dansk«; SPEC 4.13 skriver »Start passet«.
    - Rettelse: Today.tsx: »Start passet«. Week.tsx: `capitalize(formatLong(d.date))` som på I dag. `Diagnose` i More.tsx: oversæt tilstandene (fx off → fra, running → kører, suspended → sat på pause, blocked → blokeret, lock → låst, video → video-fallback, failed → fejlet), og skriv »ikke aktiv endnu · klar til offline«, når siden ikke styres af en service worker.

17. **D17 (lav)** – To kort har 2 px navy kant.
    - Skærmbillede: `i-dag.png`, `uge.png`.
    - Fejl: Hovedkortet (`.main-card`: 2 px `--c-navy`) og dagens række på Uge (`.week-day.today`: 2 px `--c-navy`) afviger fra de øvrige kort (1 px `--c-line`).
    - Regel: SPEC 5, Layout: »Kort med 12 px hjørner, 1 px navy/10 % kant«.
    - Rettelse: Brug 1 px `--c-line` på begge, eller – hvis den kraftige ramme skal blive som markering af »i dag« i sollys – skriv undtagelsen ind i SPEC 5 først.

## Uden fund

- Farver: kun `--c-*`-tokens (ingen hex-, rgb- eller gradientværdier i `theme.css`, `app.css` eller komponenterne); ren hvid baggrund (`--c-paper`) på alle skærme; ingen creme-flader.
- Forbudte mønstre: ingen kursiv, ingen nummererede »01/02«-labels (trinnumre som »1. Push-up med tempo« på `program.png` har funktion), ingen monospace, ingen pilleknapper (12 px hjørner; badges og chips 8 px), ingen gradienter, glas eller skygger (fanens røde 3 px-streg er en indikator), ingen dekorative ikoner, konfetti eller streak-flammer (»Denne uge: 0 af 7« er SPEC 4.4's formulering), ingen skeleton-loadere, karruseller, `:hover`-afhængigheder eller emojis (✓, ◐, ▸ og ▾ er tekstsymboler med funktion), ingen modale dialoger til logning (smertevalg og »Afslut passet?« vises i linjen), ingen placeholder i stedet for labels (alle felter har en synlig label).
- Tekst uden for passet: intet under 16 px (faner 17 px, chips og niveau-badges 16 px); alle knapper har tekst (−/+ har desuden `aria-label`).
- `pas-skridt.png`: tallet er 96 px (64 px versalhøjde målt), cues 19 px i vægt 600 og ink (15,26:1), piktogram 120 × 120 px, −/+/Smerte 56 px med mindst 8 px afstand, primærknappen 64 px med hvid på rød (7,55:1); grå tekst i passet er sat til ink (`.session .muted` m.fl.).
- `trafiklys.png`: Ja/Nej 56 px med 8 px afstand, valgt svar som navy flade (13,62:1), alle svar står på »Ja«, spørgsmål 3 kommer efter opvarmningen, rød-knappens tekst er som i SPEC 3.3, og begge knapper står i bundblokken.
- `opsummering.png` og `onboarding.png`: primærknappen er 64 px og står nederst (y = 767–830); opsummeringens tekst er 18 px.
- `i-dag.png`: indholdet svarer til SPEC 3.1 (dato, uge og fase, én linje pr. blok med trin og dosis, Open & Strong med »Start« på 56 × 79 px, i morgen, »Resten af ugen« foldet sammen på 56 px); backup-linjen er rigtigt skjult, da der ikke er logget pas endnu.
- `uge.png`: fakta øverst (programuge, fase, sæt og reserve, power, motor, EMOM-loft) og syv rækker som SPEC 3.4, kun visning i M2. Fanelinjen dækker søndagsrækken, fordi billedet er taget med `fullPage`; i appen kan rækken rulles frem over fanelinjen (72 px bundmargen).
- `stiger.png`: rækkerne er 88 px høje knapper med piktogram, trin og niveau-badge (navy tekst på hvid, farven kun i rammen).
- `program.png` og `diagnose.png`: knapper på 56 px med 8 px afstand; størrelser og kontrast i orden (Diagnose har kun ordvalget i D16).
- Fanelinjen: fire faner på 64 px nederst, aktiv fane med navy tekst og rød streg; inaktive faner i `--c-muted` og vægt 600 (5,42:1, uden for passet).

## Opfølgning (rettet samme aften)

Rettet efter ændringsprotokollen: `docs/SPEC.md` 3.3 først (D8: primærknappen nederst, og den faste bundblok med trykspærre i et pas), derefter koden og nye skærmbilleder.

| Fund | Rettelse |
| --- | --- |
| D1 | Trykspærre på et halvt sekund efter hvert skift af skærm i et pas (`.session.settling`). »Spring pausen over« står nederst i bundblokken, ikke hvor »Som planlagt« står; »Videre« i opvarmningen står i indholdet under uret |
| D2 | Sætskærmens handlinger (»Som planlagt«, −/værdi/+/Smerte, Reserve) står i en fast bundblok med samme højde på alle sæt; det samme gælder Ja/Nej, »Gem«, »Gem målingen«, »Start EMOM«, »Start uret« og »Stoppede før tid«. Smertevalgene åbnes i indholdet |
| D3 | Timertallet er 96 px i en ring på 300–320 px; »Næste«-kortet står i vægt 600 |
| D4 | Den gule knap har `--c-navyDark` på amber (7,06:1) |
| D5 | `.btn.small` og »Hvorfor« er 56 px høje |
| D6 | Overlinjer, »Trinnets interval«, header-knapper og rød-knappen er 18 px i et pas |
| D7 | »Skru op for medielyden« vises ved første pas-start |
| D8 | Rød-knappen står over primærknappen på trafiklyset og ved spørgsmål 3 (SPEC 3.3 rettet først) |
| D9 | Backup: »Importér« og »Eksportér« (primær) står nederst; »Varigt lager: nej« er en markeret advarsel |
| D10 | Stiger viser også kravet til oprykning, mens arbejdstallet stiger, i vægt 600 |
| D11 | I dag: kortene står nederst, nær tommelfingeren |
| D12 | Uge: etiketterne i faktaboksen er ink |
| D13 | Motorens varighed regnes ud fra ugens faser på I dag og Uge |
| D14 | Knappen hedder »Hold pause«; tælleren viser »sæt n/m« og i pausen næste sæt |
| D15 | Opsummeringen: »venstre … · højre …«, overskriften »Næste gang«, »Burpees EMOM E1« og planen ved siden af det loggede |
| D16 | »Start passet«; datoer med stort begyndelsesbogstav på Uge; Diagnose på dansk og »ikke aktiv endnu« for service workeren |
| D17 | Kortene har 1 px linje; dagens række på Uge er markeret med panelfarve og »· i dag« |
| Uden for listen | En deaktiveret primærknap ser deaktiveret ud. »Tryk for at slå lyd til« og »Skærmen kan slukke« (SPEC 4.13) vises i passet. Historik-listen (M2) er tilføjet under Mere |
