#!/usr/bin/env python3
"""Planned routes from Sorrento to the Ocala NF springs, computed on OpenStreetMap roads.
usage: make_routes.py <drive.geojsonseq from osmium export> <out routes.geojson>"""
import json, math, heapq, sys
from collections import defaultdict
def hav(a,b):
    R=6371000; la1,la2=math.radians(a[1]),math.radians(b[1]); dl=math.radians(b[0]-a[0])
    h=math.sin((la2-la1)/2)**2+math.cos(la1)*math.cos(la2)*math.sin(dl/2)**2
    return 2*R*math.asin(math.sqrt(h))
edges=defaultdict(list)
for line in open(sys.argv[1]):
    line=line.strip('\x1e\n')
    if not line: continue
    f=json.loads(line); p=f['properties']; cs=[tuple(round(v,7) for v in c) for c in f['geometry']['coordinates']]
    oneway=p.get('oneway')=='yes'
    refs=set(r.strip() for r in (p.get('ref') or '').split(';') if r.strip())
    for a,b in zip(cs,cs[1:]):
        d=hav(a,b); edges[a].append((b,d,refs))
        if not oneway: edges[b].append((a,d,refs))
nodes=list(edges)
def near(pt): return min(nodes,key=lambda n:(n[0]-pt[0])**2+(n[1]-pt[1])**2)
def route(pts, pref):
    path=[]
    for s,t in zip(pts,pts[1:]):
        s,t=near(s),near(t); dist={s:0}; prev={}; q=[(0,s)]
        while q:
            d,u=heapq.heappop(q)
            if u==t: break
            if d>dist.get(u,1e18): continue
            for v,w,refs in edges[u]:
                nd=d+w*(1 if refs & pref else 4)
                if nd<dist.get(v,1e18): dist[v]=nd; prev[v]=u; heapq.heappush(q,(nd,v))
        seg=[t]
        while seg[-1]!=s: seg.append(prev[seg[-1]])
        seg.reverse(); path+= seg if not path else seg[1:]
    miles=sum(hav(a,b) for a,b in zip(path,path[1:]))/1609.344
    return path, miles
HOME=(-81.5603,28.8075)
ALEX=(-81.5770,29.0800); JUNI=(-81.7120,29.1830); SALT=(-81.7330,29.3510); EUSTIS=(-81.6850,28.8530); ALTOONA=(-81.6470,28.9690); CR439N=(-81.598,28.958)
R=[('Primary: Sorrento to Alexander Springs (CR 437, SR 44, SR 19, CR 445)','#1F5C36',[HOME,EUSTIS,ALTOONA,ALEX],{'CR 437','SR 44','SR 19','CR 445','US 441'}),
   ('Primary: Sorrento to Juniper Springs (SR 19, SR 40)','#2E7D32',[HOME,EUSTIS,ALTOONA,JUNI],{'CR 437','SR 44','SR 19','SR 40'}),
   ('Primary: Sorrento to Salt Springs (SR 19)','#33691E',[HOME,EUSTIS,ALTOONA,SALT],{'CR 437','SR 44','SR 19'}),
   ('Backup A: CR 439 and CR 42 to SR 19','#B26A00',[HOME,CR439N,ALTOONA,ALEX],{'CR 437','SR 44','CR 439','CR 42','SR 19','CR 445'})]
feats=[]
for name,color,pts,pref in R:
    path,mi=route(pts,pref)
    feats.append({'type':'Feature','properties':{'name':f'{name}, {mi:.0f} mi','color':color,'miles':round(mi,1)},'geometry':{'type':'LineString','coordinates':[list(p) for p in path[::1]]}})
    print(name, round(mi,1), len(path))
json.dump({'type':'FeatureCollection','features':feats},open(sys.argv[2],'w'),separators=(',',':'))
