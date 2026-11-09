# Piktogram-motoren

Python-koden fra starter-kittet (5. november 2026), der tegnede piktogrammerne i `public/pictos/`. Bruges kun i milepæl 6.

- `picto.py`: motoren. Koordinater er y-op med gulvet i y = 0; en figur bygges af hofte, overkrop og lemmer med to-leds invers kinematik, og `Canvas.svg(scale)` returnerer en SVG-streng.
- `poses.py`: positurerne.

Kræver kun Python 3 (ingen pakker). Eksempel fra repoets rod:

```python
import sys; sys.path.insert(0, "tools/pictos")
import poses
open("push_up.svg", "w").write(poses.push_up(1.0))
```

## Figurerne i appen (`content/figures/`)

Appens figursystem (`src/figure/`, `docs/SPEC.md` 9.1, `docs/DECISIONS.md` D48, D56 og D58) er en TypeScript-udgave af `picto.py`. En figurfil er data, ingen kode:

1. Skriv `content/figures/<spor>.json`: `{ "format": 1, "subject": "<spor>", "figures": [...] }` med én figur pr. forklaret punkt (og pr. bevægelse med `"movement": "<id>"`, når der er flere) og én keyframe pr. position i forklaringen.
2. `node scripts/check-explain.ts content/figures/<spor>.json` tjekker formatet og figuren (led, kontakter, glidning, rækkevidde, strakte led og billederne mellem positionerne). Den skal sige OK.
3. `node scripts/figure-sheet.ts content/figures/<spor>.json` tegner kontaktarket i `screenshots/figures/<spor>.png`. Se på det: kan en, der aldrig har set øvelsen, lave den ud fra positionerne? Se også på billedet midt i hver bevægelse (stiplet ramme), på vinklerne under hver position (180° = strakt), på markeringerne (rødt, med teksten i den størrelse, den får på kortet) og på fejlparrene.
4. `npx prettier --write content/figures/<spor>.json`.

Eksempler at kopiere fra (referencefigurerne): gulv og strakte arme i `press.json` (`press.1`), væg og en hofte, der glider ned ad den, i `wallsit.json` (`wallsit.W1`), stol, rygsæk i hånden og én støttehånd i `pull.json` (`pull.1`). Eksempler på vinkler, markeringer og fejl: `press.1` (pile, hjælpelinje og fejlparret »hoften hænger«), `power_legs.1` (squat jump fra siden og forfra med cue og knæ, der falder ind, set forfra) og `wallsit.W1` (vinklen 90° i holdet).

### Vinkler, markeringer og typiske fejl (D58)

Alt er valgfrit: en figur uden felterne er gyldig som før. Briefene fra trænerne siger, hvad hver figur skal vise; her står, hvordan det skrives.

**En anden vinkel** (`second`): samme bevægelse fra en anden side ved siden af figuren, med samme faser og samme ur. Brug den, hvor én vinkel ikke er nok: fra siden for hofte og ryg, forfra for knæ over tæer og sideværts bevægelser, ovenfra for albuer og fødders placering. Den har sin egen `view` (en anden end figurens), `facing` fra siden, `props` (påkrævet, også `[]`) og én keyframe pr. position; `highlight`, `transitions` og `marks` er valgfrie (de røde segmenter er figurens, hvis den ikke nævner sine egne). Den tjekkes som en figur for sig, og problemerne står som »power_legs.1 › forfra › land: …«. Eksempel fra `power_legs.1` (kort):

```json
"second": {
  "view": "front",
  "props": [],
  "keyframes": {
    "land": { "hip": [0, 42.41], "torso": 90,
      "arms": { "near": { "to": [4, 70], "bend": 1 }, "far": { "to": [-4, 70], "bend": -1 } },
      "legs": { "near": { "to": [9, 3.6], "bend": 1, "upper": 19, "lower": 21.5, "tip": [11.5, 1] },
                "far": { "to": [-9, 3.6], "bend": -1, "upper": 19, "lower": 21.5, "tip": [-11.5, 1] } } }
  },
  "marks": [{ "cue": "Knæ over tæer", "at": "land", "point": "near.knee", "place": "right" }]
}
```

