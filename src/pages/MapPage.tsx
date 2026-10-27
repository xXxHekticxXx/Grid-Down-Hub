import { useState } from 'react';
import { Page } from '../ui';
import { usePlan, Pin } from '../lib/plan';
import { bearing, compass, distKm, fmtDec, fmtDM, fmtDist, HOME } from '../lib/util';

type Fix = { lat: number; lon: number; acc: number };

export default function MapPage() {
  const { plan, update, err } = usePlan();
  const [fix, setFix] = useState<Fix | null>(null);
  const [gpsMsg, setGpsMsg] = useState('');
  const [name, setName] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');

  const locate = () => {
    setGpsMsg('Looking for GPS… (go outside or near a window)');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setFix({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy });
        setGpsMsg('');
      },
      (e) => setGpsMsg(e.code === 1 ? 'Location permission is off. Allow location for this app in the browser settings.' : 'No GPS fix yet. Try again outdoors.'),
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 5000 }
    );
  };
  const origin = fix ?? { lat: HOME.lat, lon: HOME.lon };
  const addPin = (la: number, lo: number) => {
    if (!isFinite(la) || !isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) return;
    const pin: Pin = { id: String(Date.now()), name: name.trim() || 'Pin', lat: la, lon: lo, kind: 'pin' };
    update((p) => ({ ...p, pins: [...p.pins, pin] }));
    setName('');
    setLat('');
    setLon('');
  };

  return (
    <Page title="Map & GPS" medical={false}>
      <div className="notice">
        GPS, pins, distance and bearing work now with no internet. The street-map picture is installed by the offline map download (next step of the build).
      </div>
      <div className="card">
        <div className="row">
          <h2 style={{ margin: 0, flex: 1 }}>You are here</h2>
          <span className="badge ok">GPS works offline</span>
        </div>
        {fix ? (
          <>
            <p style={{ fontSize: '1.15rem', fontWeight: 700, margin: '.5rem 0 .1rem' }}>{fmtDec(fix.lat, fix.lon)}</p>
            <p style={{ margin: 0 }}>{fmtDM(fix.lat, fix.lon)}</p>
            <p className="muted">Accuracy about {Math.round(fix.acc)} m. Read the degrees-minutes line over a radio.</p>
          </>
        ) : (
          <p className="muted">No position yet. Tap the button.</p>
        )}
        <button className="btn primary" style={{ width: '100%' }} onClick={locate}>
          {fix ? 'Update my position' : 'Find my position'}
        </button>
        {gpsMsg ? <p className="muted">{gpsMsg}</p> : null}
        {fix ? (
          <button className="btn" style={{ width: '100%', marginTop: '.5rem' }} onClick={() => addPin(fix.lat, fix.lon)}>
            Drop a pin here{name ? ` named "${name}"` : ''}
          </button>
        ) : null}
      </div>
      <div className="card">
        <h2>My pins</h2>
        <div className="muted">Distance and bearing are straight-line from {fix ? 'your position' : 'the home pin area (no GPS fix yet)'}.</div>
        {plan?.pins.map((p) => {
          const d = distKm(origin, p);
          const b = bearing(origin, p);
          return (
            <div key={p.id} className="rec">
              <label>Name</label>
              <input value={p.name} onChange={(e) => update((pl) => ({ ...pl, pins: pl.pins.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)) }))} />
              <div style={{ marginTop: '.4rem', fontWeight: 700 }}>{fmtDec(p.lat, p.lon)}</div>
              <div className="muted">{fmtDM(p.lat, p.lon)}</div>
              <div style={{ margin: '.3rem 0' }}>
                {fmtDist(d)} · bearing {Math.round(b)}° {compass(b)}
              </div>
              {p.id !== 'home' ? (
                <button className="btn small" onClick={() => update((pl) => ({ ...pl, pins: pl.pins.filter((x) => x.id !== p.id) }))}>
                  Delete pin
                </button>
              ) : (
                <div className="muted">Default is the town of Sorrento. Edit the numbers below to your exact spot, or drop a pin at home.</div>
              )}
            </div>
          );
        })}
        <h2 style={{ marginTop: '.8rem' }}>Add a pin by coordinates</h2>
        <label htmlFor="pn">Name</label>
        <input id="pn" value={name} onChange={(e) => setName(e.target.value)} placeholder="Meeting point, water, cache…" />
        <div className="row">
          <div className="grow">
            <label htmlFor="pla">Latitude</label>
            <input id="pla" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="28.8086" />
          </div>
          <div className="grow">
            <label htmlFor="plo">Longitude</label>
            <input id="plo" inputMode="decimal" value={lon} onChange={(e) => setLon(e.target.value)} placeholder="-81.5633" />
          </div>
        </div>
        <p>
          <button className="btn primary" style={{ width: '100%' }} onClick={() => addPin(parseFloat(lat), parseFloat(lon))}>
            Add pin
          </button>
        </p>
        {err ? <div className="notice">{err}</div> : null}
        <div className="muted">Pins stay on this device and are included in your Export in My Plan.</div>
      </div>
      <a className="btn" href="#/p/county-emergency-info-lake-county">
        Pet-friendly shelters (confirm before going)
      </a>
      <a className="btn" href="#/p/nearest-hospitals-with-ers">
        Nearest hospitals with ERs
      </a>
      <div className="muted">Map data © OpenStreetMap contributors.</div>
    </Page>
  );
}
