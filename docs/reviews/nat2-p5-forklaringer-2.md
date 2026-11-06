# Review af NAT-2 P5 – Forklaringer, del 2

2026-11-06 · indhold: 05263df (75 nye punkter i `content/explain/`) · trænernes tolkninger: P53–P60 (4a828d6) · worktree på 4a828d6

Metode: De 75 nye punkter er læst felt for felt: press, pull, shoulder og legs trin 3–7, posterior 3–6, groin 3–5, core_front 3–7, core_side S3–S5, core_rot R3–R4, core_situp 3–7, wallsit W3–W5, power_legs 3–6, power_upper 3–5, burpee_emom E3–E9, club_sequence C3–C6 og alle 12 målinger i `measures.json`. Kilderne er:

- `docs/PROGRAM_KILDE.md` (sporenes tabeller, »Tempo i styrkesæt«, »Målinger«, »Målbrættet«);
- `program/tracks/*.json` og `program/measures.json`;
- ENGINE 5.4, 5.6 og 6.2, SPEC 3.2, 3.8, 4.8, 8 og 9.1;
- DECISIONS P47, P51 og P53–P60.

Kortenes påstande om passet og motoren er tjekket i koden (`src/ui/session/Runner.tsx`, `steps.ts`, `MeasureInput.tsx`, `src/engine/derive.ts`, `plan.ts`). Jeg har taget skærmbilleder af alle 129 kort og gennemgået de 75 nye. To scratch-flows i `pixel9a` viser passets skærme ved sideplanke-målingen og ved skater-hop.

## Resultat

0 høje, 2 middel og 8 lave.

- **Indholdet er godt.** Udgangsstillinger, nummererede trin og typiske fejl er konkrete. En, der aldrig har set øvelsen, kan lave næsten alle trin ud fra kortet. Undtagelserne er kick-up til håndstand (F9) og ni kort, der ikke siger, hvad »Venstre ben« eller »Venstre side« er (F3).
- **Navne, doser og regler er uændrede.** `program/` og `src/` er ikke rørt. Kortene opfinder intet tempo: hvor programmet intet tal har, bruges programmets generelle tempo, »langsomt« eller ingen tid. Alle labels med »N sek« har fasens længde.
- **Ingen henvisninger** til PDF, sider, kilder eller undersøgelser. Kortene bruger du-form og »gentagelser«, ikke »reps«. De lover ingen knap, appen ikke har, bortset fra F2.
- **Sikkerheden ved de svære trin er god:**
  - Dragon flag: vægten på skulderbladene og »Pres ikke hovedet ned i gulvet«. Kan du ikke bremse, så bøj knæene. Sofaen prøves først.
  - Nordic: sofaen tjekkes, eller en sidder i den, puden ligger under knæene, og du tager fra i god tid.
  - Etbens øvelser: stolen står mod væggen, armene er fremme, og den frie fod sættes ned, før du mister styringen.
  - Plyometri: plads, sko eller bare fødder, bløde landinger, stop ved fartfald og aldrig landing på fingrene.
  - HSPU: hovedet lander blødt, puden kan gøres tykkere, og du drejer ud til siden.
- **To middel fund:**
  - `press.5` beskriver en oprykning, motoren ikke følger (F1).
  - Sideplanke og balance skal tage to tider, men målingens skridt har kun ét ur (F2).
- **P54 virker.** Skater-hop og split jumps logges rigtigt med to tryk. Men forklaringen står kun i kortets trin 4, ikke i det, man ser under sættet (F4).

## Trænernes valg (P53–P60)

- **P53, `press.5`: nej**, se F1. **P53, `pull.5`–`pull.7` med hælene i gulvet: godt.** Det er samme opstilling som i trin 3 og den letteste.
- **P54, pr. side: godt, hvor kortet siger det.** Press, pull, core_side, core_rot, W4, W5, power ben trin 3, 4 og 6 siger præcist, hvad du gør i »Venstre side«, og passer med passets labels. Legs, posterior.3 og groin gør det ikke (F3). Skiftevise hop med to tryk er korrekt logning, se F4.
- **P55, tempo uden eget tal:** Intet kort opfinder et tempo.
  - Dragon flag med kun »3 sek ned« og hollow rocks uden tid i teksten er forsvarligt.
  - Men P55's ordlyd (»det generelle tempo«) passer ikke til fire af de otte trin, den nævner (F8).
