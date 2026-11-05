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
