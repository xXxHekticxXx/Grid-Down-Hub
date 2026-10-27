export type Source = { title: string; url: string; checked: string };

export type SectionKey = 'applies' | 'steps' | 'escalate' | 'dont' | 'need' | 'extra';

export type ArticleSection = { key: SectionKey; title: string; html: string; md?: string };

export type ArticleMeta = {
  id: string;
  title: string;
  category: string;
  summary: string;
  tags: string[];
  medical: boolean;
  emergency?: number; // order on the Emergency screen, lower first
  tools?: string[]; // tool ids embedded on the page
  sources: Source[];
  plant?: PlantInfo;
  builtin: true;
};

export type PlantInfo = {
  scientific: string;
  edible: 'yes' | 'parts' | 'no' | 'toxic';
  evidence?: 'traditional' | 'limited' | 'moderate' | 'strong' | 'none';
  season?: string;
  figure?: string; // book figure path used as the illustration
};

export type Article = ArticleMeta & { sections: ArticleSection[] };

export type Category = {
  id: string;
  title: string;
  blurb: string;
  icon: string;
  home?: boolean;
  parent?: string;
};

export type Checklist = {
  id: string;
  title: string;
  source?: Source;
  sections: { title: string; items: ChecklistItem[] }[];
  builtin?: boolean;
  updated?: number;
};

export type ChecklistItem = {
  id: string;
  text: string;
  qty?: string;
  expires?: string;
  note?: string;
  photo?: string; // user file id
  done?: boolean;
};

export type BookBlock = {
  t: 'h2' | 'h3' | 'h4' | 'p' | 'li' | 'fig' | 'table' | 'warn';
  text: string;
  num?: string;
  src?: string;
  w?: number;
  h?: number;
  caption?: string;
  label?: string;
  page: number;
};

export type BookChapter = { id: string; title: string; pageStart: number; pageEnd: number; blocks: BookBlock[] };
export type Book = { id: string; title: string; pages: number; chapters: BookChapter[] };

export type LibraryDoc = {
  id: string;
  title: string;
  kind: 'book' | 'topo' | 'reference' | 'user';
  pack?: string; // data pack that holds the PDF
  file?: string; // file name inside the pack / storage
  bookId?: string; // native chapters available
  note?: string;
  bytes?: number;
  date?: string;
  source?: Source;
  bbox?: [number, number, number, number];
};

export type PackFile = { name: string; bytes: number; sha256: string };
export type Pack = {
  id: string;
  title: string;
  description: string;
  required: boolean;
  bytes: number;
  files: PackFile[];
  chunk: number; // bytes per downloaded chunk
  date: string;
};
export type Manifest = { version: number; built: string; osmDate: string; contentChecked: string; base: string; packs: Pack[] };

export type Pin = {
  id: string;
  name: string;
  lon: number;
  lat: number;
  kind: 'pin' | 'meeting' | 'cache' | 'camp' | 'water' | 'danger' | 'home';
  note?: string;
  created: number;
  updated: number;
};

export type UserItem = {
  id: string;
  section: string; // category id or article id it was added to
  kind: 'page' | 'photo' | 'pdf' | 'checklist' | 'pin' | 'voice' | 'note';
  title: string;
  body?: string; // markdown-ish text for pages and notes
  fileId?: string;
  pinId?: string;
  checklistId?: string;
  created: number;
  updated: number;
  overrides?: string; // built-in article id this page replaces
};
