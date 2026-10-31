#!/usr/bin/env python3
"""Build the offline address pack from OpenStreetMap address points (addr:housenumber + addr:street).

usage: build_addresses.py <addresses.geojsonseq> <out_dir>
(make the input with: osmium tags-filter florida.osm.pbf nwr/addr:housenumber -o a.pbf;
 osmium export a.pbf -f geojsonseq -o addresses.geojsonseq)

Output:
  addr-index.json  {"streets": [[normalized street, display street, city, zip, shard], ...] (row index = street id),
                    "shards": {shard: [byte offset, byte length]}}
  addr-data.tsv    street id <TAB> house number <TAB> lat*1e5 <TAB> lon*1e5, grouped by shard
Shards group streets by the first two characters of the normalized name, so a search reads one small slice
of addr-data.tsv from device storage instead of the whole file.
The app normalizes what you type with the same rules (src/lib/address.ts).
"""
import json, os, re, sys, collections

SUFFIX = {
    'street': 'st', 'str': 'st', 'avenue': 'ave', 'av': 'ave', 'road': 'rd', 'drive': 'dr', 'lane': 'ln', 'boulevard': 'blvd',
    'court': 'ct', 'circle': 'cir', 'place': 'pl', 'terrace': 'ter', 'highway': 'hwy', 'trail': 'trl', 'parkway': 'pkwy',
    'way': 'way', 'point': 'pt', 'square': 'sq', 'loop': 'loop', 'run': 'run', 'path': 'path', 'cove': 'cv', 'crossing': 'xing',
    'north': 'n', 'south': 's', 'east': 'e', 'west': 'w', 'northeast': 'ne', 'northwest': 'nw', 'southeast': 'se', 'southwest': 'sw',
    'mount': 'mt', 'saint': 'st',
}
PREFIX = [
    (r'\b(county road|county rd|co rd|cr)\s*', 'cr '), (r'\b(state road|state rd|state highway|sr)\s*', 'sr '),
    (r'\b(us highway|us hwy|u s highway|us)\s*', 'us '), (r'\b(interstate|i)\s*-?\s*(?=\d)', 'i '),
]


def norm(s: str) -> str:
    s = s.lower().replace('.', ' ').replace(',', ' ').replace('#', ' ')
    s = re.sub(r"[^a-z0-9 ]", ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    for pat, rep in PREFIX:
        s = re.sub(pat, rep, s)
    return ' '.join(SUFFIX.get(w, w) for w in s.split())


DIRS = {'n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'}


def shard_of(n: str) -> str:
    # shard on the core name, so "W Doane Ave" and "Doane Ave" land together
    words = n.split()
    if len(words) > 1 and words[0] in DIRS:
        words = words[1:]
    k = re.sub(r'[^a-z0-9]', '', ''.join(words))[:2]
    return k if len(k) == 2 else (k + '_')[:2] or '__'


src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
streets = {}
rows = collections.defaultdict(list)
seen = set()
for line in open(src, encoding='utf-8'):
    f = json.loads(line.strip('\x1e'))
    p = f['properties']
    st, num = p.get('addr:street'), p.get('addr:housenumber')
    if not st or not num:
        continue
    g = f['geometry']
    if g['type'] == 'Point':
        lon, lat = g['coordinates']
    else:  # building outline: average of the outer ring
        ring = g['coordinates'][0] if g['type'] == 'Polygon' else g['coordinates'][0][0] if g['type'] == 'MultiPolygon' else g['coordinates']
        lon = sum(c[0] for c in ring) / len(ring)
        lat = sum(c[1] for c in ring) / len(ring)
    city = (p.get('addr:city') or '').strip().title()
    zipc = (p.get('addr:postcode') or '')[:5]
    n = norm(st)
    key = (n, city, zipc)
    if key not in streets:
        streets[key] = len(streets)
    sid = streets[key]
    num = re.sub(r'\s+', '', num)[:12]
    dedupe = (sid, num.lower())
    if dedupe in seen:
        continue
    seen.add(dedupe)
    rows[shard_of(n)].append(f'{sid}\t{num}\t{round(lat * 1e5)}\t{round(lon * 1e5)}')

table = [None] * len(streets)
for (n, city, zipc), sid in streets.items():
    table[sid] = [n, '', city, zipc, shard_of(n)]
# keep a readable display name: the most common original spelling
names = collections.defaultdict(collections.Counter)
for line in open(src, encoding='utf-8'):
    p = json.loads(line.strip('\x1e'))['properties']
    st = p.get('addr:street')
    if st and p.get('addr:housenumber'):
        k = (norm(st), (p.get('addr:city') or '').strip().title(), (p.get('addr:postcode') or '')[:5])
        names[streets[k]][st.strip()] += 1
for sid, c in names.items():
    table[sid][1] = c.most_common(1)[0][0]
shards = {}
with open(os.path.join(out, 'addr-data.tsv'), 'wb') as fh:
    for k in sorted(rows):
        b = ('\n'.join(rows[k]) + '\n').encode()
        shards[k] = [fh.tell(), len(b)]
        fh.write(b)
with open(os.path.join(out, 'addr-index.json'), 'w', encoding='utf-8') as fh:
    json.dump({'streets': table, 'shards': shards}, fh, ensure_ascii=False, separators=(',', ':'))
total = sum(len(v) for v in rows.values())
print(f'{total} addresses on {len(streets)} streets in {len(rows)} shards')
