// Encrypted export/import of My Plan and the user's own data.
// AES-256-GCM with a key from the passphrase (PBKDF2-SHA-256, 600,000 rounds, random salt).
const enc = new TextEncoder();
const dec = new TextDecoder();
const ITER = 600_000;

async function keyFrom(pass: string, salt: Uint8Array<ArrayBuffer>) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

const b64 = (u: Uint8Array) => {
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export type Sealed = { format: 'grid-down-hub-backup'; v: 1; kdf: 'PBKDF2-SHA256'; iter: number; salt: string; iv: string; data: string; created: string };

export async function seal(obj: unknown, pass: string): Promise<Sealed> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFrom(pass, salt);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj))));
  return { format: 'grid-down-hub-backup', v: 1, kdf: 'PBKDF2-SHA256', iter: ITER, salt: b64(salt), iv: b64(iv), data: b64(ct), created: new Date().toISOString() };
}

export async function open<T>(s: Sealed, pass: string): Promise<T> {
  if (s.format !== 'grid-down-hub-backup') throw new Error('This is not a Grid-Down Hub backup file.');
  const key = await keyFrom(pass, unb64(s.salt));
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(s.iv) }, key, unb64(s.data));
    return JSON.parse(dec.decode(pt)) as T;
  } catch {
    throw new Error('Wrong passphrase, or the file was changed.');
  }
}

export const blobToB64 = async (b: Blob) => b64(new Uint8Array(await b.arrayBuffer()));
export const b64ToBlob = (s: string, type: string) => new Blob([unb64(s)], { type });
