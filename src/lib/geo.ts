import * as mgrs from 'mgrs';

const R = 6371008.8; // mean Earth radius, meters
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function distanceM(a: [number, number], b: [number, number]) {
  const [lon1, lat1] = a.map(rad);
  const [lon2, lat2] = b.map(rad);
  const h = Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial true bearing from a to b, degrees 0-360. */
export function bearingDeg(a: [number, number], b: [number, number]) {
  const [lon1, lat1] = a.map(rad);
  const [lon2, lat2] = b.map(rad);
  const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

import { declination } from './wmm';

/** Sorrento town center: used for declination until a GPS fix is available. */
export const HOME_AREA: [number, number] = [-81.5603, 28.8075];

/** Magnetic declination (east positive) from the World Magnetic Model for this place and today's date. */
export const declinationAt = (at: [number, number] = HOME_AREA, date = new Date()) => declination(at[1], at[0], date);

/** Compass (magnetic) bearing for a true bearing measured at `at`. */
export const magneticFromTrue = (t: number, at: [number, number] = HOME_AREA) => (((t - declinationAt(at)) % 360) + 360) % 360;

/** "6.9° W" style text for the declination at a place. */
export function fmtDeclination(at: [number, number] = HOME_AREA) {
  const d = declinationAt(at);
  return `${Math.abs(d).toFixed(1)}° ${d < 0 ? 'W' : 'E'}`;
}

const CARD = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export const cardinal = (d: number) => CARD[Math.round(d / 22.5) % 16];

export function fmtDistance(m: number, metric = false) {
  if (metric) return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10000 ? 2 : 1)} km`;
  const ft = m * 3.28084;
  if (ft < 1000) return `${Math.round(ft)} ft`;
  const mi = m / 1609.344;
  return `${mi.toFixed(mi < 10 ? 2 : 1)} mi`;
}

export const fmtDD = (lat: number, lon: number) => `${lat.toFixed(5)}, ${lon.toFixed(5)}`;

export function fmtDDM(lat: number, lon: number) {
  const f = (v: number, pos: string, neg: string) => {
    const a = Math.abs(v);
    const d = Math.floor(a);
    const m = (a - d) * 60;
    return `${d}° ${m.toFixed(3)}′ ${v >= 0 ? pos : neg}`;
  };
  return `${f(lat, 'N', 'S')}, ${f(lon, 'E', 'W')}`;
}

/** USNG/MGRS grid reference, 1 m precision, spaced like USNG (17R MM 45325 86787). */
export function fmtUSNG(lat: number, lon: number, digits = 5) {
  try {
    const s = mgrs.forward([lon, lat], digits);
    const m = s.match(/^(\d{1,2}[A-Z])([A-Z]{2})(\d+)$/);
    if (!m) return s;
    const n = m[3].length / 2;
    return `${m[1]} ${m[2]} ${m[3].slice(0, n)} ${m[3].slice(n)}`;
  } catch {
    return '—';
  }
}

export function parseCoords(s: string): [number, number] | null {
  const t = s.trim();
  // USNG / MGRS
  if (/^\d{1,2}\s*[A-Z]\s*[A-Z]{2}/i.test(t)) {
    try {
      const [lon, lat] = mgrs.toPoint(t.replace(/\s+/g, '').toUpperCase());
      return [lon, lat];
    } catch {
      return null;
    }
  }
  // decimal "lat, lon"
  const m = t.match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/);
  if (m) {
    const lat = +m[1];
    const lon = +m[2];
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return [lon, lat];
  }
  return null;
}

export function pathLength(pts: [number, number][]) {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += distanceM(pts[i - 1], pts[i]);
  return d;
}
