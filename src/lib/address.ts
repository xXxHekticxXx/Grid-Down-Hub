// Offline address search: about 2 million Florida addresses from OpenStreetMap, stored on the device by the
// "addresses" data pack (built by pipeline/build_addresses.py). Normalization here must match that script.
import { packFile } from './packs';
import { parseCoords, distanceM } from './geo';

export type AddressHit = { label: string; sub: string; lat: number; lon: number; kind: 'exact' | 'near' | 'street' | 'place' | 'coords' };

const SUFFIX: Record<string, string> = {
  street: 'st', str: 'st', avenue: 'ave', av: 'ave', road: 'rd', drive: 'dr', lane: 'ln', boulevard: 'blvd',
  court: 'ct', circle: 'cir', place: 'pl', terrace: 'ter', highway: 'hwy', trail: 'trl', parkway: 'pkwy',
  way: 'way', point: 'pt', square: 'sq', loop: 'loop', run: 'run', path: 'path', cove: 'cv', crossing: 'xing',
  north: 'n', south: 's', east: 'e', west: 'w', northeast: 'ne', northwest: 'nw', southeast: 'se', southwest: 'sw',
  mount: 'mt', saint: 'st',
};
const PREFIX: [RegExp, string][] = [
  [/\b(county road|county rd|co rd|cr)\s*/g, 'cr '], [/\b(state road|state rd|state highway|sr)\s*/g, 'sr '],
  [/\b(us highway|us hwy|u s highway|us)\s*/g, 'us '], [/\b(interstate|i)\s*-?\s*(?=\d)/g, 'i '],
];
const DIRS = new Set(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']);

export function normAddr(s: string) {
  let t = s.toLowerCase().replace(/[.,#]/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [re, rep] of PREFIX) t = t.replace(re, rep);
  return t.split(' ').filter(Boolean).map((w) => SUFFIX[w] ?? w).join(' ');
}
const core = (n: string) => {
  const w = n.split(' ');
  return w.length > 1 && DIRS.has(w[0]) ? w.slice(1).join(' ') : n;
};
const shardOf = (n: string) => {
  const k = core(n).replace(/[^a-z0-9]/g, '').slice(0, 2);
  return k.length === 2 ? k : (k + '_').slice(0, 2);
};

type Index = { streets: [string, string, string, string, string][]; shards: Record<string, [number, number]>; places: [string, string, string, number, number][] };
let idx: Promise<{ ix: Index; byCore: Map<string, number[]>; data: File } | null> | null = null;

/** True when the address pack is installed on this device. */
export async function addressesInstalled() {
  return !!(await packFile('addresses', 'addr-index.json'));
}

function load() {
  if (!idx)
    idx = (async () => {
      const f = await packFile('addresses', 'addr-index.json');
      const data = await packFile('addresses', 'addr-data.tsv');
      if (!f || !data) return null;
      const ix = JSON.parse(await f.text()) as Index;
      const byCore = new Map<string, number[]>();
      ix.streets.forEach((s, i) => {
        const c = core(s[0]);
        const a = byCore.get(c);
        if (a) a.push(i);
        else byCore.set(c, [i]);
      });
      return { ix, byCore, data };
    })().catch(() => (idx = null));
  return idx;
}
export function resetAddresses() {
  idx = null;
}

const numVal = (n: string) => parseInt(n, 10);
const title = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/** Search addresses, streets, towns and coordinates. `near` ranks results by distance (lon, lat). */
export async function searchAddress(q: string, near?: [number, number], limit = 8): Promise<AddressHit[] | null> {
  const raw = q.trim();
  if (!raw) return [];
  const c = parseCoords(raw);
  if (c) return [{ label: `${c[1].toFixed(5)}, ${c[0].toFixed(5)}`, sub: 'coordinates', lat: c[1], lon: c[0], kind: 'coords' }];
  const L = await load();
  if (!L) return null;
  const { ix, byCore, data } = L;
  let t = normAddr(raw);
  let zip = '';
  const z = t.match(/\b(\d{5})$/);
  if (z && t.split(' ').length > 1) {
    zip = z[1];
    t = t.slice(0, -5).trim();
  }
  t = t.replace(/\b(fl|florida)$/, '').trim();
  let num = '';
  const m = t.match(/^(\d+[a-z]?)\s+(.+)$/);
  if (m) {
    num = m[1];
    t = m[2];
  }
  const words = t.split(' ');
  // Find the longest leading run of words that names a street; what's left is the town.
  let ids: number[] = [];
  let cityPart = '';
  let dir = '';
  for (let k = words.length; k >= 1 && !ids.length; k--) {
    let w = words.slice(0, k);
    let d = '';
    if (w.length > 1 && DIRS.has(w[0])) {
      d = w[0];
      w = w.slice(1);
    }
    const hit = byCore.get(w.join(' '));
    if (hit) {
      ids = hit;
      dir = d;
      cityPart = words.slice(k).join(' ');
    }
  }
  if (!ids.length) {
    // Typed part of a street name: prefix match on the core name.
    const pre = core(t);
    if (pre.length >= 3) for (const [k, v] of byCore) if (k.startsWith(pre) && (ids.length < 400)) ids.push(...v);
  }
  const ne = (a: string) => normAddr(a);
  let streets = ids.map((i) => ({ i, s: ix.streets[i] }));
  if (dir) {
    const d = streets.filter((x) => x.s[0].startsWith(dir + ' '));
    if (d.length) streets = d;
  }
  if (cityPart || zip) {
    const f = streets.filter((x) => (!zip || x.s[3] === zip) && (!cityPart || ne(x.s[2]).startsWith(cityPart)));
    if (f.length) streets = f;
  }
  const hits: AddressHit[] = [];
  if (streets.length) {
    const want = new Set(streets.map((x) => x.i));
    const shards = [...new Set(streets.map((x) => x.s[4] || shardOf(x.s[0])))];
    const rows: { sid: number; n: string; lat: number; lon: number }[] = [];
    for (const sh of shards) {
      const r = ix.shards[sh];
      if (!r) continue;
      const text = await data.slice(r[0], r[0] + r[1]).text();
      for (const line of text.split('\n')) {
        const tab = line.indexOf('\t');
        if (tab < 0) continue;
        const sid = +line.slice(0, tab);
        if (!want.has(sid)) continue;
        const [, n, la, lo] = line.split('\t');
        rows.push({ sid, n, lat: +la / 1e5, lon: +lo / 1e5 });
      }
    }
    const place = (s: Index['streets'][number]) => [s[2], s[3]].filter(Boolean).join(' ');
    if (num) {
      for (const r of rows.filter((x) => x.n.toLowerCase() === num)) {
        const s = ix.streets[r.sid];
        hits.push({ label: `${r.n} ${s[1]}${s[2] ? ', ' + s[2] : ''}${s[3] ? ' ' + s[3] : ''}`, sub: 'exact match', lat: r.lat, lon: r.lon, kind: 'exact' });
      }
      if (!hits.length) {
        // Not in the map data: the nearest house number on each matching street.
        const want2 = numVal(num);
        const best = new Map<number, (typeof rows)[number]>();
        for (const r of rows) {
          const v = numVal(r.n);
          if (Number.isNaN(v)) continue;
          const b = best.get(r.sid);
          if (!b || Math.abs(numVal(b.n) - want2) > Math.abs(v - want2)) best.set(r.sid, r);
        }
        for (const r of best.values()) {
          const s = ix.streets[r.sid];
          hits.push({ label: `${r.n} ${s[1]}${place(s) ? ', ' + place(s) : ''}`, sub: `closest number to ${num} in the map data`, lat: r.lat, lon: r.lon, kind: 'near' });
        }
      }
    }
    // The street itself: the middle of its addresses.
    const bySid = new Map<number, typeof rows>();
    for (const r of rows) (bySid.get(r.sid) ?? bySid.set(r.sid, []).get(r.sid)!).push(r);
    for (const [sid, rs] of bySid) {
      rs.sort((a, b) => numVal(a.n) - numVal(b.n));
      const mid = rs[Math.floor(rs.length / 2)];
      const s = ix.streets[sid];
      hits.push({ label: `${s[1]}${place(s) ? ', ' + place(s) : ''}`, sub: `the street (${rs.length} addresses)`, lat: mid.lat, lon: mid.lon, kind: 'street' });
    }
  }
  // Towns and neighborhoods
  if (!num) {
    const pt = normAddr(raw);
    for (const p of ix.places) if (p[0] === pt || (pt.length >= 3 && p[0].startsWith(pt))) hits.push({ label: p[1], sub: title(p[2] || 'place'), lat: p[3], lon: p[4], kind: 'place' });
  }
  const rank = { exact: 0, coords: 0, near: 1, place: 2, street: 3 } as const;
  hits.sort((a, b) => rank[a.kind] - rank[b.kind] || (near ? distanceM(near, [a.lon, a.lat]) - distanceM(near, [b.lon, b.lat]) : 0));
  const seen = new Set<string>();
  return hits.filter((h) => !seen.has(h.label) && seen.add(h.label)).slice(0, limit);
}