- **P56: godt.** Lave split jumps, »kontrolleret ned« i plyo-trinene og C5 på pege- og langfingerens knoer er gode valg. P56 beskriver dog bounds anderledes end kortet (F8).
- **P57: godt.** `legs.3` er to bevægelser uden løfte om rygsækkens vægt, og der er puder på stolen i `legs.4`. W4 og W5's »venstre« er standbenet, og W3's squats laves frit. Det passer med passets labels (»Ét ben, venstre – garde og slag«, »Videre« efter de 20 squats, »Rene runder?«).
- **P58: godt.** S5 og R4 laves på albuen. Dragon flag bruger sofaen, og negativerne ruller op med bøjede knæ. »Halvvejs« er ca. 45°. Det er forsvarligt at udelade walkouts, men se »Uden for pakken« om tæppe.
- **P59:** Den korteste tid og strakte ben i hollow er den forsigtige læsning, men appen kan ikke tage to tider (F2). Cooper med »Spring målingen over« passer med appen, se »Uden for pakken«.
- **P60** gælder rutinerne fra del 1 og er ikke reviewet her.

## Fund

1. **F1 (middel)**: `press.5` »Sværere« lover en trappe ned i højde, som motoren ikke kender.
   - Hvor: `content/explain/press.json:284` (press.5, `harder`) og `docs/DECISIONS.md:142` (P53).
   - Hvorfor:
     - Motoren: ENGINE 5.4 R-DP-TARGET og R-DP-STEPUP (`docs/ENGINE.md:141` og `:143`) og 6.2 (`:270`); koden i `src/engine/derive.ts:125` og `:137–139`.
     - Programmet: »Sådan rykker du op« (`docs/PROGRAM_KILDE.md:119`, `:131`).
     - Kortet: sænk hånden efter ét pas med 8 pr. side i alle sæt med 2 i reserve, »sofa, stol og til sidst trappetrin. Derefter trin 6«.
     - Motoren kender ikke højden. To hit i træk giver trin 6 på en hvilken som helst højde. Eksempel: 8 på bordet, så sofaen, og 8 igen. Så står der etarms push-up i gulvet i næste pas, og stolen og trappetrinnet springes over.
     - Efter en sænkning står arbejdstallet stadig på 8, for R-DP-TARGET hæver kun. Passet viser derfor »mål 8« og »Som planlagt (8 · reserve 2)« på den sværere højde.
     - Kortet siger ikke, at du skal rette tallet med −. Et tryk af vane logger 8 gentagelser, der ikke blev taget, og kan give et hit.
     - Programmet siger, at et sværere trin starter forfra i bunden af intervallet, og at du aldrig øger to ting på én gang.
   - Rettelse:
     - Ret P53 først: »Motoren kender ikke højden: to pas i træk med 8 pr. side i alle sæt og 2 i reserve giver trin 6, uanset højden.«
     - Ret kortet, fx: »Sænk hånden (sofa, stol, trappetrin), når du har 8 pr. side i alle sæt med 2 i reserve, og ret tallet med −. To pas i træk med 8 giver trin 6.« (142 tegn)

2. **F2 (middel)**: Sideplanke og balance skal måles på begge sider, men målingens skridt har ét ur og ét tal.
   - Hvor: `content/explain/measures.json:526` (measures.side_plank, trin 3) og `:655` (measures.balance, trin 4); `docs/DECISIONS.md:148` (P59); `src/ui/session/MeasureInput.tsx:76–84`. Skærm: `screenshots/review-p5-sideplanke-maaling-1.png` og `-2.png`.
   - Hvorfor: SPEC 4.8 (»sideplanke max pr. side«), SPEC 3.8 (en, der aldrig har set øvelsen, skal kunne følge kortet) og P59.
     - Scratch-flow i `pixel9a`: Styrke B fredag 13/11 (uge 1) frem til målingen. Efter »Start uret« og »Stop« står kun »Sideplanke (sek) 40« og »Gem målingen«. Der er hverken »Start uret« eller »Stop« til den anden side.
     - Kortet siger »Tag derefter højre side, og gem den korteste af de to tider«, men det kan appens ur ikke tage. Uret kommer kun igen, hvis du sletter tallet, og så starter det straks, før du ligger klar.
     - Nogle uger gemmer du derfor venstre side og andre uger et gæt på den korteste. Så kan kurven fra uge 1 til 12 ikke sammenlignes. Det samme gælder balance, hvor øjnene er lukket.
   - Rettelse: Ret SPEC 4.8 og P59 først. Byggeagenten laver så et skridt med to ure ved sideplanke og balance: »Venstre side« (»Venstre ben«), så »Højre …«. Skridtet viser begge tider og gemmer den korteste, og et Playwright-flow tjekker det. Kortet kan så blive, som det er.

