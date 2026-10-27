import { useEffect, useRef, useState } from 'react';
import { Screen, Row, SectionTitle, Btn, toast, Empty } from '../ui/ui';
import { content, saveItem, type Content } from '../lib/content';
import { all, put, uid, subscribe } from '../lib/db';
import { packState } from '../lib/packs';
import { writeFile } from '../lib/opfs';
import { pdfText } from '../lib/pdf';
import { fmtBytes } from '../lib/opfs';
import { go } from '../lib/router';

type UserPdf = { id: string; title: string; bytes?: number; pages?: string[]; opfs?: string; created: number };

export default function Library() {
  const [c, setC] = useState<Content | null>(null);
  const [installed, setInstalled] = useState<Record<string, boolean>>({});
  const [mine, setMine] = useState<UserPdf[]>([]);
  const [busy, setBusy] = useState('');
  const fileIn = useRef<HTMLInputElement>(null);
  useEffect(() => {
    content().then(async (cc) => {
      setC(cc);
      const packs = [...new Set(cc.library.map((d) => d.pack).filter(Boolean))] as string[];
      const st: Record<string, boolean> = {};
      for (const p of packs) st[p] = (await packState(p)).complete;
      setInstalled(st);
    });
    const load = () => all<UserPdf>('files').then((f) => setMine(f.filter((x) => x.opfs)));
    load();
    return subscribe('files', load);
  }, []);
  const importPdf = async (f?: File) => {
    if (!f) return;
    const id = uid();
    setBusy('Saving…');
    const buf = await f.arrayBuffer();
    await writeFile(`user/${id}.pdf`, buf);
    let pages: string[] = [];
    try {
      pages = await pdfText(buf, (p) => setBusy(`Reading text for search… ${Math.round(p * 100)}%`));
    } catch {
      pages = [];
    }
    await put('files', id, { id, name: f.name, type: 'application/pdf', title: f.name.replace(/\.pdf$/i, ''), bytes: f.size, pages, opfs: `user/${id}.pdf`, created: Date.now() });
    await saveItem({ section: 'library', kind: 'pdf', title: f.name.replace(/\.pdf$/i, ''), fileId: id });
    setBusy('');
    toast(`Added "${f.name}"`);
  };
  if (!c) return <Screen title="Library">{null}</Screen>;
  const books = c.library.filter((d) => d.kind === 'book' || d.kind === 'reference');
  const topo = c.library.filter((d) => d.kind === 'topo');
  const need = (pack?: string) => pack && !installed[pack];
  return (
    <Screen title="Library" actions={<Btn icon="plus" onClick={() => fileIn.current?.click()}>Import PDF</Btn>}>
      <input ref={fileIn} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { void importPdf(e.target.files?.[0]); e.target.value = ''; }} />
      {busy && <p role="status"><b>{busy}</b></p>}
      <SectionTitle>Books · read in the app</SectionTitle>
      <div className="list">
        {books.map((d) => (
          <div key={d.id} className="card" style={{ padding: 12 }}>
            <b>{d.title}</b>
            <p className="small muted" style={{ margin: '4px 0 8px' }}>{d.note}</p>
            <div className="btnrow">
              {d.bookId && <Btn kind="primary" icon="book" to={`/book/${d.bookId}`}>Read chapters</Btn>}
              <Btn icon="file" to={`/pdf/${d.id}`} disabled={!!need(d.pack)}>{need(d.pack) ? 'PDF not downloaded' : 'Original PDF'}</Btn>
            </div>
          </div>
        ))}
      </div>
      <SectionTitle>USGS topo maps · {topo.length} quads · print-ready</SectionTitle>
      <p className="small muted" style={{ marginTop: 0 }}>Home area: original USGS GeoPDFs. Ocala National Forest and the drive north: print editions made from the GeoPDFs (map only, no aerial photo). All public domain. Print on large paper or "fit to page".</p>
      <div className="grid3">
        {topo.map((d) => (
          <button key={d.id} className="btn" style={{ minHeight: 58, flexDirection: 'column', gap: 0 }} disabled={!!need(d.pack)} onClick={() => go(`/pdf/${d.id}`)}>
            <span>{d.title.replace(/^USGS US Topo: /, '').replace(/, FL \(\d+\)$/, '')}</span>
            <span className="small muted" style={{ fontWeight: 400 }}>{d.pack === 'topo-pdf-home' ? 'original' : 'print ed.'}</span>
          </button>
        ))}
      </div>
      {topo.some((d) => need(d.pack)) && <p className="small"><a href="#/setup">Download the topo PDFs</a></p>}
      <SectionTitle>My imports</SectionTitle>
      {mine.length === 0 && <Empty>Add your own PDFs (manuals, plant guides, documents). They stay on this device and are searchable offline.</Empty>}
      <div className="list">
        {mine.map((m) => <Row key={m.id} tone="mine" to={`/pdf/user:${m.id}`} title={m.title} sub={`${m.pages?.length ?? 0} pages · ${fmtBytes(m.bytes ?? 0)} · searchable`} />)}
      </div>
    </Screen>
  );
}
