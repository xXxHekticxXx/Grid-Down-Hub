import { useEffect, useState } from 'react';
import { applyTheme, loadSettings, offlineReady, readStatus, saveSettings, Settings } from '../lib/util';

const TILES = [
  ['#/firstaid', '＋', 'First Aid', 'Step by step'],
  ['#/water', '≈', 'Water & Food', 'Bleach calculator'],
  ['#/hazards', '⚠', 'Hazards', 'Hurricane, CO, snakes'],
  ['#/map', '⌖', 'Map & GPS', 'Coordinates, pins'],
  ['#/survival', '▲', 'Survival', 'Army manual'],
  ['#/comms', '◉', 'Comms & Local', 'NOAA, radios, shelters'],
  ['#/plan', '☰', 'My Plan', 'Private, on this device'],
  ['#/library', '▤', 'Library', 'PDFs and manuals']
];

export default function Home() {
  const [ready, setReady] = useState<boolean | null>(null);
  const [s, setS] = useState<Settings>(loadSettings);
  const [q, setQ] = useState('');
  useEffect(() => {
    readStatus().then((st) => setReady(offlineReady(st)));
  }, []);
  const set = (p: Partial<Settings>) => {
    const n = { ...s, ...p };
    setS(n);
    saveSettings(n);
    applyTheme(n);
  };
  return (
    <div className="wrap">
      <div className="bar">
        <h1>Grid-Down Hub</h1>
        {ready === null ? null : ready ? <span className="badge ok">Offline ready ✓</span> : <span className="badge warn">Open once online</span>}
        <a className="back" href="#/settings" aria-label="Settings">
          ⚙
        </a>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) location.hash = '#/search/' + encodeURIComponent(q.trim());
        }}
      >
        <input className="search" type="search" placeholder="Search everything (works offline)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
      </form>
      <a className="sos" href="#/emergency/cpr/1">
        <span aria-hidden="true">＋</span> EMERGENCY
      </a>
      <div className="tiles">
        {TILES.map(([href, ic, t, sub]) => (
          <a key={href} className="tile" href={href}>
            <span className="ic" aria-hidden="true">
              {ic}
            </span>
            {t}
            <small>{sub}</small>
          </a>
        ))}
      </div>
      <div className="row">
        <button className="btn grow" onClick={() => set({ night: !s.night })}>
          {s.night ? 'Night mode: ON' : 'Night mode (red light)'}
        </button>
        <button className="btn grow" onClick={() => set({ saver: !s.saver })}>
          {s.saver ? 'Battery saver: ON' : 'Battery saver'}
        </button>
      </div>
      <div className="foot">If phones work, call 911 first. Grid-Down Hub is a guide, not a substitute for training.</div>
    </div>
  );
}
