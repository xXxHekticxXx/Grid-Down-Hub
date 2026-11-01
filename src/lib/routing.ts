// Offline turn-by-turn routing over the Florida road graph (pipeline/build_routing.py).
// Everything runs on the phone: A* search on the graph, then turn instructions from the road shapes.

export type Mode = 'drive' | 'walk';
export type LonLat = [number, number];

export type RouteGraph = {
  N: number;
  E: number;
  nodes: Int32Array; // lat, lon pairs (1e-6 degrees)
  adjOff: Uint32Array; // N + 1
  adj: Uint32Array; // edge << 1 | reversed
  eu32: Uint32Array; // per edge: a, b, length dm, name, geometry offset, (bytes: speed, class, flags, 0)
  eu8: Uint8Array;
  geom: Int16Array | null; // loaded lazily; see readGeom
  readGeom: (from: number, count: number) => Promise<Int16Array>;
  names: string[];
  classes: string[];
};

export type Step = {
  type: 'depart' | 'turn' | 'continue' | 'arrive';
  modifier?: 'left' | 'right' | 'slight left' | 'slight right' | 'sharp left' | 'sharp right' | 'uturn' | 'straight';
  road: string; // the road you are on after this step
  text: string;
  at: LonLat; // where the step happens
  distM: number; // distance from the start of the route to this step
  pointIndex: number; // index into the route line
};

export type Route = {
  mode: Mode;
  line: LonLat[]; // full shape
  cumM: number[]; // distance from start at each point of line
  distanceM: number;
  durationS: number;
  steps: Step[];
  edges: number[]; // edge ids in order
  via: string[]; // main roads, for the summary
};

const F_ONEWAY_FWD = 1;
const F_ONEWAY_BACK = 2;
const F_WALK = 4;
const F_PRIVATE = 8;
const WALK_MS = 1.34; // 3 mph
const MAX_KMH = 120;

export function graphFromBuffers(meta: { nodes: number; edges: number; names: string[]; classes: string[] }, nodes: ArrayBuffer, adj: ArrayBuffer, edges: ArrayBuffer, readGeom: (from: number, count: number) => Promise<Int16Array>): RouteGraph {
  const N = meta.nodes;
  const all = new Uint32Array(adj);
  return {
    N, E: meta.edges, nodes: new Int32Array(nodes), adjOff: all.subarray(0, N + 1), adj: all.subarray(N + 1),
    eu32: new Uint32Array(edges), eu8: new Uint8Array(edges), geom: null, readGeom, names: meta.names, classes: meta.classes,
  };
}

const ea = (g: RouteGraph, e: number) => g.eu32[e * 6];
const eb = (g: RouteGraph, e: number) => g.eu32[e * 6 + 1];
const elen = (g: RouteGraph, e: number) => g.eu32[e * 6 + 2] / 10;
const ename = (g: RouteGraph, e: number) => g.names[g.eu32[e * 6 + 3]] || '';
const egeo = (g: RouteGraph, e: number) => g.eu32[e * 6 + 4];
const espd = (g: RouteGraph, e: number) => g.eu8[e * 24 + 20];
const ecls = (g: RouteGraph, e: number) => g.classes[g.eu8[e * 24 + 21]];
const eflg = (g: RouteGraph, e: number) => g.eu8[e * 24 + 22];
const nodeLL = (g: RouteGraph, n: number): LonLat => [g.nodes[n * 2 + 1] / 1e6, g.nodes[n * 2] / 1e6];

/** Can this edge be used in this direction? Returns the cost in seconds, or -1. */
function edgeCost(g: RouteGraph, e: number, reversed: boolean, mode: Mode, blocked: Set<number> | null, penalty: Map<number, number> | null): number {
  if (blocked?.has(e)) return -1;
  const f = eflg(g, e);
  const len = elen(g, e);
  let c: number;
  if (mode === 'walk') {
    if (!(f & F_WALK)) return -1;
    c = len / WALK_MS;
  } else {
    const s = espd(g, e);
    if (!s) return -1;
    if (reversed ? f & F_ONEWAY_FWD : f & F_ONEWAY_BACK) return -1;
    c = len / (s / 3.6);
    if (f & F_PRIVATE) c = c * 5 + 60; // only use private roads to reach a place on them
  }
  const p = penalty?.get(e);
  return p ? c * p : c;
}

function dist(a: LonLat, b: LonLat) {
  const R = 6371008.8;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLon = ((b[0] - a[0]) * Math.PI) / 180 * Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLon * dLon) * R;
}

