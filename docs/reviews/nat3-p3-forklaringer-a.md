# Review af NAT-3 P3 – Skærpede forklaringer, del A

2026-11-09 · indhold: 3648b6b (forklaringerne) · trænernes tolkninger: P62–P67 (d0cb7cc) · feltet »Mærk«: 0a6b352, 77072e3 og 112ef68 (D55) · worktree på d0cb7cc

## Metode

Jeg har læst 65 punkter felt for felt (briefen siger 66, men filerne har 65). De ligger i 13 filer i `content/explain/`: press, pull, backpack_row, shoulder, legs, sl_rdl, calf, posterior, wallsit, core_front, core_side, core_situp og core_rot. Hvert punkt er sammenlignet med den gamle tekst (`git diff 112ef68 3648b6b`) og med kilderne:

- `docs/PROGRAM_KILDE.md`: sporenes tabeller, »Trafiklyset« (smerte), »Sådan rykker du op«, »Start rigtigt« og »Tempo i styrkesæt«;
- `program/tracks/*.json` og `program/sessions/A.json`, `B.json`;
- ENGINE 5.4, 5.5, 6.2, 6.3 og 6.5; SPEC 3.2, 3.8, 8 og 9.1;
- DECISIONS P1–P4, P8–P10, P17, P47, P51–P67 og D55.

Det, kortene siger om passet og motoren, har jeg tjekket i koden:

- `src/engine/derive.ts`: en blok på et andet trin end sporets er neutral; skarp smerte på trin 1 sætter flaget »lettere«.
- `src/engine/session.ts`: `plannedRir` og smerte i søndagstjekket. `src/engine/explain.ts`: motorens tekster.
- `src/ui/session/Runner.tsx`: »Stoppede før tid«, »Rygsæk: X kg« og »Rene runder?«.
- `src/ui/screens/Ladders.tsx`: »Vælg selv dette trin«. `src/ui/components/ExerciseCard.tsx`: »Lettere variant i dag« viser hele `easier`.

Kørt i worktree:

- `node scripts/check-explain.ts` på de 13 filer: alle i orden.
- `npx vitest run src/content`: 116 bestået.
- `npm run shots:cards` (`CARDS_PORT=4182`): 129 kort. Alle 65 i del A har første cue og første trin på første skærm, når kortet er foldet sammen. De to undtagelser, burpee_skill.V3 og os.1, hører til del B.
- `E2E_PORT=4182 npx playwright test e2e/no-source-refs.spec.ts e2e/card.spec.ts --project=pixel9a`: 11 bestået. Kørslen tog kortenes skærmbilleder på ny i worktree, se »Uden for pakken«.
- Et scratch-flow i Firefox med pixel9a's mål viser de 13 trin 1-kort, som de ser ud fra et sæt med »· lettere variant«: »Tilbage til passet«, »Passet står stille.« og boksen »Lettere variant i dag«. Billederne ligger uden for repoet i scratchpad (`shots/lettere-*.png`), fordi kun rapporten må ind i repoet.
- Kontaktark for `content/figures/shoulder.json`, tegnet med `scripts/figure-sheet.ts` (scratchpad `shots/shoulder-sheet*.png`).

## Resultat

0 høje, 1 middel og 10 lave.

- **Navne, doser, tempo og regler er uændrede.** `program/` og `src/` er ikke rørt. Tempofelterne har kun fået ny ordlyd (calf.1, core_front.2), og hver »N sek« har stadig sin fase.
- **»Sværere« passer med motoren i alle 65 punkter.** Det gælder for alle typer af spor:
  - Stigerne: alle sæt på toppen med 2 i reserve to pas i træk (R-DP-STEPUP, P1).
  - Holdene: det samme med sekunder (R-HOLD, P3). Timeren logger selv den planlagte reserve, også 2 ved toppen i uger med »1–2 i reserve«, så et fuldt hold på toppen tæller.
  - W3: to pas i træk med 3 rene runder (R-W3, P9).
  - Læg, etbens RDL og rygsæk-row: +2 kg, og du starter forfra i bunden af intervallet (R-LOAD, P8).
  - Bulgarsk med rygsæk følger stigen (P8), og de sidste trin lover ingen oprykning.
