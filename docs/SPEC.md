# SPEC.md – Comeback-appen

Version 1.1 · 5. november 2026 · Produktspecifikation (rettet efter gennemgang mod PDF'en, se `DECISIONS.md` afsnit 6). Træningsreglerne står i `ENGINE.md`; milepælene i `PLAN.md`; beslutningslog i `DECISIONS.md`.

## 1. Formål

Comeback er en lokal, offline webapp til én bruger på en Pixel 9a. Den overtager alt tænkearbejdet i 12-ugers-programmet »Comeback – sekundærtræning til Muay Thai« (`PROGRAM_KILDE.md`): den viser, hvad der skal laves i dag, guider passet med timere, logger med få tryk og implementerer programmets regler for progression, trafiklys, lette uger, målinger og fravær. Programmet er den faglige sandhed; appen ændrer aldrig indholdet.

### Målbare succeskriterier

| ID | Kriterium | Måles ved |
|---|---|---|
| SK1 | Dagens plan er synlig uden tryk, under 1 sekund efter åbning fra ikonet (varm start) | Stopur på telefonen; Playwright-test af render uden netværk |
| SK2 | Et sæt logges med ét tryk i normaltilfældet (»som planlagt«), to tryk hvis reserven afviger | UI-test: klik-tælling pr. flow |
| SK3 | Hold-øvelser, EMOM, intervaller og Open & Strong kører uden berøring af skærmen fra start til slut | Telefon-tjekliste |
| SK4 | Ingen data tabt efter lukning, genstart af telefonen, opdatering af appen eller opdatering af IronFox | M0-probe og M2-tjekliste |
| SK5 | Hver beslutning fra motoren vises med én forklarende sætning | Motor-test: alle `step_changed`-hændelser har `explanation` |
| SK6 | Alle regler i `ENGINE.md` har mindst ét automatisk testscenarie, og alle scenarier er grønne | `npm test` |
| SK7 | Programdata indeholder alle trin fra `PROGRAM_KILDE.md` | Konverteringstest (`program.spec.ts`) |
| SK8 | Eksport + import genskaber hele tilstanden byte for byte | Motor-test `S-DATA-02` |
| SK9 | Hele appen vejer under 150 kB komprimeret JavaScript | Build-rapport |

## 2. Platform

**Valg:** PWA i IronFox, installeret fra menuen (»Installér«/»Føj til startskærm«), hostet som statiske filer på GitHub Pages fra et offentligt repo. Fallback i rækkefølge: (1) samme PWA i Vanadium, (2) samme webkode pakket som Android-APK med Capacitor, bygget af GitHub Actions. Valget afgøres af milepæl 0. **Afgjort 5/11: IronFox-PWA** (`DECISIONS.md` D19).

**Verificeret (websøgning 5/11 2026):** IronFox 159.0.1 findes og bygger på Firefox 159.0. IronFox' standard: JIT fra, WebGL fra, locale spoofet til en-US, lyst tema til websider, notifikationsprompter blokeret, begrænset adgang til systemfonte, disk-cache fra, tidszone-spoof til UTC-0 er en valgfri indstilling. Firefox for Android kan installere PWA'er, som åbner i egen session med eget ikon. Screen Wake Lock er slået til som standard i Firefox fra version 124/126, også Android. `navigator.storage.persist()` i Firefox giver en brugerprompt på desktop. Pixel 9a: 1080 × 2424 px, 6,3", 422 ppi; forventet viewport ca. 412 × 915 CSS-px (pixelratio 2,625).

**Skal testes på telefonen i M0 (ikke verificeret):** om IronFox har beholdt PWA-installation; om service worker-cache og IndexedDB overlever lukning, genstart og opdatering af IronFox; om indstillingen »Slet browserdata ved lukning« er slået til (den ville slette appens data); om `persist()` viser en prompt eller afvises stille på Android; Wake Lock i IronFox (kan være lukket af hærdning); vibration; Web Audio-lydstyrke med telefonen på gulvet; Web Share; download og upload af filer; faktisk viewport; opstartstid uden JIT; `Intl` med eksplicit tidszone og `da-DK`, uanset spoof.

**Målt i M0 (5/11, IronFox 159.0.1, `probe/RESULTS.md`):** PWA-installation og standalone virker; IndexedDB og localStorage overlever lukning og genstart (»Delete browsing data on quit« er slået fra); `persist()` giver en prompt; opdatering med »Ny version klar« virker uden datatab; Wake Lock og fallback-videoen holder skærmen tændt; lyden høres fra gulvet; `navigator.vibrate` og Web Share findes ikke; tidszone Europe/Copenhagen, sprog en-US (spoofet), `da-DK` og `en-CA` virker eksplicit; viewport 414 × 847 CSS-px med devicePixelRatio 2 i standalone; urets opløsning 16,7 ms. Konsekvenser: ingen vibration (D21), ingen »Del«-knap (D22), layout og Playwright-profil til 414 × 847 (D25).

### Udrulning og opdatering

- `main` bygges af GitHub Actions og udgives til GitHub Pages. Opus udgiver aldrig manuelt.
- Service worker med precache (vite-plugin-pwa, `registerType: 'prompt'`). Når en ny version er hentet, viser appen et banner »Ny version klar – opdatér«. Appen genindlæser aldrig af sig selv, og aldrig under et pas.
- Versionsnummer (git-tag + build-dato) vises under Mere → Om. Datamigrationer kører ved start, før første skærm tegnes, og tager altid en backup-kopi i IndexedDB først (`backup_before_migration`).
- Repoet indeholder intet navn, ingen klub, ingen logdata, ingen PDF med personlige oplysninger. Programdata og piktogrammer er ok.

## 3. Navigation og skærme

Fire faner i bunden: **I dag · Uge · Stiger · Mere**. Et aktivt pas åbner som fuldskærm oven på fanerne og kan kun forlades via »Afslut pas« (bekræftes) eller »Hold pause«.

### 3.1 I dag (startskærm)

```
┌──────────────────────────────────────┐
│ Tirsdag 10. nov · Uge 1 · Fundament  │
│ ┌──────────────────────────────────┐ │
│ │ STYRKE A           ca. 55 min    │ │
│ │ Power ben · Pres/Træk · Ben/Bag- │ │
│ │ kæde · Lyske/Mave/Læg · EMOM E1  │ │
│ │                                  │ │
│ │ [ START PASSET ]  (56 px høj)    │ │
│ └──────────────────────────────────┘ │
│ Open & Strong · 6 min      [Start]   │
│ ─────────────────────────────────── │
│ I morgen: Muay Thai 18–19.30         │
│ Resten af ugen ▾ (foldet sammen)     │
│ ─────────────────────────────────── │
│ ⓘ Sidste backup: 4 dage siden        │
└──────────────────────────────────────┘
```

- Hovedkortet viser dagens pas med varighed og en linje pr. blok med dit trin (fx »Pres trin 1 · 2 × 6«). På en Muay Thai-dag viser kortet klubtiden og, efter sluttid, knappen »Hvordan var det?« (se 4.6). På søndag viser kortet »Søndagstjek · 2 min«.
- Et pas, der ikke blev logget i går, giver i dag ét kort: »Styrke A i går blev ikke logget – Flyt · Spring over«. »Flyt« viser kun de gyldige dage (`ENGINE.md` 5.9), fx »Torsdag (motoren udgår)« eller »Kort version i dag«. Ingen streaks, ingen røde tal.
- Backup-linjen vises kun, når sidste backup er over 7 dage gammel eller efter en måleuge.
- Tom tilstand (før onboarding): kun onboarding-flowet (4.1).

### 3.2 Guidet pas

```
┌──────────────────────────────────────┐
│ Par 1 · 2/4          ⏸ Pause   ✕    │
│ PRES · Trin 1 · Push-up med tempo    │
│ ┌────────────┐                        │
│ │ piktogram  │   Sæt 2 af 2           │
│ │            │                        │
│ └────────────┘   mål 6 · reserve 3    │
│                                      │
│              6                       │   ← 96 px tal
│            reps                      │
│                                      │
│ 3 sek ned · 1 sek stille i bunden    │   ← 1–2 cues
│ ▸ Hvorfor                            │   ← foldet
│ ┌──────────────────────────────────┐ │
│ │ ✓ SOM PLANLAGT (6 · reserve 3)   │ │   ← 64 px, bund
│ └──────────────────────────────────┘ │
│  [ − ]  [ reps: 5 ]  [ + ]  [smerte] │
│  Reserve:  [ ≤1 ]  [ 2 ]  [ 3+ ]     │
└──────────────────────────────────────┘
```

- Ét skridt ad gangen i skabelonens rækkefølge (opvarmning → power → par/tri-sæt → finisher → nakke). Par og tri-sæt skifter automatisk mellem øvelserne: A1, pause, B1, pause, A2 …
- **Logning:** »Som planlagt« logger målet og den planlagte reserve. Afvigelser rettes med −/+ og reserveknapperne, før man trykker. Smerte-knappen åbner tre valg: »Let (≤3)«, »Skarp eller i et led«, »Stop øvelsen«.
- **Pausetimer** starter af sig selv, når et sæt er logget, med stor nedtælling, lyd ved 3-2-1 og en markant slutlyd. Næste sæt vises under timeren, så man kan læse, mens man hviler.
- **Hold-øvelser** (planker, wall sit, hollow, Copenhagen, håndstand): timeren starter efter en 5-sekunders nedtælling (»klar – 5 – 4 …«), tæller holdet ned, siger til ved halvvejs og ved 3-2-1 og logger selv »som planlagt«, når tiden er gået. Pausen starter straks. Man rører kun skærmen, hvis man måtte stoppe før tid (»Stoppede før tid« → indtast sekunder).
- **EMOM:** stor minutviser, antal burpees i minuttet, lyd ved hvert nyt minut og ved 10 sekunder tilbage. Til sidst to spørgsmål: »Alle minutter rene?« og »Mindst 20 sek pause i sidste minut?«.
- **Klubsekvensen:** fem faser med 3-sekunders hold som timer, mikro-pumps tælles af dig. Til sidst: »Ren runde?«.
- **Power:** reps logges som planlagt; til sidst ét spørgsmål: »Alle hop/reps lige høje og hurtige?«.
- **Nakke-stigen:** til sidst: »Let · Passende · Hårdt«.
- **Motor:** faser som timer (opvarmning 10 min, 3 stigningsløb, hoveddel efter fase, 5 min nedjogging); 30/15 og kamp-runder med lyd ved hvert skift, 10-sekunders eksplosioner og all-out. Base-pas: ét samlet ur og distance-felt til sidst (valgfrit).
- **Wake Lock** aktiveres ved start af pas og frigives ved afslutning. Fallback: probens tavse, loopede 64 × 36 px-video med lydspor (`DECISIONS.md` D16, D24), hvis API'et afvises.
- »Hvorfor« viser kildens korte begrundelse (fx evidens-boksen) og PDF-sidetal.
- **Hold pause** fryser timere. **✕** spørger »Afslut passet? Det, du har logget, gemmes«.

### 3.3 Trafiklys (før hvert pas, undtagen Open & Strong)

```
┌──────────────────────────────────────┐
│ Før du starter – 10 sekunder         │
│ Sovet mindst 6 timer?       [JA][nej]│
│ Fri for ledsmerter, kun let øm? [JA][nej]│
│ Opvarmning og første hop normale?    │
│                              [JA][nej]│
│ ⓘ I går var klubtræningen hård.      │
│                                      │
│ [ Rød: syg, feber, skarp smerte ]    │
│ [ GRØN – kør passet ]   (afledt)     │
└──────────────────────────────────────┘
```

Primærknappen står nederst, hvor tommelfingeren rammer først, og rød-knappen over den (rettet efter designgennemgangen, `docs/reviews/m2-design-review.md` D8). I et pas står »Som planlagt« og de øvrige handlinger i en fast bundblok, så de ligger samme sted på hvert sæt; en knap, der vises efter et skift af skærm, kan først trykkes efter et halvt sekund (D1, D2).

- Alle tre står på »ja« som standard. Spørgsmål 2 står på »nej«, hvis der er logget skarp smerte inden for 2 dage eller søndagstjekket har noteret smerte, der ikke gik væk. Spørgsmål 3 kan først besvares efter opvarmningen: skærmen vises før opvarmningen med spørgsmål 1–2, og spørgsmål 3 dukker op efter opvarmningens trin 4.
- Resultat: grøn → planlagt pas; gul → minimumsdosis (par 1 og par 2, 2 sæt, reserve 3, ingen power, ingen burpees, nakke udgår), ca. 25 min; rød → kun Open & Strong og en gåtur, passet markeres rødt. Motor på gul dag → rolig base 30 min. Rød-knappen hedder »Rød: syg, feber, skarp smerte eller under 4 timers søvn« (PDF s. 7).
- Hinten om gårsdagens klubtræning vises, når gårsdagens klublog var »Hård«. På styrkedage ændrer den intet automatisk; på en motor-dag med intervaller bliver rolig base standard med valget »Kør intervallerne alligevel« (`ENGINE.md` 5.2).

### 3.4 Uge

Syv rækker som PDF side 6 med chips: pas, varighed, status (✓ logget, ◐ gult, – sprunget, tomt). Et tryk på et pas giver »Flyt til …« (kun gyldige dage, se `ENGINE.md` 5.9), »Spring over« og »Kort version (30 min, par 1 og 2)«. Øverst: programuge, fase, ugens sæt/reserve, EMOM-loft, motorens indhold. Ekstra Muay Thai-dage tilføjes under Mere → Ugeplan.

### 3.5 Stiger

Liste over de ti stiger og tre power-spor med nuværende trin, niveau-badge (Basis/Stærk/Imponerende/Boss) og afstanden til næste trin som tekst: »1 pas mere med 3 × 12 og 2 i reserve«. Et tryk åbner stigen: alle trin, dosis og udførelse, dit trin markeret, piktogram pr. trin (fallback: stigens nærmeste piktogram + tekst), og knappen »Vælg selv et andet trin« (advarsel én gang, logges som dit valg). Sidegrene vælges her (højst én aktiv).

### 3.6 Mere

- **Historik:** liste af pas med dato, status, trafiklys og tryk-for-detaljer (sæt, reps, reserve, smerte, forklaringer). Klubtræninger med indhold og hårdhed. Fremgangskurver pr. stige (trin over tid) og målingerne som tabel U1/U4/U8/U12 mod Målbrættets niveauer.
- **Målinger, Målbræt, Hero-tavle, Imponer-katalog, Boss-udfordringer:** se afsnit 4.8–4.10.
- **Ugeplan:** klubdage (standard man/ons/lør), tider, valgfri clinch. Ændringer flytter de sekundære pas efter reglerne i `ENGINE.md` 5.10.
- **Status og begivenheder:** »Syg«, »Rejse«, »Ferie/pause«, »Klubben lukket« med datointerval; »Begivenhed« (fx kamp) med dato – dagen før spærres for tunge ben, Nordic og intervaller.
- **Backup:** »Eksportér backup« (download til Downloads, filnavn `comeback-backup-YYYY-MM-DD.json`), ingen »Del backup« (Web Share findes ikke i IronFox, `DECISIONS.md` D22), »Importér backup« (filvælger → forhåndsvisning: antal hændelser, periode, programversion → »Erstat alt« eller »Flet«).
- **Kalender (.ics):** »Download kalenderfil« med ugentlige gentagelser: tirsdag Styrke A, torsdag Motor, fredag Styrke B, søndag Søndagstjek, med de klokkeslæt du vælger. Ingen notifikationer i appen.
- **Turbo** (fra uge 5, valgfri): vælg én øvelse; dagstæller 0–5 lette sæt.
- **Om:** version, programversion, kilder (PDF side 54 som links). Langt tryk på versionen i 2 sekunder åbner **Tidsmaskinen**.
- **Diagnose** (under Om, `DECISIONS.md` T6): version, programversion, service worker, spejlets status (antal hændelser og hvornår det sidst blev gemt, eller fejlen), varigt lager, lagerplads, Wake Lock, lyd, viewport, tidszone, sprog og opstartstiden fra ikonet (afsnit 7).

### 3.7 Tidsmaskinen (skjult)

Vælg en dato (standard i morgen). Appen genstarter i simuleret tilstand med et rødt banner »SIMULERET · 24. dec 2026 · Afslut« og arbejder på en kopi af hændelsesloggen i hukommelsen. Alt kan prøves, inkl. logning af pas og dage fremad (»+1 dag«). Intet skrives til den rigtige log; »Afslut« kasserer kopien. Lageret åbnes skrivebeskyttet, mens simuleringen kører (motor-test `S-TIME-01..03`).

## 4. Brugerflows

### 4.1 Første start og indfasning (under 5 minutter)

1. Velkomst: én skærm, én knap.
2. Startdato (standard 9. november 2026).
3. Uger siden start: en række pr. kalenderuge med »Gennemført · Ikke gennemført« (standard: gennemført). Det afgør programugen (regel R-WEEK).
4. Trin pr. stige: de ti stiger, rotationsstigen (Mave 2), de tre power-spor (power ben, power overkrop, burpee-trin E1–E9), klubsekvensen (C1–C6) og nakke-stigen (N1–N6), hver med en vælger (standard trin 1, E1, C1 og N1) og hjælpeteksten »Det sværeste trin, hvor du kan lave 3 sæt i bunden med perfekt form og 2–3 i reserve. I tvivl: et trin lavere«. Valgfrit felt »seneste reps/sek« pr. stige, som sætter arbejdstallet.
5. Målinger fra uge 1 og, hvis de er taget, uge 4 (valgfrit): væg-test, push-ups, bord-rows, pike, hollow, sideplanke, wall sit, balance, base-distance (uge 4 også burpee-test og Cooper).
6. »Færdig« → I dag. Alt gemmes som `onboarding_completed` plus `step_set`-hændelser med begrundelsen »Valgt ved start«.

Pas for pas bagud udfyldes ikke; kan tilføjes i Historik → »Tilføj pas bagud« (status og dato, ingen sæt).

### 4.2 Normalt styrkepas

Start passet → trafiklys → opvarmning (fire trin som timer, 8 min) → spørgsmål 3 → power → par 1 → par 2 → tri-sæt/par 3 → finisher (EMOM eller klubsekvens) → nakke → opsummering. Opsummeringen viser: logget vs. planlagt, motorens beslutninger med forklaring (»Pres: 1 pas mere med 2 × 12 → trin 2«), smerte-flag og én knap »Færdig«. Passet gemmes løbende; lukkes appen midt i et pas, fortsætter den samme sted ved næste åbning (samme dag).

### 4.3 Gult og rødt pas

Gul: samme flow, kortere skabelon; opsummeringen siger »Gult pas tæller som gennemført«. Rød: I dag viser kun Open & Strong og »Gåtur«. Passet logges `red` og kan ikke flyttes til senere samme dag.

### 4.4 Open & Strong

Seks øvelser som ét sammenhængende ur: brystryg 3 × 3 vejrtrækninger (styret af lyd), åben bog 5 pr. side (tællende lyd hvert 4. sek), Y-løft 2 × 8 med 2 sek hold, wall slides 8, hage-ind 8 × 5 sek, couch stretch 45 sek pr. side. Efter fire gennemførte uger ændres Y-løftets cue til »med to små vandflasker«. Kan startes fra alle skærme. Logges som `os_done`; ingen streak vises, kun »denne uge: 5 af 7«.

### 4.5 Motor

Trafiklys → fase-timer efter programuge → afslut med valgfri distance (base/Cooper). Gul dag → rolig base.

### 4.6 Klubtræning og lørdagskarakter

Efter klubtidens slutning (eller næste dag) viser I dag-kortet »Hvordan var det?«: indhold som chips (Teknik · Power · Fart · Sparring · Mix), hårdhed (Let · Middel · Hård), overskud (Frisk · OK · Flad). Lørdag også: »Teknikken i sidste runde: 1–10«. Alt valgfrit; »Jeg var der ikke« logger fravær. Standard uden svar: mødt, intet indhold.

### 4.7 Søndagstjek (2 min)

Fire felter: timer søvn i snit (tal), lørdagskarakteren (udfyldt hvis logget), »Gør noget ondt, der ikke gik væk?« (nej/ja + vælg øvelse), og listen »Klar til næste trin« (afledt) med »For tungt?« pr. stige. Svarene påvirker trafiklysets spørgsmål 2 og regel R-PAIN-SUNDAY.

### 4.8 Lette uger og målinger

I uge 4, 8 og 12 (programuger) viser I dag »Let uge – målinger«. Målingerne er indbygget i passene som første sæt af den relevante øvelse: tirsdag væg-test, push-ups max, bord-rows max, burpee-test 3 min (erstatter EMOM); torsdag Cooper (valgfri) eller base-check; fredag pike max, hollow max, sideplanke max pr. side, wall sit max, balance. Hver måling viser forrige værdi og Målbrættets niveau. Uge 1 har samme målinger som nulpunkt. Efter ugens sidste pas: »Ryk op«-oversigt for stiger, der nåede toppen.

### 4.9 Hero-tavlen og imponer-kataloget

Hero-tavlen: tolv felter, hver med »Kryds af« (din erklæring) og en automatisk hint, når loggen viser, at kravet er nået. Imponer-kataloget: alle varianter med adgangskrav; låste viser kravet som tekst (»Klar når: Pres trin 2«), ulåste kan vælges som fredagens 5-minutters variant efter klubsekvensen. Niveauskift (Basis → Stærk osv.) fejres med én fuldskærms-bekræftelse, ikke konfetti-animationer.

### 4.10 Boss-udfordringer

Fra uge 11, kun på grøn dag, aldrig dagen før en registreret begivenhed. Vælges i stedet for EMOM om tirsdagen; resultat logges med niveau (Stærk/Imponerende).

### 4.11 Livet

- **Sprunget pas:** se 3.1. **Sprunget uge / tre uger / sygdom / rejse / klubben lukket / jul og nytår:** reglerne i `ENGINE.md` 5.7–5.8; appen foreslår én løsning i et kort med »OK« og »Vælg anden«.
- **Rejse:** I dag viser »Rejsepas · 25 min« (push-ups, rygsæk-row, split squats, 6 min EMOM) som eneste styrkepas.
- **Jul 2026:** I ugen fra 21/12 foreslår appen motor onsdag 23/12 (rolig base) og Styrke B lørdag 26/12 (alternativ 27/12). I ugen fra 28/12 foreslår den målinger 29–30/12 (alternativ 2–3/1). »Klubben lukket« erstatter Muay Thai med 4–5 kamp-runder hjemme.

### 4.12 Backup, import og opdatering

Efter hver måleuge og hver 7. dag uden backup viser I dag backup-linjen. Eksport skriver én JSON-fil med hele loggen, skemaversion og programversion. Import viser forhåndsvisning før noget ændres og tager først en intern backup. Opdatering: banner, aldrig under et pas.

### 4.13 Tomme tilstande og fejl

| Situation | Hvad vises |
|---|---|
| Ingen historik | »Dit første pas bliver dit nulpunkt« |
| Lageret kan ikke skrives | Rød linje øverst: »Kan ikke gemme – eksportér backup nu«, eksportknap. Passet fortsætter i hukommelsen |
| Lyd blokeret (ingen brugergestus) | Lyd aktiveres ved »Start passet«-trykket; hvis det fejler: »Tryk for at slå lyd til« |
| Wake Lock afvist | Lille ikon »Skærm kan slukke« + fallback-video |
| Import af ugyldig fil | »Filen er ikke en Comeback-backup« med årsag |
| Importfil fra nyere skemaversion | Afvises med »Opdatér appen først« |
| Programversion ændret siden sidst | Én gang: »Programmet er opdateret til v2 – dine trin er bevaret« |

## 5. Designsystem

**Identitet:** PDF'ens: thai-rød og navy (»rødt og blåt hjørne«), Kanit til overskrifter og store tal, Bai Jamjuree til brødtekst. Alle farver kommer fra `design-tokens.json` i starter-kittet som CSS-variabler med filens navne (`--c-red`, `--c-navy`, `--c-blue`, `--c-gold`, `--c-ink`, `--c-muted`, `--c-panel`, `--c-line`, `--c-paper` = #FFFFFF, `--c-green` og `--c-amber` til trafiklyset osv.). Ingen andre farver, heller ingen sand- eller cremetoner.

**Tema:** ét eksplicit lyst, højkontrast-tema. Ingen `prefers-color-scheme`-afhængighed (IronFox melder altid lyst). Baggrund ren hvid; tekst navy; primærknap rød med hvid tekst; sekundær navy-outline; gul og rød trafiklys-tilstande med egne nuancer fra tokens. Mørkt tema er ikke i v1.

**Typografi:** Kanit 700 til tal (64–96 px i pas, 32 px på kort) og overskrifter (28/22 px); Bai Jamjuree 400/600 til tekst (18 px minimum i pas, 16 px ellers). Linjehøjde 1,3. Selvhostede woff2 fra `public/fonts`.

**Layout:** 414 px bred portræt (målt i M0: 414 × 847 CSS-px, `DECISIONS.md` D25); sikker zone 16 px; primær handling altid i bunden (tommelfinger) med 64 px højde; øvrige trykflader mindst 56 × 56 px og 8 px afstand. Ingen swipe-kun-gestus, intet dobbelttryk, intet langt tryk undtagen tidsmaskinen. Kort med 12 px hjørner, 1 px navy/10 % kant, ingen skygger over 2 px.

**Komponenter:** Dagskort, Pas-skridt (piktogram + tal + cues), Reserve-vælger (tre knapper), Pausetimer (ring + tal), Hold-timer, EMOM-ur, Trafiklys-række, Stige-liste, Niveau-badge, Måle-felt med forrige værdi, Banner (opdatering, simulering, lagerfejl).

**Piktogrammer:** SVG'erne fra `pictos/` i navy/lilla/rød som i PDF'en, 120 × 120 px i pas. Trin uden eget piktogram bruger stigens nærmeste (fx `one_arm_push_up` for trin 5–7 i Pres) plus udførelsesteksten. Kortlægning i `program/pictos.json`; manglende tegnes i den valgfri milepæl 6.

**Lyd:** syntetiseret via Web Audio: tik (880 Hz, 60 ms) ved 3-2-1, »go« (to toner 660→990 Hz, 200 ms), »slut« (tre toner), minutskifte i EMOM (én lang tone). Ingen vibration: `navigator.vibrate` findes ikke i IronFox (`DECISIONS.md` D21). Appen beder ved pas-start: »Skru op for medielyden« første gang.

**Mønstre, der skal undgås (Opus):** creme/off-white baggrund; kursive accentord i overskrifter; nummererede »01/02/03«-labels; monospace-labels; pilleformede knapper (brug 12 px hjørner); gradienter og glas-effekter; dekorative ikoner uden funktion; konfetti/fyrværkeri; streak-flammer; skeleton-loaders (alt er lokalt); karruseller; modale dialoger til almindelig logning; placeholder-tekst i stedet for labels; tekst under 16 px; grå-på-grå; hover-afhængige elementer; emojis i UI-tekst.

## 6. Tilgængelighed og ergonomi

- Svedige fingre: store flader, ingen præcise gestus, knapper tåler et »klodset« tryk (ingen hurtigt skiftende knapper på samme sted; »Som planlagt« ligger altid samme sted).
- Telefonen på gulvet ca. 1 meter væk: tal på 96 px, cues 18–20 px, kontrast mindst 7:1 for al tekst i pas.
- Sollys: lyst tema, ingen tynde skrifter under 600 i vægt til vigtig tekst.
- Én hånd: alt vigtigt i nederste halvdel; fanelinje i bunden.
- Skærmlæser er ikke et krav, men alle knapper har tekst, ikke kun ikon.
- Ingen afhængighed af tale (ingen TTS).

## 7. Ydelse

- Preact + TypeScript + Vite; ingen UI-bibliotek, ingen animationsbibliotek, ingen dato-bibliotek (brug `Intl`). Budget: ≤ 150 kB gz JS, ≤ 30 kB CSS, fonte ≤ 200 kB i alt.
- Motoren afleder tilstanden fra loggen én gang ved start (hundredvis af hændelser, millisekunder selv uden JIT) og cacher øjebliksbilledet i hukommelsen; UI'et læser kun øjebliksbilledet.
- Timere bruger `performance.now()` + tidsstempler, ikke `setInterval`-tælling, så de er præcise efter en baggrundsperiode. Opdatering af visning højst 4 gange i sekundet.
- Ingen netværkskald efter installation. Ingen analytics.
- **Opstartstiden på Diagnose** (Mere → Om → Diagnose, `DECISIONS.md` D34) tæller kun en ren opstart fra ikonet. En indlæsning er en ren opstart, når alle fire gælder: (1) appen kører installeret, dvs. `matchMedia('(display-mode: standalone)')` matcher; (2) indlæsningen er en ny navigation med navigationstypen `navigate`, ikke en genindlæsning (`reload`), tilbage/frem (`back_forward`) eller en ukendt type; (3) I dag er den første skærm, appen viser; (4) hverken indfasningen eller tidsmaskinen har været i brug i samme indlæsning, før I dag er synlig. Målingen tages, når I dag er tegnet med sine fonte: første tegning (`first-contentful-paint`) og I dag synlig (mærket `cb-today`), begge i ms fra navigationens start. De seneste 5 rene opstarter gemmes på enheden i `localStorage['comeback.startup']`, uden for hændelsesloggen og uden for backup. Diagnose viser den seneste og medianen af de gemte og siger, om den aktuelle opstart talte med, og ellers hvorfor ikke. Er der ingen ren opstart endnu, står der: »Ingen måling endnu. Luk appen helt, og åbn den fra ikonet.«

## 8. Tid og sprog

- Alle datoer gemmes som `YYYY-MM-DD` i Europe/Copenhagen; »i dag« beregnes med `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen' })`, aldrig med `new Date().getDate()`. Ugen starter mandag. Et pas hører til den dato, det blev startet.
- Visning med `da-DK` eksplicit (»tirsdag 10. nov«, »1.500«, »3 × 6–12«), uanset browserens locale.
- UI-tekst på dansk, »du«; korte sætninger; ingen udråbstegn i instruktioner.

## 9. Data og backup

- **Programdata** (`program/*.json`): versioneret (`programVersion`), stabile ID'er for spor, stiger, trin, pas-skabeloner, uger og målinger (`ENGINE.md` 7). Konverteret fra `PROGRAM_KILDE.md` med en test, der tæller trin pr. stige mod kilden.
- **Brugerdata:** tilføj-kun hændelseslog (`ENGINE.md` 3). Primært lager IndexedDB (database `comeback`, store `events` + `meta`), spejl af seneste eksport-JSON i `localStorage['comeback.mirror']`. Ved start: læs IndexedDB; mangler den, men spejlet findes → gendan og vis »Data gendannet fra spejl«.
- `navigator.storage.persist()` kaldes efter første loggede pas (brugergestus), og resultatet vises under Mere → Backup.
- **Skemaversion** i `meta`; migrationer er rene funktioner `migrate_v1_v2(events)` med tests; før migration gemmes en kopi.
- **Eksportfil:** `{ app: 'comeback', schemaVersion, programVersion, exportedAt, events: [...] }`. Import validerer, viser forhåndsvisning og kan erstatte eller flette (hændelser med samme `id` ignoreres).
- Tidsmaskinen skriver aldrig til lageret.

## 10. Ikke med i v1

Mørkt tema, notifikationer, tale, flere brugere, synkronisering, Android-widget, grafik ud over simple kurver, imponer-videoer, kost-logning.
