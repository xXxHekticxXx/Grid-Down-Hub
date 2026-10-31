import { useState } from 'react';
import StatusBar, { useOfflineReady } from '../ui/StatusBar';
import { Icon } from '../ui/icons';
import { Tile } from '../ui/ui';
import { go, href } from '../lib/router';
import { UpdateBanner } from '../ui/UpdateBanner';
import { useSettings } from '../lib/settings';

export const HOME_TILES = [
  { to: '/map', icon: 'map', title: 'Map', sub: 'GPS, pins, layers, topo' },
  { to: '/cat/first-aid', icon: 'medkit', title: 'Trauma & First Aid', sub: 'Bleeding, CPR, wounds, bites' },
  { to: '/cat/water', icon: 'drop', title: 'Water', sub: 'Find it, store it, treat it' },
  { to: '/hub/field', icon: 'axe', title: 'Bushcraft & Shelter', sub: 'Fire, shelter, power, camp' },
  { to: '/hub/plants-food', icon: 'leaf', title: 'Plants, Food & Herbal', sub: 'Edibles, look-alikes, remedies' },
  { to: '/cat/hazards', icon: 'storm', title: 'Hazards & Security', sub: 'Storms, heat, fire, wildlife' },
  { to: '/tools', icon: 'tools', title: 'Tools & Radio', sub: 'Bleach, timers, SOS, NOAA' },
  { to: '/library', icon: 'book', title: 'Library', sub: 'Manuals, topo maps, your PDFs' },
];

export default function Home() {
  const { s, set } = useSettings();
  const [q, setQ] = useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) go(`/search?q=${encodeURIComponent(q.trim())}`);
  };
  const night = s.theme === 'night';
  const st = useOfflineReady();
  return (
    <div className="screen">
      <StatusBar />
      <div className="home-head">
        <h1>Grid-Down Hub</h1>
        <button className="pill" aria-pressed={s.saver} onClick={() => set({ saver: !s.saver })} aria-label="Battery saver">
          <Icon name="battery" size={20} /> {s.saver ? 'Saver on' : 'Saver'}
        </button>
        <button className="icon-btn ring" onClick={() => set({ theme: night ? 'day' : 'night' })} aria-label={night ? 'Day mode' : 'Night mode (red on black)'}>
          <Icon name={night ? 'sun' : 'moon'} />
        </button>
      </div>
      <main className="content stack">
        <UpdateBanner />
        <form className="searchbox" onSubmit={submit} role="search">
          <Icon name="search" />
          <input type="search" aria-label="Search everything" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn btn-primary" type="submit" style={{ minHeight: 48 }}>Search</button>
        </form>
        <a className="emergency-btn" href={href('/emergency')}>
          <Icon name="alert" size={44} stroke={2.4} />
          <span style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="big">EMERGENCY</span>
            <span className="small">CPR · Bleeding · Choking · Gunshot · Snakebite</span>
          </span>
        </a>
        <div className="plan-row">
          <a className="plan-btn" href={href('/stay')}>
            <b>STAY PLAN</b>
            <span>Hold at home · My Plan</span>
          </a>
          <a className="plan-btn go" href={href('/go')}>
            <b>GO PLAN</b>
            <span>Route · fuel · load list</span>
          </a>
        </div>
        {!st.ready && st.missing !== 0 && (
          <a className="card card-warn setup-banner" href={href('/setup')} data-testid="setup-banner">
            <b>Get the maps and Library onto this device</b>
            <span className="small">One download on Wi-Fi, then everything works with no internet. Tap here, then Download everything.</span>
          </a>
        )}
        {s.saver ? (
          <div className="list">
            {HOME_TILES.map((t) => (
              <a key={t.to} className="row" href={href(t.to)}>
                <span className="row-main"><span className="row-title" style={{ fontFamily: 'var(--head)', fontSize: 'calc(var(--fs)*1.3)' }}>{t.title}</span></span>
                <span className="row-chev">›</span>
              </a>
            ))}
            <p className="small muted">Battery saver: black screen, no animations, the map draws less and GPS runs only while the map is open.</p>
          </div>
        ) : (
          <nav className="tiles" aria-label="Sections">
            {HOME_TILES.map((t) => (
              <Tile key={t.to} {...t} />
            ))}
          </nav>
        )}
      </main>
      <footer className="home-foot">
        <span>Nearest ER: AdventHealth Waterman · <a href="tel:3522533333">352-253-3333</a></span>
        <span style={{ display: 'flex', gap: 4 }}>
          <a className="icon-btn" href={href('/plan')} aria-label="My Plan"><Icon name="lock" /></a>
          <a className="icon-btn" href={href('/settings')} aria-label="Settings"><Icon name="gear" /></a>
        </span>
      </footer>
    </div>
  );
}
