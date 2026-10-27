// One encrypted file that carries everything the user made: My Plan, pins, tracks, their pages,
// photos, voice notes, PDFs, checklists, inventory, timers and settings. Built-in content and the
// big map packs are not included (they come with the app).
import { entries, put, clear, type StoreName } from './db';
import { seal, open, blobToB64, b64ToBlob, type Sealed } from './crypto';
import { getFile, writeFile } from './opfs';

const STORES: StoreName[] = ['plan', 'pins', 'items', 'checklists', 'inventory', 'files', 'tracks', 'usermaps', 'kv'];
const KV_KEEP = /^(settings|userSections|hiddenChecklists|fuel|goplan|stayplan|dataBase)$/;

type Packed = { app: 'grid-down-hub'; v: 1; exported: string; stores: Record<string, [string, unknown][]>; opfs: Record<string, string>; timers?: string };

async function packValue(v: unknown): Promise<unknown> {
  if (v instanceof Blob) return { __blob: await blobToB64(v), type: v.type };
  if (Array.isArray(v)) return Promise.all(v.map(packValue));
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) o[k] = await packValue(x);
    return o;
  }
  return v;
}
function unpackValue(v: unknown): unknown {
  if (v && typeof v === 'object' && '__blob' in (v as Record<string, unknown>)) {
    const b = v as { __blob: string; type: string };
    return b64ToBlob(b.__blob, b.type);
  }
  if (Array.isArray(v)) return v.map(unpackValue);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, unpackValue(x)]));
  return v;
}

export async function exportAll(pass: string): Promise<Blob> {
  const stores: Packed['stores'] = {};
  const opfs: Record<string, string> = {};
  for (const s of STORES) {
    const rows = await entries<unknown>(s);
    stores[s] = [];
    for (const [k, v] of rows) {
      if (s === 'kv' && !KV_KEEP.test(k)) continue;
      stores[s].push([k, await packValue(v)]);
      const rec = v as { opfs?: string };
      if (s === 'files' && rec?.opfs) {
        const f = await getFile(rec.opfs);
        if (f) opfs[rec.opfs] = await blobToB64(f);
      }
    }
  }
  let timers: string | undefined;
  try {
    timers = localStorage.getItem('gdh-timers') ?? undefined;
  } catch {
    timers = undefined;
  }
  const payload: Packed = { app: 'grid-down-hub', v: 1, exported: new Date().toISOString(), stores, opfs, timers };
  const sealed = await seal(payload, pass);
  return new Blob([JSON.stringify(sealed)], { type: 'application/json' });
}

export async function importAll(file: File, pass: string, mode: 'replace' | 'merge'): Promise<{ counts: Record<string, number> }> {
  const sealed = JSON.parse(await file.text()) as Sealed;
  const p = await open<Packed>(sealed, pass);
  if (p.app !== 'grid-down-hub') throw new Error('Not a Grid-Down Hub backup.');
  const counts: Record<string, number> = {};
  for (const s of STORES) {
    const rows = p.stores[s] ?? [];
    if (mode === 'replace' && s !== 'kv') await clear(s);
    for (const [k, v] of rows) await put(s, k, unpackValue(v));
    counts[s] = rows.length;
  }
  for (const [path, b64] of Object.entries(p.opfs ?? {})) await writeFile(path, b64ToBlob(b64, 'application/pdf'));
  if (p.timers) {
    try {
      localStorage.setItem('gdh-timers', p.timers);
    } catch {
      /* ignore */
    }
  }
  return { counts };
}

/** A stable fingerprint of the user's data, used by the automated test to prove an export imports identically. */
export async function fingerprint(): Promise<string> {
  const parts: string[] = [];
  for (const s of STORES) {
    const rows = (await entries<unknown>(s)).filter(([k]) => s !== 'kv' || KV_KEEP.test(k)).sort(([a], [b]) => a.localeCompare(b));
    for (const [k, v] of rows) parts.push(`${s}/${k}=${JSON.stringify(await packValue(v))}`);
  }
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parts.join('\n')));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
