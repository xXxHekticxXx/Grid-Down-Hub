// Build all bundled content: articles (Markdown -> structured JSON), categories, checklists,
// local data, books (native chapters) and the offline search index.
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';
import MiniSearch from 'minisearch';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const C = (...p) => path.join(root, 'content', ...p);
const outGen = path.join(root, 'src', 'generated');
const outPub = path.join(root, 'public', 'content');
fs.mkdirSync(outGen, { recursive: true });
fs.mkdirSync(outPub, { recursive: true });

export const SECTION_KEYS = [
  ['applies', /^when (this|it) applies/i],
  ['steps', /^(do this|steps|what to do|how to)/i],
  ['escalate', /^(warning signs|get help|when to get help)/i],
  ['dont', /^do not/i],
  ['need', /^what you need/i],
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(path.join(dir, d.name)) : d.name.endsWith('.md') ? [path.join(dir, d.name)] : [],
  );
}

// Tool embeds: a line `::tool bleach` or `::timer 15 Swelling check` becomes an interactive widget.
function toolDirectives(md) {
  return md
    .replace(/^::tool\s+([a-z0-9-]+)\s*$/gm, (_, id) => `<div class="tool-embed" data-tool="${id}"></div>`)
    .replace(/^::timer\s+(\d+)\s+(.+)$/gm, (_, min, label) =>
      `<div class="tool-embed" data-tool="timer" data-minutes="${min}" data-label="${label.replace(/"/g, '&quot;')}"></div>`);
}

const stripHtml = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();

marked.use({ gfm: true, breaks: false });