3. **F3 (lav)**: Ni kort siger ikke, hvad du gør i »Venstre ben« og »Venstre side«.
   - Hvor: `content/explain/legs.json:144` (legs.3), `:236` (legs.4), `:295` (legs.5), `:363` (legs.6) og `:418` (legs.7); `posterior.json:153` (posterior.3); `groin.json:148` (groin.3), `:210` (groin.4) og `:277` (groin.5). Det samme mangler i del 1 (legs.1–2, posterior.1, groin.1–2).
   - Hvorfor: Trænernes regel efter del 1 (»præcist, hvad man gør i passets to sidesæt«), P47 og P54 (»»Venstre side« er den side, der arbejder«).
     - Passet viser »Sæt 1 af 3 · Venstre ben« og så »Højre ben«. Kortene siger kun »Tag alle gentagelser, og skift så ben/side«.
     - I Copenhagen kan du ikke se, om »Venstre side« betyder, at du ligger på venstre side, eller at venstre ben er på sofaen.
     - Resten af del 2 siger det: press, pull, core_side, core_rot, W4, W5 og power.
   - Rettelse: Én sætning i hvert kort:
     - legs.3: »I »Venstre ben« står venstre fod forrest, i »Højre ben« højre.«
     - legs.4–7: »I »Venstre ben« står du på venstre ben.«
     - posterior.3: »I »Venstre ben« er venstre hæl på håndklædet.«
     - groin.3–5 som sideplanken: »I »Venstre side« ligger du på venstre side.« Skriv valget ved P54.

4. **F4 (lav)**: Ved skiftevise hop står instruktionen kun i kortets trin 4.
   - Hvor: `content/explain/power_legs.json:170`, `:174` og `:192` (power_legs.3: trin 4, cues og `getReady`) og `:240`, `:244` og `:262` (power_legs.4). Skærm: `screenshots/review-p5-skater-venstre.png` og `-hoejre.png`.
   - Hvorfor: P54 og SPEC 3.2 (»Nu« viser mål og 2 cues, og pausen viser »Gør klar«).
     - Logningen er rigtig. Du tager målet på hvert ben og trykker »Som planlagt« for venstre og straks igen for højre. Knappen står samme sted på begge skærme, og spørgsmålet om lige høje hop dækker sættet.
     - Under sættet viser passet »Sæt 1 af 3 · Venstre side · mål 3 reps« og cuen »Spring sidelæns fra ét ben til det andet …«. Hvis du ikke har kortet åbent, kan du tage 3 hop i alt eller 3 hop kun til venstre.
   - Rettelse:
     - Første cue: »Skiftevis: målet på hvert ben« (power_legs.3) og »Skiftevis: målet med hvert ben foran« (power_legs.4).
     - »Gør klar« fx: »Find 3 meter fri plads til siden, og tryk »Som planlagt« to gange efter sættet: venstre, så straks højre.« (105 tegn)

5. **F5 (lav)**: Kortet siger ikke, hvad du gør med resten af træk-sættene, hvis bordet vipper midt i passet.
   - Hvor: `content/explain/pull.json:95`, `:156`, `:217`, `:278`, `:339` og `:400` (pull.3–7, typiske fejl nr. 3).
   - Hvorfor: SPEC 3.2 og ENGINE R-PAIN-SHARP.
     - Passet har ingen knap til at springe en blok over. Der er kun −/+, »Som planlagt« og »Smerte«, og »Stop øvelsen« tæller som skarp smerte og sender sporet et trin ned i 7 dage.
     - »Stop, og vælg trin 1 … under Stiger efter passet« er rigtigt for sikkerheden. Men passet viser stadig »Sæt 2 af 3 · mål 8«.
   - Rettelse: Sig, hvad du gør i passet, fx »Stop, og ret tallet. Tag resten af sættene som rygsæk-row, og vælg trin 1 under Stiger efter passet.« Tilføj, at du ikke skal trykke »Smerte«.

