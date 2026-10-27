import { useEffect, useState } from 'react';
import { content, type LocalData } from '../lib/content';
import { href } from '../lib/router';

// FRS/GMRS channel plan (FCC 47 CFR Part 95). FRS: no license. GMRS: FCC license, no exam.
const FRS = [
  ...[1, 2, 3, 4, 5, 6, 7].map((n) => ({ ch: n, mhz: (462.5625 + (n - 1) * 0.025).toFixed(4), frs: '2 W', gmrs: '5 W' })),
  ...[8, 9, 10, 11, 12, 13, 14].map((n) => ({ ch: n, mhz: (467.5625 + (n - 8) * 0.025).toFixed(4), frs: '0.5 W', gmrs: '0.5 W' })),
  ...[15, 16, 17, 18, 19, 20, 21, 22].map((n) => ({ ch: n, mhz: (462.55 + (n - 15) * 0.025).toFixed(4), frs: '2 W', gmrs: '50 W' })),
];

export function RadioTool() {
  const [local, setLocal] = useState<LocalData | null>(null);
  useEffect(() => {
    content().then((c) => setLocal(c.local));
  }, []);
  return (
    <div className="stack">
      <section className="card">
        <h2 className="card-title">NOAA Weather Radio · Lake County</h2>
        {local && (
          <>
            <p>SAME code for Lake County: <b className="mono">{local.noaa.same}</b> (program it so the radio only alarms for this county).</p>
            <table className="prose">
              <thead><tr><th>Station</th><th>Frequency</th><th>Use</th></tr></thead>
              <tbody>
                {local.noaa.stations.map((s) => (
                  <tr key={s.call}><td><b>{s.call}</b> {s.city}</td><td><b>{s.mhz} MHz</b> (WX{s.channel})</td><td>{s.role}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="small muted">Source: {local.noaa.source.title}, checked {local.noaa.source.checked}.</p>
          </>
        )}
        <p><a href={href('/a/noaa-weather-radio')}>How to set up a NOAA radio</a></p>
      </section>
      <section className="card">
        <h2 className="card-title">Common calling and emergency channels</h2>
        <table className="prose">
          <tbody>
            <tr><td>FRS/GMRS</td><td>Pick one channel for your group ahead of time and write it in My Plan. GMRS channel 20 (462.675 MHz) is traditionally used for emergency and traveler help.</td></tr>
            <tr><td>CB radio</td><td>Channel 9 is reserved for emergencies and traveler help. Channel 19 is used by truckers for road conditions.</td></tr>
            <tr><td>Ham 2 m</td><td>146.520 MHz national simplex calling frequency. Anyone can listen; transmitting needs an amateur license.</td></tr>
            <tr><td>Ham 70 cm</td><td>446.000 MHz national simplex calling frequency.</td></tr>
            <tr><td>Marine VHF</td><td>Channel 16 (156.800 MHz) distress and calling, on the water.</td></tr>
          </tbody>
        </table>
        <p><a href={href('/a/frs-gmrs')}>FRS vs GMRS rules</a> · <a href={href('/a/ham-radio-intro')}>Intro to ham radio</a></p>
      </section>
      <section className="card">
        <h2 className="card-title">FRS / GMRS channels</h2>
        <table className="prose small">
          <thead><tr><th>Ch</th><th>MHz</th><th>FRS max</th><th>GMRS max</th></tr></thead>
          <tbody>{FRS.map((r) => <tr key={r.ch}><td>{r.ch}</td><td className="mono">{r.mhz}</td><td>{r.frs}</td><td>{r.gmrs}</td></tr>)}</tbody>
        </table>
        <p className="small muted">GMRS repeater channels (15R–22R) transmit on 467.xxx MHz and need a GMRS license. Bubble-pack radios sold as "22 channel" are FRS.</p>
      </section>
    </div>
  );
}
