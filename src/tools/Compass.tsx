import { useEffect, useState } from 'react';
import { watchHeading, watchPosition, type Fix } from '../lib/native';
import { all } from '../lib/db';
import type { Pin } from '../types';
import { bearingDeg, cardinal, distanceM, fmtDistance, fmtDD, fmtDDM, fmtUSNG, magneticFromTrue, fmtDeclination, declinationAt, HOME_AREA } from '../lib/geo';
import { useSettings } from '../lib/settings';
import { href } from '../lib/router';

export function CompassTool() {
  const { s } = useSettings();
  const [h, setH] = useState<number | null>(null);
  const [fix, setFix] = useState<Fix | null>(null);
  const [err, setErr] = useState('');
  const [pins, setPins] = useState<Pin[]>([]);
  const [target, setTarget] = useState<string>('');
  useEffect(() => watchHeading(setH), []);
  useEffect(() => watchPosition(setFix, setErr), []);
  useEffect(() => {
    all<Pin>('pins').then(setPins);
  }, []);
  const pin = pins.find((p) => p.id === target);
  const brg = fix && pin ? bearingDeg([fix.lon, fix.lat], [pin.lon, pin.lat]) : null;
  const rel = brg != null && h != null ? (brg - h + 360) % 360 : null;
  return (
    <div className="stack">
      <section className="card center" aria-label="Compass">
        <svg viewBox="0 0 200 200" width="240" height="240" role="img" aria-label={h == null ? 'No compass sensor' : `Heading ${Math.round(h)} degrees`}>
          <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeWidth="4" />
          <g transform={`rotate(${h == null ? 0 : -h} 100 100)`}>
            {['N', 'E', 'S', 'W'].map((d, i) => (
              <text key={d} x="100" y="26" textAnchor="middle" fontSize="20" fontWeight="800" fill={d === 'N' ? '#C8102E' : 'currentColor'} transform={`rotate(${i * 90} 100 100)`}>{d}</text>
            ))}
            {Array.from({ length: 36 }).map((_, i) => (
              <line key={i} x1="100" y1="10" x2="100" y2={i % 9 === 0 ? 22 : 16} stroke="currentColor" strokeWidth="2" transform={`rotate(${i * 10} 100 100)`} />
            ))}
          </g>
          {rel != null && <path d="M100 40 L112 70 L100 62 L88 70 Z" fill="#1F5C36" transform={`rotate(${rel} 100 100)`} />}
          <path d="M100 18 L108 34 L92 34 Z" fill="currentColor" />
          <text x="100" y="112" textAnchor="middle" fontSize="30" fontWeight="800" fill="currentColor">{h == null ? '—' : `${Math.round(h)}°`}</text>
          <text x="100" y="136" textAnchor="middle" fontSize="16" fill="currentColor">{h == null ? '' : cardinal(h)}</text>
        </svg>
        {h == null && <p className="small">No compass sensor reading. Laptops usually have none. On the phone, move it in a figure 8 to wake the compass. You can still navigate by GPS on the map, or by sun and stars (Radio &amp; Navigation).</p>}
      </section>
      <section className="card">
        <h2 className="card-title">Where am I</h2>
        {fix ? (
          <div data-testid="gps-coords">
            <div><b>{fmtDD(fix.lat, fix.lon)}</b></div>
            <div>{fmtDDM(fix.lat, fix.lon)}</div>
            <div>USNG {fmtUSNG(fix.lat, fix.lon)}</div>
            <div className="small muted">± {fmtDistance(fix.acc, s.metric)}{fix.alt != null ? ` · elevation ${Math.round(fix.alt * 3.28084)} ft` : ''}</div>
          </div>
        ) : (
          <p className="small">{err || 'Waiting for GPS…'} GPS works without cell service; it can take a minute outdoors.</p>
        )}
      </section>
      <section className="card">
        <h2 className="card-title">Bearing to a pin</h2>
        <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Pick a pin">
          <option value="">Pick a pin…</option>
          {pins.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {pin && fix && brg != null && (
          <p style={{ marginTop: 8 }}>
            <b>{fmtDistance(distanceM([fix.lon, fix.lat], [pin.lon, pin.lat]), s.metric)}</b> at <b>{Math.round(brg)}° true</b> ({cardinal(brg)}), about <b>{Math.round(magneticFromTrue(brg, [fix.lon, fix.lat]))}° on a hand compass</b>.
          </p>
        )}
        {pins.length === 0 && <p className="small">No pins yet. <a href={href('/map')}>Drop one on the map</a> with a long press.</p>}
        <p className="small muted" data-testid="declination">A hand compass points to magnetic north, {fmtDeclination(fix ? [fix.lon, fix.lat] : HOME_AREA)} of true north here today (World Magnetic Model 2025). {declinationAt(fix ? [fix.lon, fix.lat] : HOME_AREA) < 0 ? 'Add' : 'Subtract'} {Math.abs(declinationAt(fix ? [fix.lon, fix.lat] : HOME_AREA)).toFixed(1)}° to a map (true) bearing to get the compass bearing. USGS topo sheets print the declination of the year they were made, so use this number instead.</p>
      </section>
    </div>
  );
}
