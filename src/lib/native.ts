// Thin wrappers that use the Android app's native features when present and web APIs otherwise.
import { Capacitor } from '@capacitor/core';

export const native = () => Capacitor.isNativePlatform();

export async function keepAwake(on: boolean) {
  try {
    if (native()) {
      const { KeepAwake } = await import('@capacitor-community/keep-awake');
      await (on ? KeepAwake.keepAwake() : KeepAwake.allowSleep());
      return;
    }
    if (on) {
      wakeLock = await (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinel> } }).wakeLock?.request('screen') ?? null;
    } else {
      await wakeLock?.release();
      wakeLock = null;
    }
  } catch {
    /* not supported; the screen may dim */
  }
}
let wakeLock: WakeLockSentinel | null = null;

/** Save or share a file the app made (PDF, backup, GPX). */
export async function saveFile(name: string, blob: Blob) {
  if (native()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const data = await new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result).split(',')[1]);
      fr.onerror = () => rej(fr.error);
      fr.readAsDataURL(blob);
    });
    const r = await Filesystem.writeFile({ path: name, data, directory: Directory.Documents, recursive: true });
    try {
      await Share.share({ title: name, url: r.uri, dialogTitle: 'Save, print or send' });
    } catch {
      /* user closed the share sheet; the file is still in Documents */
    }
    return `Saved to Documents/${name}`;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 4000);
  return `Downloaded ${name}`;
}

export type Fix = { lon: number; lat: number; acc: number; heading: number | null; speed: number | null; alt: number | null; time: number };

/** Watch GPS. Works with no cell service or internet: GPS comes from satellites. */
export function watchPosition(cb: (f: Fix) => void, err: (m: string) => void): () => void {
  let stop = () => undefined as void;
  if (native()) {
    import('@capacitor/geolocation').then(async ({ Geolocation }) => {
      try {
        const perm = await Geolocation.checkPermissions();
        if (perm.location !== 'granted') await Geolocation.requestPermissions();
        const id = await Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 30000, maximumAge: 2000 }, (p, e) => {
          if (e || !p) return err(e?.message || 'No GPS fix yet');
          cb({ lon: p.coords.longitude, lat: p.coords.latitude, acc: p.coords.accuracy, heading: p.coords.heading ?? null, speed: p.coords.speed ?? null, alt: p.coords.altitude ?? null, time: p.timestamp });
        });
        stop = () => void Geolocation.clearWatch({ id });
      } catch (e) {
        err((e as Error).message);
      }
    });
    return () => stop();
  }
  if (!('geolocation' in navigator)) {
    err('This device has no location service.');
    return () => undefined;
  }
  const id = navigator.geolocation.watchPosition(
    (p) => cb({ lon: p.coords.longitude, lat: p.coords.latitude, acc: p.coords.accuracy, heading: p.coords.heading, speed: p.coords.speed, alt: p.coords.altitude, time: p.timestamp }),
    (e) => err(e.code === 1 ? 'Location permission is off. Turn it on for this app in Settings.' : e.code === 3 ? 'Waiting for a GPS fix. Go outside or near a window.' : e.message),
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 30000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

/** Compass heading in degrees (true north when the device reports it). */
export function watchHeading(cb: (deg: number | null) => void): () => void {
  type OE = DeviceOrientationEvent & { webkitCompassHeading?: number };
  const handler = (e: Event) => {
    const o = e as OE;
    if (typeof o.webkitCompassHeading === 'number') return cb(o.webkitCompassHeading);
    if (o.absolute && o.alpha != null) return cb((360 - o.alpha + 360) % 360);
  };
  const evt = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
  window.addEventListener(evt, handler, true);
  const t = setTimeout(() => cb(null), 4000);
  const first = (e: Event) => {
    clearTimeout(t);
    window.removeEventListener(evt, first, true);
    handler(e);
  };
  window.addEventListener(evt, first, true);
  return () => {
    clearTimeout(t);
    window.removeEventListener(evt, handler, true);
    window.removeEventListener(evt, first, true);
  };
}

// ---- Flashlight (phone torch through the camera) ----
let torchTrack: MediaStreamTrack | null = null;
export async function torch(on: boolean): Promise<boolean> {
  try {
    if (!on) {
      torchTrack?.stop();
      torchTrack = null;
      return true;
    }
    if (!torchTrack) {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
      torchTrack = stream.getVideoTracks()[0];
    }
    const caps = (torchTrack.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
    if (!caps.torch) {
      torchTrack.stop();
      torchTrack = null;
      return false;
    }
    await torchTrack.applyConstraints({ advanced: [{ torch: true } as MediaTrackConstraintSet] });
    return true;
  } catch {
    torchTrack?.stop();
    torchTrack = null;
    return false;
  }
}
export async function torchSet(lit: boolean) {
  if (!torchTrack) return;
  try {
    await torchTrack.applyConstraints({ advanced: [{ torch: lit } as MediaTrackConstraintSet] });
  } catch {
    /* ignore */
  }
}

export async function vibrate(ms: number | number[]) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* ignore */
  }
}
