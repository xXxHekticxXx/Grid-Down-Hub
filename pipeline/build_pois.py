#!/usr/bin/env python3
"""Build the offline map point layers (POIs) from an OSM extract with osmium.

usage: build_pois.py <florida.osm.pbf> <out_dir>
Writes one compact GeoJSON per layer plus pois-index.json (for offline search).
Statewide layers: what you need on the road anywhere in Florida.
Regional layers (Lake County -> Ocala NF box): everything else.
"""
import json, os, re, subprocess, sys, tempfile

pbf, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
REGION = (-82.10, 28.30, -81.10, 29.62)

FILTERS = [
    "nwr/amenity=hospital,clinic,doctors,fire_station,police,pharmacy,fuel,place_of_worship,school,drinking_water,water_point,shelter,ranger_station",
    "nwr/healthcare=hospital,urgent_care,pharmacy,clinic",
    "nwr/shop=supermarket,grocery,greengrocer,convenience,hardware,doityourself,trade,agrarian,farm,butcher,wholesale,variety_store,outdoor,sports,hunting",
    "nwr/natural=spring",
    "nwr/leisure=slipway,park,nature_reserve",
    "nwr/tourism=camp_site,caravan_site",
    "nwr/boundary=protected_area,national_park",
    "nwr/natural=water",
    "nwr/emergency=yes",
]


def centroid(geom):
    t = geom["type"]
    c = geom["coordinates"]
    if t == "Point":
        return c
    pts = []

    def walk(x):
        if isinstance(x[0], (int, float)):
            pts.append(x)
        else:
            for y in x:
                walk(y)
    walk(c)
    if not pts:
        return None
    return [sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)]


def in_region(lon, lat):
    return REGION[0] <= lon <= REGION[2] and REGION[1] <= lat <= REGION[3]


URGENT = re.compile(r"urgent|walk[- ]?in|immediate care|express care|minute ?clinic|fast ?track|emergency", re.I)


def classify(tags):
    a = tags.get("amenity", "")
    h = tags.get("healthcare", "")
    s = tags.get("shop", "")
    name = tags.get("name", "")
    if a == "hospital" or h == "hospital":
        return "hospital"
    if h == "urgent_care" or (a in ("clinic", "doctors") and URGENT.search(name)):
        return "urgent_care"
    if a == "fire_station":
        return "fire"
    if a == "police":
        return "police"
    if a == "pharmacy" or h == "pharmacy":
        return "pharmacy"
    if a == "fuel":
        return "gas"
    if s in ("supermarket", "grocery", "greengrocer", "butcher", "wholesale"):
        return "grocery"
    if s in ("convenience", "variety_store"):
        return "store"
    if s in ("hardware", "doityourself", "trade", "agrarian", "farm"):
        return "hardware"
    if s in ("outdoor", "sports", "hunting"):
        return "outdoor"
    if tags.get("natural") == "spring":
        return "spring"
    if tags.get("leisure") == "slipway":
        return "boat_ramp"
    if a in ("drinking_water", "water_point"):
        return "water_tap"
    if tags.get("natural") == "water" and name:
        return "lake"
    if tags.get("tourism") in ("camp_site", "caravan_site"):
        return "campground"
    if tags.get("leisure") in ("park", "nature_reserve") or tags.get("boundary") in ("protected_area", "national_park"):
        return "park" if name else None
    if a == "ranger_station":
        return "ranger"
    if a == "place_of_worship":
        return "church"
    if a == "school":
        return "school"
    return None


STATEWIDE = {"hospital", "urgent_care", "fire", "police", "pharmacy", "gas", "grocery", "hardware", "spring", "campground", "ranger"}
KEEP_TAGS = ["name", "addr:housenumber", "addr:street", "addr:city", "addr:postcode", "phone", "contact:phone",
             "opening_hours", "emergency", "operator", "brand", "fuel:diesel", "drinking_water", "website"]

with tempfile.TemporaryDirectory() as tmp:
    filt = os.path.join(tmp, "f.osm.pbf")
    subprocess.run(["osmium", "tags-filter", "-O", "-o", filt, pbf, *FILTERS], check=True)
    seq = os.path.join(tmp, "f.geojsonseq")
    subprocess.run(["osmium", "export", "-O", "-f", "geojsonseq", "-x", "print_record_separator=false",
                    "-a", "type,id", "-o", seq, filt], check=True)
    layers = {}
    seen = set()
    with open(seq) as f:
        for line in f:
            ft = json.loads(line)
            tags = ft.get("properties", {})
            kind = classify(tags)
            if not kind:
                continue
            c = centroid(ft["geometry"])
            if not c:
                continue
            lon, lat = round(c[0], 5), round(c[1], 5)
            if kind not in STATEWIDE and not in_region(lon, lat):
                continue
            key = (kind, tags.get("name", ""), round(lon, 3), round(lat, 3))
            if key in seen:  # node + building of the same place
                continue
            seen.add(key)
            props = {"k": kind}
            for t in KEEP_TAGS:
                if t in tags:
                    props[t.replace("addr:", "").replace("contact:", "")] = tags[t]
            if kind == "hospital":
                props["er"] = tags.get("emergency") == "yes" or "emergency" in tags.get("healthcare:speciality", "")
            if kind in ("spring", "lake", "boat_ramp", "water_tap"):
                props["note"] = "Water source: treat before drinking"
            layers.setdefault(kind, []).append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [lon, lat]},
                                                "properties": props})

index = []
for kind, feats in sorted(layers.items()):
    with open(os.path.join(out, f"poi-{kind}.geojson"), "w") as f:
        json.dump({"type": "FeatureCollection", "features": feats}, f, separators=(",", ":"))
    for ft in feats:
        p = ft["properties"]
        if p.get("name"):
            addr = " ".join(x for x in [p.get("housenumber", ""), p.get("street", ""), p.get("city", "")] if x)
            index.append([kind, p["name"], addr, ft["geometry"]["coordinates"][0], ft["geometry"]["coordinates"][1]])
    print(f"{kind:12s} {len(feats):6d}")
with open(os.path.join(out, "pois-index.json"), "w") as f:
    json.dump(index, f, separators=(",", ":"))
print("indexed", len(index))