6. **F6 (lav)**: Fire positioner kan ikke tegnes, som de står.
   - Hvor og rettelse:
     - `content/explain/core_front.json:403` (core_front.6, »Ved væggen«): »Kroppen lige fra hæl til hænder og ca. 30° over gulvet«, med hænder og tæer i gulvet. En lige linje mellem to punkter i gulvet ligger i gulvet. Med figurens mål (ankel til skulder 77, arm 31) er skuldrene ca. 38 over gulvet ved 30°, og armene når ikke ned. Ret til: »Kroppen lige fra hæl til skuldre og ca. 15° over gulvet. Armene er strakt frem og skråt ned til håndklædet ved væggen.«
     - `content/explain/burpee_emom.json:229`, `:315`, `:401`, `:487`, `:573`, `:659` og `:745` (E3–E9 »Hænder i gulvet«; det samme i E1–E2): »hoften i knæhøjde«, »overkroppen hælder ca. 45° frem« og hænderne fladt i gulvet med strakte arme. Med hoften i knæhøjde (ca. 22) og 45° er skuldrene ca. 43 over gulvet, men armen er 31. Ret til »hoften lidt under knæhøjde« eller »overkroppen næsten vandret«. `measures.burpee_3min` har ingen vinkler og kan tegnes.
     - `content/explain/wallsit.json:366` og `:376` (W5, `one_left` og `one_right`): positionerne siger, hvilken arm der slår, men ikke hvilket ben du står på. Faserne »Højre ben frem« og »Skift ben« går til samme position, så figuren kan ikke vise skiftet. Ret til fire positioner (venstre eller højre standben × venstre eller højre lige), eller nævn standbenet i teksten.
     - `content/explain/measures.json:743–776` (nordic_depth): »skinnebenene i gulvet« (`shin`), men posterior.4–6 har »vristene i gulvet« (`foot`) i samme stilling. Brug samme kontakter.
   - Hvorfor: SPEC 9.1 (figuren bygges på positionerne i ord og kontakterne; led bøjer den rigtige vej, og kontakterne passer) og kroppens mål i `tools/pictos/poses.py:12`.

7. **F7 (lav)**: Tre målinger mangler det, der gør tallene sammenlignelige.
   - Hvor og rettelse:
     - `content/explain/measures.json:707–710` (nordic_depth): Der er kun knapperne »Kvart vej«, »Halvvejs« og »Helt ned«. Kortet siger ikke, hvad du vælger mellem to niveauer, eller hvis du ikke når kvart vej. Tilføj: »Vælg det højeste, du nåede helt. Nåede du ikke kvart vej, så tryk »Spring målingen over«.«
     - `:106` (pushups, `easier`): Knoer i én uge og flade hænder i en anden giver to forskellige tal. Tilføj »og tag den sådan hver gang«.
     - `:17` (wall_test, trin 3): Lineal eller fingre (»én finger er ca. 2 cm«) giver forskellige tal. Tilføj »Mål på samme måde hver gang.«
   - Hvorfor: SPEC 4.8 (forrige værdi og Målbrættets niveau ved hver måling) og PROGRAM_KILDE »Målbrættet« (»Din egen kurve fra uge 1 til 12 er det, der tæller«).

8. **F8 (lav)**: P55 og P56 beskriver noget andet end kortene.
   - Hvor:
     - `docs/DECISIONS.md:144` (P55) mod `groin.json:150` (groin.3), `:279` (groin.5) og `posterior.json:155` (posterior.3), og S2 fra del 1.
     - `docs/DECISIONS.md:145` (P56) mod `power_legs.json:378–383` (power_legs.6).
   - Hvorfor: `CLAUDE.md` (en beslutning beskriver valget og dets konsekvens) og SPEC 9.1.
     - P55 siger, at trinene »følger programmets generelle tempo for styrkesæt« (3 sek ned, 1 sek stille i bunden, kontrolleret op). V-ups og shoulder.5–7 har pausen.
     - Groin.3, groin.5 og posterior.3 har kun 3 sek den ene vej og programmets eget »langsomt« eller »hurtigt ind« den anden. Kortene opfinder intet, men P55 siger noget andet.
     - P56 siger: »Etbens bounds er drop-hop på ét ben … fra et trappetrin.« Kortet har tre lange spring som hovedudgave og drop-hop, når pladsen mangler. Det svarer til programmets »eller«.
   - Rettelse:
     - P55: »… får 3 sek på den langsomme vej. Programmets eget »langsomt« eller »hurtigt ind« gælder den anden vej, uden pause.«
     - P56: skriv kortets valg ind.

