// User PDFs live in the Origin Private File System (private to this app, on this device).
async function dir() {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle('library', { create: true });
}
export const opfsSupported = () => !!navigator.storage?.getDirectory;

export async function listFiles(): Promise<{ name: string; size: number }[]> {
  const d = await dir();
  const out: { name: string; size: number }[] = [];
  for await (const [name, h] of d.entries()) {
    if (h.kind === 'file') out.push({ name, size: (await (h as FileSystemFileHandle).getFile()).size });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
export async function saveFile(file: File) {
  const d = await dir();
  const h = await d.getFileHandle(file.name, { create: true });
  const w = await h.createWritable();
  await w.write(file);
  await w.close();
}
export async function readFile(name: string): Promise<ArrayBuffer> {
  const d = await dir();
  return (await (await d.getFileHandle(name)).getFile()).arrayBuffer();
}
export async function removeFile(name: string) {
  const d = await dir();
  await d.removeEntry(name);
}
