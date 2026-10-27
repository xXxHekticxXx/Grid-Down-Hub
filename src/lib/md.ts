// Markdown for pages the user writes or edits (the same format the built-in pages use).
import { marked } from 'marked';
import type { ArticleSection, SectionKey } from '../types';

marked.use({ gfm: true, breaks: true });

const KEYS: [SectionKey, RegExp][] = [
  ['applies', /^when (this|it) applies/i],
  ['steps', /^(do this|steps|what to do|how to)/i],
  ['escalate', /^(warning signs|get help|when to get help)/i],
  ['dont', /^do not/i],
  ['need', /^what you need/i],
];

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function tools(md: string) {
  return md
    .replace(/^::tool\s+([a-z0-9-]+)\s*$/gm, (_, id) => `<div class="tool-embed" data-tool="${esc(id)}"></div>`)
    .replace(/^::timer\s+(\d+)\s+(.+)$/gm, (_, min, label) => `<div class="tool-embed" data-tool="timer" data-minutes="${esc(min)}" data-label="${esc(label)}"></div>`);
}

/** Render user-written Markdown. Raw HTML the user typed is shown as text, not run. */
export function renderUser(md: string) {
  const safe = md.replace(/</g, '&lt;');
  return marked.parse(tools(safe)) as string;
}

export function sectionsFrom(md: string): ArticleSection[] {
  const parts = md.split(/^## +/m);
  const intro = parts.shift()!.trim();
  const out: ArticleSection[] = [];
  if (intro) out.push({ key: 'extra', title: '', html: renderUser(intro), md: intro });
  for (const p of parts) {
    const nl = p.indexOf('\n');
    const title = (nl < 0 ? p : p.slice(0, nl)).trim();
    const body = nl < 0 ? '' : p.slice(nl + 1).trim();
    const key = (KEYS.find(([, re]) => re.test(title)) || ['extra'])[0] as SectionKey;
    out.push({ key, title, html: renderUser(body), md: body });
  }
  return out;
}

export function sectionsToMd(sections: ArticleSection[]) {
  return sections.map((s) => (s.title ? `## ${s.title}\n\n${s.md ?? ''}` : s.md ?? '')).join('\n\n');
}

export const PAGE_TEMPLATE = `Short intro: what this page is about.

## When this applies

## Do this

1.
2.

## Warning signs — get help

-

## Do NOT

-

## What you need

-
`;
