// Maps by state: an offline map for every US state (Florida ships built in). The list comes from
// states.json; each map is one PMTiles file on the "state-maps" GitHub release. The phone app fetches it
// in 32 MB parts (HTTP ranges) through Android's own networking, checks every part's SHA-256 and writes it
// into app storage, so a download can stop and pick up where it left off.
import { CapacitorHttp } from '@capacitor/core';
import { get, put } from './db';
import * as fsx from './opfs';
import { isNative, packState, packPath, deletePack, importPackFile, type Pack } from './packs';

export type StatePack = Pack & { code: string };
export type StateIndex = { version: number; built: string; base: string; packs: StatePack[] };

const INDEX_URLS = [
  'https://raw.githubusercontent.com/xXxHekticxXx/Grid-Down-Hub/data-packs/data/states.json',
  'https://xxxhekticxxx.github.io/Grid-Down-Hub/data/states.json',
];
export const RELEASE_BASE = 'https://github.com/xXxHekticxXx/Grid-Down-Hub/releases/download/state-maps/';
/** States that border Florida, listed first. */
export const NEAR = ['GA', 'AL'];

export async function loadStateIndex(refresh = false): Promise<StateIndex | null> {
  const saved = await get<StateIndex>('kv', 'states');
  if (saved && !refresh) return saved;
  for (const u of INDEX_URLS) {
    try {
      const r = await fetch(u, { cache: 'no-store' });
      if (!r.ok) continue;
      const idx = (await r.json()) as StateIndex;
      if (!idx.packs?.length) continue;
      await put('kv', 'states', idx);
      return idx;
    } catch {
      /* offline: try the next one, then fall back to the saved list */
    }
  }
  return saved ?? null;
}

/** State maps that are fully downloaded, for the map screen. */
export async function installedStates(): Promise<StatePack[]> {
  const idx = await get<StateIndex>('kv', 'states');
  if (!idx) return [];
  const out: StatePack[] = [];
  for (const p of idx.packs) if ((await packState(p.id)).complete) out.push(p);
  return out;
}

export const fileUrl = (idx: StateIndex | null, p: StatePack) => (idx?.base || RELEASE_BASE) + p.files[0].name;

// ---------- downloads (keep running when the screen closes) ----------

export type Job = { id: string; done: number; total: number; error?: string; running: boolean };
const jobs = new Map<string, Job>();
const stops = new Map<string, AbortController>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());
export const subscribeJobs = (f: () => void) => {
  listeners.add(f);
  return () => void listeners.delete(f);
};
export const jobFor = (id: string) => jobs.get(id);

function b64ToBuf(s: string): ArrayBuffer {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

async function sha256(buf: ArrayBuffer) {
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function fetchRange(url: string, from: number, to: number): Promise<ArrayBuffer> {
  const headers = { Range: `bytes=${from}-${to}` };
  if (isNative()) {
    // Android's networking: follows GitHub's redirect and isn't limited by browser cross-site rules.
    const r = await CapacitorHttp.request({ url, method: 'GET', headers, responseType: 'arraybuffer', connectTimeout: 30000, readTimeout: 120000 });
    if (r.status !== 206 && r.status !== 200) throw new Error(`HTTP ${r.status}`);
    return typeof r.data === 'string' ? b64ToBuf(r.data) : (r.data as ArrayBuffer);
  }
  const r = await fetch(url, { headers, cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.arrayBuffer();
}

export async function startDownload(idx: StateIndex | null, p: StatePack) {
  if (jobs.get(p.id)?.running) return;
  const ctl = new AbortController();
  stops.set(p.id, ctl);
  const f = p.files[0];
  const st = await packState(p.id);
  const have = new Set(st.done[f.name] ?? []);
  const job: Job = { id: p.id, done: [...have].reduce((a, i) => a + f.chunks[i].bytes, 0), total: p.bytes, running: true };
  jobs.set(p.id, job);
  emit();
  const url = fileUrl(idx, p);
  try {
    let offset = 0;
    for (let i = 0; i < f.chunks.length; i++) {
      const c = f.chunks[i];
      if (!have.has(i)) {
        let ok = false;
        for (let attempt = 0; attempt < 4 && !ok; attempt++) {
          if (ctl.signal.aborted) throw new DOMException('Stopped', 'AbortError');
          try {
            const buf = await fetchRange(url, offset, offset + c.bytes - 1);
            if (buf.byteLength !== c.bytes || (await sha256(buf)) !== c.sha256) throw new Error('part did not check out');
            await fsx.writeAt(packPath(p.id, f.name), offset, buf);
            ok = true;
          } catch (e) {
            if ((e as Error).name === 'AbortError') throw e;
            if (attempt === 3) throw new Error(`part ${i + 1} of ${f.chunks.length}: ${(e as Error).message}`);
            await new Promise((z) => setTimeout(z, 2000 * (attempt + 1)));
          }
        }
        have.add(i);
        st.done[f.name] = [...have];
        await put('kv', `pack:${p.id}`, st);
        job.done += c.bytes;
        emit();
      }
      offset += c.bytes;
    }
    await fsx.truncate(packPath(p.id, f.name), f.bytes);
    st.complete = true;
    st.verifiedAt = new Date().toISOString();
    st.source = url;
    await put('kv', `pack:${p.id}`, st);
    job.running = false;
  } catch (e) {
    job.running = false;
    job.error = (e as Error).name === 'AbortError' ? undefined : (e as Error).message;
  }
  emit();
}

export function stopDownload(id: string) {
  stops.get(id)?.abort();
}

export async function removeState(p: StatePack) {
  stopDownload(p.id);
  await deletePack(p);
  jobs.delete(p.id);
  emit();
}

/** Website version: the browser can't fetch from the release directly, so the file is downloaded by hand and imported. */
export async function importState(p: StatePack, file: File, onProgress?: (f: number) => void) {
  await importPackFile(p, file, onProgress);
  emit();
}