- **»Lettere« på trin 2–7 peger på nabotrinnet og »Vælg … under Stiger«.** Knappen findes (»Vælg selv dette trin«, R-USER-STEP). Vælger han et andet trin midt i passet, bliver blokken neutral (`derive.ts:118`), så det skader ingenting.
- **»Mærk« står på alle 65.** Hver er én sætning med anatomisk rimelige steder og med de steder, det ikke må mærkes (lænd, knæ og nakke). »Mærk« står efter »Træner«, så cues og trin bliver på første skærm.
- **Opstillingen derhjemme er blevet konkret og entydig.** Fx:
  - en stol uden hjul med ryglænet mod væggen;
  - knæl på puden, og rejs dig uden at flytte fødderne (split squat);
  - sæt dig på sofakanten for at finde skridtet (bulgarsk);
  - puden en underbenslængde foran sofaen og sofaen tjekket (Nordic);
  - en lukket flaske på langs på lænden;
  - stå på bare fødder eller i sko.

  HSPU-trinene er rettet, så puden ligger mellem fingrene og væggen. Det er anatomisk rigtigt, men figuren viser det modsatte (F2).
- **Ingen henvisninger** til PDF, sider, kilder eller undersøgelser. Kortene bruger du-form og »gentagelser«.
- **Det ene middel fund:** på syv trin 1-kort siger »Lettere«, at du kun skal tage varianten under en bestemt betingelse. Teksten står også øverst som »Lettere variant i dag« efter skarp smerte, og der modsiger den passet (F1).

## Trænernes valg i del A (P63–P65)

- **P63, puder på stolen i `legs.4`:** Det er godt, at der nu er et signal. Men signalet kommer efter ét pas på toppen, mens motoren rykker op efter to i træk og lader arbejdstallet blive på toppen (F3). Begrundelsen »samme signal som dobbelt progression (P1, P2)« passer ikke, for P1 kræver to pas i træk.
- **P64, afstanden til væggen i `core_front.6`:** samme mekanisme (F3).
- **P65, stolen i rows:** Stolen står mod væggen, og `wall` står i udstyret. Det er godt. Men »samme indhold som sidst« er tvetydigt, fordi den samme rygsæk bruges i Styrke A (pull.1) og i Styrke B (backpack_row, der får +2 kg) (F6).
- P62, P66 og P67 hører til del B.

## Fund

1. **F1 (middel): På trin 1 modsiger »Lettere« boksen »Lettere variant i dag«.**
   - Hvor:
     - `content/explain/press.json:38` (press.1), `pull.json:38` (pull.1) og `backpack_row.json:37`;
     - `shoulder.json:38` (shoulder.1), `core_front.json:37` (core_front.1), `core_side.json:41` (core_side.S1) og `core_situp.json:37` (core_situp.1);
     - skærm: kortet åbnet fra et sæt, hvor passet viser »· lettere variant«.
   - Hvorfor:
     - SPEC 9.1 (`docs/SPEC.md:359`): på et spors første trin er »Lettere« »det, du laver, når passet viser »lettere variant« efter skarp smerte på trin 1«.
     - SPEC 3.8 (`:178`): kortet viser så hele teksten øverst som »Lettere variant i dag«.
     - ENGINE 5.5 R-PAIN-SHARP (`docs/ENGINE.md:169`) og 6.5: trinnet bliver stående med den lettere variant i 7 dage. Motoren skriver »bliv på trin 1 med en lettere variant til …« (`src/engine/explain.ts:67`).
     - 3648b6b gav shoulder.1, core_front.1, core_side.S1 og core_situp.1 en betingelse. press.1, pull.1 og backpack_row.1 havde den i forvejen.
     - Efter skarp smerte står der nu fx »Lettere variant i dag: … Tag den, hvis du ikke kan lave 6 rene gentagelser i alle sæt.« eller »… Tag den, hvis hoften synker før 20 sek.«
     - Kan han lave 6, læser han, at varianten ikke gælder ham, og laver den fulde øvelse i smerteugen. Det svækker smertereglen (`docs/PROGRAM_KILDE.md:107`).
     - Den ekstra sætning gør også boksen højere (press.1: 150 px). Fra passet begynder første nummererede trin ved 843–916 px på alle 13 trin 1-kort (uden boksen ved 731–779 px), så den første linje ender under første skærm på 847 px (SPEC 3.8, `:177`). Se også »Uden for pakken«.
   - Rettelse: Skriv betingelsen, så den passer i begge situationer, eller fjern den fra `easier` på trin 1. Fx:
     - press.1: »Hænderne på sofakanten med samme tempo og planke, også når du ikke kan lave 6 rene gentagelser. Ondt i håndleddet: tag push-ups på knoer.« (137 tegn)
     - core_side.S1: »Bøj knæene, så det nederste knæ og underarmen bærer dig, med hoved, hofte og knæ på én linje. Brug den også, hvis hoften synker før 20 sek.« (139 tegn)
     - De fem andre på samme måde.
     - Overvej en regel i `src/content/validate.ts`, der afviser »Tag den, hvis« i `easier` på et spors første trin.