const categories = JSON.parse(fs.readFileSync(C('categories.json'), 'utf8'));
// Shared source list: an article can name a source by key (`- cdc-water`) instead of repeating it.
const SOURCES = JSON.parse(fs.readFileSync(C('sources.json'), 'utf8'));
const resolveSource = (s, file) => {
  if (typeof s === 'string') {
    const r = SOURCES[s];
    if (!r) throw new Error(`${file}: unknown source key ${s}`);
    return { title: r.title, url: r.url, checked: String(r.checked) };
  }
  return { title: s.title, url: s.url, checked: String(s.checked) };
};
const catIds = new Set(categories.map((c) => c.id));
const articles = [];
for (const file of walk(C('articles'))) {
  const raw = fs.readFileSync(file, 'utf8');
  const { data, content } = matter(raw);
  const id = data.id || path.basename(file, '.md');
  if (!catIds.has(data.category)) throw new Error(`${file}: unknown category ${data.category}`);
  const parts = content.split(/^## +/m);
  const intro = parts.shift().trim();
  const sections = [];
  if (intro) sections.push({ key: 'extra', title: '', html: marked.parse(toolDirectives(intro)), md: intro });
  for (const p of parts) {
    const nl = p.indexOf('\n');
    const title = (nl < 0 ? p : p.slice(0, nl)).trim();
    const body = nl < 0 ? '' : p.slice(nl + 1).trim();
    const key = (SECTION_KEYS.find(([, re]) => re.test(title)) || ['extra'])[0];
    sections.push({ key, title, html: marked.parse(toolDirectives(body)), md: body });
  }
  articles.push({
    id,
    title: data.title,
    category: data.category,
    summary: data.summary || '',
    tags: data.tags || [],
    medical: !!data.medical,
    emergency: data.emergency,
    tools: data.tools || [],
    sources: (data.sources || []).map((s) => resolveSource(s, file)),
    plant: data.plant,
    builtin: true,
    sections,
    file: path.relative(root, file),
  });
}
articles.sort((a, b) => a.title.localeCompare(b.title));
const ids = new Set();
for (const a of articles) {
  if (ids.has(a.id)) throw new Error(`duplicate article id ${a.id}`);
  ids.add(a.id);
}

const checklists = fs.existsSync(C('checklists'))
  ? fs.readdirSync(C('checklists')).filter((f) => f.endsWith('.json')).map((f) => ({ ...JSON.parse(fs.readFileSync(C('checklists', f), 'utf8')), builtin: true }))
  : [];
const local = JSON.parse(fs.readFileSync(C('local.json'), 'utf8'));
const library = JSON.parse(fs.readFileSync(C('library.json'), 'utf8'));

// Books: copy chapters and figures to public/, index paragraphs grouped by heading.
const books = [];
const bookDir = C('books');
for (const id of fs.existsSync(bookDir) ? fs.readdirSync(bookDir) : []) {
  const src = path.join(bookDir, id);
  if (!fs.existsSync(path.join(src, 'book.json'))) continue;
  const dst = path.join(root, 'public', 'books', id);
  fs.mkdirSync(path.join(dst, 'fig'), { recursive: true });
  fs.copyFileSync(path.join(src, 'book.json'), path.join(dst, 'book.json'));
  for (const f of fs.readdirSync(path.join(src, 'fig'))) {
    const t = path.join(dst, 'fig', f);
    if (!fs.existsSync(t)) fs.copyFileSync(path.join(src, 'fig', f), t);
  }
  const book = JSON.parse(fs.readFileSync(path.join(src, 'book.json'), 'utf8'));
  const meta = JSON.parse(fs.readFileSync(path.join(src, 'meta.json'), 'utf8'));
  books.push({ ...meta, id, chapters: book.chapters.map((c) => ({ id: c.id, title: c.title, pageStart: c.pageStart, pageEnd: c.pageEnd, blocks: c.blocks.length })) });
}

// Search documents
const docs = [];
for (const a of articles) {
  docs.push({
    id: `a:${a.id}`, type: 'article', title: a.title, ref: a.id, cat: a.category,
    tags: a.tags.join(' '), text: (a.summary + ' ' + a.sections.map((s) => s.title + ' ' + stripHtml(s.html)).join(' ')).slice(0, 20000),
  });
}
for (const b of books) {
  const book = JSON.parse(fs.readFileSync(path.join(bookDir, b.id, 'book.json'), 'utf8'));
  for (const ch of book.chapters) {
    let cur = null;
    let n = 0;
    const flush = () => { if (cur && cur.text.trim()) docs.push(cur); };
    for (let i = 0; i < ch.blocks.length; i++) {
      const bl = ch.blocks[i];
      if (bl.t === 'h2' || bl.t === 'h3' || !cur) {
        flush();
        n++;
        cur = { id: `b:${b.id}:${ch.id}:${n}`, type: 'book', title: `${b.short}: ${bl.t.startsWith('h') ? bl.text : ch.title}`, ref: `${b.id}/${ch.id}/${i}`, cat: 'library', tags: ch.title, text: '' };
        if (bl.t.startsWith('h')) continue;
      }
      cur.text += ' ' + (bl.caption ? bl.caption + ' ' : '') + bl.text;
    }
    flush();
  }
}
// PDF page text (Library PDFs that are not converted into native chapters, and the topo quads)
const pdfTextDir = C('library-text');
for (const f of fs.existsSync(pdfTextDir) ? fs.readdirSync(pdfTextDir) : []) {
  const t = JSON.parse(fs.readFileSync(path.join(pdfTextDir, f), 'utf8'));
  t.pages.forEach((txt, i) => {
    if (txt.trim().length < 20) return;
    docs.push({ id: `p:${t.id}:${i + 1}`, type: 'pdf', title: `${t.title}, page ${i + 1}`, ref: `${t.id}/${i + 1}`, cat: 'library', tags: '', text: txt.slice(0, 8000) });
  });
}
for (const c of checklists) {
  docs.push({ id: `c:${c.id}`, type: 'checklist', title: c.title, ref: c.id, cat: 'checklists', tags: 'checklist', text: c.sections.map((s) => s.title + ' ' + s.items.map((i) => i.text).join(' ')).join(' ') });
}

export const SEARCH_OPTIONS = {
  fields: ['title', 'tags', 'text'],
  storeFields: ['type', 'title', 'ref', 'cat'],
  searchOptions: { boost: { title: 4, tags: 2 }, prefix: true, fuzzy: 0.15 },
};
const ms = new MiniSearch(SEARCH_OPTIONS);
ms.addAll(docs);

// Snippet text kept separately so result lists can show the matching line.
const snippets = Object.fromEntries(docs.map((d) => [d.id, d.text.slice(0, 4000)]));

fs.writeFileSync(path.join(outGen, 'content.json'), JSON.stringify({ categories, articles: articles.map(({ file, ...a }) => a), checklists, local, library, books }));
fs.writeFileSync(path.join(outPub, 'search-index.json'), JSON.stringify(ms));
fs.writeFileSync(path.join(outPub, 'search-snippets.json'), JSON.stringify(snippets));
fs.writeFileSync(path.join(root, 'content-stats.json'), JSON.stringify({
  articles: articles.length,
  byCategory: Object.fromEntries(categories.map((c) => [c.id, articles.filter((a) => a.category === c.id).length])),
  searchDocs: docs.length,
  books: books.map((b) => ({ id: b.id, chapters: b.chapters.length })),
}, null, 2));
console.log(`content: ${articles.length} articles, ${checklists.length} checklists, ${books.length} books, ${docs.length} search docs`);
