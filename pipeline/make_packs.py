#!/usr/bin/env python3
"""Split every data file into chunks for download, and write data/manifest.json with the SHA-256
of every file and every chunk (the app checks each chunk as it arrives).

usage: make_packs.py <packs.json> <out_dir> <osm_date>
packs.json: [{"id","title","description","required","files":[path,...]}]
"""
import hashlib, json, os, sys, datetime

CHUNK = 32 * 1024 * 1024  # 32 MiB parts: small enough to retry cheaply on a weak signal
spec_path, out, osm_date = sys.argv[1], sys.argv[2], sys.argv[3]
spec = json.load(open(spec_path))
os.makedirs(out, exist_ok=True)
manifest = {"version": 1, "built": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "osmDate": osm_date,
            "contentChecked": "2026-10-27", "packs": []}
for p in spec:
    files = []
    pdir = os.path.join(out, p["id"])
    os.makedirs(pdir, exist_ok=True)
    for path in p["files"]:
        name = os.path.basename(path)
        whole = hashlib.sha256()
        chunks = []
        with open(path, "rb") as fh:
            i = 0
            while True:
                b = fh.read(CHUNK)
                if not b:
                    break
                whole.update(b)
                chunks.append({"bytes": len(b), "sha256": hashlib.sha256(b).hexdigest()})
                with open(os.path.join(pdir, f"{name}.{i:03d}"), "wb") as o:
                    o.write(b)
                i += 1
        files.append({"name": name, "bytes": os.path.getsize(path), "sha256": whole.hexdigest(), "chunks": chunks})
        print(f"{p['id']}/{name}: {os.path.getsize(path):,} bytes, {len(chunks)} parts, sha256 {whole.hexdigest()}")
    manifest["packs"].append({"id": p["id"], "title": p["title"], "description": p["description"], "required": p["required"],
                              "bytes": sum(f["bytes"] for f in files), "files": files, "date": p.get("date", osm_date)})
with open(os.path.join(out, "manifest.json"), "w") as fh:
    json.dump(manifest, fh, indent=1)
print("total", sum(p["bytes"] for p in manifest["packs"]), "bytes")
