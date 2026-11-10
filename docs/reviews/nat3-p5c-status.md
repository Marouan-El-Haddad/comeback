# Review af NAT-3 P5c – Livet: syg, rejse, ferie, klubben lukket og begivenheder

2026-11-10 · cc7125e, 8eeb532, 6df7d54, 590e3e1, 67984c4, c56ea68, fe6b5df og c451433 · worktree på c451433 (`git diff e9cdc75 c451433`)

Metode:

- **Læst** mod:
  - P5c i `docs/runs/NAT-3-TASKS.md` og pakke 5 i `docs/runs/NAT-3.md` (NAT-2 pakke 7);
  - SPEC 3.1, 3.4, 3.6, 3.7, 4.6, 4.7, 4.11, 5 og 6;
  - ENGINE 3.1, 4, 5.1, 5.5 (R-ABSENCE-3), 5.7, 5.8, 5.9, 5.14, 6.4 og 8 (S-WEEK-01..13, S-EVENT-01..03, S-MOVE-05);
  - PROGRAM_KILDE »Trafiklyset« (s. 7), »Uge 7–12« og »Når livet ændrer sig« (s. 47);
  - PLAN M3, tjekliste 3–6;
  - DECISIONS D57, D61, D64–D67 og R30.
- **Kørt** i worktreen:
  - `npm test`: 805/805. `npm run typecheck` og `npm run lint`: rene.
  - `e2e/status.spec.ts` i `pixel9a` og `pixel9a-utc` (`E2E_PORT=4185`, Firefox uden JIT): 16/16.
  - Hele Playwright-suiten i begge projekter: 170/170 på 30,7 min. Én test var flaky: `content.spec.ts` »Potensér« fik timeout under belastning i `pixel9a` og bestod ved gentagelsen (uden for P5c).
- **Egne flows** i tidsmaskinen (scratch, ikke committet), i begge projekter (10/10):
  - en rejse 9.–20. november, der onsdag gøres kortere til fredag 13. (M1);
  - syg tirsdag–onsdag, forlænget onsdag til fredag, og så »Afslut« (M1);
  - rejse på en klubdag efter klubtidens slutning (L1);
  - ferie lørdag–mandag med søndagstjek, en begivenhed lørdag og en tirsdag, Uge og Begivenheder under Mere (med a11y-tjek af skærmen);
  - uret 00.30 i København (23.30 UTC): »Fra« og begivenhedens første dato.
- **Motoren** med et scratch-script på testenes `Log`:
  - klubben lukket sat efter syg samme dag (syg gælder, dagen er rød);
  - syg inde i en ferie;
  - tre ugers sygdom (R-ABSENCE-3 i uge 4 og »du gentager uge 1«);
  - en begivenhed på en rejsedag (rejsepasset mister split squats);
  - en begivenhed tilføjet efter dagens pas (L2);
  - »Fjern« og en ny status med samme slags og første dag (M1).
- **Skærmbilleder** i `screenshots/` (`pixel9a`; `-utc`-udgaverne er ens):
  - `review-p5c-pixel9a-forkort-rejse.png`
  - `review-p5c-pixel9a-rejse-17-nov.png`
  - `review-p5c-pixel9a-afslut-to-syg.png`
  - `review-p5c-pixel9a-rejse-klubdag.png`
  - `review-p5c-pixel9a-fredag-foer-begivenhed.png`
  - `review-p5c-pixel9a-ferie-soendag.png`
  - `review-p5c-pixel9a-begivenheder-liste.png`

## Resultat

0 høje, 2 middel og 5 lave.