/** Nearest graph node that has at least one usable road for this mode. */
export function nearestNode(g: RouteGraph, p: LonLat, mode: Mode): { node: number; distM: number } {
  const lat = p[1] * 1e6;
  const lon = p[0] * 1e6;
  const k = Math.cos((p[1] * Math.PI) / 180);
  let best = -1;
  let bestD = Infinity;
  const nodes = g.nodes;
  for (let n = 0; n < g.N; n++) {
    const dy = nodes[n * 2] - lat;
    const dx = (nodes[n * 2 + 1] - lon) * k;
    const d = dx * dx + dy * dy;
    if (d >= bestD) continue;
    let ok = false;
    for (let i = g.adjOff[n]; i < g.adjOff[n + 1]; i++) {
      const v = g.adj[i];
      if (mode === 'walk' ? eflg(g, v >>> 1) & F_WALK : espd(g, v >>> 1)) { ok = true; break; }
    }
    if (ok) { best = n; bestD = d; }
  }
  return { node: best, distM: Math.sqrt(bestD) * 0.111195 };
}

// Search state reused between searches (the graph has millions of nodes).
let gScore: Float64Array | null = null;
let came: Int32Array | null = null;
let closed: Uint8Array | null = null;

class Heap {
  k = new Float64Array(1 << 16);
  v = new Int32Array(1 << 16);
  n = 0;
  push(key: number, val: number) {
    if (this.n === this.k.length) {
      const k2 = new Float64Array(this.n * 2); k2.set(this.k); this.k = k2;
      const v2 = new Int32Array(this.n * 2); v2.set(this.v); this.v = v2;
    }
    let i = this.n++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.k[p] <= key) break;
      this.k[i] = this.k[p]; this.v[i] = this.v[p]; i = p;
    }
    this.k[i] = key; this.v[i] = val;
  }
  pop(): number {
    const top = this.v[0];
    const key = this.k[--this.n];
    const val = this.v[this.n];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= this.n) break;
      if (c + 1 < this.n && this.k[c + 1] < this.k[c]) c++;
      if (this.k[c] >= key) break;
      this.k[i] = this.k[c]; this.v[i] = this.v[c]; i = c;
    }
    this.k[i] = key; this.v[i] = val;
    return top;
  }
}

/** A* from node s to node t. Returns the list of (edge << 1 | reversed), or null if no route. */
function search(g: RouteGraph, s: number, t: number, mode: Mode, blocked: Set<number> | null, penalty: Map<number, number> | null): number[] | null {
  if (!gScore || gScore.length !== g.N) {
    gScore = new Float64Array(g.N).fill(Infinity);
    came = new Int32Array(g.N).fill(-1);
    closed = new Uint8Array(g.N);
  }
  const touched: number[] = [];
  const speed = mode === 'walk' ? WALK_MS : MAX_KMH / 3.6;
  const tLat = g.nodes[t * 2];
  const tLon = g.nodes[t * 2 + 1];
  const k = Math.cos((tLat / 1e6) * Math.PI / 180);
  const h = (n: number) => {
    const dy = g.nodes[n * 2] - tLat;
    const dx = (g.nodes[n * 2 + 1] - tLon) * k;
    return (Math.sqrt(dx * dx + dy * dy) * 0.111195) / speed;
  };
  const heap = new Heap();
  gScore[s] = 0; touched.push(s);
  heap.push(h(s), s);
  let found = false;
  while (heap.n) {
    const u = heap.pop();
    if (closed![u]) continue;
    closed![u] = 1;
    if (u === t) { found = true; break; }
    const gu = gScore[u];
    for (let i = g.adjOff[u]; i < g.adjOff[u + 1]; i++) {
      const v = g.adj[i];
      const e = v >>> 1;
      const rev = (v & 1) === 1;
      const c = edgeCost(g, e, rev, mode, blocked, penalty);
      if (c < 0) continue;
      const w = rev ? ea(g, e) : eb(g, e);
      const ng = gu + c;
      if (ng < gScore[w]) {
        if (gScore[w] === Infinity) touched.push(w);
        gScore[w] = ng;
        came![w] = v;
        heap.push(ng + h(w), w);
      }
    }
  }
  let path: number[] | null = null;
  if (found) {
    path = [];
    let n = t;
    while (n !== s) {
      const v = came![n];
      path.push(v);
      n = v & 1 ? eb(g, v >>> 1) : ea(g, v >>> 1);
    }
    path.reverse();
  }
  for (const n of touched) { gScore[n] = Infinity; came![n] = -1; closed![n] = 0; }
  return path;
}

