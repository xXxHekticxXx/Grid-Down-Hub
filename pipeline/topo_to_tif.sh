#!/usr/bin/env bash
# Render one USGS US Topo GeoPDF to a clipped, web-mercator GeoTIFF for the topo overlay.
# usage: topo_to_tif.sh <in.pdf> <out.tif> [dpi]
set -euo pipefail
in="$1"; out="$2"; dpi="${3:-250}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
# neatline = the map frame; everything outside it (the collar) is cut away
neat="$(gdalinfo "$in" 2>/dev/null | sed -n 's/^ *NEATLINE=//p')"
srs="$(gdalsrsinfo -o wkt1 "$in" 2>/dev/null | tr -d '\n')"
printf '{"type":"FeatureCollection","features":[]}' >/dev/null
cat > "$tmp/neat.csv" <<EOF
id,WKT
1,"$neat"
EOF
ogr2ogr -q -a_srs "$srs" -oo GEOM_POSSIBLE_NAMES=WKT -oo KEEP_GEOM_COLUMNS=NO "$tmp/neat.gpkg" "$tmp/neat.csv"
gdal_translate -q --config GDAL_PDF_DPI "$dpi" \
  --config GDAL_PDF_LAYERS_OFF "Images,Images.Orthoimage,Map_Collar,Map_Collar.Map_Elements,Barcode" \
  -of GTiff -co TILED=YES -co COMPRESS=DEFLATE "$in" "$tmp/full.tif"
gdalwarp -q -overwrite -t_srs EPSG:3857 -r bilinear -cutline "$tmp/neat.gpkg" -crop_to_cutline \
  -dstalpha -co TILED=YES -co COMPRESS=DEFLATE -multi -wo NUM_THREADS=ALL_CPUS "$tmp/full.tif" "$out"
