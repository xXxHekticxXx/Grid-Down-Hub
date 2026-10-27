import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { Screen, Btn, toast } from '../ui/ui';
import { content } from '../lib/content';
import { packFile } from '../lib/packs';
import { get } from '../lib/db';
import { getFile } from '../lib/opfs';
import { openPdf } from '../lib/pdf';
import { saveFile } from '../lib/native';

async function fileFor(docId: string): Promise<{ title: string; file: File | null; note?: string; name: string }> {
  if (docId.startsWith('user:')) {
    const rec = await get<{ title: string; opfs: string; name: string }>('files', docId.slice(5));
    return { title: rec?.title ?? 'PDF', file: rec ? await getFile(rec.opfs) : null, name: rec?.name ?? 'document.pdf' };
  }
  const c = await content();
  const d = c.library.find((x) => x.id === docId);
  if (!d || !d.pack || !d.file) return { title: 'Not found', file: null, name: '' };
  return { title: d.title, file: await packFile(d.pack, d.file), note: d.note, name: d.file };
}

function Page({ doc, n, scale }: { doc: PDFDocumentProxy; n: number; scale: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const holder = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setVisible(true), { rootMargin: '600px' });
    if (holder.current) io.observe(holder.current);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    let task: { cancel: () => void; promise: Promise<unknown> } | null = null;
    let dead = false;
    (async () => {
      const p = await doc.getPage(n);
      if (dead || !ref.current) return;
      const width = Math.min(holder.current?.clientWidth || 800, 1400) * scale;
      const vp0 = p.getViewport({ scale: 1 });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const vp = p.getViewport({ scale: (width / vp0.width) * dpr });
      const cv = ref.current;
      cv.width = vp.width;
      cv.height = vp.height;
      cv.style.width = `${vp.width / dpr}px`;
      task = p.render({ canvas: cv, canvasContext: cv.getContext('2d')!, viewport: vp } as Parameters<typeof p.render>[0]);
      try {
        await task.promise;
      } catch {
        /* cancelled */
      }
    })();
    return () => {
      dead = true;
      task?.cancel();
    };
  }, [visible, doc, n, scale]);
  return (
    <div ref={holder} id={`page-${n}`} style={{ minHeight: 300 }}>
      <canvas ref={ref} className="pdf-page" aria-label={`Page ${n}`} />
      <div className="small muted center" style={{ marginBottom: 10 }}>Page {n}</div>
    </div>
  );
}

export default function PdfViewer({ docId, page }: { docId: string; page: number }) {
  const [info, setInfo] = useState<{ title: string; note?: string; name: string; file: File | null } | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [scale, setScale] = useState(1);
  const [jump, setJump] = useState(String(page));
  const [err, setErr] = useState('');
  useEffect(() => {
    let d: PDFDocumentProxy | null = null;
    fileFor(docId).then(async (i) => {
      setInfo(i);
      if (!i.file) return setErr('This PDF is not on the device yet. Download the Library pack in Settings > Offline data.');
      try {
        d = await openPdf(await i.file.arrayBuffer());
        setDoc(d);
      } catch (e) {
        setErr('Could not open this PDF: ' + (e as Error).message);
      }
    });
    return () => {
      void d?.destroy();
    };
  }, [docId]);
  useEffect(() => {
    if (doc && page > 1) setTimeout(() => document.getElementById(`page-${page}`)?.scrollIntoView(), 300);
  }, [doc, page]);
  return (
    <Screen title={info?.title ?? 'PDF'} crumb="Library"
      actions={<>
        <button className="icon-btn" aria-label="Smaller" onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}>−</button>
        <button className="icon-btn" aria-label="Bigger" onClick={() => setScale((s) => Math.min(4, s + 0.25))}>+</button>
      </>}>
      {info?.note && <div className="book-notice">{info.note}</div>}
      {err && <p className="card card-warn">{err}</p>}
      {doc && (
        <>
          <form className="btnrow" style={{ marginBottom: 10 }} onSubmit={(e) => { e.preventDefault(); document.getElementById(`page-${jump}`)?.scrollIntoView(); }}>
            <label className="field" style={{ flex: '0 1 160px' }}><span className="field-label">Go to page (1–{doc.numPages})</span><input type="number" min={1} max={doc.numPages} value={jump} onChange={(e) => setJump(e.target.value)} /></label>
            <Btn type="submit">Go</Btn>
            <Btn icon="print" onClick={async () => info?.file && toast(await saveFile(info.name, info.file))}>Save / print original</Btn>
          </form>
          <div style={{ overflowX: scale > 1 ? 'auto' : 'visible' }}>
            {Array.from({ length: doc.numPages }, (_, i) => <Page key={`${i}-${scale}`} doc={doc} n={i + 1} scale={scale} />)}
          </div>
        </>
      )}
    </Screen>
  );
}