async function edgeShape(g: RouteGraph, e: number, rev: boolean): Promise<LonLat[]> {
  const off = egeo(g, e);
  const cnt = g.eu32[(e + 1) * 6 + 4] - off;
  const d = await g.readGeom(off, cnt);
  const a = ea(g, e);
  let lat = g.nodes[a * 2];
  let lon = g.nodes[a * 2 + 1];
  const pts: LonLat[] = [[lon / 1e6, lat / 1e6]];
  for (let i = 0; i < cnt; i++) {
    lat += d[i * 2]; lon += d[i * 2 + 1];
    pts.push([lon / 1e6, lat / 1e6]);
  }
  return rev ? pts.reverse() : pts;
}

function bearing(a: LonLat, b: LonLat) {
  const r = Math.PI / 180;
  const y = Math.sin((b[0] - a[0]) * r) * Math.cos(b[1] * r);
  const x = Math.cos(a[1] * r) * Math.sin(b[1] * r) - Math.sin(a[1] * r) * Math.cos(b[1] * r) * Math.cos((b[0] - a[0]) * r);
  return ((Math.atan2(y, x) / r) + 360) % 360;
}

function turnModifier(delta: number): Step['modifier'] {
  const d = ((delta + 540) % 360) - 180; // -180..180, positive = right
  const a = Math.abs(d);
  if (a < 20) return 'straight';
  if (a > 160) return 'uturn';
  const side = d > 0 ? 'right' : 'left';
  if (a < 45) return `slight ${side}` as Step['modifier'];
  if (a > 125) return `sharp ${side}` as Step['modifier'];
  return side;
}

const roadLabel = (r: string) => r || 'the road';
/** Same road under different labels ("CR 437" and "Sanford Road (CR 437)") counts as one road. */
const roadKey = (r: string) => {
  const m = r.match(/\(([^)]+)\)$/);
  return (m ? m[1] : r).toLowerCase();
};
const ROAD_RANK: Record<string, number> = { motorway: 7, trunk: 6, primary: 5, secondary: 4, tertiary: 3, unclassified: 2, residential: 1 };

/** Build a full route (shape, steps, distance, time) from a path. */
async function buildRoute(g: RouteGraph, path: number[], mode: Mode, from: LonLat, to: LonLat): Promise<Route> {
  const line: LonLat[] = [from];
  const cumM: number[] = [0];
  const steps: Step[] = [];
  let durationS = 0;
  let prevName: string | null = null;
  let prevBearing = 0;
  const roadMeters = new Map<string, number>();
  for (let i = 0; i < path.length; i++) {
    const v = path[i];
    const e = v >>> 1;
    const rev = (v & 1) === 1;
    const shape = await edgeShape(g, e, rev);
    const name = ename(g, e);
    const cls = ecls(g, e);
    const c = edgeCost(g, e, rev, mode, null, null);
    durationS += c > 0 ? c : 0;
    roadMeters.set(name, (roadMeters.get(name) ?? 0) + elen(g, e) * (ROAD_RANK[cls] ?? 0.5));
    const startIdx = line.length - 1;
    const b0 = bearing(shape[0], shape[Math.min(1, shape.length - 1)]);
    if (i === 0) {
      steps.push({ type: 'depart', road: name, text: mode === 'walk' ? `Walk along ${roadLabel(name)}` : `Head out on ${roadLabel(name)}`, at: shape[0], distM: cumM[startIdx], pointIndex: startIdx });
    } else if (roadKey(name) !== roadKey(prevName ?? '')) {
      const mod = turnModifier(b0 - prevBearing);
      const verb = mod === 'straight' ? 'Continue' : mod === 'uturn' ? 'Make a U-turn' : `Turn ${mod}`;
      const text = name ? `${verb} onto ${name}` : mod === 'straight' ? 'Continue straight' : verb;
      steps.push({ type: mod === 'straight' ? 'continue' : 'turn', modifier: mod, road: name, text, at: shape[0], distM: cumM[startIdx], pointIndex: startIdx });
    } else {
      // same road, but a real corner (a road that bends at a junction): say it only for sharp turns
      const mod = turnModifier(b0 - prevBearing);
      if (mod && mod !== 'straight' && !mod.startsWith('slight')) {
        steps.push({ type: 'turn', modifier: mod, road: name, text: `Turn ${mod} to stay on ${roadLabel(name)}`, at: shape[0], distM: cumM[startIdx], pointIndex: startIdx });
      }
    }
    for (let j = i === 0 ? 0 : 1; j < shape.length; j++) {
      const p = shape[j];
      cumM.push(cumM[cumM.length - 1] + dist(line[line.length - 1], p));
      line.push(p);
    }
    prevName = name;
    prevBearing = bearing(shape[Math.max(0, shape.length - 2)], shape[shape.length - 1]);
  }
  cumM.push(cumM[cumM.length - 1] + dist(line[line.length - 1], to));
  line.push(to);
  steps.push({ type: 'arrive', road: '', text: 'Arrive at your destination', at: to, distM: cumM[cumM.length - 1], pointIndex: line.length - 1 });
  const byKey = new Map<string, [string, number]>();
  for (const [n, m] of roadMeters) {
    if (!n) continue;
    const label = n.replace(/^.*\((.+)\)$/, '$1');
    const k = roadKey(n);
    byKey.set(k, [label, (byKey.get(k)?.[1] ?? 0) + m]);
  }
  const via = [...byKey.values()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n);
  return { mode, line, cumM, distanceM: cumM[cumM.length - 1], durationS, steps, edges: path.map((v) => v >>> 1), via };
}

