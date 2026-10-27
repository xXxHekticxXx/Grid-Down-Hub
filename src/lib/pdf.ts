// PDF viewing and text extraction with pdf.js (runs fully offline; the worker is bundled).
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export async function openPdf(data: ArrayBuffer | Uint8Array) {
  return pdfjs.getDocument({ data: data instanceof Uint8Array ? data : new Uint8Array(data) }).promise;
}

export async function pdfText(data: ArrayBuffer, onProgress?: (p: number) => void): Promise<string[]> {
  const doc = await openPdf(data.slice(0));
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i);
    const tc = await p.getTextContent();
    pages.push(tc.items.map((it) => ('str' in it ? it.str : '')).join(' ').replace(/\s+/g, ' ').trim());
    onProgress?.(i / doc.numPages);
  }
  await doc.destroy();
  return pages;
}
