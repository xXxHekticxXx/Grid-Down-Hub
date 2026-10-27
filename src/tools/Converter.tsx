import { useState } from 'react';
import { Field } from '../ui/ui';

type U = { id: string; label: string; to: (v: number) => number; from: (v: number) => number };
const lin = (id: string, label: string, f: number): U => ({ id, label, to: (v) => v * f, from: (v) => v / f });

const GROUPS: Record<string, U[]> = {
  Temperature: [
    { id: 'F', label: '°F', to: (v) => ((v - 32) * 5) / 9, from: (c) => (c * 9) / 5 + 32 },
    { id: 'C', label: '°C', to: (v) => v, from: (v) => v },
  ],
  Distance: [lin('mi', 'miles', 1609.344), lin('km', 'kilometers', 1000), lin('m', 'meters', 1), lin('ft', 'feet', 0.3048), lin('yd', 'yards', 0.9144), lin('nmi', 'nautical miles', 1852), lin('in', 'inches', 0.0254), lin('cm', 'centimeters', 0.01)],
  Volume: [lin('gal', 'US gallons', 3.785411784), lin('qt', 'quarts', 0.946352946), lin('cup', 'cups', 0.2365882365), lin('floz', 'fluid ounces', 0.0295735296), lin('L', 'liters', 1), lin('mL', 'milliliters', 0.001), lin('tsp', 'teaspoons', 0.00492892159), lin('tbsp', 'tablespoons', 0.0147867648)],
  Weight: [lin('lb', 'pounds', 0.45359237), lin('oz', 'ounces', 0.028349523125), lin('kg', 'kilograms', 1), lin('g', 'grams', 0.001)],
  Speed: [lin('mph', 'mph', 0.44704), lin('kmh', 'km/h', 1 / 3.6), lin('kn', 'knots', 0.514444), lin('ms', 'm/s', 1)],
  Area: [lin('acre', 'acres', 4046.8564224), lin('ha', 'hectares', 10000), lin('sqft', 'sq ft', 0.09290304), lin('sqm', 'sq m', 1)],
  Power: [lin('W', 'watts', 1), lin('kW', 'kilowatts', 1000), lin('hp', 'horsepower', 745.699872)],
};

export function ConverterTool() {
  const [group, setGroup] = useState('Temperature');
  const units = GROUPS[group];
  const [from, setFrom] = useState(units[0].id);
  const [val, setVal] = useState('100');
  const u = units.find((x) => x.id === from) ?? units[0];
  const base = u.to(Number(val) || 0);
  return (
    <section className="card" aria-label="Unit converter">
      <div className="btnrow" style={{ marginBottom: 10 }}>
        {Object.keys(GROUPS).map((g) => (
          <button key={g} className={`btn ${g === group ? 'btn-primary' : ''}`} onClick={() => { setGroup(g); setFrom(GROUPS[g][0].id); }}>{g}</button>
        ))}
      </div>
      <div className="grid2">
        <Field label="Value"><input type="number" inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} /></Field>
        <Field label="From">
          <select value={from} onChange={(e) => setFrom(e.target.value)}>
            {units.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </Field>
      </div>
      <table className="prose" style={{ marginTop: 10 }}>
        <tbody>
          {units.filter((x) => x.id !== from).map((x) => (
            <tr key={x.id}><td>{x.label}</td><td><b>{fmt(x.from(base))}</b></td></tr>
          ))}
        </tbody>
      </table>
      {group === 'Power' && <p className="small muted">Watts = volts × amps. A 12 V battery rated 100 Ah holds about 1,200 watt-hours.</p>}
    </section>
  );
}
const fmt = (n: number) => (Math.abs(n) >= 1000 ? n.toLocaleString(undefined, { maximumFractionDigits: 1 }) : Number(n.toPrecision(5)).toString());