2. **F2 (lav): HSPU-teksten er rettet, men figuren viser det modsatte.**
   - Hvor:
     - `content/explain/shoulder.json`: shoulder.4 (`:210`, `:245`, `:264`), shoulder.5 (`:284`, `:319`, `:328`), shoulder.6 (`:350`, `:391`) og shoulder.7's »Nede«;
     - `content/figures/shoulder.json`, shoulder.4–7. Puden ligger ved `at: [13, 0]` på rummets side af hænderne (x 10–11), og hovedet lander ved x ≈ 19. I trin 7 lander det ved x ≈ 23, uden for bøgerne (x 4,5–14,5).
   - Hvorfor:
     - Den nye tekst er rigtig. Med ryggen mod væggen går hovedet ned foran fingerspidserne mod væggen og danner en trekant med hænderne, og albuerne peger ud i rummet.
     - Figurerne er ikke ændret i 3648b6b. De lægger hoved og pude på rummets side af hænderne, som passede med den gamle tekst (»puden mellem hænderne og fødderne«).
     - Nu siger kortet ét og viser det modsatte i en omvendt øvelse med vægt på hovedet. SPEC 3.8 kræver, at øvelsen kan laves ud fra kortet og figuren.
     - P3's regel er, at positionerne kun ændres i ordlyden (`docs/runs/NAT-3-TASKS.md`, P3). Her er indholdet ændret (afstanden til væggen og pudens side), uden en linje i DECISIONS.
     - Figuren kan ikke tegnes rigtigt endnu. Tjekket kræver, at underarmen peger mod brystets side, og det er forkert med armene over hovedet. Det er P1a's »albuens retning i omvendte stillinger« (`docs/runs/NAT-3-TASKS.md:45`).
   - Rettelse:
     - Behold teksten.
     - Sæt shoulder.4–7 på P2.1's liste, når P1a er færdig: hænderne en fodlængde (ca. 15 enheder) fra væggen, puden (trin 4–5) mellem hænderne og væggen, hovedet ned foran fingerspidserne mod væggen og albuerne ud i rummet. I trin 7 går hovedet ned mellem stakkene.
     - Skriv én linje i DECISIONS om, at positionerne i shoulder.4–7 er rettet i indhold.

3. **F3 (lav): Puderne i `legs.4` og afstanden i `core_front.6` gør øvelsen sværere efter ét pas på toppen, men passet viser stadig toppen som mål.**
   - Hvor: `content/explain/legs.json:239` (legs.4, trin 3), `content/explain/core_front.json:370` (core_front.6, trin 4) og `docs/DECISIONS.md:160–161` (P63, P64).
   - Hvorfor:
     - ENGINE 5.4 R-DP-TARGET (`docs/ENGINE.md:141`) hæver kun arbejdstallet. R-DP-STEPUP (`:143`) rykker op efter to hit i træk.
     - Efter en fjernet pude eller et skridt længere væk viser passet stadig »mål 8« og »Som planlagt (8 · reserve 2)«, nu i den sværere udgave.
     - Kortet siger ikke, at han skal rette tallet med −. Et tryk af vane logger gentagelser, han ikke tog, og kan give hit nummer to. Så kommer `legs.5` (uden stol) eller `core_front.7` (fuld rollout uden væg) for tidligt.
     - Det er samme mekanisme som F1 i `docs/reviews/nat2-p5-forklaringer-2.md` (press.5), der førte til P53.
   - Rettelse:
     - legs.4, trin 3: »Kan du ikke rejse dig fra stolen, så læg puder på sædet. Fjern én, når du rammer toppen i alle sæt, og ret så tallet med −.« (123 tegn)
     - core_front.6, trin 4: »Flyt dig en fodlængde længere fra væggen, når alle sæt rammer 8 rene gentagelser med 2 i reserve, og ret så tallet med −.« (121 tegn)
     - Ret begrundelsen i P63 og P64: »Motoren kender ikke puderne (afstanden): to pas i træk på toppen giver næste trin, uanset dem.«

