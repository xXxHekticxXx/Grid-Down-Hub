// Water disinfection with unscented household bleach. CDC "How to Make Water Safe in an Emergency":
// any 5-9% sodium hypochlorite bleach, 8 drops per gallon, double for cloudy, colored or very cold
// water; 1% bleach 40 drops per gallon. EPA's table allows 6 drops per gallon for 8.25% bleach.
// Stir and wait at least 30 minutes.
import { useState } from 'react';
import { Field } from '../ui/ui';
import { startTimer } from './timerStore';
import { go } from '../lib/router';

type Strength = '5-9' | '8.25-epa' | '1';
type Unit = 'gal' | 'qt' | 'L';

export function bleachDrops(amount: number, unit: Unit, strength: Strength, cloudy: boolean) {
  const gallons = unit === 'gal' ? amount : unit === 'qt' ? amount / 4 : amount / 3.785411784;
  const perGal = strength === '1' ? 40 : strength === '8.25-epa' ? 6 : 8;
  const drops = gallons * perGal * (cloudy ? 2 : 1);
  return Math.max(1, Math.round(drops));
}

export function BleachCalc({ embedded }: { embedded?: boolean }) {
  const [amount, setAmount] = useState('1');
  const [unit, setUnit] = useState<Unit>('gal');
  const [strength, setStrength] = useState<Strength>('5-9');
  const [cloudy, setCloudy] = useState(false);
  const n = Math.max(0, Number(amount) || 0);
  const drops = n > 0 ? bleachDrops(n, unit, strength, cloudy) : 0;
  const ml = drops / 16; // CDC: 8 drops is about 0.5 mL
  const tsp = ml / 4.93;
  return (
    <section className="card" aria-label="Bleach and water calculator" data-testid="bleach">
      <h2 className="card-title">Bleach &amp; water calculator</h2>
      <div className="grid2">
        <Field label="How much water">
          <input type="number" inputMode="decimal" min="0" step="0.5" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="bleach-amount" />
        </Field>
        <Field label="Unit">
          <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)} data-testid="bleach-unit">
            <option value="gal">gallons</option>
            <option value="qt">quarts</option>
            <option value="L">liters</option>
          </select>
        </Field>
        <Field label="Bleach strength (on the label)">
          <select value={strength} onChange={(e) => setStrength(e.target.value as Strength)} data-testid="bleach-strength">
            <option value="5-9">5% to 9% (regular or concentrated, CDC)</option>
            <option value="8.25-epa">8.25% exactly, EPA table (fewer drops)</option>
            <option value="1">1% (some camping and pool products)</option>
          </select>
        </Field>
        <Field label="Water looks">
          <select value={cloudy ? 'cloudy' : 'clear'} onChange={(e) => setCloudy(e.target.value === 'cloudy')} data-testid="bleach-clarity">
            <option value="clear">clear</option>
            <option value="cloudy">cloudy or colored</option>
          </select>
        </Field>
      </div>
      <div className="card card-ok" style={{ marginTop: 10 }} aria-live="polite">
        <div className="big-number" data-testid="bleach-drops">{drops} drops</div>
        <div>
          {drops > 0 && <>≈ {ml.toFixed(ml < 2 ? 1 : 0)} mL{tsp >= 0.2 ? ` · about ${tsp.toFixed(2)} teaspoon` : ''} of unscented bleach. </>}
          <b data-testid="bleach-wait">Stir, then wait at least 30 minutes</b> before drinking.
        </div>
      </div>
      <ol className="prose small" style={{ marginTop: 10 }}>
        <li>Use plain, unscented bleach. Not "splash-less", scented or color-safe bleach.</li>
        <li>Cloudy water: let it settle and pour it through a clean cloth, paper towel or coffee filter first, then use the cloudy dose.</li>
        <li>After 30 minutes it should smell slightly of chlorine. If not, add the same dose again and wait 15 more minutes.</li>
        <li>Bleach does not remove fuel, chemicals or salt. Don't use water that smells of gas or chemicals.</li>
      </ol>
      <div className="btnrow" style={{ marginTop: 8 }}>
        <button className="btn btn-go" onClick={() => { startTimer({ label: `Bleach water (${n} ${unit})`, minutes: 30 }); if (!embedded) go('/tool/timers'); }} data-testid="bleach-timer">Start 30-minute timer</button>
      </div>
      <p className="sources small">Sources: CDC, How to Make Water Safe in an Emergency; EPA, Emergency Disinfection of Drinking Water. Checked 2026-10-27.</p>
    </section>
  );
}
