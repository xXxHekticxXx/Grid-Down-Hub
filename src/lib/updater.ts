// Updates that patch like a normal app.
//
// Phone (Android app): when there's internet, the app checks app-update.json on the Grid-Down Hub site. A newer
// build of the app's screens and content downloads in the background, its SHA-256 is checked, and it is switched
// in the next time the app goes to the background, so the next time you open it you're on the new version. Your
// plan, pins, notes and map packs are untouched. If a new version ever needs a new APK (a change to the Android
// part itself), the app says so and one tap opens the installer.
//
// Laptop and browsers: the service worker fetches the new version in the background and the page switches to it.
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { App } from '@capacitor/app';
import { native } from './native';
import { DEFAULT_REMOTE } from './packs';
import { get, put } from './db';

declare const __BUILD_NUMBER__: number;
declare const __APP_VERSION__: string;

/** Raise this when a release changes the Android side (native plugins, permissions, capacitor.config). */
export const NATIVE_LEVEL = 2;

export const APP_VERSION = __APP_VERSION__;
export const BUILD_NUMBER = __BUILD_NUMBER__;

type UpdateInfo = { version: string; build: number; nativeLevel: number; bundle: string; checksum: string; apk: string; notes?: string };
export type UpdateState =
  | { kind: 'current'; checked: number }
  | { kind: 'downloading'; version: string }
  | { kind: 'ready'; version: string }
  | { kind: 'apk'; version: string; apk: string }
  | { kind: 'offline' }
  | { kind: 'error'; message: string };

const CHECK_EVERY = 6 * 60 * 60 * 1000;
let running: Promise<UpdateState> | null = null;
const listeners = new Set<(s: UpdateState) => void>();
let last: UpdateState | null = null;

export const onUpdateState = (fn: (s: UpdateState) => void) => {
  listeners.add(fn);
  if (last) fn(last);
  return () => void listeners.delete(fn);
};
const emit = (s: UpdateState) => {
  last = s;
  listeners.forEach((f) => f(s));
  return s;
};

/** Call once at startup. Tells the update system this version started fine (otherwise it rolls back). */
export async function startUpdater() {
  if (!native()) return;
  try {
    await CapacitorUpdater.notifyAppReady();
  } catch {
    /* plugin missing in an old APK: nothing to do */
  }
  void checkForUpdate(false);
  void App.addListener('resume', () => void checkForUpdate(false));
}

export function checkForUpdate(force: boolean): Promise<UpdateState> {
  if (!running) running = doCheck(force).finally(() => (running = null));
  return running;
}

async function doCheck(force: boolean): Promise<UpdateState> {
  if (!navigator.onLine) return emit({ kind: 'offline' });
  const lastCheck = (await get<number>('kv', 'updateChecked')) ?? 0;
  const pending = await get<string>('kv', 'updatePending');
  if (!force && Date.now() - lastCheck < CHECK_EVERY) return emit(pending ? { kind: 'ready', version: pending } : { kind: 'current', checked: lastCheck });
  try {
    const r = await fetch(`${native() ? DEFAULT_REMOTE : import.meta.env.BASE_URL}app-update.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) throw new Error(`update check failed (${r.status})`);
    const u = (await r.json()) as UpdateInfo;
    await put('kv', 'updateChecked', Date.now());
    if (!native()) {
      // Browser: the service worker does the work; just ask it to look now.
      const reg = await navigator.serviceWorker?.getRegistration();
      await reg?.update();
      return emit({ kind: 'current', checked: Date.now() });
    }
    if (u.build <= BUILD_NUMBER) {
      await put('kv', 'updatePending', null);
      return emit({ kind: 'current', checked: Date.now() });
    }
    if (u.nativeLevel > NATIVE_LEVEL) return emit({ kind: 'apk', version: u.version, apk: u.apk });
    if (pending === u.version) return emit({ kind: 'ready', version: u.version });
    emit({ kind: 'downloading', version: u.version });
    const bundle = await CapacitorUpdater.download({ url: new URL(u.bundle, DEFAULT_REMOTE).href, version: u.version, checksum: u.checksum });
    await CapacitorUpdater.next({ id: bundle.id }); // switched in when the app next goes to the background
    await put('kv', 'updatePending', u.version);
    return emit({ kind: 'ready', version: u.version });
  } catch (e) {
    return emit({ kind: 'error', message: (e as Error).message });
  }
}

/** Switch to a downloaded version right now (reloads the app). */
export async function applyNow() {
  const list = await CapacitorUpdater.list();
  const pending = await get<string>('kv', 'updatePending');
  const b = list.bundles.find((x) => x.version === pending);
  await put('kv', 'updatePending', null);
  if (b) await CapacitorUpdater.set({ id: b.id });
}