4. **F4 (lav): Ben-stigen har et andet kriterium for at gå et trin ned end de andre stiger, og det passer ikke med ugens reserve.**
   - Hvor: `content/explain/legs.json:105` (legs.2), `:167` (legs.3) og `:388` (legs.6).
   - Hvorfor:
     - Pres, træk og skuldre siger »hvis du ikke kan lave N rene gentagelser i alle sæt«. Bagkæde, wall sit og mave bruger et formkriterium.
     - Ben kræver »bunden af intervallet rent med 2 i reserve«. I uge 6–7 er planen »1–2 i reserve« (ENGINE 6.3, P10). Der er bunden med 1 i reserve netop planen, men kortet beder ham gå et trin ned.
     - Pres og ben ligger begge i Styrke A, så samme pas har to forskellige regler for det samme valg.
   - Rettelse: »Vælg trinnet under Stiger, hvis du ikke kan lave bunden af intervallet rent i alle sæt.«

5. **F5 (lav): »Lettere« i `shoulder.3` er en halv håndstand, som motoren tæller som trinnet.**
   - Hvor: `content/explain/shoulder.json:162`.
   - Hvorfor:
     - SPEC 9.1 (`docs/SPEC.md:359`): uden for første trin er »Lettere« nabotrinnet eller programmets egen variant. En halv håndstand er ingen af delene.
     - Den nye sætning »Tag den, hvis du ikke kan holde 20 sek med lige krop« gør den til et varigt alternativ.
     - Timeren logger sekunderne som shoulder.3 (R-HOLD). To pas med 45 sek halvt oppe giver derfor shoulder.4: spark op i fuld håndstand med ryggen mod væggen, og sænk dig til hovedet. Det sker, uden at han nogensinde har holdt en fuld håndstand.
     - Den gamle tekst sagde, at trin 2 laves i samme blok (P17). Det er forsvundet.
   - Rettelse: »Trin 2: fødderne på en stol, som du laver i samme blok. Vælg den under Stiger, hvis du ikke kan holde 20 sek helt oppe med lige krop.« (133 tegn)

6. **F6 (lav): »Pak rygsækken som sidst« i `pull.1` er tvetydigt.**
   - Hvor: `content/explain/pull.json:41` (`getReady`) og `docs/DECISIONS.md:162` (P65).
   - Hvorfor:
     - Den samme rygsæk bruges i Styrke A (pull.1, gentagelser) og i Styrke B (backpack_row, som får +2 kg efter R-LOAD, `docs/ENGINE.md:155`).
     - Har appen sagt »læg 2 kg mere i rygsækken« i B, kan »som sidst« i A læses som B's vægt. Så bliver pull.1 tungere, uden at motoren ved det, og tallene kan ikke sammenlignes. Det var netop det, P65 ville undgå.
   - Rettelse: Skriv »Pak rygsækken som sidst på dette trin, …« i pull.1. Skriv i P65, at pull.1 har sin egen vægt uafhængigt af rygsæk-row, eller beslut det modsatte og skriv det på begge kort.

7. **F7 (lav): »Gør klar« henviser til en vægt, der ikke kan ses i pausen.**
   - Hvor: `content/explain/sl_rdl.json:44`, `calf.json:40`, `backpack_row.json:40` og `src/ui/session/Runner.tsx:1472`.
   - Hvorfor:
     - »Gør klar« vises i pausen og på introkortet før øvelsen (SPEC 3.2 og 9.1, `docs/SPEC.md:361`).
     - »Rygsæk: X kg« står kun på sættets skærm efter pausen (`Runner.tsx:1472`). Hverken »Næste«, introkortet eller »Dagens pas« viser vægten.
     - »Viser passet »Rygsæk«, så pak den med den vægt« kan altså ikke følges i pausen. »Hvis appen har sagt til« (backpack_row) henviser til opsummeringen fra sidste uge.
   - Rettelse: Vis »Rygsæk: X kg« i »Næste«, på introkortet og i »Dagens pas« (UI, SPEC 3.2), eller skriv: »Pak rygsækken som sidst, og læg 2 liter vand mere i, hvis appen sagde det efter sidste pas.«

