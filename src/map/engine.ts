// Connects installed map packs to MapLibre. PMTiles archives are read straight out of device
// storage (no server, no network), one small slice per tile.
import maplibregl from 'maplibre-gl';
import { Protocol, PMTiles, FileSource } from 'pmtiles';
import { packFile } from '../lib/packs';

let protocol: Protocol | null = null;
export function ensureProtocol() {
  if (!protocol) {
    protocol = new Protocol({ metadata: false });
    maplibregl.addProtocol('pmtiles', protocol.tile);
  }
  return protocol;
}

const opened = new Map<string, PMTiles>();

/** Returns a pmtiles:// url for an installed pack file, or null if that pack isn't installed. */
export async function pmtilesUrl(pack: string, file: string): Promise<string | null> {
  const key = `${pack}/${file}`;
  const p = ensureProtocol();
  if (!opened.has(key)) {
    const f = await packFile(pack, file);
    if (!f) return null;
    const src = new FileSource(new File([f], key, { type: 'application/octet-stream' }));
    const pm = new PMTiles(src);
    p.add(pm);
    opened.set(key, pm);
  }
  return `pmtiles://${key}`;
}

/** User-imported PMTiles files (Maps > Add a map). */
export async function pmtilesFromFile(key: string, f: File) {
  const p = ensureProtocol();
  if (!opened.has(key)) {
    const pm = new PMTiles(new FileSource(new File([f], key)));
    p.add(pm);
    opened.set(key, pm);
  }
  const h = await opened.get(key)!.getHeader();
  return { url: `pmtiles://${key}`, header: h };
}

export function forget(key: string) {
  opened.delete(key);
}

export function assetUrl(rel: string) {
  // MapLibre needs absolute URLs for glyphs and sprites; keep the {fontstack}/{range} tokens unencoded.
  const b = new URL(import.meta.env.BASE_URL, location.href).href;
  return b + rel;
}
