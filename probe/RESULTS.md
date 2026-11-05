# Probe – resultater (milepæl 0)

Udfyldes efter tjeklisten i `docs/PLAN.md`, milepæl 0. Proben: https://marouan-el-haddad.github.io/comeback/probe/

| Felt                              | Værdi |
| --------------------------------- | ----- |
| Dato                              |       |
| Android-version                   |       |
| IronFox-version                   |       |
| Vanadium-version (kun hvis brugt) |       |

## Resultater

Skriv GRØN eller RØD, som proben viser, og notér tal og iagttagelser (fx tallet under »Lager«, om der kom en prompt ved »Persist«, og om »Delete browsing data on quit« var slået til).

| Nr. | Punkt                                                         | IronFox | Vanadium | Noter |
| --- | ------------------------------------------------------------- | ------- | -------- | ----- |
| 1   | Installation: STANDALONE fra ikonet                           |         |          |       |
| 2   | Lager: samme tal efter lukning og genstart; `persist()`       |         |          |       |
| 3   | Offline: åbner i flytilstand                                  |         |          |       |
| 4   | Opdatering: »Ny version klar«, opdatering ved tryk, samme tal |         |          |       |
| 5   | Wake Lock: skærmen tændt i 3 minutter; fallback-video         |         |          |       |
| 6   | Lyd og vibration                                              |         |          |       |
| 7   | Tid og sprog                                                  |         |          |       |
| 8   | Ydelse: første tegning og afspilning af 1.000 hændelser       |         |          |       |
| 9   | Filer: eksportér, importér, del                               |         |          |       |
| 10  | Viewport                                                      |         |          |       |

Vanadium-kolonnen udfyldes kun, hvis punkt 1, 2 eller 4 er rødt i IronFox.

## Beslutningsregel

- Alt grønt på 1, 2, 3 og 4 → IronFox-PWA.
- 1, 2 eller 4 rødt → Vanadium.
- Begge rødt → Capacitor-APK (milepæl 2 får da et ekstra trin: Capacitor-opsætning og APK via Actions).

Præcisering (`docs/DECISIONS.md` D18): rødt punkt 3 i IronFox behandles som rødt 1, 2 eller 4, og »begge rødt« betyder rødt i både IronFox og Vanadium.

## Beslutning

Platform: _(udfyldes og skrives i `docs/DECISIONS.md`)_