9. **F9 (lav)**: Kick-up til håndstand er ikke forklaret.
   - Hvor: `content/explain/shoulder.json:209` (shoulder.4, trin 1), `:281` (shoulder.5), `:343` (shoulder.6) og `:405` (shoulder.7).
   - Hvorfor: NAT-2 og SPEC 3.8 (en, der aldrig har set øvelsen, skal kunne lave den rigtigt ud fra kortet).
     - I trin 3 går du op ad væggen med maven mod den. Trin 4 er første gang med ryggen mod væggen, og »Spark op til håndstand« siger ikke hvordan: med ét ben ad gangen, hvor hårdt og fra hvilken stilling.
     - Sparker du for hårdt, rammer du væggen hårdt. Sparker du for svagt, falder du tilbage.
   - Rettelse: shoulder.4, trin 1: »Sæt hænderne, træd den ene fod frem, og spark det andet ben op mod væggen. Det første ben følger, og hælene lander på væggen.« (125 tegn). I shoulder.5–7: »Spark op som i trin 4.«

10. **F10 (lav)**: Småting i ordene og udstyret.
    - Hvor og rettelse:
      - `content/explain/measures.json:459` og `:592`: »Gem tiden«, men knappen hedder »Gem målingen« (`MeasureInput.tsx:136`).
      - `:288`, `:304` og `:314` (base_check): »Start dit ur« betyder løbeuret, men passet har selv en knap »Start uret«. Skriv »dit løbeur eller en app, der måler distancen«.
      - `legs.json:258` (legs.4): Udstyret er stol og væg, men trin 4 bruger puder på sædet. Tilføj `pillow`.
      - Det sidste trin siges på fire måder: »Det er stigens sidste trin«, »Dette er sporets sidste trin«, »Det er sidste trin« og »Der er intet trin over dette« (bl.a. `press.json:406`, `pull.json:404`, `groin.json:301` og `burpee_emom.json:730`). Vælg én formulering.
    - Hvorfor: SPEC 8 (samme ord for det samme overalt) og SPEC 9.1 (udstyr).

## Verificeret

- `node scripts/check-explain.ts`: alle 23 filer er OK, og 129 af 129 punkter er forklaret.
- `npx vitest run src/content src/ui/__tests__/card.test.ts scripts/__tests__` (med `--no-cache` og cache i scratchpad): 124 bestået i 4 filer.
- `git show --stat 05263df`: kun `content/explain/*.json`. `program/` og `src/` er urørt.
- Skærmbilleder af alle 129 kort i `screenshots/cards/` (ignoreres af git). Alle har første cue og første trin på første skærm (847 px).
- Scratch-test af de 75 nye kort med alle folder åbne (ikke committet): 0 problemer mod 18 px, 7:1 og 56 px. Intet kort er bredere end 414 px, og ingen tekst henviser til kilder.
- Scratch-flows i `pixel9a` (Firefox uden JIT) mod dev-serveren: sideplanke-målingen (F2) og skater-hop (F4). Nye skærmbilleder: `screenshots/review-p5-sideplanke-maaling-1.png`, `-2.png`, `screenshots/review-p5-skater-venstre.png` og `-hoejre.png`.
- Om værktøjet:
  - `CARDS_PORT=4190` virker ikke i Firefox, for 4190 er en spærret port (»This address is restricted«). Jeg brugte port 4191 med en egen Playwright- og Vite-konfiguration i scratchpad.
  - Mine to første forsøg med `npm run shots:cards` skrev Vites afhængighedscache i `node_modules/.vite`, som er linket fra hovedrepoet. Det er kun cache, ingen kildefiler.

## Til telefonen (efter rettelserne)

1. Styrke B i en måleuge i tidsmaskinen: Kan du tage sideplanken på begge sider med appens ur, og gemmes den korteste tid?
2. Styrke A med power ben på trin 3: Står det i »Nu« eller i pausen, at hoppene er skiftevise med målet på hvert ben?
3. Stiger → Pres → trin 5: Siger kortet, at to pas i træk med 8 giver trin 6?

## Uden for pakken (ikke fund i P5)

- **Tæppe og et bord, der vipper:** core_front.5 og pull.3–7 sender dig et trin ned under Stiger. Motoren rykker dig op igen efter to hit, fordi den ikke ved, at du mangler glat gulv eller et fast bord. Programmet siger »bliv på rygsæk-row« og »På tæppe: long-lever planke og walkouts«. Forslag: et valg pr. spor i motoren (»Bliv på dette trin«).
- **Cooper:** ENGINE 5.6 siger »cooper (valgfri, ellers base-check)«, men motorpasset i de lette uger har kun Cooper. Springer du den over, måles grundformen ikke i uge 4, 8 og 12.
- **Balance:** Kortet viser »Så længe du kan« øverst (`src/ui/components/cardItem.ts:39`), men målingen stopper ved 60 sek pr. ben.
- **Passet:** Sættene viser stadig programmets cues og »reps« (P6 og P8).
