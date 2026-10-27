// Built-in content plus everything the user adds or edits. User edits never change the
// built-in originals: an edited page is saved as the user's version, and "Restore original"
// simply deletes that version.
import type { Article, Category, Checklist, LibraryDoc, UserItem } from '../types';
import { all, get, put, del, uid } from './db';

export type LocalData = {
  checked: string;
  mapCenter: { lon: number; lat: number; zoom: number; label: string };
  numbers: { label: string; phone: string; note: string }[];
  hospitals: { name: string; role: string; address: string; phone: string; lon: number; lat: number; er: boolean; note?: string }[];
  noaa: { same: string; sameLabel: string; stations: { call: string; city: string; mhz: string; channel: number; role: string; covers: string }[]; source: { title: string; url: string; checked: string } };
  alerts: { name: string; url: string; note: string }[];
  sources: { title: string; url: string; checked: string }[];
};
export type BookMeta = { id: string; short: string; title: string; publisher: string; year: number; libraryId: string; notice: string; chapters: { id: string; title: string; pageStart: number; pageEnd: number; blocks: number }[] };
export type Content = { categories: Category[]; articles: Article[]; checklists: Checklist[]; local: LocalData; library: LibraryDoc[]; books: BookMeta[] };

let cache: Promise<Content> | null = null;
export function content(): Promise<Content> {
  if (!cache) cache = import('../generated/content.json').then((m) => m.default as unknown as Content);
  return cache;
}

export type UserSection = { id: string; title: string; blurb: string; parent?: string; created: number };

export async function userSections(): Promise<UserSection[]> {
  return ((await get<UserSection[]>('kv', 'userSections')) ?? []).sort((a, b) => a.created - b.created);
}
export async function addUserSection(title: string, blurb: string, parent?: string) {
  const list = await userSections();
  const s = { id: 'u-' + uid(), title, blurb, parent, created: Date.now() };
  await put('kv', 'userSections', [...list, s]);
  return s;
}
export async function saveUserSections(list: UserSection[]) {
  await put('kv', 'userSections', list);
}

export async function userItems(section?: string): Promise<UserItem[]> {
  const items = await all<UserItem>('items');
  return items.filter((i) => !section || i.section === section).sort((a, b) => a.created - b.created);
}
export async function saveItem(it: Partial<UserItem> & { section: string; kind: UserItem['kind']; title: string }) {
  const now = Date.now();
  const id = it.id ?? uid();
  const prev = it.id ? await get<UserItem>('items', it.id) : undefined;
  const v: UserItem = { ...(prev ?? { created: now }), ...it, id, updated: now } as UserItem;
  await put('items', id, v);
  return v;
}
export const deleteItem = (id: string) => del('items', id);

/** The user's edited version of a built-in article, if any. */
export async function overrideFor(articleId: string): Promise<UserItem | undefined> {
  return (await all<UserItem>('items')).find((i) => i.overrides === articleId);
}

export async function checklists(): Promise<Checklist[]> {
  const c = await content();
  const mine = await all<Checklist>('checklists');
  const byId = new Map(c.checklists.map((x) => [x.id, x]));
  for (const m of mine) byId.set(m.id, m);
  const hidden = new Set((await get<string[]>('kv', 'hiddenChecklists')) ?? []);
  return [...byId.values()].filter((x) => !hidden.has(x.id));
}
export async function checklist(id: string): Promise<Checklist | undefined> {
  return (await get<Checklist>('checklists', id)) ?? (await content()).checklists.find((c) => c.id === id);
}
export async function saveChecklist(c: Checklist) {
  await put('checklists', c.id, { ...c, updated: Date.now() });
}
export async function restoreChecklist(id: string) {
  await del('checklists', id);
}
export async function deleteChecklist(id: string) {
  const c = await content();
  await del('checklists', id);
  if (c.checklists.some((x) => x.id === id)) {
    const hidden = (await get<string[]>('kv', 'hiddenChecklists')) ?? [];
    await put('kv', 'hiddenChecklists', [...new Set([...hidden, id])]);
  }
}

export function findArticle(c: Content, id: string) {
  return c.articles.find((a) => a.id === id);
}
