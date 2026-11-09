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

Appens figursystem (`src/figure/`, `docs/SPEC.md` 9.1, `docs/DECISIONS.md` D48 og D56) er en TypeScript-udgave af `picto.py`. En figurfil er data, ingen kode:

1. Skriv `content/figures/<spor>.json`: `{ "format": 1, "subject": "<spor>", "figures": [...] }` med én figur pr. forklaret punkt (og pr. bevægelse med `"movement": "<id>"`, når der er flere) og én keyframe pr. position i forklaringen.
2. `node scripts/check-explain.ts content/figures/<spor>.json` tjekker formatet og figuren (led, kontakter, glidning, rækkevidde, strakte led og billederne mellem positionerne). Den skal sige OK.
3. `node scripts/figure-sheet.ts content/figures/<spor>.json` tegner kontaktarket i `screenshots/figures/<spor>.png`. Se på det: kan en, der aldrig har set øvelsen, lave den ud fra positionerne? Se også på billedet midt i hver bevægelse (stiplet ramme) og på vinklerne under hver position (180° = strakt).
4. `npx prettier --write content/figures/<spor>.json`.

Eksempler at kopiere fra (referencefigurerne): gulv og strakte arme i `press.json` (`press.1`), væg og en hofte, der glider ned ad den, i `wallsit.json` (`wallsit.W1`), stol, rygsæk i hånden og én støttehånd i `pull.json` (`pull.1`).

### Det ser tjekket ikke

»OK« betyder, at led, kontakter og billederne imellem er mulige, ikke at figuren er rigtig. Se selv efter på kontaktarket:

- holdningen: en hængende hofte, en rund ryg, hvor den skal være lige, hovedets stilling;
- om figuren viser det, positionens tekst beskriver (ud over strakte led og kontakter);
- om den blå pil peger ud af brystet;
- billedet ovenfra (`"view": "top"`), hvor kun formatet tjekkes.

### Faldgruber

- Mål som piktogrammerne: skinneben 23, lår 24, overkrop 30, overarm 16, underarm 15, hals 11, hoved r 6,4. Arm højst 31, ben højst 47 fra skulder og hofte; et punkt mere end 1 uden for rækkevidde giver »når ikke sit punkt«.
- **Strakte led:** læg punktet på fuld længde eller op til 1 over (arm 31 fra skulderen, ben 47 fra hoften). Et punkt bare 0,4 inden for bøjer leddet 17°. Siger teksten »strakte arme«, »benene er strakte« eller »strakt knæ«, afviser tjekket et led, der er bøjet over 5°.
- **`facing`** er den vej, brystet vender, når figuren drejes op at stå uden at spejle den: stående med brystet mod højre, push-up og planke med hovedet til højre og liggende på ryggen med hovedet til venstre er 1, en håndstand med brystet mod højre er −1. Den blå pil på kontaktarket skal pege ud af brystet. En forkert `facing` er den eneste måde, et knæ kan bøje forkert i sidebilledet; tjekket fanger den ved fødderne og ved et lår, der står over 70° bag kroppen.
- **Fødder:** i sidebilledet har hvert synligt ben `tip`, i alle positioner. Kontakt som i `poses.py`: håndleddet på fladen (y = 0 på gulvet), anklen 3,6 over med tåen `tip` 0,3 over (stående med brystet mod højre: tå 7,2 foran anklen; på tæerne: tå lige foran og under anklen), hoften 5 over, når man sidder eller ligger.
- **Fladerne:** gulvet i y = 0, stolesæde, bordplade, trappetrin og seng øverst i deres `height`, bøger i `at[1] + 2,4 × antal − 0,4`, puden 3,4 over `at`.
- I sidebilledet ingen `bend`: knæ og albuer bøjer selv ud fra `facing`. Kopiér aldrig `bend` fra `poses.py` (`squat_jump`, `bulgarian` og `chin_tuck` bøjer albuerne forkert). Undtagelse: en arm over hovedet (håndstand, pike) må have `bend` 1 eller −1, så albuen peger den anden vej.
- **Forfra og ovenfra** vælger `bend` siden: 1 på `near` og −1 på `far` sender knæ og albuer udad. Brug samme `bend` i alle positioner, ellers skifter leddet side undervejs.
- **Ryg, mave og side:** kontakten betyder, at den del af overkroppen rører fladen; resten må løftes (hollow hold, sit-up, sideplanken på albuen).
- En hånd eller fod, der står på samme flade i to positioner, skal have samme punkt i begge, ellers »glider« den. Langs en væg og med et håndklæde (`attach`) må den glide. Skal den løftes og sættes et andet sted (et skridt, fødderne, der hopper tilbage, hænderne, der går), så skriv en overgang: `"transitions": [{ "from": "squat", "to": "chest", "lift": ["near.foot", "far.foot"] }]`. Overgangen gælder kun den vej; skriv også den modsatte, hvis bevægelsen går tilbage den vej.
- **Frem langs gulvet:** `"advance": 15` på en overgang flytter hele figuren 15 enheder langs x på den vej (bounds); vejen tilbage til start fører den tilbage.
- **Ryggens form:** `"spine": 4` krummer ryggen 4 enheder mod ryggen (katten, rund øvre ryg), `-4` mod brystet (koen); kun i sidebilledet. Mærket på hovedet viser, hvor ansigtet vender: drej hovedet med `head` (hagen mod brystet er en negativ vinkel ved `facing` 1).
- Rører knæ, hofte eller hoved en flade, som positionen ikke nævner, er det en fejl: flyt figuren. Ret ikke forklaringen selv.
- `tip` står i alle positioner af et lem eller i ingen. Det arbejdende lem er `near` (mørkt); `far` er lyst.
- Figurer, der venter på at blive tegnet om, står i `src/figure/waiting.ts`; fjern din figur derfra, når den består.