- **Samme højder:** hoften og fødderne står i samme højde i begge vinkler. Forfra peger et lår mod beskueren og forkortes (`upper`, mindst 12), og knæene bøjer ud over tæerne med `bend` 1 på `near` og −1 på `far`. Fødder på gulvet står i samme punkt i alle positioner, ellers glider de.
- **Liggende eller skrå forfra** (sideplanke og lyske): kroppen skråt fra fødderne til hovedet. Den nære side er den nederste. Albuen står under den nederste skulder: `near` arm som `{ "joint": [x, 2.5], "end": [x + 8, 1.2] }` med x lige under skulderen (overarmen 16 lodret). Ved `side` er det overkroppens lange side, der rører gulvet, og `spine` bøjer forfra overkroppen til siden (+ mod den nære side) – fx en hofte, der hænger. Afprøvet i `src/figure/__tests__/check.test.ts` (»en sideplanke forfra«).

**Markeringer** (`marks`, i figuren og i `second`): det, der skal huskes, på det rigtige tidspunkt. Hver har én slags og enten `at` (en position: vises, mens figuren holder stille dér, i et hold eller en pause) eller `phase` (fasens nummer i forklaringens `phases`, talt fra 1: vises hele fasen). Der er én markering ad gangen i begge vinkler tilsammen, og hver ses mindst 0,4 sek i kortet.

- **Pil:** `{ "arrow": "chest", "phase": 1, "offset": [-7, 0] }` – en pil langs den vej, delen går i fasen (buet, hvis vejen buer; i en `repeat` med hoved i begge ender). Delene: `hip`, `shoulder`, `chest`, `head` og `near.`/`far.` + `hand`, `elbow`, `knee`, `foot`, `toes`. `offset` flytter pilen ved siden af kroppen (højst 30 hver vej). Kun i en fase, hvor figuren bevæger sig, og mindst 4 lang.
- **Vinkel:** `{ "angle": "near.knee", "at": "sit", "degrees": 90 }` – bue og gradtal ved `knee`, `elbow`, `hip` (overkrop–lår) eller `shoulder` (overkrop–overarm). Ved en position eller i et hold. `degrees` skal passe med vinklen, figuren tegner (højst 10° fra; kontaktarket skriver »tegnet 90°«). Pas på forkortede led: push-uppens albue er tegnet 52°, så den får ingen vinkel.
- **Cue:** `{ "cue": "Knæ over tæer", "at": "land", "point": "near.knee", "place": "right" }` – højst 3 ord ved et punkt (en del af kroppen eller `[x, y]`), uden punkt i tegningens øverste venstre hjørne.
- **Hjælpelinje:** `{ "line": ["near.foot", "shoulder"], "cue": "Én planke", "at": "bottom" }` – en stiplet linje mellem to punkter, evt. med en cue ved midten.

Teksten står i HTML i 18 px, så den kan læses fra gulvet; den er stor i forhold til figuren og flytter sig selv væk fra kroppen (først til den side, `place` siger, så de andre sider, over eller under kroppen og et hjørne). Kontaktarket viser den i den størrelse, den får på kortet. En positions markering står på positionens stillbillede, en fases på billedet af den position, fasen starter fra.

**Typiske fejl som figur** (`faults`): rigtigt og forkert side om side under fejlen på kortet. `mistake` er fejlens nummer i forklaringens `mistakes` (talt fra 1, som »typisk fejl nr. 1« i briefen), `at` positionen og `wrong` de felter i posen, der ændres; et lem i `arms` eller `legs` erstatter det rigtige. Et lem med `to` beholder sit punkt, så hænder og fødder står, når hoften flytter sig:

```json
"faults": [{ "mistake": 1, "at": "top", "wrong": { "hip": [45.4, 15.8], "torso": 30.75 } }]
```