8. **F8 (lav): »Mærk« i `core_side.S4` gør al smerte til stop.**
   - Hvor: `content/explain/core_side.json:224`.
   - Hvorfor:
     - Smertereglen (`docs/PROGRAM_KILDE.md:107`, ENGINE 6.5) siger, at smerte op til 3 er i orden, hvis den er væk næste morgen. Skarp eller stigende smerte i et led betyder stop og et trin ned.
     - »Smerte i håndled eller skulder betyder stop« gør al smerte til stop. Trykker han »Smerte« og »Stop øvelsen«, rykker appen ham et trin ned i en uge for let smerte (R-PAIN-SHARP).
     - D55: »Mærk« siger, hvor øvelsen mærkes og evt. ikke må mærkes. Det er ikke en ny smerteregel.
   - Rettelse: »Siden af kroppen og skulderen, der bærer dig, ikke håndleddet.« eller »… skarp smerte i håndled eller skulder betyder stop.«

9. **F9 (lav): »Stop uret« i `core_rot.R2` og `R3` er ikke en knap i appen.**
   - Hvor: `content/explain/core_rot.json:98` og `:172`.
   - Hvorfor: Holdet har knappen »Stoppede før tid« (SPEC 3.2, `docs/SPEC.md:110`). W1, W4 og core_front.2 siger »tryk »Stoppede før tid««, så teksten er ikke ens på tværs af kortene.
   - Rettelse: »… Er holdet for langt, så tryk »Stoppede før tid«, når flasken vipper.« (159 tegn i R2)

10. **F10 (lav): Fem felter har for mange sætninger.**
    - Hvor:
      - `content/explain/pull.json:13` og `backpack_row.json:12`: `start` har 3 sætninger;
      - `pull.json:41`, `pull.json:103` og `backpack_row.json:40`: `getReady` har 2 sætninger.
    - Hvorfor: SPEC 9.1 (`docs/SPEC.md:353`, `:361`) tillader 1–2 sætninger i `start` og én i `getReady`. Alle fem er kommet med 3648b6b. Valideringen tjekker kun antallet af sætninger i `feel`.
    - Rettelse:
      - start (begge): »Stå foran stolen, og støt den ene hånd midt på sædet med strakt arm. Foden på samme side frem og den anden et stort skridt bagud, ryggen lige og næsten vandret og rygsækken i den frie hånd.«
      - pull.1: »Stil en solid stol uden hjul med ryglænet mod væggen, og pak rygsækken som sidst (første gang, så 8 gentagelser går rent med 2–3 i reserve).« (140 tegn)
      - pull.2: »Find et tungt spisebord, ikke et klapbord, med en kant, du kan gribe om, og ryd gulvet under langsiden.«
      - backpack_row.1: »Stil en solid stol uden hjul med ryglænet mod væggen, og pak rygsækken som sidst, med 2 liter vand mere, hvis appen har sagt til.«
      - Overvej `oneSentence` for `trains` og `getReady` og højst 2 sætninger for `start` i `validate.ts`.

11. **F11 (lav): Bøgerne i `calf.1` står ikke i udstyret og kan glide.**
    - Hvor: `content/explain/calf.json:40` (`getReady`). Udstyret er `["step", "wall", "backpack"]`.
    - Hvorfor:
      - Programmet siger trappetrin (`docs/PROGRAM_KILDE.md`, »Læg og fødder«), og figuren viser et trin.
      - Den nye mulighed, »en stabel tykke bøger mod væggen«, står ikke i udstyret (SPEC 9.1).
      - En løs stak kan glide, når hælen går under kanten med al vægten på én forfod.
    - Rettelse: Fjern bøgerne, eller skriv »en stak store, flade bøger helt ind mod væggen, der ikke kan glide«, og tilføj `books` i udstyret.

## Uden for pakken

