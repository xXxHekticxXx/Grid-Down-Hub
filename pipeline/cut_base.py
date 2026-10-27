#!/usr/bin/env python3
"""Remove from the statewide base map every tile (zoom >= 6) that lies entirely inside the area the
detail map covers, so the app never draws the same roads twice.

usage: cut_base.py <in.pmtiles> <out.pmtiles> <minlon> <minlat> <maxlon> <maxlat>
"""
import math, sys
from pmtiles.reader import Reader, MmapSource, all_tiles
from pmtiles.writer import Writer
from pmtiles.tile import zxy_to_tileid

src, dst = sys.argv[1], sys.argv[2]
W, S, E, N = map(float, sys.argv[3:7])


def tile_bounds(z, x, y):
    n = 2 ** z
    lon0 = x / n * 360 - 180
    lon1 = (x + 1) / n * 360 - 180
    lat0 = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + 1) / n))))
    lat1 = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    return lon0, lat0, lon1, lat1


with open(src, "r+b") as f:
    r = Reader(MmapSource(f))
    header = r.header()
    metadata = r.metadata()
    tiles = []
    dropped = 0
    for (z, x, y), data in all_tiles(r.get_bytes):
        if z >= 6:
            a, b, c, d = tile_bounds(z, x, y)
            if a >= W and c <= E and b >= S and d <= N:
                dropped += 1
                continue
        tiles.append((zxy_to_tileid(z, x, y), data))
tiles.sort(key=lambda t: t[0])
with open(dst, "wb") as out:
    w = Writer(out)
    for tid, data in tiles:
        w.write_tile(tid, data)
    h = {k: header[k] for k in ("tile_type", "tile_compression", "min_lon_e7", "min_lat_e7", "max_lon_e7", "max_lat_e7", "center_zoom", "center_lon_e7", "center_lat_e7")}
    metadata["description"] = (metadata.get("description", "") + f" Tiles inside {W},{S},{E},{N} at zoom 6+ are served by the detail map.").strip()
    w.finalize(h, metadata)
print(f"kept {len(tiles)} tiles, dropped {dropped} inside the detail area")
