import { useState } from 'react';
import { Field } from '../ui/ui';

// FEMA/Ready.gov: at least 1 gallon per person per day, more in heat, for sick people, nursing
// mothers and children. Dogs: plan about 1 ounce of water per pound of body weight per day, more in heat.
export function WaterNeedTool() {
  const [people, setPeople] = useState('1');
  const [days, setDays] = useState('14');
  const [dogLb, setDogLb] = useState('90');
  const [hot, setHot] = useState(true);
  const p = Number(people) || 0;
  const d = Number(days) || 0;
  const perPerson = hot ? 2 : 1;
  const dogGalDay = ((Number(dogLb) || 0) * (hot ? 1.5 : 1)) / 128;
  const total = p * d * perPerson + d * dogGalDay;
  return (
    <section className="card" aria-label="Water needs calculator">
      <h2 className="card-title">How much water to store</h2>
      <div className="grid2">
        <Field label="People"><input type="number" min="0" value={people} onChange={(e) => setPeople(e.target.value)} /></Field>
        <Field label="Days"><input type="number" min="0" value={days} onChange={(e) => setDays(e.target.value)} /></Field>
        <Field label="Dog weight (lb, 0 if none)"><input type="number" min="0" value={dogLb} onChange={(e) => setDogLb(e.target.value)} /></Field>
        <Field label="Weather">
          <select value={hot ? 'hot' : 'mild'} onChange={(e) => setHot(e.target.value === 'hot')}>
            <option value="hot">Florida summer / working hard</option>
            <option value="mild">Mild, resting</option>
          </select>
        </Field>
      </div>
      <div className="card card-ok" style={{ marginTop: 10 }}>
        <div className="big-number">{Math.ceil(total)} gallons</div>
        <div className="small">
          {p} × {d} days × {perPerson} gal/person/day{dogGalDay > 0 ? ` + dog about ${dogGalDay.toFixed(2)} gal/day` : ''}. That is about {Math.ceil(total / 7)} seven-gallon jugs or {Math.ceil(total / 5)} five-gallon jugs.
        </div>
      </div>
      <p className="small muted">Minimum is 1 gallon per person per day for drinking and basic hygiene (FEMA). In heat or hard work, plan on 2 or more. This does not include water for cooking dry foods, washing or flushing.</p>
    </section>
  );
}
