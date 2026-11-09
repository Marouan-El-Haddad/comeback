# NAT-3 – passet færdigt, figurer i høj kvalitet, livet

Kører uden opsyn fra mandag 9/11. Programmet starter i dag, og første styrkepas er tirsdag 10/11. Brugeren kan ikke svare undervejs. `CLAUDE.md` og arbejdsformen fra `docs/runs/NAT-2.md` gælder: du er orkestrator med underagenterne i `.claude/agents/`, tjekliste og log ligger i filer, hver pakke reviewes, og der pushes efter et grønt review. Kopiér denne fil til `docs/runs/NAT-3.md`, og før tjekliste i `docs/runs/NAT-3-TASKS.md` og log i `docs/runs/NAT-3-LOG.md`.

## Brugerens feedback på NAT-2

- Tjeklisten virker, som rapporten beskriver.
- De fleste animationer er okay og forståelige, men ikke i den kvalitet, brugeren håbede på. Det skal være helt tydeligt, præcis hvordan øvelsen udføres, og alt skal være synligt fra den rigtige vinkel.
- Ikke alle øvelser er animeret. Fx ligner »etbens bounds« en stillestående tegning og ser mærkelig ud.
- Samlet: en god start i den rigtige retning, men UI, UX, design, animationer og forklaringer skal være mærkbart bedre og mere skræddersyede. Det kræver ingen revolution; byg videre på det, der findes.

## Pakker i prioriteret rækkefølge

0. **P6 fra arbejdsmappen:** der ligger ucommittet arbejde til »Dagens pas«, »Nu og næste«, pausen, introkortet og »Hold pause«. Kassér det ikke. Gør det færdigt, test det, review det, og udgiv det, så det er klar til tirsdagens Styrke A. Tag P54 med: skiftevise øvelser (skater-hop, split jumps) vises som ét sæt.
1. **Ret figurmotoren** efter `docs/runs/NAT-2-P3-FIX.md`:
   - H1: interpolér leddenes vinkler i stedet for at flytte hoften i en lige linje, så knæ og albuer ikke knækker, og intet går gennem gulvet.
   - M1–M3 og L1–L4.
   - Motorens grænser: kontakt på side, ryg og mave, skridt og hop, rekvisitter på ryggen og ryggens krumning.
2. **Alle figurer i høj kvalitet:**
   - Hver øvelse er animeret. Der må ikke være stillestående tegninger som »etbens bounds«.
   - Vælg den vinkel, der viser det vigtige: forfra for sideværts bevægelser og knæ over tæer, fra siden for hofte- og rygvinkler. Brug to vinkler, hvor én ikke er nok.
   - Rekvisitter (stol, væg, rygsæk, bøger), gulvet og kontaktpunkterne skal være rigtige.
   - Vis det, der skal huskes, i figuren på det rigtige tidspunkt, fx bevægelsesretningen, en vinkel eller én kort cue ved bundpositionen.
   - Vis de typiske fejl i de vigtigste øvelser (trin 1 og 2) som figur, med rigtigt og forkert side om side, fx hængende hofte i en push-up.
   - Lav kontaktark for alle figurer. Reviewer gennemgår hver figur mod forklaringens positioner og mod anatomien og afviser alt, der ikke er tydeligt. Pakken er først færdig, når de afviste figurer er rettet.
3. **Skærp forklaringerne:** læs alle kort med brugerens blik. Står der præcist, hvordan øvelsen laves derhjemme med gulv, stol, væg og rygsæk? Hvad skal han mærke, og hvornår er det for let eller for svært? Skær teksten ned, hvor det kan lade sig gøre, og gør den mere konkret, hvor det er nødvendigt. Navne, doser og regler ændres ikke.
4. **Løft designet:** gå alle skærme igennem mod `docs/SPEC.md` afsnit 5 og 6 og listen over forbudte mønstre. Se især på hierarki, den typografiske skala, luft, PDF'ens plakatidentitet, figuren som hovedperson og overgange, der viser, hvad der ændrede sig. Tag før- og efterbilleder af de vigtigste skærme til rapporten.
5. **Livet:** søndagstjek, der skal virke søndag 15/11. Desuden flyt og spring over, syg, rejse, ferie, klubben lukket, begivenheder og klublog med lørdagskarakter (NAT-2 pakke 7).
6. **Valgfri:** resten af milepæl 3 (NAT-2 pakke 8), derefter milepæl 4.

Pakke 0–5 er påkrævede. Pakke 6 er valgfri.

## Kvalitet og test

- Alt nyt dækkes af Playwright i `pixel9a` og `pixel9a-utc`; brug tidsmaskinen til datoer. Hele suiten skal være kørt grøn på den endelige `main`.
- Brugerens rigtige data på telefonen må aldrig gå tabt. Han logger rigtige pas fra tirsdag, så ændringer i lager eller hændelser kræver migration, backup og test.
- JavaScript skal fylde under 150 kB gz.

## Slutrapport

Skriv `docs/runs/NAT-3-REPORT.md` med opsummeringen fra `CLAUDE.md`. Medtag desuden:
- pakkerne og deres status
- reviewfund i tal
- testtal
- før- og efterbilleder
- URL'erne
- en tjekliste til telefonen med højst seks ja/nej-punkter, der kan klares i tidsmaskinen på ti minutter

Commit og push rapporten, og skriv opsummeringen i chatten.