- `"view": "front"` tegner fejlen i den anden vinkel (knæene, der falder ind i `power_legs.1`: benene med `bend` −1 på `near` og 1 på `far`).
- `contacts` siger, hvad den forkerte stilling rører, når fejlen ændrer det (en hæl, der letter); ellers positionens.
- Den forkerte stilling skal være mulig (leddene bøjer rigtigt, punkterne nås, intet går ind i en flade, kontakterne holder) og afvige mindst 3 synligt fra den rigtige. Den må gerne komme tæt på gulvet.
- **Strakte lemmer og hænder og fødder, der står:** en hofte, der hænger, gør vejen fra fod til skulder længere. Med strakte ben og arme skal skuldrene derfor ind over hænderne: `press.1`'s hofte hænger 5 under linjen med hoften i [45,4; 15,8] og `torso` 30,75 i stedet for [43,94; 20,33] og 20,84.

**Figuren skal bevæge sig synligt:** et tegnet punkt (også ansigtets mærke) flytter sig mindst 3 i hele bevægelsen, og hver fase til en anden position mindst 2 (`advance` tæller med). En lille bevægelse (hage ind, skulderblade) skal overdrives lidt; nakkens N1 og N2 venter derfor på dig (`docs/runs/NAT-3-FIGURES.md`).

**Bounds og spring med `advance`:** tegningen følger figuren, så den er næsten lige så stor som stående stille, og små mærker under gulvlinjen viser vejen. Står den til sidst i sin første stilling, står den et halvt sekund og begynder forfra ved start (et klip); den glider ikke baglæns.

### Det ser tjekket ikke

»OK« betyder, at led, kontakter og billederne imellem er mulige, ikke at figuren er rigtig. Se selv efter på kontaktarket:

- holdningen: en hængende hofte, en rund ryg, hvor den skal være lige, hovedets stilling;
- om figuren viser det, positionens tekst beskriver (ud over strakte led og kontakter);
- om den blå pil peger ud af brystet;
- om markeringerne peger det rigtige sted hen, og om deres tekst dækker det, den taler om;
- om fejlparret viser fejlen, som forklaringen beskriver den;
- billedet ovenfra (`"view": "top"`), hvor kun formatet tjekkes.

### Faldgruber