- **Det virker:**
  - **Reglerne:**
    - Syg er en rød dag med kun Open & Strong og en gåtur og intet pas at starte; ferie er hvile, også på en klubdag; rejse giver rejsepasset på A- og B-dage og lader motoren og klubben stå; klubben lukket giver kamp-runder på klubdagene.
    - Af syg, rejse og ferie gælder den nyeste, og klubben lukket gælder ved siden af. Det gælder overalt, hvor dagens status læses: `planFor`, trafiklyset (syg er rød, også når klubben lukkes bagefter), `unloggedOn`, `validMoveDays` (S-MOVE-05), klubloggen og søndagstjekkets lørdagskarakter (ingen karakter på en lørdag med status).
    - R-PW og R-ABSENCE-3 følger af ugerne alene, også under sygdom og ferie: tre ugers sygdom giver ét sæt trinskift i uge 4 og »Sidste uge blev ikke gennemført: du gentager uge 1.«.
    - »Dagen før« (R-EVENT) og forklaringen: `eventTrim` sammenligner dagens plan med og uden begivenheden, så forklaringen siger præcis det, reglen tog ud – også på en rejsedag og for motoren i uge 3, 4 og 5 (S-EVENT-03).
  - **Hændelserne:**
    - Der tilføjes kun `status_set` og `calendar_event_added` gennem `model.commit`; ingen ny hændelse og intet nyt felt, så ingen migration.
    - Afløsningen på (`status`, `from`) i `deriveState` ændrer ingen eksisterende log: brugerfladen har ikke kunnet skrive `status_set` før nu.
    - »Afslut« og »Fjern« rører kun deres egen periode, og de dage, der er gået, står som før (S-WEEK-13). Importens validering tager imod en periode med `to` før `from`, og »Flet« ordner efter `at`, så afløsningen virker også efter en import.
  - **Tidsmaskinen:** Status og Begivenhed lukker ved »Afslut« på I dag og under Mere, `useSameWorld` stopper en skrivning på tværs, og lagerets antal hændelser er uændret i alle flows.
  - **Datoer:** »Fra« er dagens dato i København, også kl. 00.30 med uret i UTC; »til og med« er med; perioder over en uge- og månedsgrænse læses rigtigt.
  - **Dobbelttryk:** D61-spærren og det halve sekund virker på »Gem status«, »Afslut« og »Tilføj begivenhed«, også med 400 ms langsommere skrivninger, og datofelterne tager intet tryk det første halve sekund.
  - **Brug:** knapperne er 56 px med 8 px imellem, primærknapperne 64 px, al tekst mindst 16 px og med kontrast over 4,5:1 (a11y-tjekket i testene og i egne flows); ingen dialog; hver status har tekst; tilbage-gestussen lukker skærmene; ingen henvisninger til kilder.
  - **Testene** prøver kriterierne og ikke bare, at noget vises: tjekliste 3, 5 og 6 med hovedkortets titel og linjer, de blokke, der forsvinder, motorens forklaring ord for ord og lagerets antal hændelser; S-WEEK-13 med prioritet og afløsning dag for dag; S-EVENT-03 med alle varianter (A, boss, motor i uge 3, 4 og 5, klubdag, B uden vægt). Hullerne er M1 og L5.
- **Det virker ikke:**
  - En status, der gælder, kan ikke rettes: en ny periode af samme slags lægges oven i den gamle, som stadig gælder, og skærmen siger det ikke (M1).
  - Syg-teksten mister programmets »hvil« ved feber (M2).

## Fund

### M1 (middel): En status, der gælder, kan ikke rettes – en ny periode af samme slags lægges oven i den gamle, som stadig gælder

- **Alvor:** middel. Intet data går tabt, og »Afslut« på den gamle periode retter det, men kun hvis brugeren opdager det; skærmen og »✓«-linjen siger det modsatte.
- **Hvor:**
  - `src/ui/life/StatusForm.tsx:77–92`: noterne under valget nævner kun en anden slags status, der overlapper, eller en med samme første dag.
  - `src/ui/life/StatusForm.tsx:94–99`: »Gem status« skriver altid `status_set` med det valgte »Fra«, som ikke kan ligge før i dag (`:46`).
  - `src/ui/life/StatusForm.tsx:100–117`: »Afslut« siger altid »Fra i dag gælder den almindelige plan.«.
