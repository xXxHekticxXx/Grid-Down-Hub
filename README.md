# Grid-Down Hub

An offline emergency and survival app for Sorrento, Lake County and the Ocala National Forest. After one
download it needs no internet: maps of all of Florida with a Lake County to Ocala detail map, a USGS topo
overlay, GPS with DD/DDM/USNG coordinates, 140+ step-by-step articles (trauma first, then water, food, plants
and herbal remedies, hazards, power and shelter, radio and navigation, bushcraft, the go plan), the Army
survival and first aid manuals and FEMA's *Are You Ready?* as native chapters, editable checklists, tools
(CPR metronome, bleach calculator, timers, compass, flashlight and SOS), and a private My Plan that never
leaves the device except as an encrypted export.

- **Website / PWA:** https://xxxhekticxxx.github.io/Grid-Down-Hub/
- **Android app:** `GridDownHub.apk` on the website and on the Releases page.

## How it is built

| Part | Where |
| --- | --- |
| App (React, Vite, TypeScript, MapLibre, PMTiles) | `src/` |
| Articles (Markdown with dated sources) | `content/articles/` |
| Checklists | `content/checklists/` |
| Native book chapters converted from the PDFs | `content/books/` (by `pipeline/convert_manual.py`) |
| Map, topo and library data packs | branch `data-packs` (by the scripts in `pipeline/`) |
| Android project (Capacitor 8) | `android/` |
| Build, APK and Pages deploy | `.github/workflows/build-and-deploy.yml` |
| Offline acceptance tests (Playwright) | `tests/` |

`npm run build` regenerates the content, runs `scripts/check-content.mjs` (every article must have the five
sections, at least two steps, sources with a checked date; category minimums; no unfinished markers; no broken
links) and type-checks before bundling.

## Data sources

Map data © OpenStreetMap contributors (ODbL), built with Planetiler from the Geofabrik Florida extract.
USGS US Topo quads, FEMA P-2064, ATP 3-50.21 and ATP 4-02.11 are U.S. government works (public domain /
approved for public release). Fonts: Noto Sans (OFL). Medical guidance follows the 2024 AHA/Red Cross First
Aid Guidelines and the 2025 AHA CPR guidelines.

## Privacy

My Plan, pins, notes, photos and everything you add live only in the device's storage. Nothing personal is in
this repository; the test suite checks that.
