// Fails the build if any article is missing a required section or a dated source, if a category
// is under its minimum, if an internal link is broken, or if unfinished-text markers appear anywhere.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'src', 'generated', 'content.json'), 'utf8'));
const REQUIRED = ['applies', 'steps', 'escalate', 'dont', 'need'];
const MIN = { 'first-aid': 35, water: 8, food: 8, hazards: 15, 'power-shelter': 8, 'comms-nav': 8, skills: 8 };
const MIN_TOTAL = 90;
// Words that mean a page is unfinished. Matched as whole words, case-insensitive.
const BANNED = [/\bTODO\b/i, /\bTBD\b/i, /\blorem\b/i, /\bipsum\b/i, /\bplaceholder\b/i, /\bFIXME\b/i, /\bcoming soon\b/i];
const errors = [];
const ids = new Set(data.articles.map((a) => a.id));

for (const a of data.articles) {
  const keys = new Set(a.sections.map((s) => s.key));
  for (const k of REQUIRED) if (!keys.has(k)) errors.push(`${a.id}: missing section "${k}"`);
  if (!a.sources.length) errors.push(`${a.id}: no sources`);
  for (const s of a.sources) {
    if (!/^https?:\/\//.test(s.url)) errors.push(`${a.id}: source without a URL (${s.title})`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.checked)) errors.push(`${a.id}: source "${s.title}" has no checked date`);
  }
  if (a.category === 'first-aid' && !a.medical) errors.push(`${a.id}: first aid page not marked medical`);
  if (!a.summary) errors.push(`${a.id}: no summary`);
  const html = a.sections.map((s) => s.html).join(' ');
  for (const m of html.matchAll(/href="#\/a\/([a-z0-9-]+)"/g)) if (!ids.has(m[1])) errors.push(`${a.id}: link to missing page ${m[1]}`);
  const text = [a.title, a.summary, ...a.sections.map((s) => s.title + ' ' + s.md)].join(' ');
  for (const re of BANNED) if (re.test(text)) errors.push(`${a.id}: contains "${text.match(re)[0]}"`);
  const steps = a.sections.find((s) => s.key === 'steps');
  if (steps && (steps.md || '').split('\n').filter((l) => /^\s*(\d+\.|-)\s+\S/.test(l)).length < 2) errors.push(`${a.id}: fewer than 2 steps`);
}
// Article ids the app code links to must exist too.
const walkSrc = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? (e.name === 'generated' ? [] : walkSrc(path.join(d, e.name))) : /\.tsx?$/.test(e.name) ? [path.join(d, e.name)] : []);
for (const f of walkSrc(path.join(root, 'src'))) {
  const t = fs.readFileSync(f, 'utf8');
  for (const m of t.matchAll(/\/a\/([a-z0-9-]+)/g)) if (!ids.has(m[1])) errors.push(`${path.relative(root, f)}: links to missing page ${m[1]}`);
}
const goIds = fs.readFileSync(path.join(root, 'src/pages/GoPlan.tsx'), 'utf8').match(/\[('[a-z0-9-]+'(?:, *'[a-z0-9-]+')+)\]\.includes\(a\.id\)/);
if (goIds) for (const m of goIds[1].matchAll(/'([a-z0-9-]+)'/g)) if (!ids.has(m[1])) errors.push(`GoPlan: stay page ${m[1]} missing`);
const byCat = {};
for (const a of data.articles) byCat[a.category] = (byCat[a.category] || 0) + 1;
for (const [c, n] of Object.entries(MIN)) if ((byCat[c] || 0) < n) errors.push(`category ${c}: ${byCat[c] || 0} articles, needs ${n}`);
if (data.articles.length < MIN_TOTAL) errors.push(`only ${data.articles.length} articles, needs ${MIN_TOTAL}`);
for (const c of data.checklists) for (const s of c.sections) for (const i of s.items) for (const re of BANNED) if (re.test(i.text)) errors.push(`checklist ${c.id}: "${i.text}"`);

// Scan the whole content folder and app source for unfinished-text markers.
function scan(dir, exts) {
  const out = [];
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) {
      if (['node_modules', 'books', 'generated'].includes(d.name)) continue;
      out.push(...scan(p, exts));
    } else if (exts.some((e) => d.name.endsWith(e))) {
      fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
        for (const re of BANNED) if (re.test(line)) out.push(`${path.relative(root, p)}:${i + 1}: ${line.trim().slice(0, 120)}`);
      });
    }
  }
  return out;
}
const grep = [...scan(path.join(root, 'content'), ['.md', '.json']), ...scan(path.join(root, 'src'), ['.ts', '.tsx', '.css'])];
errors.push(...grep.map((g) => `unfinished marker: ${g}`));

const report = [
  `Content check ${new Date().toISOString()}`,
  `Articles: ${data.articles.length} (minimum ${MIN_TOTAL})`,
  ...Object.entries(byCat).sort().map(([c, n]) => `  ${c}: ${n}${MIN[c] ? ` (minimum ${MIN[c]})` : ''}`),
  `Checklists: ${data.checklists.length}`,
  `Books: ${data.books.map((b) => `${b.short} ${b.chapters.length} chapters, ${b.chapters.reduce((s, c) => s + c.blocks, 0)} blocks`).join('; ')}`,
  `Scan for TODO/TBD/lorem/ipsum/placeholder/FIXME/coming soon in content/ and src/: ${grep.length} found`,
  errors.length ? `FAILED: ${errors.length} problems\n` + errors.map((e) => '  - ' + e).join('\n') : 'PASSED: every article has all five sections, steps, dated sources; all minimums met; no unfinished markers.',
].join('\n');
fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
fs.writeFileSync(path.join(root, 'reports', 'content-check.txt'), report + '\n');
console.log(report);
if (errors.length && !process.env.CONTENT_ALLOW_FAIL) process.exit(1);
