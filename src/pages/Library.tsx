import { useEffect, useMemo, useRef, useState } from 'react';
import sv from '../../content/survival.json';
import { Page } from '../ui';
import PdfViewer from './PdfViewer';
import { listFiles, opfsSupported, readFile, removeFile, saveFile } from '../lib/opfs';
import { fmtBytes } from '../lib/util';

const ATP_URL = import.meta.env.BASE_URL + sv.file;

export default function Library({ open, name }: { open?: string; name?: string }) {
  if (open === 'atp') return <Atp />;
  if (open === 'f' && name) return <UserPdf name={name} />;
  return <LibraryHome />;
}

function useAtp() {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    fetch(ATP_URL, { method: 'HEAD' })
      .then((r) => setOk(r.ok && (r.headers.get('content-type') || '').includes('pdf')))
      .catch(() => setOk(false));
  }, []);
  return ok;
}

function Atp() {
  const ok = useAtp();
  return (
    <Page title="Survival manual" back="#/library" medical>
      {ok === false ? (
        <div className="notice">
          The Army manual PDF is not on this device yet. Open the app once while you have internet and it will download with the next update. You can also add your own copy from the Library page.
        </div>
      ) : ok ? (
        <PdfViewer source={{ url: ATP_URL }} />
      ) : (
        <div className="card">Checking…</div>
      )}
      <div className="muted">
        {sv.title}.{' '}
        <a href={sv.sourceUrl} target="_blank" rel="noopener">
          Source
        </a>
      </div>
    </Page>
  );
}

function UserPdf({ name }: { name: string }) {
  const [data, setData] = useState<ArrayBuffer | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    readFile(name).then(setData, () => setErr('Could not read that file.'));
  }, [name]);
  const src = useMemo(() => (data ? { data } : null), [data]);
  return (
    <Page title={name} back="#/library">
      {err ? <div className="notice">{err}</div> : src ? <PdfViewer source={src} /> : <div className="card">Opening…</div>}
    </Page>
  );
}

function LibraryHome() {
  const atp = useAtp();
  const [files, setFiles] = useState<{ name: string; size: number }[]>([]);
  const [msg, setMsg] = useState('');
  const pick = useRef<HTMLInputElement>(null);
  const refresh = () => {
    if (opfsSupported()) listFiles().then(setFiles, () => setMsg('Could not read your files.'));
  };
  useEffect(refresh, []);
  const add = async (list: FileList | null) => {
    if (!list?.length) return;
    setMsg('');
    try {
      for (const f of Array.from(list)) await saveFile(f);
      setMsg(`Added ${list.length} file${list.length > 1 ? 's' : ''}.`);
    } catch (e) {
      setMsg('Could not save the file. The device may be out of storage space. ' + (e instanceof Error ? e.message : ''));
    }
    refresh();
  };
  return (
    <Page title="Library">
      <div className="list">
        <a className="item" href="#/library/atp">
          <span className="bar2" />
          <span>
            Army ATP 3-50.21, Survival
            <div className="muted">{atp === false ? 'Not downloaded yet' : 'Bundled. Public release.'}</div>
          </span>
          <span className="chev">›</span>
        </a>
        <a className="item" href="#/p/bigger-offline-libraries-kiwix-free">
          <span className="bar2" />
          <span>
            Bigger offline libraries (Kiwix)
            <div className="muted">Wikipedia, medical references. You download these.</div>
          </span>
          <span className="chev">›</span>
        </a>
      </div>
      <div className="card">
        <h2>My documents</h2>
        {!opfsSupported() ? <div className="notice">This browser can't store files privately. Use Chrome or Edge.</div> : null}
        {files.length === 0 ? <div className="muted">No PDFs added yet. Add the ones you want to have with no internet, for example Where There Is No Doctor (download it yourself from Hesperian).</div> : null}
        <div className="list">
          {files.map((f) => (
            <div key={f.name} className="row">
              <a className="item grow" href={'#/library/f/' + encodeURIComponent(f.name)}>
                <span>
                  {f.name}
                  <div className="muted">{fmtBytes(f.size)}</div>
                </span>
              </a>
              <button
                className="btn"
                onClick={async () => {
                  if (confirm(`Remove ${f.name} from this device?`)) {
                    await removeFile(f.name);
                    refresh();
                  }
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <input ref={pick} type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
        <p>
          <button className="btn primary" style={{ width: '100%' }} onClick={() => pick.current?.click()}>
            Add your own PDF
          </button>
        </p>
        {msg ? <div className="muted">{msg}</div> : null}
        <div className="muted">Added files stay on this device. Nothing is uploaded.</div>
      </div>
    </Page>
  );
}
