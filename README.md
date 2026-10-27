# Grid-Down Hub data packs

Offline map, topo and library data for the Grid-Down Hub app, split into 32 MiB parts. The build workflow on
`main` copies `data/` into the GitHub Pages site, where the app downloads it once and checks every part
against the SHA-256 values in `data/manifest.json`.

- maps-base: Florida base map (OpenMapTiles schema, Planetiler, OpenStreetMap data 2026-10-25, ODbL)
- maps-detail: Lake County to Ocala National Forest detail map, zoom 15 (same sources)
- topo-overlay: 27 USGS US Topo quads as a raster overlay (public domain)
- pois: map places from OpenStreetMap and Lake County emergency shelters
- library: ATP 3-50.21, ATP 4-02.11 (U.S. Army, approved for public release) and FEMA P-2064 (public domain)
- topo-pdf-home / topo-pdf-forest: USGS US Topo GeoPDFs and print editions (public domain)

Map data © OpenStreetMap contributors, available under the Open Database License.
