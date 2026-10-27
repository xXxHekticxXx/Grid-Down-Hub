// Data packs: maps, topo overlay, map layers and Library PDFs. Each file is served in chunks;
// every chunk is checked against its SHA-256 before it is written, so a bad or partial
// download is caught and that chunk alone is fetched again.
import { get, put } from './db';
import * as fsx from './opfs';

export type ChunkInfo = { bytes: number; sha256: string };
export type PackFile = { name: string; bytes: number; sha256: string; chunks: ChunkInfo[] };
export type Pack = {
  id: string;
  title: string;
  description: string;
  required: boolean;
  bytes: number;
  files: PackFile[];
  date: string;
};
export type Manifest = { version: number; built: string; osmDate: string; contentChecked: string; packs: Pack[] };
export type PackState = { done: Record<string, number[]>; complete: boolean; verifiedAt?: string; source?: string };

export const isNative = () => !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();

/** Where packs are downloaded from: the GitHub Pages site (the PWA's own origin, or remote for the Android app). */
export const DEFAULT_REMOTE = 'https://xxxhekticxxx.github.io/Grid-Down-Hub/';
export async function dataBase(): Promise<string> {
  const custom = await get<string>('kv', 'dataBase');
  if (custom) return custom.endsWith('/') ? custom : custom + '/';
  if (isNative()) return DEFAULT_REMOTE;
  return new URL(import.meta.env.BASE_URL, location.href).href;
}

let manifestCache: Manifest | null = null;
export async function loadManifest(refresh = false): Promise<Manifest | null> {
  if (manifestCache && !refresh) return manifestCache;
  const saved = await get<Manifest>('kv', 'manifest');
  if (!refresh && saved) return (manifestCache = saved);
  try {
    const r = await fetch((await dataBase()) + 'data/manifest.json', { cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    const m = (await r.json()) as Manifest;
    await put('kv', 'manifest', m);
    return (manifestCache = m);
  } catch {
    return (manifestCache = saved ?? null);
  }
}

export const packPath = (packId: string, file: string) => `packs/${packId}/${file}`;

export async function packState(id: string): Promise<PackState> {
  return (await get<PackState>('kv', `pack:${id}`)) ?? { done: {}, complete: false };
}

export async function packFile(packId: string, name: string): Promise<File | null> {
  const st = await packState(packId);
  if (!st.complete) return null;
  return fsx.getFile(packPath(packId, name));
}

async function sha256(buf: ArrayBuffer) {
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export type Progress = { pack: string; file: string; bytesDone: number; bytesTotal: number; chunk: number; chunks: number };

/** Download one pack. Resumes where it stopped; returns when every chunk is verified and written. */
export async function downloadPack(pack: Pack, onProgress: (p: Progress) => void, signal?: AbortSignal) {
  const baseUrl = await dataBase();
  const st = await packState(pack.id);
  const total = pack.bytes;
  let done = pack.files.reduce(
    (s, f) => s + (st.done[f.name] ?? []).reduce((a, i) => a + f.chunks[i].bytes, 0),
    0,
  );
  for (const f of pack.files) {
    const have = new Set(st.done[f.name] ?? []);
    let offset = 0;
    for (let i = 0; i < f.chunks.length; i++) {
      const c = f.chunks[i];
      if (!have.has(i)) {
        let ok = false;
        for (let attempt = 0; attempt < 4 && !ok; attempt++) {
          if (signal?.aborted) throw new DOMException('Stopped', 'AbortError');
          try {
            const url = `${baseUrl}data/${pack.id}/${f.name}.${String(i).padStart(3, '0')}`;
            const r = await fetch(url, { signal, cache: 'no-store' });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const buf = await r.arrayBuffer();
            if (buf.byteLength !== c.bytes || (await sha256(buf)) !== c.sha256) throw new Error('checksum mismatch');
            await fsx.writeAt(packPath(pack.id, f.name), offset, buf);
            ok = true;
          } catch (e) {
            if ((e as Error).name === 'AbortError') throw e;
            if (attempt === 3) throw new Error(`${f.name} part ${i + 1}: ${(e as Error).message}`);
            await new Promise((z) => setTimeout(z, 1500 * (attempt + 1)));
          }
        }
        have.add(i);
        st.done[f.name] = [...have];
        await put('kv', `pack:${pack.id}`, st);
        done += c.bytes;
      }
      offset += c.bytes;
      onProgress({ pack: pack.id, file: f.name, bytesDone: done, bytesTotal: total, chunk: i + 1, chunks: f.chunks.length });
    }
    await fsx.truncate(packPath(pack.id, f.name), f.bytes);
  }
  st.complete = true;
  st.verifiedAt = new Date().toISOString();
  st.source = baseUrl;
  await put('kv', `pack:${pack.id}`, st);
}

/** Install a pack file the user picked from their own storage (sideloading, no internet). */
export async function importPackFile(pack: Pack, file: File, onProgress?: (frac: number) => void) {
  const pf = pack.files.find((f) => f.name === file.name) ?? (pack.files.length === 1 ? pack.files[0] : undefined);
  if (!pf) throw new Error(`${file.name} is not part of ${pack.title}`);
  if (file.size !== pf.bytes) throw new Error(`${file.name} is ${file.size} bytes; expected ${pf.bytes}`);
  const st = await packState(pack.id);
  let off = 0;
  const done: number[] = [];
  for (let i = 0; i < pf.chunks.length; i++) {
    const c = pf.chunks[i];
    const buf = await file.slice(off, off + c.bytes).arrayBuffer();
    if ((await sha256(buf)) !== c.sha256) throw new Error(`${file.name}: part ${i + 1} does not match the published checksum`);
    await fsx.writeAt(packPath(pack.id, pf.name), off, buf);
    done.push(i);
    off += c.bytes;
    onProgress?.(off / pf.bytes);
  }
  st.done[pf.name] = done;
  st.complete = pack.files.every((f) => (st.done[f.name]?.length ?? 0) === f.chunks.length);
  if (st.complete) st.verifiedAt = new Date().toISOString();
  st.source = 'imported file';
  await put('kv', `pack:${pack.id}`, st);
}

/** Re-check every installed file against the manifest checksums (Settings > Check all files). */
export async function verifyPack(pack: Pack, onProgress?: (frac: number) => void): Promise<{ ok: boolean; bad: string[] }> {
  const bad: string[] = [];
  let doneBytes = 0;
  for (const f of pack.files) {
    const file = await fsx.getFile(packPath(pack.id, f.name));
    if (!file || file.size !== f.bytes) {
      bad.push(f.name);
      continue;
    }
    let off = 0;
    for (const c of f.chunks) {
      const buf = await file.slice(off, off + c.bytes).arrayBuffer();
      if ((await sha256(buf)) !== c.sha256) {
        bad.push(f.name);
        break;
      }
      off += c.bytes;
      doneBytes += c.bytes;
      onProgress?.(doneBytes / pack.bytes);
    }
  }
  return { ok: bad.length === 0, bad };
}

export async function deletePack(pack: Pack) {
  await fsx.removeDir(`packs/${pack.id}`).catch(() => undefined);
  const d = await navigator.storage.getDirectory();
  try {
    const p = await d.getDirectoryHandle('packs');
    await p.removeEntry(pack.id, { recursive: true });
  } catch {
    /* gone */
  }
  await put('kv', `pack:${pack.id}`, { done: {}, complete: false });
}
