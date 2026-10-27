// Small helpers: storage (IndexedDB), settings, geo, status checks.

// ---------- IndexedDB key/value ----------
const DB = 'grid-down-hub';
function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
export async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await open();
  return new Promise((res, rej) => {
    const q = db.transaction('kv').objectStore('kv').get(key);
    q.onsuccess = () => res(q.result as T | undefined);
    q.onerror = () => rej(q.error);
  });
}
export async function idbSet(key: string, val: unknown): Promise<void> {
  const db = await open();
  return new Promise((res, rej) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(val, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

// ---------- settings (per-device conveniences, safe if storage is blocked) ----------
export type Settings = { night: boolean; saver: boolean; sound: boolean; ssLast?: string };
const DEFAULTS: Settings = { night: false, saver: false, sound: true };
export function loadSettings(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('gdh-settings') || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}
export function saveSettings(s: Settings) {
  try {
    localStorage.setItem('gdh-settings', JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
export function applyTheme(s: Settings) {
  const el = document.documentElement;
  el.dataset.theme = s.night ? 'night' : 'day';
  el.dataset.saver = s.saver || s.night ? '1' : '0';
  if (s.saver && !s.night) el.dataset.theme = 'saver';
}

// ---------- geo ----------
export const HOME = { lat: 28.8086, lon: -81.5633 };
export function dm(v: number, pos: string, neg: string) {
  const h = v >= 0 ? pos : neg;
  const a = Math.abs(v);
  const d = Math.floor(a);
  const m = (a - d) * 60;
  return `${d}° ${m.toFixed(2)}′ ${h}`;
}
export const fmtDec = (lat: number, lon: number) =>
  `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'W'}`;
export const fmtDM = (lat: number, lon: number) => `${dm(lat, 'N', 'S')}, ${dm(lon, 'E', 'W')}`;
const rad = (d: number) => (d * Math.PI) / 180;
export function distKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
export function bearing(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}
const PTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export const compass = (deg: number) => PTS[Math.round(deg / 22.5) % 16];
export function fmtDist(km: number) {
  const mi = km * 0.621371;
  return mi < 0.1 ? `${Math.round(km * 3280.84)} ft` : `${mi.toFixed(1)} mi (${km.toFixed(1)} km)`;
}

// ---------- device status ----------
export function fmtBytes(n: number) {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(0)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}
export type Status = { sw: boolean; cached: number; persisted: boolean | null; usage: number; quota: number };
export async function readStatus(): Promise<Status> {
  let sw = false;
  let cached = 0;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    sw = !!reg?.active;
    for (const k of await caches.keys()) {
      if (k.includes('precache')) cached += (await (await caches.open(k)).keys()).length;
    }
  } catch {
    /* ignore */
  }
  let persisted: boolean | null = null;
  let usage = 0;
  let quota = 0;
  try {
    persisted = (await navigator.storage?.persisted?.()) ?? null;
    const e = await navigator.storage?.estimate?.();
    usage = e?.usage ?? 0;
    quota = e?.quota ?? 0;
  } catch {
    /* ignore */
  }
  return { sw, cached, persisted, usage, quota };
}
export const offlineReady = (s: Status) => s.sw && s.cached > 0;

export function download(name: string, text: string, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
