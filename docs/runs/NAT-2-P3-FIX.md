P3-rettelser. Grundlaget er to ting: reviewet i `docs/reviews/nat2-p3-figurer.md` (1 høj, 3 middel og 4 lave fund) og det, figuragenterne har lært af at tegne alle 129 figurer. Figurerne er nu committet i `content/figures/`. Du retter motoren, tjekket og formatet, så figurerne kan tegnes rigtigt. Figuragenterne retter selv dataene bagefter.

Siden sidst:
- P6 har committet passet med »Nu og næste«.
- `src/figure/sync.ts` lader figuren følge passets ur.
- Alle forklaringer og figurer ligger i `content/`.

Læs CLAUDE.md igen.

**Reviewets høje og mellemsvære fund**

- **H1, interpolationen.** Hoften flyttes i en lige linje mellem positionerne (`src/figure/motion.ts`, `lerpPose`). Agenterne har set følgerne mange steder:
  - knæet knækker midt i push-ups og planker;
  - knæene bøjer 70–72° i dragon flag og V-ups;
  - albuer folder, og skuldre synker;
  - knæ og albuer går gennem gulv eller seng (burpee 12, nordic 2,6, nakke N5 7–9);
  - låret krymper (20,7 af 24 i groin.2);
  - frie arme glider ind mod maven eller bliver kortere (dead bug).

  Interpolér leddenes vinkler med forlæns kinematik ud fra det punkt, der står fast: fod, tå, hånd, knæ, hofte eller skulder. Så holder segmenterne længden, og strakte led bliver strakte. Når hælen løftes, drejer foden om tåen.

  Tests: For alle figurer bøjer intet led mere end i nabopositionerne, intet går gennem en flade midt i en fase, og segmenterne holder længden.
- **M1:** Tjekket skal fange forkert `facing`, også uden `tip`. Det skal også fange forkert bøjningsretning mellem positionerne og rekvisitter, der ligger i gulvet.
- **M2:** Lav en regel og et tjek for strakte led. Agenterne har nu tegnet dem på fuld længde, 0,02–0,05 over, og det skal tjekket acceptere.
- **M3:** README skal forklare `facing` og pilen, give eksempler, beskrive reglen for strakte led og sige, hvad tjekket ikke ser.

**Reviewets lave fund**

- L1: Stillbillederne bliver for smalle med 4–6 positioner.
- L2: Der mangler tests for pausen i baggrunden, loftet på 30 billeder i sekundet og opslaget ved `like` og »Potensér«.
- L3: Kontaktbeskeden viser den forkerte fod.
- L4: D48 siger, at CSS-filen ligger for sig, men den ligger i kortets JavaScript.

**Grænser, som har tvunget figuragenterne til dårligere figurer**

1. **Kontaktreglerne `side`, `back` og `belly`** kræver, at skulderen højst er 8 over gulvet. Derfor:
   - hviler sideplanke og lyske ikke på albuen: S1, S3, S4, groin.2, groin.4 og `measures.side_plank`;
   - kan hollow hold og sit-up ikke løfte skuldrene: core_front.2, core_situp.1 og `measures.hollow`;
   - ligger bunden i core_front.3 og .4 forkert;
   - har os.1 en ekstra håndklædehale.

   Reglerne skal betyde det, de siger: den kropsdel, kontakten nævner, rører fladen, og resten må løftes.
2. **En rekvisit på ryggen** (`attach: "back"`) tegnes opret under maven. Det rammer flasken i core_rot.R2–R4.
3. **Skridt og hop:** Flytter en fod eller hånd sig mellem to positioner, kalder tjekket det glidning. Derfor kan disse ikke tegnes:
   - burpees, hvor fødderne hopper tilbage, så figurerne har ingen fødder;
   - spiderman i opvarmningen;
   - hænderne, der går ind mod væggen i shoulder.3;
   - bounds, der skal flytte figuren frem (power_legs.6).

   Giv formatet en måde at sige, at et lem løftes i en fase. Så tillader tjekket flytningen, og figuren løfter lemmet undervejs. Lad også en gentagelse (`repeat`) kunne flytte figuren frem.
4. **Albuens retning i omvendte stillinger** bliver forkert, fordi tjekket tvinger den. Det gælder håndstanden med `facing` −1 i shoulder.4–7.
5. **Kroppens form:**
   - Ryggen er en ret linje, så kat og ko, rund øvre ryg og drejning kun kan antydes.
   - Hagen kan ikke ses på et rundt hoved (nakkens tuck).

   Lav en enkel krumning af ryggen og en antydning af ansigtets retning, hvis det er billigt. Ellers skriv det som forslag.
6. **Kontaktarket:** cellerne overlapper ved brede figurer.

**Bagefter**

- Kør `node scripts/check-explain.ts` på alle filer.
- Skriv i dit resumé præcist hvilke figurer (fil og punkt) der nu fejler eller kan tegnes bedre med de nye muligheder, så figuragenterne kan rette dem.
- Ret ikke selv i `content/figures/`, bortset fra mekaniske migrationer, hvis formatet ændres. Nævn dem i så fald.
- Ret SPEC 9.1, D48 og `tools/pictos/README.md`.
- Playwright: `figure.spec` og en test af, at en push-up ikke knækker midt i en fase.
- Opstarten må ikke blive langsommere, og startfilerne skal være uændrede.

Commit ikke `docs/runs/NAT-2-TASKS.md`, `docs/runs/NAT-2-LOG.md` eller noget i `docs/reviews/`. Afslut commit-beskederne med de samme to linjer, og push ikke. Svar med højst 300 ord.
