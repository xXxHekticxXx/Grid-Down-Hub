// Converts the verified markdown in /content into src/generated/content.json
// (pages + a prebuilt MiniSearch index). Runs before every build.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import MiniSearch from 'minisearch';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cdir = path.join(root, 'content');

const FILES = [
  ['01_content_first_aid.md', 'firstaid'],
  ['02_content_water_food.md', 'water'],
  ['03_content_hazards_florida.md', 'hazards'],
  ['04_content_comms_kit_plan.md', 'comms'],
  ['05_content_survival_library.md', 'library'],
  ['08_local_sorrento.md', 'comms']
];
const SKIP_TITLES = ['My Plan template', 'Licensing', 'Core survival skills source'];
const SECTION_OVERRIDE = { 'Local wildlife': 'hazards' };
const REF = { '01': 'First Aid', '02': 'Water & Food', '03': 'Hazards', '04': 'Comms', '05': 'Survival', '08': 'Comms & Local' };
const MEDICAL = new Set(['firstaid', 'water', 'hazards']);

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const strip = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ').trim();

function clean(line) {
  // drop build instructions that were written for the developer
  if (/^\s*(- )?(\*\*)?(App|Benny)\b[^a-z]/.test(line)) return null;
  if (/^\s*\*\*Calculator logic/.test(line)) return null;
  if (/^>/.test(line)) return null;
  line = line.replace(/\s*App feature:.*$/, '');
  line = line.replace(/\s*The bigger version is the optional Pi Hub \(Prompt 5\)\./, '');
  line = line.replace(/\(see `(\d\d)`\)/gi, (_, n) => `(see ${REF[n] || 'other pages'})`);
  line = line.replace(/`(\d\d)`/g, (_, n) => REF[n] || 'other pages');
  line = line.replace(/Benny:.*$/, '');
  return line;
}

const pages = [];
const seen = new Set();
for (const [file, defaultSection] of FILES) {
  const lines = fs.readFileSync(path.join(cdir, file), 'utf8').split('\n');
  let cur = null;
  const flush = () => {
    if (!cur) return;
    const md = cur.lines.join('\n').trim();
    if (md) {
      let id = slug(cur.title);
      while (seen.has(id)) id += '-2';
      seen.add(id);
      let html = marked.parse(md, { gfm: true });
      html = html
        .replace(/<a href/g, '<a target="_blank" rel="noopener" href')
        .replace(/<table>/g, '<div class="tw"><table>')
        .replace(/<\/table>/g, '</table></div>')
        .replace(/<p><em>Sources?/g, '<p class="src"><em>Source');
      pages.push({ id, title: cur.title, section: cur.section, medical: MEDICAL.has(cur.section), html, text: strip(html) });
    }
    cur = null;
  };
  for (const raw of lines) {
    if (/^# /.test(raw)) continue;
    if (/^---+\s*$/.test(raw)) continue;
    const m = raw.match(/^## (.+)$/);
    if (m) {
      flush();
      const title = m[1].trim();
      if (SKIP_TITLES.some((t) => title.startsWith(t))) { cur = null; continue; }
      let section = defaultSection;
      for (const [k, v] of Object.entries(SECTION_OVERRIDE)) if (title.startsWith(k)) section = v;
      cur = { title, section, lines: [] };
      continue;
    }
    if (!cur) continue;
    const c = clean(raw);
    if (c !== null) cur.lines.push(c);
  }
  flush();
}

// extra search documents: emergency cards, survival chapters, checklists
const emergency = JSON.parse(fs.readFileSync(path.join(cdir, 'emergency.json'), 'utf8'));
const survival = JSON.parse(fs.readFileSync(path.join(cdir, 'survival.json'), 'utf8'));
const docs = [];
for (const p of pages) docs.push({ id: 'p:' + p.id, title: p.title, section: p.section, url: '#/p/' + p.id, text: p.text });
for (const e of emergency) {
  docs.push({ id: 'e:' + e.id, title: 'Emergency card: ' + e.title, section: 'emergency', url: '#/emergency/' + e.id + '/1', text: e.steps.map((s) => s.h + ' ' + s.t).join(' ') });
}
for (const c of survival.chapters) {
  docs.push({ id: 's:' + c.id, title: 'Survival: ' + c.title, section: 'survival', url: '#/survival/' + c.id, text: c.full + ' ' + c.ch + ' Army ATP 3-50.21' });
}
docs.push({ id: 'water:calc', title: 'Bleach water calculator', section: 'water', url: '#/water', text: 'bleach drops gallons purify disinfect treat water calculator' });
docs.push({ id: 'plan', title: 'My Plan: contacts, meds, documents, pet, kit', section: 'plan', url: '#/plan', text: 'contacts meeting point medications documents pet kit checklist export import' });
docs.push({ id: 'map', title: 'Map and GPS', section: 'map', url: '#/map', text: 'gps coordinates pins distance bearing latitude longitude shelters hospitals' });
docs.push({ id: 'library', title: 'Library: manuals and your PDFs', section: 'library', url: '#/library', text: 'pdf manual library atp survival add pdf' });

const options = { fields: ['title', 'text'], storeFields: ['title', 'section', 'url'], idField: 'id' };
const ms = new MiniSearch(options);
ms.addAll(docs);

const outDir = path.join(root, 'src', 'generated');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, 'content.json'),
  JSON.stringify({ built: new Date().toISOString().slice(0, 10), pages: pages.map(({ text, ...p }) => p), index: ms.toJSON() })
);
console.log(`content: ${pages.length} pages, ${docs.length} search docs`);
