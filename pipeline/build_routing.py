#!/usr/bin/env python3
"""Build the offline routing graph (turn-by-turn directions) from an OpenStreetMap road extract.

usage: build_routing.py <roads.osm.pbf> <out_dir>
(make the input with: osmium tags-filter florida.osm.pbf w/highway=... -o roads.osm.pbf)

Output files (little-endian), read by src/lib/routing.ts:
  route-meta.json   {"nodes": N, "edges": E, "names": [...], "classes": [...], "osmDate": ...}
  route-nodes.bin   N x (int32 lat*1e6, int32 lon*1e6)
  route-adj.bin     (N+1) uint32 offsets, then 2E uint32 entries (edge << 1 | 1 if traversed b->a)
  route-edges.bin   E x 24 bytes: uint32 a, uint32 b, uint32 length (decimeters), uint32 name index,
                    uint32 geometry offset (points), uint8 car speed km/h (0 = no cars), uint8 class,
                    uint8 flags (1 oneway a->b, 2 oneway b->a, 4 walk allowed, 8 private, 16 unpaved), uint8 0
  route-geom.bin    int16 (dlat, dlon) pairs in 1e-6 degrees: the shape of every edge from node a to node b,
                    each step relative to the previous point (the first step from node a); long steps are
                    split so every step fits in int16. Geometry offset and count are in steps.
A graph node is any point where two roads meet or a road ends; everything in between is shape only.
"""
import json, os, re, sys
from array import array
import numpy as np
import osmium

CLASSES = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'service',
           'living_street', 'track', 'road', 'path', 'footway', 'cycleway', 'bridleway', 'steps', 'pedestrian']
LINK = {'motorway_link': 'motorway', 'trunk_link': 'trunk', 'primary_link': 'primary', 'secondary_link': 'secondary', 'tertiary_link': 'tertiary'}
# Default car speeds (km/h) when the road has no usable maxspeed: typical Florida speeds.
SPEED = {'motorway': 105, 'trunk': 88, 'primary': 72, 'secondary': 64, 'tertiary': 56, 'unclassified': 48,
         'residential': 40, 'service': 24, 'living_street': 16, 'track': 16, 'road': 40}
LINK_SPEED = 56
CAR = set(SPEED)
NO_CAR_ACCESS = {'no', 'agricultural', 'forestry', 'delivery', 'emergency'}
SKIP_SERVICE = {'parking_aisle', 'drive-through'}
SKIP_FOOTWAY = {'sidewalk', 'crossing'}  # sidewalks run next to roads you can already walk on


def mph(v):
    m = re.match(r'^\s*(\d+)\s*(mph)?', v or '')
    if not m:
        return None
    n = int(m.group(1))
    return round(n * 1.609) if m.group(2) or n < 90 else n


