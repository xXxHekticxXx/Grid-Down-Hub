import { useEffect, useState } from 'react';
import { get, put } from '../lib/db';
import { Field } from '../ui/ui';
import { href } from '../lib/router';

export type Fuel = { tank: string; cans: string; mpg: string; reserve: string };
export const DEFAULT_FUEL: Fuel = { tank: '', cans: '', mpg: '', reserve: '20' };

export function fuelMiles(f: Fuel) {
  const gal = (Number(f.tank) || 0) + (Number(f.cans) || 0);
  const mpg = Number(f.mpg) || 0;
  const reserve = Math.min(90, Math.max(0, Number(f.reserve) || 0)) / 100;
  return { gal, total: gal * mpg, usable: gal * mpg * (1 - reserve) };
}

export function FuelRangeTool() {
  const [f, setF] = useState<Fuel>(DEFAULT_FUEL);
  useEffect(() => {
    get<Fuel>('kv', 'fuel').then((v) => v && setF({ ...DEFAULT_FUEL, ...v }));
  }, []);
  const upd = (p: Partial<Fuel>) => {
    const n = { ...f, ...p };
    setF(n);
    void put('kv', 'fuel', n);
  };
  const r = fuelMiles(f);
  return (
    <section className="card" aria-label="Fuel range">
      <h2 className="card-title">Fuel range</h2>
      <div className="grid2">
        <Field label="Gas in the tank (gal)"><input type="number" min="0" step="0.5" value={f.tank} onChange={(e) => upd({ tank: e.target.value })} /></Field>
        <Field label="Gas in cans (gal)"><input type="number" min="0" step="0.5" value={f.cans} onChange={(e) => upd({ cans: e.target.value })} /></Field>
        <Field label="Miles per gallon (loaded)"><input type="number" min="0" step="0.5" value={f.mpg} onChange={(e) => upd({ mpg: e.target.value })} /></Field>
        <Field label="Keep in reserve (%)" hint="Detours, idling, back roads"><input type="number" min="0" max="90" value={f.reserve} onChange={(e) => upd({ reserve: e.target.value })} /></Field>
      </div>
      <div className="card card-ok" style={{ marginTop: 10 }}>
        <div className="big-number">{Math.round(r.usable)} miles</div>
        <div className="small">usable range ({Math.round(r.total)} miles on {r.gal} gallons, minus {f.reserve || 0}% reserve). Road miles are longer than straight-line miles, often by a third or more on back roads.</div>
      </div>
      <p className="small"><a href={href('/map?fuel=1')}>Show the range ring on the map</a></p>
    </section>
  );
}
