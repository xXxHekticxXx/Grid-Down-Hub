import { useEffect, useRef, useState } from 'react';

type Doc = { numPages: number; getPage: (n: number) => Promise<any> };

export default function PdfViewer({ source }: { source: { url: string } | { data: ArrayBuffer } }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
        pdfjs.GlobalWorkerOptions.workerSrc = worker;
        const task = pdfjs.getDocument('url' in source ? { url: source.url } : { data: new Uint8Array(source.data.slice(0)) });
        const d = await task.promise;
        if (!dead) {
          setDoc(d as unknown as Doc);
          setBusy(false);
        }
      } catch (e) {
        if (!dead) {
          setErr('Could not open this PDF. ' + (e instanceof Error ? e.message : ''));
          setBusy(false);
        }
      }
    })();
    return () => {
      dead = true;
    };
  }, [source]);

  useEffect(() => {
    if (!doc || !canvas.current || !box.current) return;
    let task: { cancel: () => void; promise: Promise<unknown> } | null = null;
    let dead = false;
    (async () => {
      const p = await doc.getPage(page);
      const base = p.getViewport({ scale: 1 });
      const fit = (box.current!.clientWidth - 16) / base.width;
      const dpr = window.devicePixelRatio || 1;
      const vp = p.getViewport({ scale: fit * zoom * dpr });
      const c = canvas.current!;
      c.width = Math.floor(vp.width);
      c.height = Math.floor(vp.height);
      c.style.width = Math.floor(vp.width / dpr) + 'px';
      c.style.height = Math.floor(vp.height / dpr) + 'px';
      task = p.render({ canvasContext: c.getContext('2d')!, canvas: c, viewport: vp });
      try {
        await task!.promise;
      } catch {
        /* cancelled */
      }
      if (dead) return;
    })();
    return () => {
      dead = true;
      task?.cancel();
    };
  }, [doc, page, zoom]);

  if (err) return <div className="notice">{err}</div>;
  const n = doc?.numPages ?? 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
      <div className="row">
        <button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page">
          ‹
        </button>
        <input style={{ width: '5.5rem', textAlign: 'center' }} inputMode="numeric" value={page} onChange={(e) => { const v = parseInt(e.target.value, 10); if (v >= 1 && v <= n) setPage(v); }} aria-label="Page number" />
        <span className="muted">of {n || '…'}</span>
        <button className="btn" disabled={page >= n} onClick={() => setPage(page + 1)} aria-label="Next page">
          ›
        </button>
        <span className="grow" />
        <button className="btn" onClick={() => setZoom(Math.max(0.5, zoom - 0.25))} aria-label="Zoom out">
          −
        </button>
        <button className="btn" onClick={() => setZoom(Math.min(4, zoom + 0.25))} aria-label="Zoom in">
          +
        </button>
      </div>
      <div className="pdfbox" ref={box}>
        {busy ? <div style={{ color: '#fff', padding: '2rem' }}>Opening…</div> : null}
        <canvas ref={canvas} />
      </div>
    </div>
  );
}