- **Hvorfor:**
  - **Kilderne:**
    - SPEC 3.6: »Afslut« betyder, at »fra i dag gælder den almindelige plan igen«.
    - D67: »skærmen siger, hvad et tryk gør, før det gemmer« (den forsigtigste læsning) og (2) »skærmen siger det før »Gem status««.
    - ENGINE 3.1 og S-WEEK-13: et `status_set` afløser kun et tidligere med samme `status` og `from`.
  - **Gøres en rejse kortere** (rejse 9.–20. november; onsdag 11/11 vælger brugeren »Rejse« fra i dag til og med fredag 13.):
    - Skærmen viser kun »Rejse fra i dag til og med fredag 13. november.« og de faste linjer (`review-p5c-pixel9a-forkort-rejse.png`), og »✓ Rejse fra i dag til og med fredag 13. november.« står bagefter.
    - Den gamle periode gælder stadig: tirsdag 17/11 er »Rejsepas« med »Rejse til og med fredag 20. november« (`review-p5c-pixel9a-rejse-17-nov.png`), og fredag 20/11 bliver også rejsepas i stedet for Styrke B. Rejsepasset er neutralt for progression (R-TRAVEL), så en hel uges styrkepas flytter ingen stiger, hvis brugeren følger appen.
  - **Forlænges en sygdom** (syg tirsdag–onsdag; onsdag »Syg« fra i dag til og med fredag) står der to perioder med hver sit »Afslut«. Det første tryk siger »✓ Syg er afsluttet. Fra i dag gælder den almindelige plan.«, mens hovedkortet stadig er »Syg · Til og med fredag 13. november« (`review-p5c-pixel9a-afslut-to-syg.png`).
  - **Samme første dag under en nyere status** (syg i dag, så rejse fra i dag, så igen syg fra i dag til torsdag) afløser den nye syg den gamle på dens plads under rejsen: noten siger »Afløser Syg i dag.«, og »✓ Syg fra i dag til og med torsdag …« står, men alle dagene er rejsedage med rejsepas (probe med motoren).
- **Rettelse:**
  - Når den nye status har samme slags som en, der gælder eller kommer, og perioderne overlapper eller støder op til hinanden, så ret den gamle i stedet for at lægge en ny oven i: starter den gamle samme dag eller før, skrives `status_set` med den gamle `from` og den nye `to` (motoren afløser allerede på (`status`, `from`), og de dage, der er gået, står som før); starter den gamle senere, fjernes den (`to` før `from`), og den nye skrives. Sig det under valget: »Retter Rejse til og med fredag 20. november: nu til og med fredag 13. november.«.
  - Byg noterne af motorens egen tilstand efter skrivningen (`deriveState` med den nye hændelse og `statusOn` for hver dag i den nye og den gamle periode), så skærmen siger de dage, hvor noget andet gælder (»Rejse gælder i stedet 10.–12. november.«).
  - Lad »Afslut« sige, hvad der gælder i dag bagefter, når en anden periode stadig dækker dagen (»Syg gælder stadig til og med fredag 13. november.«).
  - Test: rejse 9.–20., onsdag ny rejse til fredag 13. → tirsdag 17/11 er Styrke A; syg forlænget og så afsluttet med ét tryk.

### M2 (middel): Syg-teksten mister programmets »hvil« ved feber

- **Alvor:** middel. Programmets regel for sygdom står ikke i appen, og den nye skærm Status gentager det; rettelsen er to tekster.
- **Hvor:**
  - `src/ui/life/StatusForm.tsx:26–30`: »Alle dage er røde: kun Open & Strong og en gåtur.« og »Kun forkølet over halsen er din egen vurdering.«.
  - `src/ui/screens/Today.tsx:757`: hovedkortet »Syg« har samme tekst (fra før P5c, men nu med »Ret status« og datoen).
- **Hvorfor:**
  - PROGRAM_KILDE, »Rejser, sygdom og pauser« (s. 47): »**Syg** med feber eller ondt i kroppen: hvil. Kun forkølet over halsen: Open & Strong og en gåtur.«
  - ENGINE 5.7, R-ILL: alle dage er røde, og »»Kun forkølet over halsen« er brugerens vurdering; appen viser teksten«. Trafiklysets røde dag (s. 7) giver Open & Strong og en gåtur, og R-ILL lægger vurderingen hos brugeren – men kun, hvis han kan læse, hvad den afgør.
  - »Kun forkølet over halsen er din egen vurdering.« siger ikke, hvad vurderingen afgør. Med feber læses kortet som Open & Strong og en gåtur, hvor programmet siger hvil.
- **Rettelse:** brug programmets sætning begge steder: »Feber eller ondt i kroppen: hvil. Kun forkølet over halsen: Open & Strong og en gåtur.«

### L1 (lav): En rejsedag viser Muay Thai, men klubloggen kommer aldrig

- **Hvor:** `src/ui/life.ts:85`: `clubDay` er `null` for enhver status, også rejse.
- **Hvorfor:**
  - D67 (6): »På en rejsedag står klubben, som motoren siger«. Hovedkortet onsdag på en rejse er »Muay Thai · Træning 18–19.30«.
  - SPEC 4.6: efter klubtidens slutning (eller næste dag) viser I dag »Hvordan var det?«. Kl. 22 på rejsedagen er der ingen knap, og torsdag intet »Muay Thai i går« (`review-p5c-pixel9a-rejse-klubdag.png`). En træning, han faktisk tager, kan ikke logges, og P25-hintet og flad-reglen mangler den.