/** Best route plus up to one clearly different alternative. */
export async function findRoutes(g: RouteGraph, from: LonLat, to: LonLat, mode: Mode, blocked: Set<number> | null): Promise<Route[]> {
  const s = nearestNode(g, from, mode);
  const t = nearestNode(g, to, mode);
  if (s.node < 0 || t.node < 0) return [];
  const p1 = search(g, s.node, t.node, mode, blocked, null);
  if (!p1) return [];
  const r1 = await buildRoute(g, p1, mode, from, to);
  const out = [r1];
  const pen = new Map<number, number>();
  for (const v of p1) pen.set(v >>> 1, 2.5);
  const p2 = search(g, s.node, t.node, mode, blocked, pen);
  if (p2) {
    const shared = p2.filter((v) => pen.has(v >>> 1)).length / p2.length;
    const r2 = await buildRoute(g, p2, mode, from, to);
    if (shared < 0.7 && r2.durationS < r1.durationS * 1.5) out.push(r2);
  }
  return out;
}

/** Edges near a point (for "avoid this road"): the closest road segment for this mode. */
export function nearestEdge(g: RouteGraph, p: LonLat, mode: Mode): number {
  const { node } = nearestNode(g, p, mode);
  if (node < 0) return -1;
  let best = -1;
  let bestD = Infinity;
  for (let i = g.adjOff[node]; i < g.adjOff[node + 1]; i++) {
    const e = g.adj[i] >>> 1;
    const other = g.adj[i] & 1 ? ea(g, e) : eb(g, e);
    const m = nodeLL(g, other);
    const n = nodeLL(g, node);
    const mid: LonLat = [(m[0] + n[0]) / 2, (m[1] + n[1]) / 2];
    const d = dist(mid, p);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

/** All edges of the same road continuing from an edge, up to the next junction with a different road
 * (so "block SR 19 here" blocks the stretch between crossroads, not just a few feet). */
export function roadStretch(g: RouteGraph, e: number): number[] {
  const name = g.eu32[e * 6 + 3];
  const out = new Set([e]);
  const walk = (n: number) => {
    for (let guard = 0; guard < 200; guard++) {
      const next: number[] = [];
      let crossing = false;
      for (let i = g.adjOff[n]; i < g.adjOff[n + 1]; i++) {
        const x = g.adj[i] >>> 1;
        if (out.has(x)) continue;
        if (g.eu32[x * 6 + 3] === name) next.push(g.adj[i]);
        else if (espd(g, x)) crossing = true;
      }
      if (crossing || next.length !== 1) return;
      const v = next[0];
      out.add(v >>> 1);
      n = v & 1 ? ea(g, v >>> 1) : eb(g, v >>> 1);
    }
  };
  walk(ea(g, e));
  walk(eb(g, e));
  return [...out];
}

export const edgeName = (g: RouteGraph, e: number) => ename(g, e);
export const edgeEnds = (g: RouteGraph, e: number): [LonLat, LonLat] => [nodeLL(g, ea(g, e)), nodeLL(g, eb(g, e))];

/** Where the user is along the route: nearest point index and distance off the line (meters). */
export function progressOnRoute(r: Route, p: LonLat, fromIndex = 0): { index: number; offM: number; alongM: number } {
  let best = fromIndex;
  let bestD = Infinity;
  const end = Math.min(r.line.length - 1, fromIndex + 400);
  for (let i = Math.max(0, fromIndex - 5); i < end; i++) {
    const a = r.line[i];
    const b = r.line[i + 1];
    // distance from p to segment ab in a local flat projection
    const k = Math.cos((p[1] * Math.PI) / 180);
    const ax = (a[0] - p[0]) * k, ay = a[1] - p[1], bx = (b[0] - p[0]) * k, by = b[1] - p[1];
    const dx = bx - ax, dy = by - ay;
    const L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L)) : 0;
    const x = ax + t * dx, y = ay + t * dy;
    const d = Math.sqrt(x * x + y * y) * 111195;
    if (d < bestD) { bestD = d; best = i; }
  }
  const along = r.cumM[best] + dist(r.line[best], p);
  return { index: best, offM: bestD, alongM: Math.min(along, r.distanceM) };
}
