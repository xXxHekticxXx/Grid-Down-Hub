#!/usr/bin/env bash
# Make a print edition of a USGS US Topo GeoPDF: the full sheet with its margin (scale bar, legend,
# north arrow, adjoining quads) but without the aerial photo layer, as a georeferenced JPEG PDF.
# usage: make_print_edition.sh <in_geo.pdf> <out.pdf> [dpi]
set -euo pipefail
in="$1"; out="$2"; dpi="${3:-200}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
gdal_translate -q --config GDAL_PDF_DPI "$dpi" --config GDAL_PDF_LAYERS_OFF "Images,Images.Orthoimage,Barcode" \
  -of GTiff -co COMPRESS=DEFLATE "$in" "$tmp/sheet.tif"
gdal_translate -q -of PDF -co COMPRESS=JPEG -co JPEG_QUALITY=82 -co DPI="$dpi" \
  -co TITLE="$(basename "$in" .pdf | sed 's/_TM_geo//; s/_/ /g') (print edition, no aerial photo)" \
  -co PRODUCER="Grid-Down Hub from USGS US Topo (public domain)" "$tmp/sheet.tif" "$out"
