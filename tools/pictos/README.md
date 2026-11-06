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

Appens figursystem (`src/figure/`, `docs/SPEC.md` 9.1, `docs/DECISIONS.md` D48) er en TypeScript-udgave af `picto.py`. En figurfil er data, ingen kode:

1. Skriv `content/figures/<spor>.json`: `{ "format": 1, "subject": "<spor>", "figures": [...] }` med én figur pr. forklaret punkt (og pr. bevægelse med `"movement": "<id>"`, når der er flere) og én keyframe pr. position i forklaringen.
2. `node scripts/check-explain.ts content/figures/<spor>.json` tjekker formatet og figuren (led, kontakter, glidning, rækkevidde). Den skal sige OK.
3. `node scripts/figure-sheet.ts content/figures/<spor>.json` tegner kontaktarket i `screenshots/figures/<spor>.png`. Se på det: kan en, der aldrig har set øvelsen, lave den ud fra positionerne?
4. `npx prettier --write content/figures/<spor>.json`.

Faldgruber:

- Mål som piktogrammerne: skinneben 23, lår 24, overkrop 30, overarm 16, underarm 15, hals 11, hoved r 6,4. Arm højst 31, ben højst 47 fra skulder og hofte; et punkt uden for rækkevidde giver »når ikke sit punkt«.
- Kontakt som i `poses.py`: håndleddet på fladen (y = 0 på gulvet), anklen 3,6 over med tåen `tip` 0,3 over (stående med brystet mod højre: tå 7,2 foran anklen; på tæerne: tå lige foran og under anklen), hoften 5 over, når man sidder eller ligger.
- I sidebilledet ingen `bend`: knæ og albuer bøjer selv ud fra `facing`. Kopiér aldrig `bend` fra `poses.py` (`squat_jump`, `bulgarian` og `chin_tuck` bøjer albuerne forkert).
- En hånd eller fod, der står på samme flade i to positioner, skal have samme punkt i begge, ellers »glider« den. Langs en væg og med et håndklæde (`attach`) må den glide.
- Rører knæ, hofte eller hoved en flade, som positionen ikke nævner, er det en fejl: flyt figuren. Ret ikke forklaringen selv.
- `tip` står i alle positioner af et lem eller i ingen. Det arbejdende lem er `near` (mørkt); `far` er lyst.
