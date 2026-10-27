import { useEffect, useState } from 'react';
import { Page } from '../ui';
import { applyTheme, fmtBytes, loadSettings, offlineReady, readStatus, saveSettings, Settings as S, Status } from '../lib/util';

type W = Window & { __gdhUpdate?: boolean; __gdhApply?: () => void; __gdhReg?: ServiceWorkerRegistration };

export default function Settings() {
  const [st, setSt] = useState<Status | null>(null);
  const [s, setS] = useState<S>(loadSettings);
  const [upd, setUpd] = useState<boolean>(!!(window as W).__gdhUpdate);
  const [msg, setMsg] = useState('');
  const refresh = () => readStatus().then(setSt);
  useEffect(() => {
    refresh();
    const f = () => setUpd(true);
    window.addEventListener('gdh-update', f);
    return () => window.removeEventListener('gdh-update', f);
  }, []);
  const set = (p: Partial<S>) => {
    const n = { ...s, ...p };
    setS(n);
    saveSettings(n);
    applyTheme(n);
  };
  const ready = st ? offlineReady(st) : false;
  const pct = st && st.quota ? Math.min(100, (st.usage / st.quota) * 100) : 0;
  const Toggle = ({ label, on, f }: { label: string; on: boolean; f: () => void }) => (
    <button className="item" style={{ font: 'inherit', width: '100%', cursor: 'pointer' }} onClick={f} aria-pressed={on}>
      <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
      <span className={'badge ' + (on ? 'ok' : 'warn')}>{on ? 'On' : 'Off'}</span>
    </button>
  );
  return (
    <Page title="Settings">
      {st ? (
        ready ? (
          <div className="good">
            <b>Ready to work offline ✓</b>
            <div>The app and its content are saved on this device ({st.cached} files).</div>
          </div>
        ) : (
          <div className="notice">
            <b>Not ready for offline yet.</b> Open the app once while you have internet, wait a minute, then check again.
          </div>
        )
      ) : null}
      <div className="card">
        <h2>Storage</h2>
        {st ? (
          <>
            <div className="row">
              <b className="grow">Used by this app</b>
              <b>
                {fmtBytes(st.usage)} of {st.quota ? fmtBytes(st.quota) : '?'} available
              </b>
            </div>
            <div style={{ height: '.9rem', borderRadius: '.5rem', background: 'var(--line)', overflow: 'hidden', margin: '.4rem 0' }}>
              <div style={{ width: pct + '%', height: '100%', background: 'var(--blue)' }} />
            </div>
            <div className="row">
              <b className="grow">Permanent storage</b>
              <span className={'badge ' + (st.persisted ? 'ok' : 'warn')}>{st.persisted ? 'Granted' : st.persisted === false ? 'Not granted' : 'Unknown'}</span>
            </div>
            {!st.persisted ? (
              <>
                <div className="notice" style={{ marginTop: '.5rem' }}>
                  The browser may delete saved data if the phone runs low on space. Installing the app to your home screen makes permission much more likely.
                </div>
                <button
                  className="btn"
                  style={{ marginTop: '.5rem' }}
                  onClick={async () => {
                    try {
                      const ok = await navigator.storage.persist();
                      setMsg(ok ? 'Permanent storage granted.' : 'The browser said no. Install the app to the home screen and try again.');
                    } catch {
                      setMsg('This browser does not support it.');
                    }
                    refresh();
                  }}
                >
                  Ask for permanent storage
                </button>
              </>
            ) : null}
          </>
        ) : (
          'Checking…'
        )}
        {msg ? <div className="muted">{msg}</div> : null}
      </div>
      <div className="list">
        <Toggle label="Night mode (red light)" on={s.night} f={() => set({ night: !s.night })} />
        <Toggle label="Battery saver (dark, no animation)" on={s.saver} f={() => set({ saver: !s.saver })} />
        <Toggle label="Metronome sound" on={s.sound} f={() => set({ sound: !s.sound })} />
      </div>
      <div className="card">
        <h2>Updates</h2>
        {upd ? (
          <>
            <div className="good">An update is ready.</div>
            <button className="btn red" style={{ marginTop: '.5rem', width: '100%' }} onClick={() => (window as W).__gdhApply?.()}>
              Install update now
            </button>
          </>
        ) : (
          <>
            <div className="muted">Updates never install on their own. Open the app online about once a month and press the button.</div>
            <button
              className="btn"
              style={{ marginTop: '.5rem', width: '100%' }}
              onClick={async () => {
                try {
                  await (window as W).__gdhReg?.update();
                  setMsg(navigator.onLine ? 'Checked. If an update exists this page will offer it in a moment.' : 'You are offline. Try again when you have internet.');
                } catch {
                  setMsg('Could not check right now.');
                }
              }}
            >
              Check for updates
            </button>
          </>
        )}
      </div>
      <div className="list">
        <a className="item" href="#/plan">
          <span>Export / import my plan</span>
          <span className="chev">›</span>
        </a>
        <a className="item" href="#/about">
          <span>About and sources</span>
          <span className="chev">›</span>
        </a>
      </div>
      <div className="muted">Map data © OpenStreetMap contributors. App version 1.0.</div>
    </Page>
  );
}
