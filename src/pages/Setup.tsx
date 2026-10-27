// First run and Settings > Offline data: one tap downloads every pack the app needs.
import { useEffect, useRef, useState } from 'react';
import { Screen, Btn, Card, toast, SectionTitle } from '../ui/ui';
import { loadManifest, packState, downloadPack, verifyPack, deletePack, importPackFile, dataBase, type Manifest, type PackState, type Progress, type Pack } from '../lib/packs';
import { fmtBytes, storageInfo, askPersist } from '../lib/opfs';
import { resetPlaces } from '../lib/search';

export default function Setup() {
  const [m, setM] = useState<Manifest | null | undefined>();
  const [states, setStates] = useState<Record<string, PackState>>({});
  const [prog, setProg] = useState<Progress | null>(null);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState('');
  const [space, setSpace] = useState<{ used: number; quota: number; persisted: boolean } | null>(null);
  const [base, setBase] = useState('');
  const abort = useRef<AbortController | null>(null);
  const importFor = useRef<Pack | null>(null);
  const fileIn = useRef<HTMLInputElement>(null);

  const refresh = async (force = false) => {
    const mm = await loadManifest(force);
    setM(mm);
    if (mm) {
      const st: Record<string, PackState> = {};
      for (const p of mm.packs) st[p.id] = await packState(p.id);
      setStates(st);
    }
    setSpace(await storageInfo());
    setBase(await dataBase());
  };
  useEffect(() => {
    void refresh(true);
  }, []);

  const runAll = async (ids?: string[]) => {
    if (!m) return;
    setRunning(true);
    setMsg('');
    await askPersist();
    abort.current = new AbortController();
    try {
      for (const p of m.packs) {
        if (ids ? !ids.includes(p.id) : !p.required) continue;
        if ((await packState(p.id)).complete) continue;
        await downloadPack(p, setProg, abort.current.signal);
        await refresh();
      }
      resetPlaces();
      setMsg('All downloaded and checked. The app now works with no internet.');
      toast('Offline ready');
    } catch (e) {
      setMsg((e as Error).name === 'AbortError' ? 'Paused. Tap Download to continue where it stopped.' : `Stopped: ${(e as Error).message}. Tap Download to try again; finished parts are kept.`);
    }
    setRunning(false);
    setProg(null);
    void refresh();
  };

  if (m === undefined) return <Screen title="Offline data"><p className="muted">Checking…</p></Screen>;
  if (m === null)
    return (
      <Screen title="Offline data">
        <Card tone="warn" title="Can't reach the data">
          <p>The list of map and library downloads could not be loaded from {base || 'the app site'}. Connect to the internet once (Wi-Fi or cell) and try again. After that, everything works offline.</p>
          <Btn kind="go" onClick={() => refresh(true)}>Try again</Btn>
        </Card>
      </Screen>
    );
  const req = m.packs.filter((p) => p.required);
  const opt = m.packs.filter((p) => !p.required);
  const needBytes = req.filter((p) => !states[p.id]?.complete).reduce((s, p) => s + p.bytes, 0);
  const allDone = req.every((p) => states[p.id]?.complete);
  return (
    <Screen title="Offline data">
      <div className="stack">
        <Card tone={allDone ? 'ok' : 'warn'} title={allDone ? 'Offline ready' : 'One tap to get everything'}>
          <p>{allDone ? `Everything is on this device: maps of all of Florida, the Lake County–Ocala detail map, the USGS topo overlay, the map places, and the Library. Map data from ${m.osmDate}.` : `Downloads ${fmtBytes(needBytes)} once (use Wi-Fi). Each part is checked with SHA-256 as it arrives. If the download stops, it continues where it left off.`}</p>
          {!allDone && !running && <Btn kind="go" icon="download" full onClick={() => runAll()}>Download everything ({fmtBytes(needBytes)})</Btn>}
          {running && prog && (
            <div aria-live="polite" data-testid="progress">
              <progress value={prog.bytesDone} max={prog.bytesTotal} style={{ width: '100%', height: 24 }} />
              <p className="small">{m.packs.find((p) => p.id === prog.pack)?.title}: {fmtBytes(prog.bytesDone)} of {fmtBytes(prog.bytesTotal)} (part {prog.chunk} of {prog.chunks})</p>
              <Btn onClick={() => abort.current?.abort()}>Pause</Btn>
            </div>
          )}
          {msg && <p role="status"><b>{msg}</b></p>}
        </Card>
        <SectionTitle>Packs</SectionTitle>
        {[...req, ...opt].map((p) => (
          <div key={p.id} className="card" style={{ padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <b>{p.title}</b>
              <span className={`badge ${states[p.id]?.complete ? '' : 'warn'}`}>{states[p.id]?.complete ? 'Installed' : p.required ? 'Needed' : 'Optional'}</span>
            </div>
            <p className="small muted" style={{ margin: '4px 0' }}>{p.description} · {fmtBytes(p.bytes)} · {p.files.length} file{p.files.length > 1 ? 's' : ''} · data {p.date}</p>
            <details className="small"><summary>Files and SHA-256</summary>{p.files.map((f) => <div key={f.name} className="mono" style={{ wordBreak: 'break-all' }}>{f.name} · {fmtBytes(f.bytes)} · {f.sha256}</div>)}</details>
            <div className="btnrow" style={{ marginTop: 6 }}>
              {!states[p.id]?.complete && !running && <Btn icon="download" onClick={() => runAll([p.id])}>Download</Btn>}
              {states[p.id]?.complete && <Btn icon="check" onClick={async () => { setMsg(`Checking ${p.title}…`); const r = await verifyPack(p); setMsg(r.ok ? `${p.title}: every file matches its SHA-256.` : `${p.title}: ${r.bad.join(', ')} failed the check. Delete and download it again.`); }}>Check files</Btn>}
              <Btn icon="upload" onClick={() => { importFor.current = p; fileIn.current?.click(); }}>Install from a file</Btn>
              {states[p.id]?.complete && <Btn kind="danger" icon="trash" onClick={async () => { if (confirm(`Remove ${p.title} from this device?`)) { await deletePack(p); void refresh(); } }}>Remove</Btn>}
            </div>
          </div>
        ))}
        <input ref={fileIn} type="file" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          const p = importFor.current;
          e.target.value = '';
          if (!f || !p) return;
          try {
            setMsg(`Installing ${f.name}…`);
            await importPackFile(p, f, (fr) => setMsg(`Installing ${f.name}… ${Math.round(fr * 100)}%`));
            setMsg(`Installed ${f.name} (checksum OK).`);
            void refresh();
          } catch (err) {
            setMsg((err as Error).message);
          }
        }} />
        {space && <p className="small muted">This app is using {fmtBytes(space.used)} of {fmtBytes(space.quota)} available. Storage {space.persisted ? 'is marked persistent (the system will not clear it to free space)' : 'is not marked persistent yet; install the app (Add to Home screen / Install) so the system keeps it'}.</p>}
        <p className="small muted">Downloads come from {base}data/. "Install from a file" adds a pack you copied over by USB or SD card, with no internet at all.</p>
      </div>
    </Screen>
  );
}
