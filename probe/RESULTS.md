# Probe – resultater (milepæl 0)

Udfyldt efter tjeklisten i `docs/PLAN.md`, milepæl 0. Proben ligger på repoets GitHub Pages-adresse under `/comeback/probe/`.

| Felt                              | Værdi                                            |
| --------------------------------- | ------------------------------------------------ |
| Dato                              | 5. november 2026                                 |
| Telefon                           | Pixel 9a                                         |
| IronFox-version                   | 159.0.1                                          |
| Vanadium-version (kun hvis brugt) | ikke brugt (punkt 1, 2 og 4 er grønne i IronFox) |

## Resultater

| Nr. | Punkt                                                         | IronFox                         | Vanadium | Noter                                                                                                                                                               |
| --- | ------------------------------------------------------------- | ------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Installation: STANDALONE fra ikonet                           | GRØN                            | –        | STANDALONE, åbnet fra ikonet, service workeren styrer siden                                                                                                         |
| 2   | Lager: samme tal efter lukning og genstart; `persist()`       | GRØN                            | –        | Samme tal efter lukning og efter genstart. »Delete browsing data on quit« er slået fra. `persist()` gav en prompt; brugeren tillod; persisted = ja                  |
| 3   | Offline: åbner i flytilstand                                  | ikke gyldigt testet             | –        | Wifi var tændt i flytilstand (»Net lige nu: online«). »Klar til offline: ja«. Offline er en bonus, ikke et krav, og afgør ikke platformen (`docs/DECISIONS.md` D20) |
| 4   | Opdatering: »Ny version klar«, opdatering ved tryk, samme tal | GRØN                            | –        | »Ny version klar« kom af sig selv; v2 viste samme tal                                                                                                               |
| 5   | Wake Lock: skærmen tændt i 3 minutter; fallback-video         | GRØN                            | –        | Både API'et og fallback-videoen holdt skærmen tændt i 3 min                                                                                                         |
| 6   | Lyd og vibration                                              | Lyd GRØN, vibration RØD         | –        | Alt kunne høres fra gulvet 1 m væk. `navigator.vibrate` findes ikke                                                                                                 |
| 7   | Tid og sprog                                                  | GRØN                            | –        | Tidszone Europe/Copenhagen, sprog en-US (spoofet). da-DK og en-CA virker, når de angives eksplicit                                                                  |
| 8   | Ydelse: første tegning og afspilning af 1.000 hændelser       | RØD                             | –        | Første tegning (first-contentful-paint) 2.050 ms; afspilning 1,4 ms i snit over 771 kørsler; urets opløsning 16,7 ms. Se konklusionen nedenfor                      |
| 9   | Filer: eksportér, importér, del                               | Eksport og import GRØN, del RØD | –        | Eksport til Downloads og import virker. Web Share findes ikke                                                                                                       |
| 10  | Viewport                                                      | GRØN                            | –        | 414 × 847 CSS-px, devicePixelRatio 2 (standalone)                                                                                                                   |

Vanadium-kolonnen udfyldes kun, hvis punkt 1, 2 eller 4 er rødt i IronFox.

## Beslutningsregel

- Alt grønt på 1, 2, 3 og 4 → IronFox-PWA.
- 1, 2 eller 4 rødt → Vanadium.
- Begge rødt → Capacitor-APK (milepæl 2 får da et ekstra trin: Capacitor-opsætning og APK via Actions).

Præcisering (`docs/DECISIONS.md` D18, rettet af D20): punkt 3 afgør ikke platformen. Offline er en bonus for brugeren; appen beholder offline-funktionen.

## Punkt 8: hvad forsinker første tegning?

Spørgsmålet var, om probens egen afspilning eller indlæsningen af fonte forsinker første tegning. Svaret er nej til begge. Målt med Playwright i Firefox med IronFox' JIT-indstillinger (JIT slået fra), viewport 414 × 847, median af 7 indlæsninger:

| Variant                                              | Første tegning |
| ---------------------------------------------------- | -------------- |
| Proben som udgivet                                   | 74 ms          |
| Uden afspilningen                                    | 74 ms          |
| Med appens webfonte (woff2), `font-display` standard | 72 ms          |
| Med appens webfonte, `font-display: swap`            | 73 ms          |
| Med webfonte forsinket 300 ms                        | 68–69 ms       |
| Varm start gennem probens service worker (5 kørsler) | 33–41 ms       |

- Afspilningen starter først 1,6 sekund efter første tegning (en `setTimeout` i en effekt, der kører efter tegningen), så den kan ikke forsinke den.
- Proben bruger ingen webfonte (`system-ui`, 0 fontanmodninger). Firefox melder første tegning, før webfonte er hentet, så tallet viser ikke, om tekst med webfont er synlig. Appen måler derfor også, hvornår I dag er synlig med fontene indlæst.
- Telefonens afspilning (1,4 ms pr. 1.000 hændelser) er lige så hurtig som pc'ens Firefox med JIT slået fra (2 ms). JavaScript-arbejdet kan altså ikke forklare 2.050 ms, når samme side tegnes på 33–74 ms på pc'en. Tiden ligger, før siden kører: opstart af appen og service workeren eller hentning fra nettet. Proben kan ikke skille dem ad.
- Testopsætningen havde selv et 2-sekunders hul: Firefox prøvede `localhost` på IPv4, mens serveren lyttede på IPv6. Playwright og `npm run preview` bruger nu `127.0.0.1`.

Appens krav er SK1 (I dag synlig under 1 sekund ved varm start). Det måles i milepæl 2 i samme profil, og Mere → Om → Diagnose viser tiden til første tegning og til I dag fra telefonen.

## Beslutning

Platform: IronFox-PWA (`docs/DECISIONS.md` D19). Ingen vibration (kun lyd), ingen »Del«-knap, `persist()` kaldes efter første loggede pas.
