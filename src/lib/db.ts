// On-device database (IndexedDB). Nothing in here ever leaves the device unless the user exports it.
import { openDB, type IDBPDatabase } from 'idb';

export type StoreName =
  | 'kv' // settings, flags, download state
  | 'pins'
  | 'items' // user pages, photos, PDFs, voice notes attached to sections
  | 'checklists' // user copies of checklists (built-ins are copied on first edit)
  | 'inventory'
  | 'files' // small blobs: photos, voice notes, user PDF metadata
  | 'tracks'
  | 'usermaps'
  | 'plan'; // My Plan: contacts, meds, dog, documents, radio, evacuation

const STORES: StoreName[] = ['kv', 'pins', 'items', 'checklists', 'inventory', 'files', 'tracks', 'usermaps', 'plan'];
let dbp: Promise<IDBPDatabase> | null = null;

export function db() {
  if (!dbp) {
    dbp = openDB('grid-down-hub', 1, {
      upgrade(d) {
        for (const s of STORES) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s);
      },
    });
  }
  return dbp;
}

export async function get<T>(store: StoreName, key: string): Promise<T | undefined> {
  return (await db()).get(store, key);
}
export async function put<T>(store: StoreName, key: string, value: T) {
  await (await db()).put(store, value, key);
  emit(store);
}
export async function del(store: StoreName, key: string) {
  await (await db()).delete(store, key);
  emit(store);
}
export async function all<T>(store: StoreName): Promise<T[]> {
  return (await db()).getAll(store);
}
export async function keys(store: StoreName): Promise<string[]> {
  return ((await db()).getAllKeys(store)) as Promise<string[]>;
}
export async function entries<T>(store: StoreName): Promise<[string, T][]> {
  const d = await db();
  const tx = d.transaction(store);
  const out: [string, T][] = [];
  let c = await tx.store.openCursor();
  while (c) {
    out.push([String(c.key), c.value as T]);
    c = await c.continue();
  }
  return out;
}
export async function clear(store: StoreName) {
  await (await db()).clear(store);
  emit(store);
}

// tiny change feed so screens refresh when data changes
const listeners = new Map<StoreName, Set<() => void>>();
export function subscribe(store: StoreName, fn: () => void) {
  if (!listeners.has(store)) listeners.set(store, new Set());
  listeners.get(store)!.add(fn);
  return () => {
    listeners.get(store)!.delete(fn);
  };
}
function emit(store: StoreName) {
  listeners.get(store)?.forEach((f) => f());
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
