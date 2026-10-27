// Large files (map packs, PDFs) live in the Origin Private File System: the app's own storage
// on the device, outside the browser cache. In the Android app this is the app's private data
// directory, removed only if the app is uninstalled or its storage is cleared.

async function root() {
  return navigator.storage.getDirectory();
}

async function dirFor(path: string, create = true) {
  const parts = path.split('/').filter(Boolean);
  parts.pop();
  let d = await root();
  for (const p of parts) d = await d.getDirectoryHandle(p, { create });
  return d;
}
const base = (path: string) => path.split('/').filter(Boolean).pop()!;

export async function fileHandle(path: string, create = false) {
  const d = await dirFor(path, create);
  return d.getFileHandle(base(path), { create });
}

export async function getFile(path: string): Promise<File | null> {
  try {
    return await (await fileHandle(path)).getFile();
  } catch {
    return null;
  }
}

export async function exists(path: string) {
  return (await getFile(path)) !== null;
}

/** Write bytes at a byte offset, keeping what is already there (used for resumable chunked downloads). */
export async function writeAt(path: string, position: number, data: ArrayBuffer | Blob) {
  const h = await fileHandle(path, true);
  const w = await h.createWritable({ keepExistingData: true });
  await w.write({ type: 'write', position, data });
  await w.close();
}

export async function writeFile(path: string, data: Blob | ArrayBuffer) {
  const h = await fileHandle(path, true);
  const w = await h.createWritable();
  await w.write(data);
  await w.close();
}

export async function truncate(path: string, size: number) {
  const h = await fileHandle(path, true);
  const w = await h.createWritable({ keepExistingData: true });
  await w.truncate(size);
  await w.close();
}

export async function remove(path: string) {
  try {
    const d = await dirFor(path, false);
    await d.removeEntry(base(path), { recursive: true });
  } catch {
    /* already gone */
  }
}

export async function removeDir(path: string) {
  try {
    const d = await root();
    await d.removeEntry(path, { recursive: true });
  } catch {
    /* already gone */
  }
}

export async function storageInfo() {
  const est = await navigator.storage.estimate();
  let persisted = false;
  try {
    persisted = await navigator.storage.persisted();
  } catch {
    /* not supported */
  }
  return { used: est.usage ?? 0, quota: est.quota ?? 0, persisted };
}

export async function askPersist() {
  try {
    if (navigator.storage.persist) return await navigator.storage.persist();
  } catch {
    /* not supported */
  }
  return false;
}

export function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  const u = ['KB', 'MB', 'GB', 'TB'];
  let i = -1;
  do {
    n /= 1024;
    i++;
  } while (n >= 1024 && i < u.length - 1);
  return `${n.toFixed(n >= 100 ? 0 : 1)} ${u[i]}`;
}
