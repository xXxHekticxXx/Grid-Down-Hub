#!/usr/bin/env python3
"""Describe one state map file as a download pack: size, SHA-256 and the SHA-256 of every 32 MiB part,
so the app can fetch it in parts (HTTP ranges) and check each part before writing it.

usage: state_pack.py <XX.pmtiles> <XX> <State name> <osm date> <out.json>
"""
import hashlib, json, os, sys

path, code, name, osm_date, out = sys.argv[1:6]
CHUNK = 32 * 1024 * 1024
size = os.path.getsize(path)
whole = hashlib.sha256()
chunks = []
with open(path, "rb") as f:
    while True:
        b = f.read(CHUNK)
        if not b:
            break
        whole.update(b)
        chunks.append({"bytes": len(b), "sha256": hashlib.sha256(b).hexdigest()})
pack = {
    "id": f"state-{code.lower()}",
    "code": code,
    "title": f"{name} map",
    "description": f"All of {name}: roads to street level (zoom 13), towns, water, parks and forests, from OpenStreetMap",
    "required": False,
    "bytes": size,
    "date": osm_date,
    "files": [{"name": f"{code}.pmtiles", "bytes": size, "sha256": whole.hexdigest(), "chunks": chunks}],
}
with open(out, "w") as f:
    json.dump(pack, f)
print(f"{code}: {size/1e6:.0f} MB in {len(chunks)} parts")
