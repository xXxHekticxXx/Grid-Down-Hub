#!/usr/bin/env python3
"""Pack a gdal2tiles XYZ folder of WebP tiles into one PMTiles archive (the USGS topo overlay).

usage: xyz_to_pmtiles.py <xyz_dir> <out.pmtiles> <name> <attribution>
"""
import math, os, sys
from pmtiles.writer import Writer
from pmtiles.tile import zxy_to_tileid, tileid_to_zxy, TileType, Compression

src, dst, name, attribution = sys.argv[1:5]
tiles = []
for z in sorted(os.listdir(src), key=lambda s: int(s) if s.isdigit() else -1):
    if not z.isdigit():
        continue
    for x in os.listdir(os.path.join(src, z)):
        for fn in os.listdir(os.path.join(src, z, x)):
            if fn.endswith(".webp"):
                y = int(fn[:-5])
                tiles.append((zxy_to_tileid(int(z), int(x), y), os.path.join(src, z, x, fn), int(z)))
tiles.sort()
minz = min(t[2] for t in tiles)
maxz = max(t[2] for t in tiles)
# bounds from the highest-zoom tiles
xs, ys = [], []
for tid, _, z in tiles:
    if z == maxz:
        _, x, y = tileid_to_zxy(tid)
        xs.append(x)
        ys.append(y)
n = 2 ** maxz
def lon_of(x): return x / n * 360 - 180
def lat_of(y): return math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
W, E = lon_of(min(xs)), lon_of(max(xs) + 1)
N, S = lat_of(min(ys)), lat_of(max(ys) + 1)
with open(dst, "wb") as out:
    w = Writer(out)
    for tid, path, _ in tiles:
        with open(path, "rb") as fh:
            w.write_tile(tid, fh.read())
    header = {
        "tile_type": TileType.WEBP, "tile_compression": Compression.NONE,
        "min_lon_e7": int(W * 1e7), "min_lat_e7": int(S * 1e7), "max_lon_e7": int(E * 1e7), "max_lat_e7": int(N * 1e7),
        "center_zoom": minz + 2, "center_lon_e7": int((W + E) / 2 * 1e7), "center_lat_e7": int((S + N) / 2 * 1e7),
    }
    w.finalize(header, {"name": name, "attribution": attribution, "type": "overlay", "format": "webp"})
print(f"{len(tiles)} tiles z{minz}-{maxz} bounds {W:.4f},{S:.4f},{E:.4f},{N:.4f}")