- Mål som piktogrammerne: skinneben 23, lår 24, overkrop 30, overarm 16, underarm 15, hals 11, hoved r 6,4. Arm højst 31, ben højst 47 fra skulder og hofte; et punkt mere end 1 uden for rækkevidde giver »når ikke sit punkt«.
- **Strakte led:** læg punktet på fuld længde eller op til 1 over (arm 31 fra skulderen, ben 47 fra hoften). Et punkt bare 0,4 inden for bøjer leddet 17°. Siger teksten »strakte arme«, »armen strakt«, »benene er strakte«, »strakt knæ«, »strakte knæ«, »knæ og ankler strakte«, »benet hænger strakt« eller »strakt standben«, afviser tjekket et led, der er bøjet over 5° (ental: mindst ét lem; flertal: alle).
- **`facing`** er den vej, brystet vender, når figuren drejes op at stå uden at spejle den: stående med brystet mod højre, push-up og planke med hovedet til højre og liggende på ryggen med hovedet til venstre er 1, en håndstand med brystet mod højre er −1. Den blå pil på kontaktarket skal pege ud af brystet. En forkert `facing` er den eneste måde, et knæ kan bøje forkert i sidebilledet; tjekket fanger den ved fødderne, ved et lår, der står over 70° bag kroppen, og ved brystet, der skal vende væk fra fladen, når ryggen rører den, og mod den ved mave og bryst.
- **Fødder:** i sidebilledet har hvert synligt ben `tip`, i alle positioner. Kontakt som i `poses.py`: håndleddet på fladen (y = 0 på gulvet), anklen 3,6 over med tåen `tip` 0,3 over (stående med brystet mod højre: tå 7,2 foran anklen; på tæerne: tå lige foran og under anklen), hoften 5 over, når man sidder eller ligger.
- **Fladerne:** gulvet i y = 0, stolesæde, bordplade, trappetrin og seng øverst i deres `height`, bøger i `at[1] + 2,4 × antal − 0,4`, puden 3,4 over `at`.
- I sidebilledet ingen `bend`: knæ og albuer bøjer selv ud fra `facing`. Kopiér aldrig `bend` fra `poses.py` (`squat_jump`, `bulgarian` og `chin_tuck` bøjer albuerne forkert). Undtagelse: en arm over hovedet må have `bend` 1 eller −1, men kun når teksten siger, at albuen peger den anden vej. Håndstand-push-uppen har ingen `bend`: albuerne peger skråt ud i rummet af sig selv, som teksten siger.
- **Forfra og ovenfra** vælger `bend` siden: 1 på `near` og −1 på `far` sender knæ og albuer udad. Brug samme `bend` i alle positioner, ellers skifter leddet side undervejs. Kan leddet ikke bøje til samme side i to positioner (hånden under hovedet og armen frem på sengen i `neck.N5 › side`), så giv overgangene en `via` med lemmet strakt imellem.
- **Ryg, mave og side:** kontakten betyder, at den del af overkroppen rører fladen; resten må løftes (hollow hold, sit-up, sideplanken på albuen).
- En hånd eller fod, der står på samme flade i to positioner, skal have samme punkt i begge, ellers »glider« den. Langs en væg og med et håndklæde (`attach`) må den glide. Skal den løftes og sættes et andet sted (et skridt, fødderne, der hopper tilbage, hænderne, der går), så skriv en overgang: `"transitions": [{ "from": "plank", "to": "lunge", "lift": ["near.foot"] }]`. Lemmet svinger da med leddenes vinkler og drejer fri af fladen med hånd, fod, knæ og albue. Overgangen gælder kun den vej; skriv også den modsatte, hvis bevægelsen går tilbage den vej. Slutter bevægelsen et andet sted, end den startede, kan vejen tilbage til start også have en overgang (`from` den sidste position, `to` den første).
- **`via` – en pose på vejen:** skal kroppen en anden vej end den lige vej mellem to positioner (burpeens hofte, der skal højt, mens fødderne hopper tilbage, så knæene ikke går i gulvet), så giv overgangen en mellempose: `{ "from": "squat", "to": "chest", "via": { "hip": [39.6, 33.6], "torso": -5, "head": -4, "arms": { … }, "legs": { … } } }`. Via-posen skrives som en hel keyframe; den rører det, begge positioner rører (en hånd eller fod med `lift` giver slip), og intet, ingen af dem rører, og den har `tip` som positionerne. Bevægelsen bruger halvdelen af tiden på hver halvdel, og kontaktarket viser via-posen med blå ramme. Via-posen og billederne på hver side af den måles mod de to rigtige positioner: et lem, overgangen ikke løfter, bøjer højst 8° mere end i den mest bøjede af dem, og et led, som teksten kalder strakt i begge positioner, er strakt i via-posen. Læg derfor de lemmer, der er strakte i begge positioner, på fuld længde i via-posen. Eksempel: `burpee_emom.json` › `burpee_emom.E1`.
- **Frem langs gulvet:** `"advance": 15` på en overgang flytter hele figuren 15 enheder langs x på den vej (bounds); holdene og de næste faser står, hvor figuren kom til, og vejen tilbage til start fører den tilbage. Tegn hver keyframe på stedet med samme fodpunkt, og lad overgangene flytte figuren.
- **Ryggens form:** `"spine": 4` krummer ryggen 4 enheder mod ryggen (katten, rund øvre ryg), `-4` mod brystet (koen). Forfra bøjer `spine` overkroppen til siden (+ mod den nære side), fx en hofte, der hænger i en sideplanke; ovenfra bruges den ikke. Mærket på hovedet viser, hvor ansigtet vender: drej hovedet med `head` (hagen mod brystet er en negativ vinkel ved `facing` 1).
- Rører knæ, hofte eller hoved en flade, som positionen ikke nævner, er det en fejl: flyt figuren. Ret ikke forklaringen selv.
- `tip` står i alle positioner af et lem eller i ingen. Det arbejdende lem er `near` (mørkt); `far` er lyst.
- Figurer, der venter på at blive tegnet om, står i `src/figure/waiting.ts`; fjern din figur derfra, når den består. `docs/runs/NAT-3-FIGURES.md` siger, hvad hver skal have, og en afprøvet udgave står i `src/figure/__tests__/p2/`.
