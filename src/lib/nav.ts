// Offline directions: loads the "routing" data pack into memory, keeps the list of roads you marked as
// blocked, and speaks turn instructions. The search itself is in routing.ts.
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { packFile, packState } from './packs';
import { get, put } from './db';
import { native } from './native';
import { graphFromBuffers, type RouteGraph, type LonLat, type Step } from './routing';

let graphP: Promise<RouteGraph | null> | null = null;

/** The Florida road graph, loaded once (about 180 MB in memory). null if the pack isn't installed. */
export function loadGraph(): Promise<RouteGraph | null> {
  if (!graphP) {
    graphP = (async () => {
      const st = await packState('routing');
      if (!st.complete) return null;
      const [meta, nodes, adj, edges, geom] = await Promise.all(
        ['route-meta.json', 'route-nodes.bin', 'route-adj.bin', 'route-edges.bin', 'route-geom.bin'].map((n) => packFile('routing', n)),
      );
      if (!meta || !nodes || !adj || !edges || !geom) return null;
      const m = JSON.parse(await meta.text());
      const [nb, ab, eb] = await Promise.all([nodes.arrayBuffer(), adj.arrayBuffer(), edges.arrayBuffer()]);
      // road shapes stay on disk; only the pieces of a found route are read
      const readGeom = async (from: number, count: number) => new Int16Array(await geom.slice(from * 4, (from + count) * 4).arrayBuffer());
      return graphFromBuffers(m, nb, ab, eb, readGeom);
    })().catch(() => null);
    graphP.then((g) => { if (!g) graphP = null; });
  }
  return graphP;
}
export const routingInstalled = async () => (await packState('routing')).complete;

// ---------- blocked roads ----------
export type BlockedRoad = { id: string; name: string; edges: number[]; at: LonLat; created: number; sig: string };
const sig = (g: RouteGraph) => `${g.N}:${g.E}`;

export async function blockedRoads(g: RouteGraph): Promise<BlockedRoad[]> {
  const all = (await get<BlockedRoad[]>('kv', 'blockedRoads')) ?? [];
  return all.filter((b) => b.sig === sig(g)); // a new road map renumbers roads; old blocks no longer apply
}
export async function blockedSet(g: RouteGraph): Promise<Set<number>> {
  return new Set((await blockedRoads(g)).flatMap((b) => b.edges));
}
export async function addBlocked(g: RouteGraph, name: string, edges: number[], at: LonLat) {
  const list = await blockedRoads(g);
  list.push({ id: `${Date.now()}`, name, edges, at, created: Date.now(), sig: sig(g) });
  await put('kv', 'blockedRoads', list);
}
export async function clearBlocked(id?: string) {
  const all = (await get<BlockedRoad[]>('kv', 'blockedRoads')) ?? [];
  await put('kv', 'blockedRoads', id ? all.filter((b) => b.id !== id) : []);
}

// ---------- voice ----------
export async function speak(text: string) {
  try {
    if (native()) {
      await TextToSpeech.stop().catch(() => undefined);
      await TextToSpeech.speak({ text, lang: 'en-US', rate: 1.0, pitch: 1.0, volume: 1.0, category: 'playback' });
    } else if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      window.speechSynthesis.speak(u);
    }
  } catch {
    /* no voice on this device */
  }
}

// ---------- wording ----------
export function spokenDistance(m: number, metric: boolean) {
  if (metric) return m >= 1000 ? `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} kilometers` : `${Math.round(m / 50) * 50 || 50} meters`;
  const mi = m / 1609.344;
  if (mi >= 0.9) return `${mi >= 10 ? Math.round(mi) : mi.toFixed(1)} miles`;
  if (mi >= 0.4) return 'half a mile';
  if (mi >= 0.2) return 'a quarter mile';
  return `${Math.max(100, Math.round((m * 3.28084) / 100) * 100)} feet`;
}

export function arrowFor(s: Step | undefined) {
  if (!s) return '↑';
  if (s.type === 'arrive') return '⚑';
  switch (s.modifier) {
    case 'left': return '↰';
    case 'right': return '↱';
    case 'slight left': return '↖';
    case 'slight right': return '↗';
    case 'sharp left': return '↙';
    case 'sharp right': return '↘';
    case 'uturn': return '↶';
    default: return '↑';
  }
}

export function fmtDuration(s: number) {
  const m = Math.max(1, Math.round(s / 60));
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} hr ${m % 60} min`;
}
export const arrival = (s: number) => new Date(Date.now() + s * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
