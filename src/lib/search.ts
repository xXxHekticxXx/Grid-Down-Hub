// Offline full-text search across articles, both manuals, Library PDFs, checklists,
// map places (POIs) and everything the user has added.
import MiniSearch, { type SearchResult } from 'minisearch';
import { packFile } from './packs';
import { all } from './db';
import type { Pin, UserItem } from '../types';

const OPTIONS = {
  fields: ['title', 'tags', 'text'],
  storeFields: ['type', 'title', 'ref', 'cat'],
  searchOptions: { boost: { title: 4, tags: 2 }, prefix: true, fuzzy: 0.15 },
};

export type Hit = { id: string; type: string; title: string; ref: string; cat: string; score: number; snippet: string };

let builtin: Promise<{ ms: MiniSearch; snippets: Record<string, string> }> | null = null;
function loadBuiltin() {
  if (!builtin) {
    const base = import.meta.env.BASE_URL;
    builtin = Promise.all([
      fetch(base + 'content/search-index.json').then((r) => r.text()),
      fetch(base + 'content/search-snippets.json').then((r) => r.json()),
    ]).then(([idx, snippets]) => ({ ms: MiniSearch.loadJSON(idx, OPTIONS), snippets }));
  }
  return builtin;
}

let places: Promise<{ ms: MiniSearch; rows: Record<string, string> } | null> | null = null;
export function resetPlaces() {
  places = null;
}
async function loadPlaces() {
  if (!places) {
    places = (async () => {
      const f = await packFile('pois', 'pois-index.json');
      if (!f) return null;
      const rows = JSON.parse(await f.text()) as [string, string, string, number, number][];
      const ms = new MiniSearch({ fields: ['title', 'text'], storeFields: ['type', 'title', 'ref', 'cat'], searchOptions: { prefix: true, fuzzy: 0.15, boost: { title: 3 } } });
      const snip: Record<string, string> = {};
      ms.addAll(rows.map(([k, name, addr, lon, lat], i) => {
        const id = `poi:${i}`;
        snip[id] = `${KIND_LABEL[k] ?? k}${addr ? ' · ' + addr : ''}`;
        return { id, type: 'place', title: name, ref: `${lon},${lat},${k}`, cat: k, text: `${KIND_LABEL[k] ?? k} ${addr}` };
      }));
      // shelters are not in the OSM index; add them from their own layer
      const sh = await packFile('pois', 'poi-shelter.geojson');
      if (sh) {
        const gj = JSON.parse(await sh.text()) as { features: { geometry: { coordinates: [number, number] }; properties: Record<string, string | boolean> }[] };
        gj.features.forEach((ft, i) => {
          const p = ft.properties;
          const id = `shelter:${i}`;
          snip[id] = `Public shelter · ${p.street}, ${p.city}${p.pets ? ' · pet-friendly' : ''} · confirm open via AlertLake`;
          ms.add({ id, type: 'place', title: String(p.name), ref: `${ft.geometry.coordinates[0]},${ft.geometry.coordinates[1]},shelter`, cat: 'shelter', text: `shelter emergency shelter ${p.street} ${p.city} ${p.pets ? 'pet friendly pets' : ''}` });
        });
      }
      return { ms, rows: snip };
    })();
  }
  return places;
}

export const KIND_LABEL: Record<string, string> = {
  hospital: 'Hospital', urgent_care: 'Urgent care', fire: 'Fire station', police: 'Police', pharmacy: 'Pharmacy', gas: 'Gas station',
  grocery: 'Grocery', store: 'Convenience store', hardware: 'Hardware / feed store', outdoor: 'Outdoor / sporting goods', spring: 'Spring (treat before drinking)',
  boat_ramp: 'Boat ramp', water_tap: 'Water tap (treat before drinking)', lake: 'Lake (treat before drinking)', campground: 'Campground', park: 'Park / forest',
  ranger: 'Ranger station', church: 'Church', school: 'School', shelter: 'Public shelter',
};

function snippetFor(text: string, terms: string[]) {
  const lower = text.toLowerCase();
  let pos = -1;
  for (const t of terms) {
    pos = lower.indexOf(t.toLowerCase());
    if (pos >= 0) break;
  }
  if (pos < 0) return text.slice(0, 160);
  const s = Math.max(0, pos - 60);
  return (s > 0 ? '…' : '') + text.slice(s, s + 180) + '…';
}

export async function search(q: string, limit = 60): Promise<Hit[]> {
  q = q.trim();
  if (!q) return [];
  const { ms, snippets } = await loadBuiltin();
  const out: Hit[] = [];
  const add = (r: SearchResult, snip: string) =>
    out.push({ id: r.id, type: r.type, title: r.title, ref: r.ref, cat: r.cat, score: r.score, snippet: snippetFor(snip, r.terms) });
  for (const r of ms.search(q)) add(r, snippets[r.id] ?? '');
  const p = await loadPlaces();
  if (p) for (const r of p.ms.search(q).slice(0, 40)) add({ ...r, score: r.score * 0.8 }, p.rows[r.id] ?? '');
  // user content: searched live
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const match = (s: string) => words.every((w) => s.toLowerCase().includes(w));
  for (const it of await all<UserItem>('items')) {
    const text = `${it.title} ${it.body ?? ''}`;
    if (match(text)) out.push({ id: `u:${it.id}`, type: 'mine', title: it.title, ref: it.id, cat: it.section, score: 50, snippet: snippetFor(it.body ?? '', words) });
  }
  for (const pin of await all<Pin>('pins')) {
    if (match(`${pin.name} ${pin.note ?? ''}`)) out.push({ id: `pin:${pin.id}`, type: 'pin', title: pin.name, ref: `${pin.lon},${pin.lat},pin`, cat: 'mypins', score: 40, snippet: pin.note ?? 'My pin' });
  }
  const userPdfText = await all<{ id: string; title: string; pages: string[] }>('files').then((fs) => fs.filter((f) => Array.isArray(f.pages)));
  for (const f of userPdfText) {
    f.pages.forEach((t, i) => {
      if (match(t)) out.push({ id: `upd:${f.id}:${i}`, type: 'pdf', title: `${f.title}, page ${i + 1}`, ref: `user:${f.id}/${i + 1}`, cat: 'library', score: 30, snippet: snippetFor(t, words) });
    });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}