- **Rettelse:** lad `clubDay` kun udelukke syg, ferie og klubben lukket (`statusOn` er `ill` eller `holiday`, eller `clubClosedOn`), så klubloggen følger kortet. Alternativt: vis ikke Muay Thai på en rejsedag. Den første er forsigtigst, for »Jeg var der ikke« findes allerede.

### L2 (lav): Forklaringen dagen før en begivenhed siger »taget ud af dagens pas« om et pas, der er taget

- **Hvor:** `src/ui/screens/Today.tsx:280–286` og `eventTrim` i `src/engine/plan.ts`.
- **Hvorfor:** tilføjes begivenheden efter dagens pas (A logget tirsdag, kamp onsdag tilføjet tirsdag aften), står »I morgen: Kamp – let udgave i dag. … Power ben, Ben og Bagkæde er taget ud af dagens pas.« over »✓ Logget i dag«. Passet havde dem. SPEC 3.1 og S-EVENT-03 vil have dagens ændring forklaret, ikke en ændring, der ikke skete.
- **Rettelse:** er dagens pas logget eller i gang (`plan.done` eller `plan.open`), så vis kun »I morgen: Kamp.«.

### L3 (lav): SPEC 4.11 lover stadig et kort med »OK« og »Vælg anden« for sprunget uge, tre uger, sygdom, rejse og klubben lukket

- **Hvor:** `docs/SPEC.md:264`.
- **Hvorfor:** P5c tilføjede en linje til 4.11, men lod sætningen stå. Appen (og SPEC 3.1, 3.6 og D67 (5)) forklarer en gentaget uge med en linje, tre uger med et kort uden knapper og status med skærmen Status. Kun jul og nytår (5.8, P6) har »OK« og »Vælg anden« (`overlay_choice`). To afsnit i SPEC siger nu to ting.
- **Rettelse:** skriv 4.11 som: sprunget uge og tre uger forklares på I dag (3.1), status sættes under Status (3.6), og »OK« og »Vælg anden« gælder jul og nytår (5.8).

### L4 (lav): »Ugerne er ikke gennemførte« passer ikke på en kort status

- **Hvor:** `src/ui/life/StatusForm.tsx:28` (»Ugerne under sygdom er ikke gennemførte.«) og `:37` (»Ugerne er ikke gennemførte. Vil du træne i ferien, så sæt ikke ferie.«).
- **Hvorfor:** ENGINE 4 (»Gennemført uge«): ugen er gennemført med ét A, B eller rejsepas med par 1 logget. Syg onsdag–torsdag eller ferie lørdag–søndag efter tirsdagens A giver en gennemført uge, men skærmen siger det modsatte og kan få ham til at lade være med at sætte en kort ferie, så appen planlægger pas på feriedagene.
- **Rettelse:** fx »Syge- og feriedage gennemfører ikke ugen: den tæller kun med Styrke A, B eller rejsepasset på en anden dag.« (for ferie også »Vil du træne i ferien, så sæt ikke ferie.«).

### L5 (lav): Ferie på en klubdag har ingen test

- **Hvor:** `e2e/status.spec.ts`, `src/ui/__tests__/status.test.ts`.
- **Hvorfor:** D67 (6) og SPEC 3.1 og 3.4: ferie er hvile, også på en klubdag, og I dag og Uge viser »Ferie« og ingen Muay Thai. Testene ser kun »Lørdag: Ferie: hvile« i »Resten af ugen«; hovedkortet »Ferie« med »Ret status«, Uges chip og søndagstjekket under en ferie er ikke prøvet. Egne flows viser, at det virker (`review-p5c-pixel9a-ferie-soendag.png`).
- **Rettelse:** et flow i `e2e/status.spec.ts`: ferie lørdag–mandag → lørdag og mandag er »Ferie« med »Ret status« og uden Muay Thai i Uge, søndag er hovedkortet søndagstjekket med ferien i kortet over.

## Opfølgning

