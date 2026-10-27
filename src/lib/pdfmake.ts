// Printable PDFs made on the device: checklists, inventory, My Plan, and the current map view.
import { jsPDF } from 'jspdf';
import type { Checklist } from '../types';
import type { Inv } from '../pages/Inventory';

const M = 48; // margin in points
type Doc = jsPDF & { y: number };

function newDoc(title: string, sub?: string): Doc {
  const d = new jsPDF({ unit: 'pt', format: 'letter' }) as Doc;
  d.setFont('helvetica', 'bold');
  d.setFontSize(20);
  d.text(title, M, M + 6);
  d.setFont('helvetica', 'normal');
  d.setFontSize(10);
  d.text(sub ?? `Grid-Down Hub · printed ${new Date().toLocaleString()}`, M, M + 24);
  d.y = M + 46;
  return d;
}
function ensure(d: Doc, h: number) {
  if (d.y + h > d.internal.pageSize.getHeight() - M) {
    d.addPage();
    d.y = M;
  }
}
function heading(d: Doc, t: string) {
  ensure(d, 30);
  d.setFont('helvetica', 'bold');
  d.setFontSize(13);
  d.text(t, M, d.y);
  d.y += 18;
  d.setFont('helvetica', 'normal');
  d.setFontSize(11);
}
function para(d: Doc, t: string, indent = 0) {
  const w = d.internal.pageSize.getWidth() - 2 * M - indent;
  for (const line of d.splitTextToSize(t, w) as string[]) {
    ensure(d, 15);
    d.text(line, M + indent, d.y);
    d.y += 14;
  }
}
function box(d: Doc, checked: boolean) {
  d.rect(M, d.y - 9, 10, 10);
  if (checked) {
    d.line(M + 2, d.y - 4, M + 4.5, d.y - 1);
    d.line(M + 4.5, d.y - 1, M + 9, d.y - 8);
  }
}

export function checklistPdf(c: Checklist): Blob {
  const d = newDoc(c.title, c.source ? `Source: ${c.source.title} (checked ${c.source.checked}) · printed ${new Date().toLocaleDateString()}` : undefined);
  for (const s of c.sections) {
    heading(d, s.title);
    for (const it of s.items) {
      ensure(d, 16);
      box(d, !!it.done);
      const extra = [it.qty && `qty ${it.qty}`, it.expires && `exp ${it.expires}`, it.note].filter(Boolean).join(' · ');
      para(d, it.text + (extra ? `   (${extra})` : ''), 18);
      d.y += 2;
    }
    d.y += 6;
  }
  return d.output('blob');
}

export function inventoryPdf(list: Inv[]): Blob {
  const d = newDoc('Inventory');
  const cats = [...new Set(list.map((i) => i.category))];
  for (const c of cats) {
    heading(d, c);
    for (const i of list.filter((x) => x.category === c)) para(d, `${i.name} — ${i.qty} ${i.unit}${i.where ? ' · ' + i.where : ''}${i.expires ? ' · expires ' + i.expires : ''}${i.note ? ' · ' + i.note : ''}`);
  }
  return d.output('blob');
}

export type PlanPrint = { title: string; sections: { title: string; lines: string[] }[] };
export function planPdf(p: PlanPrint): Blob {
  const d = newDoc(p.title, `PRIVATE · printed ${new Date().toLocaleString()} · keep this paper somewhere safe`);
  for (const s of p.sections) {
    heading(d, s.title);
    if (s.lines.length === 0) para(d, '(nothing entered)');
    for (const l of s.lines) para(d, l);
    d.y += 6;
  }
  return d.output('blob');
}

export function mapPdf(img: string, w: number, h: number, meta: { title: string; center: string; usng: string; scale: string; attribution: string }): Blob {
  const landscape = w > h;
  const d = new jsPDF({ unit: 'pt', format: 'letter', orientation: landscape ? 'landscape' : 'portrait' });
  const pw = d.internal.pageSize.getWidth();
  const ph = d.internal.pageSize.getHeight();
  d.setFont('helvetica', 'bold');
  d.setFontSize(14);
  d.text(meta.title, M, 36);
  d.setFont('helvetica', 'normal');
  d.setFontSize(9);
  d.text(`Center ${meta.center}  ·  USNG ${meta.usng}  ·  ${meta.scale}  ·  printed ${new Date().toLocaleString()}`, M, 50);
  const availW = pw - 2 * M;
  const availH = ph - 100;
  const k = Math.min(availW / w, availH / h);
  d.addImage(img, 'PNG', M, 60, w * k, h * k);
  d.rect(M, 60, w * k, h * k);
  d.setFontSize(8);
  d.text(`North is up. ${meta.attribution}`, M, ph - 24);
  return d.output('blob');
}
