// Maps screen: "Add maps by state" button, the state list sheet, and the installed/downloading state maps.
import { useEffect, useRef, useState } from 'react';
import { Btn, Sheet, SectionTitle, Empty, toast } from '../ui/ui';
import { fmtBytes } from '../lib/opfs';
import { isNative, packState } from '../lib/packs';
import { loadStateIndex, startDownload, stopDownload, removeState, importState, subscribeJobs, jobFor, fileUrl, NEAR, type StateIndex, type StatePack } from '../lib/statemaps';

type Row = { p: StatePack; installed: boolean; partial: boolean };

export function StateMaps() {
  const [idx, setIdx] = useState<StateIndex | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [, tick] = useState(0);
  const [loading, setLoading] = useState(false);
  const importFor = useRef<StatePack | null>(null);
  const fileIn = useRef<HTMLInputElement>(null);

  const refreshRows = async (i: StateIndex | null) => {
    if (!i) return setRows([]);
    setRows(await Promise.all(i.packs.map(async (p) => {
      const st = await packState(p.id);
      return { p, installed: st.complete, partial: !st.complete && Object.values(st.done).some((d) => d.length > 0) };
    })));
  };

  useEffect(() => {
    loadStateIndex().then((i) => { setIdx(i); void refreshRows(i); });
    return subscribeJobs(() => { tick((n) => n + 1); setIdx((i) => { void refreshRows(i); return i; }); });
  }, []);

  const openList = async () => {
    setOpen(true);
    setLoading(true);
    const i = await loadStateIndex(true);
    setIdx(i);
    await refreshRows(i);
    setLoading(false);
  };

  const download = (p: StatePack) => {
    if (!isNative()) {
      importFor.current = p;
      window.open(fileUrl(idx, p), '_blank');
      toast(`Downloading ${p.files[0].name} in your browser. When it finishes, pick it with "Import the file".`);
      return;
    }
    void startDownload(idx, p);
  };

  const remove = async (p: StatePack) => {
    if (!confirm(`Delete the ${p.title}? You can download it again later.`)) return;
    await removeState(p);
    await refreshRows(idx);
  };

  const mine = rows.filter((r) => r.installed || r.partial || jobFor(r.p.id));
  const name = (p: StatePack) => p.title.replace(/ map$/, '');
  const match = (r: Row) => !q || name(r.p).toLowerCase().includes(q.toLowerCase()) || r.p.code.toLowerCase() === q.toLowerCase();
  const near = rows.filter((r) => NEAR.includes(r.p.code) && match(r));
  const rest = rows.filter((r) => !NEAR.includes(r.p.code) && match(r));

  const status = (r: Row, long: boolean) => {
    const j = jobFor(r.p.id);
    if (j?.running) return `Downloading ${Math.round((j.done / j.total) * 100)}% · ${fmtBytes(j.done)} of ${fmtBytes(j.total)}`;
    if (j?.error) return `Stopped: ${j.error}. Tap Resume to keep going.`;
    if (r.installed) return `${fmtBytes(r.p.bytes)} · installed${long ? ' · on the map' : ' ✓'}`;
    if (r.partial) return `${fmtBytes(r.p.bytes)} · part downloaded`;
    return fmtBytes(r.p.bytes);
  };

  const action = (r: Row) => {
    const j = jobFor(r.p.id);
    if (j?.running) return <button className="btn" onClick={() => stopDownload(r.p.id)}>Stop</button>;
    if (r.installed) return <button className="btn" onClick={() => void remove(r.p)}>Delete</button>;
    return (
      <span className="btnrow" style={isNative() ? { flex: '0 0 auto' } : { flex: '1 1 100%' }}>
        {!isNative() && <button className="btn" onClick={() => { importFor.current = r.p; fileIn.current?.click(); }}>Import the file</button>}
        <button className="btn btn-go" onClick={() => download(r.p)}>{r.partial || j?.error ? 'Resume' : 'Download'}</button>
      </span>
    );
  };

  const row = (r: Row, long: boolean) => {
    const j = jobFor(r.p.id);
    return (
      <div key={r.p.id} className="row" data-testid={`state-${r.p.code}`} style={isNative() ? undefined : { flexWrap: 'wrap' }}>
        <span className="row-main">
          <span className="row-title">{long ? r.p.title : name(r.p)}</span>
          <span className="row-sub">{status(r, long)}</span>
          {j?.running && <span style={{ display: 'block', height: 8, background: 'var(--line)', borderRadius: 4, marginTop: 6 }}><span style={{ display: 'block', height: 8, width: `${(j.done / j.total) * 100}%`, background: '#1F5C36', borderRadius: 4 }} /></span>}
        </span>
        {action(r)}
      </div>
    );
  };

  return (
    <>
      <Btn icon="map" full onClick={() => void openList()}>Add maps by state</Btn>
      {mine.length > 0 && (
        <>
          <SectionTitle>State maps</SectionTitle>
          <div className="list">{mine.map((r) => row(r, true))}</div>
        </>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title="Add maps by state">
        <label className="small" style={{ display: 'block', fontWeight: 700 }}>Search states
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search states" style={{ width: '100%', marginBottom: 8, marginTop: 4 }} />
        </label>
        {loading && rows.length === 0 && <Empty>Getting the list of states…</Empty>}
        {!loading && rows.length === 0 && <Empty>The list of state maps isn't available yet. Connect to the internet and try again.</Empty>}
        {near.length > 0 && <><SectionTitle>Next to Florida</SectionTitle><div className="list">{near.map((r) => row(r, false))}</div></>}
        {rest.length > 0 && <><SectionTitle>All states</SectionTitle><div className="list">{rest.map((r) => row(r, false))}</div></>}
        <p className="small muted">
          Roads to street level, towns, water, parks and forests (OpenStreetMap). Each part is checked as it downloads; once done, it works with no signal.
          Directions and Pin by address stay Florida-only.
          {!isNative() && ' On the website, Download saves the file with your browser; then use "Import the file" to add it.'}
        </p>
      </Sheet>
      <input ref={fileIn} type="file" hidden accept=".pmtiles" onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        const p = importFor.current;
        if (!f || !p) return;
        try {
          toast(`Checking and adding ${f.name}…`);
          await importState(p, f);
          toast(`${p.title} added`);
          await refreshRows(idx);
        } catch (err) {
          toast((err as Error).message);
        }
      }} />
    </>
  );
}