2026-11-10 · 6fcbc0a, 2379344, 85bb19c og 25280da (D70, R33, ENGINE 3.1, 8 og 9 med S-WEEK-14, SPEC 3.1, 3.6, 4.6, 4.7 og 4.11) · worktree på 25280da. Slutrunden i P5a og P5b (75c4323–91cd51a) ligger imellem; andre har tjekket den.

Metode:

- **Kørt** i worktreen:
  - `npm test`: 822/822. `npm run typecheck` og `npm run lint`: rene.
  - `e2e/status.spec.ts` i `pixel9a` og `pixel9a-utc` (`E2E_PORT=4187`): 22/22.
  - `life`, `moves`, `tabs`, `no-source-refs` og `design` i begge projekter: 47/47.
- **Egne flows** i begge projekter (10/10, scratch):
  - M1's rejse og sygdom fra reviewet;
  - ferie foran en kommende ferie, og hullet mellem to syge perioder (N1);
  - syg på en rejse, og så rejsen gjort kortere (N2);
  - klubloggen på en rejsedag og dagen efter.
- **Skærmbilleder** i `screenshots/` (`pixel9a`; `-utc`-udgaverne er ens):
  - `review-p5c-opf-pixel9a-ferie-foran.png`
  - `review-p5c-opf-pixel9a-syg-paa-rejse.png`
  - `review-p5c-opf-pixel9a-syg-paa-rejse-i-dag.png`

### Status på fundene

- **M1 rettet:**
  - Rejsen 9.–20., der onsdag gøres kortere til fredag 13., gælder kun til den 13. Skærmen siger »Retter Rejse til og med fredag 20. november: nu til og med fredag 13. november.«. Tirsdag 17/11 er Styrke A uden statuskort, og fredag 20/11 er Styrke B.
  - En sygdom, der forlænges onsdag, står som én periode med ét »Afslut«. »✓ Syg er afsluttet. Fra i dag gælder den almindelige plan.« passer nu: hovedkortet er Muay Thai, og tirsdag står stadig som syg i Uge.
  - »Afslut« siger før og efter trykket, hvad der stadig gælder (»Afslut, så gælder Rejse stadig til og med …«).
- **M2 rettet:** programmets »Feber eller ondt i kroppen: hvil. Kun forkølet over halsen: Open & Strong og en gåtur.« står på Status, på kortet »Syg« og i statuskortet, og »I morgen« siger »Syg: hvil eller Open & Strong og en gåtur«.
- **L1 rettet:** på en rejsedag kommer »Hvordan var det?« efter klubtiden, og »Muay Thai i går« står dagen efter. Søndagstjekket har lørdagskarakteren på en rejselørdag (SPEC 4.6 og 4.7 er rettet med).
- **L2 rettet:** når dagens pas er logget eller i gang, står kun »I morgen: Kamp.« (`eventLine`). Begivenhed siger »Dagens pas er logget, så det ændres ikke.«.
- **L3 rettet:** SPEC 4.11.
- **L4 rettet:** »Syge- og feriedage gennemfører ikke ugen: den tæller kun med Styrke A, B eller rejsepasset på en anden dag.«.
- **L5 rettet:** e2e-flowet ferie lørdag–mandag.

**S-WEEK-14 og data:**

- Scenariet i ENGINE 8, rækken i 3.1 og testen siger det samme, og programmet har ingen regel, det går imod.
- `statusChange` skriver kun `status_set`: ingen ny hændelse, intet nyt felt og ingen migration. P5c er ikke udgivet, så ingen rigtig log har en status.
- De dage, der er gået, står som før:
  - En periode, der gælder, afsluttes i går på sin plads.
  - En kommende periode fjernes.
  - Den rettede periode skrives fra i dag.
- De to hændelser skrives i én transaktion og i rækkefølge (fjernelsen før den nye), og »Flet« sorterer stabilt efter `at`. Rettelsen kan derfor ikke miste eller forvanske de dage, der er gået, heller ikke efter en import.
- Dobbelttryk-spærren og tidsmaskinen holder stadig (testene består).

### Nye fund

#### N1 (lav): En periode foran en kommende af samme slags skærer den kommende af

