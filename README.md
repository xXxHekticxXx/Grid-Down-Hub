# Grid-Down Hub

Offline emergency guide (installable PWA): first aid step cards with a CPR metronome, bleach water calculator, hazards, comms, survival manual, private plan, PDF library.
No personal data is in this repo. Your plan, pins and PDFs live only on your device.

- Build: `npm ci && npm run build` (content in `content/` is converted to pages and a search index first)
- Deploy: push to `main`; the GitHub Action publishes to GitHub Pages and bundles the public-release Army ATP 3-50.21 PDF.
- Content verified 2026-10-26. Map data (when added) (c) OpenStreetMap contributors.