- **Boksen »Lettere variant i dag« skubber trinene ned.** Fra et sæt med »· lettere variant« begynder første nummererede trin under første skærm på alle 13 trin 1-kort (843–916 px). Kortere tekst løser det ikke alene: legs.1 har ingen betingelse og en boks på 101 px, men trinene begynder alligevel ved 892 px. Boksen kunne vise kun første sætning, stå i stedet for cues eller stå under trinene (SPEC 3.8).
- **»Rygsæk: X kg« viser kun den vægt, der er lagt til.** Vægten starter på 0, og der er intet felt til startvægten (P42 nævner brugerens egen rettelse, men UI'et har den ikke). Det passer til læg og etbens RDL, som starter uden rygsæk. Men rygsæk-row starter med en rygsæk af ukendt vægt, så »Rygsæk: 2 kg« ligner hele vægten. Forslag: »Rygsæk: +2 kg« eller et felt til startvægten.
- **Skærmbillederne af kortet er forældede.** `screenshots/kort-maerk.png`, `kort-skimmet.png`, `kort-foldet-ud.png` og `kort-fra-passet.png` viser stadig teksten fra før 3648b6b, fx »Mærk: … ikke skuldrene.« på press.1. `e2e/card.spec.ts` tager dem på ny. De fælles krav siger, at skærmbilleder af ændrede skærme skal ligge i `screenshots/`.

## Opfølgning

2026-11-09 · rettelser: c1685a6 (diff `5fa62f0..c1685a6` i `content/explain/` og `docs/DECISIONS.md`) · worktree på c1685a6

Tjekket:

- `node scripts/check-explain.ts` på de 13 filer: alle i orden.
- `npx vitest run src/content`: 116 bestået.
- Sætningstællingen i SPEC 9.1 (`start` 1–2, `getReady` og `trains` 1): ingen overtrædelser.
- Ingen rester af »Tag den, hvis« i »Lettere« på trin 1, af »stop uret«, af bøgerne under læggen eller af »viser passet »Rygsæk««.
- Figurerne er ikke ændret.

Status pr. fund:

- **F1 (middel): rettet.** Alle syv trin 1-kort siger nu »… også når …« eller »Brug den også, …«. »Lettere variant i dag« modsiger ikke længere passet efter skarp smerte.
- **F2 (lav): udskudt til P2.** Teksten i shoulder.4–7 er rigtig, og figurerne rettes i P2.1, når P1a er færdig. Linjen i DECISIONS om, at positionerne er rettet i indhold og ikke kun i ordlyd, mangler stadig. Den kan komme med P2.
- **F3 (lav): rettet.**
  - legs.4, trin 3, og core_front.6, trin 4, siger »tager du færre, så ret tallet med −«.
  - Nye P63 og P64: puden fjernes og afstanden øges efter ét pas, hvor alle sæt rammer toppen med 2 i reserve. Passet viser stadig toppen som mål, og to pas i træk på toppen giver næste trin.
  - Begge følger nu samme mekanisme. Programmets egne ord, »sænk sædet gradvist« og »Flyt dig længere fra væggen«, er bevaret. Det godkender jeg.
- **F4 (lav): rettet.** legs.2, legs.3 og legs.6 siger »rent i alle sæt«, som de andre stiger.
- **F5 (lav): rettet.** »Lettere« i shoulder.3 er nu trin 2 i samme blok, og håndstanden skal holdes »helt oppe«.
- **F6 (lav): rettet på kortet.** pull.1 siger »som sidst på dette trin«. P65 siger stadig kun »samme indhold som sidst«, men kortet er entydigt.
- **F7 (lav): rettet.** sl_rdl.1, calf.1 og backpack_row.1 henviser ikke længere til en vægt, som passet viser først senere. De siger »som sidste gang« og »2 kg mere, hvis appen bad om det« (backpack_row: »efter sidste rygsæk-row«).
- **F8 (lav): rettet.** core_side.S4 siger »skarp smerte«.
- **F9 (lav): rettet.** core_rot.R2 og R3 siger »tryk »Stoppede før tid««.
- **F10 (lav): rettet.** `start` i pull.1 og backpack_row.1 har 2 sætninger, og `getReady` i pull.1, pull.2 og backpack_row.1 har én.
- **F11 (lav): rettet.** Bøgerne er fjernet, så kortet siger trappetrin som programmet.

Nye fund: ingen. De ændrede felter overholder kildernes navne, doser, tempo og regler. Det, de lover om motoren, passer: »Sværere« og to pas i træk er uændret, og P63 og P64 nævner, at motoren ikke kender puderne og afstanden.

Stadig åbent uden for pakken: kortenes skærmbilleder (`screenshots/kort-maerk.png`, `kort-skimmet.png`, `kort-foldet-ud.png` og `kort-fra-passet.png`) viser stadig teksten fra før 3648b6b. Boksen »Lettere variant i dag« skubber stadig trinene under første skærm, og »Rygsæk: X kg« viser stadig kun den vægt, der er lagt til. De to sidste hører til UI'et.

Resultat efter opfølgningen: 0 åbne høje eller middel og 1 åben lav (F2, i P2).