class Roads(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.ids = array('q')      # node ids of every way, concatenated
        self.lat = array('i')
        self.lon = array('i')
        self.wstart = array('I', [0])
        self.wattr = []            # (speed, cls, flags, name)
        self.names = {'': 0}

    def way(self, w):
        t = w.tags
        hw = t.get('highway')
        cls = LINK.get(hw, hw)
        if cls not in CLASSES:
            return
        if hw == 'service' and t.get('service') in SKIP_SERVICE:
            return
        if hw == 'footway' and t.get('footway') in SKIP_FOOTWAY:
            return
        if t.get('area') == 'yes':
            return
        access = t.get('motor_vehicle') or t.get('motorcar') or t.get('vehicle') or t.get('access') or ''
        flags = 0
        speed = 0
        if cls in CAR and access not in NO_CAR_ACCESS:
            speed = mph(t.get('maxspeed')) or (LINK_SPEED if hw in LINK else SPEED[cls])
            if cls == 'track' or t.get('surface') in ('sand', 'dirt', 'ground', 'unpaved', 'gravel', 'grass'):
                speed = min(speed, 32)
                flags |= 16
            if access in ('private', 'destination', 'customers'):
                flags |= 8
            ow = t.get('oneway')
            if ow in ('yes', 'true', '1') or (ow is None and (hw in ('motorway', 'motorway_link') or t.get('junction') == 'roundabout')):
                flags |= 1
            elif ow == '-1':
                flags |= 2
        foot = t.get('foot') or t.get('access') or ''
        if cls not in ('motorway', 'trunk') and hw not in LINK and foot not in ('no', 'private'):
            flags |= 4
        if cls == 'trunk' and t.get('foot') in ('yes', 'designated'):
            flags |= 4
        if speed == 0 and not flags & 4:
            return
        ref = t.get('ref') or ''
        name = t.get('name') or ''
        label = name if not ref else (f'{name} ({ref})' if name and ref not in name else ref)
        ni = self.names.setdefault(label, len(self.names))
        try:
            for n in w.nodes:
                self.ids.append(n.ref)
                self.lat.append(round(n.location.lat * 1e6))
                self.lon.append(round(n.location.lon * 1e6))
        except osmium.InvalidLocationError:
            del self.ids[self.wstart[-1]:]
            del self.lat[self.wstart[-1]:]
            del self.lon[self.wstart[-1]:]
            return
        self.wstart.append(len(self.ids))
        self.wattr.append((min(speed, 255), CLASSES.index(cls), flags, ni))


src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
h = Roads()
h.apply_file(src, locations=True, idx='flex_mem')
ids = np.frombuffer(h.ids, dtype=np.int64)
lat = np.frombuffer(h.lat, dtype=np.int32)
lon = np.frombuffer(h.lon, dtype=np.int32)
ws = np.frombuffer(h.wstart, dtype=np.uint32).astype(np.int64)
print(f'{len(h.wattr)} ways, {len(ids)} way nodes')

# A node becomes a graph node if it is used more than once (a junction) or ends a way.
uniq, counts = np.unique(ids, return_counts=True)
is_graph = counts > 1
ends = np.concatenate([ids[ws[:-1]], ids[ws[1:] - 1]])
is_graph[np.searchsorted(uniq, ends)] = True
gidx_of_uniq = np.full(len(uniq), -1, dtype=np.int64)
gidx_of_uniq[is_graph] = np.arange(int(is_graph.sum()))
pos = np.searchsorted(uniq, ids)
gnode = gidx_of_uniq[pos]  # graph index per way node, -1 for shape points
N = int(is_graph.sum())
node_lat = np.zeros(N, dtype=np.int32)
node_lon = np.zeros(N, dtype=np.int32)
m = gnode >= 0
node_lat[gnode[m]] = lat[m]
node_lon[gnode[m]] = lon[m]
print(f'{N} graph nodes')

ea, eb, elen, ename, egeo, espd, ecls, eflg = (array('I'), array('I'), array('I'), array('I'), array('I'), array('B'), array('B'), array('B'))
glat, glon = array('i'), array('i')
R = 6371008.8
for wi, (spd, cls, flg, ni) in enumerate(h.wattr):
    s, e = int(ws[wi]), int(ws[wi + 1])
    start = s
    for k in range(s + 1, e):
        if gnode[k] < 0 and k != e - 1:
            continue
        a, b = int(gnode[start]), int(gnode[k])
        if a == b and k - start < 2:
            start = k
            continue
        la = lat[start:k + 1].astype(np.float64) * 1e-6
        lo = lon[start:k + 1].astype(np.float64) * 1e-6
        dlat = np.radians(np.diff(la))
        dlon = np.radians(np.diff(lo)) * np.cos(np.radians((la[1:] + la[:-1]) / 2))
        length = float(np.sum(np.sqrt(dlat * dlat + dlon * dlon)) * R)
        ea.append(a); eb.append(b); elen.append(max(1, round(length * 10))); ename.append(ni)
        egeo.append(len(glat)); espd.append(spd); ecls.append(cls); eflg.append(flg)
        pl, po = int(lat[start]), int(lon[start])
        for j in range(start + 1, k + 1):
            tl, to = int(lat[j]), int(lon[j])
            n = max(1, -(-max(abs(tl - pl), abs(to - po)) // 32000))
            for q in range(1, n + 1):
                ql, qo = pl + (tl - pl) * q // n, po + (to - po) * q // n
                glat.append(ql - (pl + (tl - pl) * (q - 1) // n)); glon.append(qo - (po + (to - po) * (q - 1) // n))
            pl, po = tl, to
        start = k
E = len(ea)
print(f'{E} edges, {len(glat)} shape points')

# adjacency: for each node, the edges you can leave it by (either direction; one-way rules are checked when routing)
A = np.frombuffer(ea, dtype=np.uint32).astype(np.int64)
B = np.frombuffer(eb, dtype=np.uint32).astype(np.int64)
src_nodes = np.concatenate([A, B])
entries = np.concatenate([np.arange(E, dtype=np.int64) << 1, (np.arange(E, dtype=np.int64) << 1) | 1])
order = np.argsort(src_nodes, kind='stable')
offsets = np.zeros(N + 1, dtype=np.uint32)
np.add.at(offsets, src_nodes + 1, 1)
offsets = np.cumsum(offsets).astype(np.uint32)

with open(os.path.join(out, 'route-nodes.bin'), 'wb') as fh:
    fh.write(np.stack([node_lat, node_lon], axis=1).astype('<i4').tobytes())
with open(os.path.join(out, 'route-adj.bin'), 'wb') as fh:
    fh.write(offsets.astype('<u4').tobytes())
    fh.write(entries[order].astype('<u4').tobytes())
rec = np.zeros(E, dtype=[('a', '<u4'), ('b', '<u4'), ('len', '<u4'), ('name', '<u4'), ('geo', '<u4'), ('spd', 'u1'), ('cls', 'u1'), ('flg', 'u1'), ('pad', 'u1')])
rec['a'] = A; rec['b'] = B; rec['len'] = np.frombuffer(elen, dtype=np.uint32); rec['name'] = np.frombuffer(ename, dtype=np.uint32)
rec['geo'] = np.frombuffer(egeo, dtype=np.uint32); rec['spd'] = np.frombuffer(espd, dtype=np.uint8)
rec['cls'] = np.frombuffer(ecls, dtype=np.uint8); rec['flg'] = np.frombuffer(eflg, dtype=np.uint8)
with open(os.path.join(out, 'route-edges.bin'), 'wb') as fh:
    fh.write(rec.tobytes())
with open(os.path.join(out, 'route-geom.bin'), 'wb') as fh:
    fh.write(np.stack([np.frombuffer(glat, dtype=np.int32), np.frombuffer(glon, dtype=np.int32)], axis=1).astype('<i2').tobytes())
# one extra record so the app can read the step count of the last edge as geo[e+1] - geo[e]
with open(os.path.join(out, 'route-edges.bin'), 'ab') as fh:
    end = np.zeros(1, dtype=rec.dtype)
    end['geo'] = len(glat)
    fh.write(end.tobytes())
names = [''] * len(h.names)
for k, v in h.names.items():
    names[v] = k
with open(os.path.join(out, 'route-meta.json'), 'w', encoding='utf-8') as fh:
    json.dump({'version': 1, 'nodes': N, 'edges': E, 'points': len(glat), 'classes': CLASSES, 'names': names}, fh, ensure_ascii=False, separators=(',', ':'))
print('done')