- **Hvor:** `src/engine/status.ts:40–43`: den rettede periode slutter altid på den nye sidste dag.
- **Hvorfor:**
  - D70 og SPEC 3.6: en ny status, der overlapper eller støder op til en af samme slags, retter den, »fra den gamles første dag til den nye sidste dag«. Det er rigtigt, når den nye ligger i eller efter den gamle. Ligger den foran, forsvinder den gamles dage.
  - **Ferie:** ferie 21.–27. november står allerede. Vælger brugeren ferie 18.–20. (tre dage mere foran), er resultatet kun 18.–20., og 21.–27. er væk. Skærmen siger »Retter Ferie fra lørdag 21. november til og med fredag 27. november: nu fra onsdag 18. november til og med fredag 20. november.« (`review-p5c-opf-pixel9a-ferie-foran.png`), men ikke, at 21.–27. forsvinder.
  - **Hullet:** syg 12.–13. og 16.–17., og så syg 14.–15. Resultatet er 12.–15., og 16.–17. er væk.
  - **Julen:** samme sker med »Klubben lukket« 24/12–3/1, hvis 21.–23/12 lægges til bagefter.
  - Dage, der er gået, rammes aldrig, og skærmen viser resultatet. Derfor lav.
- **Rettelse:**
  - En rettet periode, der begynder efter den nye sidste dag, beholder sin egen slutdag (`to` = det seneste af den nye `to` og dens `to`). Så føjer en periode foran eller i et hul sig til i stedet for at skære af.
  - Tilføj ferien og hullet til S-WEEK-14.

#### N2 (lav): En rejse, der gøres kortere, tager de syge dage, der blev sat under rejsen

- **Hvor:** `src/engine/status.ts:42`: den rettede periode skrives altid som den nyeste.
- **Hvorfor:**
  - Eksemplet: rejse 9.–20. november. Torsdag 12/11 sættes syg til og med fredag 13. Samme dag rettes rejsen til fredag 13., fordi han tager hjem.
  - Bagefter er torsdag og fredag rejsedage. Hovedkortet torsdag er »Motor« og fredag »Rejsepas« i stedet for »Syg« (`review-p5c-opf-pixel9a-syg-paa-rejse-i-dag.png`).
  - Skærmen siger det kun som tredje af fem linjer: »Gælder i stedet for Syg de dage, de overlapper.« (`review-p5c-opf-pixel9a-syg-paa-rejse.png`).
  - D70's egen forsigtigste læsning er, at »det, brugeren lige har valgt, gælder«. Han valgte en ny slutdag for rejsen, ikke at sygdommen hører op. At den nyeste gælder (ENGINE 5.1, trin 3), handler om, hvad han sidst sagde om dagene.
  - Når dagene igen sættes som syge, er det rettet, og intet går tabt. Derfor lav.
- **Rettelse:**
  - En rettelse, der kun flytter slutdagen tidligere, beholder sin plads: `status_set` med den gamle `from` og den nye `to`, som S-WEEK-13 afløser på stedet.
  - Kun en rettelse, der lægger dage til (som syg igen fra i dag over en rejse, S-WEEK-14), skrives som den nyeste.
  - Tilføj eksemplet til S-WEEK-14: torsdag og fredag er stadig syge dage.

### Kort tjek af N1 og N2

2026-11-10 · 7923e3f, 18b3437, c5adb54 og e17e5b5 (D71, R34, S-WEEK-14..16) på e17e5b5. Kørt: `npm test` 829/829 (S-WEEK-13..16 grønne i begge tidszoner), typecheck og lint rene, `status.spec` 24/24 og egne flows 14/14 i `pixel9a` og `pixel9a-utc`.

- **N1 rettet:** ferie 18.–20. foran 21.–27. giver to perioder (18.–27.); syg 14.–15. i hullet giver 12.–17.; klubben lukket 21.–23/12 foran 24/12–3/1 giver begge perioder. Et overlap (ferie 18.–22. over 21.–27.) retter til 18.–27.
- **N2 rettet:** rejsen, der rettes til fredag 13. efter »Syg« torsdag–fredag, beholder sin plads. Torsdag og fredag er »Syg«, og skærmen siger »Syg gælder stadig fra i dag til og med fredag 13. november.«. En rejse, der forlænges fra fredag, lader de syge dage stå.
- **M1 virker stadig:** rejsen 9.–20., der rettes til 13., giver Styrke A tirsdag 17/11 og Styrke B fredag 20/11, og den forlængede sygdom har ét »Afslut«.
- **Data:** `applyStatusSet` læser `status_set` som før; der skrives kun `status_set`, og de dage, der er gået, ændres aldrig. Ingen nye fund.
