import { useState } from 'react';
import { Page, PageList, pagesFor } from '../ui';
import { bleachDose, spoonText } from '../lib/metronome';

const QTY: [string, number][] = [
  ['1 qt', 0.25],
  ['1 gal', 1],
  ['5 gal', 5]
];

export default function Water() {
  const [qty, setQty] = useState<number | 'other'>(5);
  const [custom, setCustom] = useState('2');
  const [strong, setStrong] = useState(true);
  const [cloudy, setCloudy] = useState(false);
  const gal = qty === 'other' ? Math.max(0, parseFloat(custom) || 0) : qty;
  const dose = bleachDose(gal, strong, cloudy);
  const Opt = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) => (
    <button className={'btn' + (on ? ' on' : '')} onClick={onClick} aria-pressed={on}>
      {children}
    </button>
  );
  return (
    <Page title="Water & Food" medical>
      <div className="seg">
        <span className="btn on" style={{ cursor: 'default' }}>
          Bleach
        </span>
        <a className="btn" href="#/p/make-water-safe-boiling-best-method">
          Boil
        </a>
        <a className="btn" href="#/p/how-much-water-to-store">
          Storage
        </a>
      </div>
      <div className="card">
        <h2>1. How much water?</h2>
        <div className="seg">
          {QTY.map(([l, v]) => (
            <Opt key={l} on={qty === v} onClick={() => setQty(v)}>
              {l}
            </Opt>
          ))}
          <Opt on={qty === 'other'} onClick={() => setQty('other')}>
            Other
          </Opt>
        </div>
        {qty === 'other' ? (
          <>
            <label htmlFor="g">Gallons</label>
            <input id="g" inputMode="decimal" value={custom} onChange={(e) => setCustom(e.target.value)} />
          </>
        ) : null}
        <h2 style={{ marginTop: '.9rem' }}>2. Bleach strength on the label</h2>
        <div className="seg">
          <Opt on={strong} onClick={() => setStrong(true)}>
            5 to 9%
          </Opt>
          <Opt on={!strong} onClick={() => setStrong(false)}>
            1%
          </Opt>
        </div>
        <h2 style={{ marginTop: '.9rem' }}>3. Water looks</h2>
        <div className="seg">
          <Opt on={!cloudy} onClick={() => setCloudy(false)}>
            Clear
          </Opt>
          <Opt on={cloudy} onClick={() => setCloudy(true)}>
            Cloudy, colored or cold
          </Opt>
        </div>
      </div>
      <div className="result" aria-live="polite">
        <div style={{ fontWeight: 700, opacity: 0.9 }}>Add this much unscented bleach</div>
        <div className="n">
          {gal > 0 ? dose.drops : 0} drop{dose.drops === 1 ? '' : 's'}
        </div>
        <div>
          {gal > 0 ? `${dose.ml < 10 ? dose.ml.toFixed(2).replace(/0$/, '') : dose.ml.toFixed(1)} mL, ${spoonText(dose.ml, dose.tsp)}` : 'Enter an amount of water'}
        </div>
        <div style={{ fontWeight: 800, marginTop: '.4rem' }}>Stir well, then wait at least 30 minutes.</div>
      </div>
      <div className="notice">
        Cloudy water: filter it first through a clean cloth, paper towel or coffee filter, or let it settle. Use only regular unscented bleach (no scented, color-safe or "with cleaner"). Bleach older than about a year loses strength. Boiling is the most effective method. Neither boiling nor bleach removes chemicals, metals or salt.
      </div>
      <div className="muted">
        Source:{' '}
        <a href="https://cdc.gov/water-emergency/about/" target="_blank" rel="noopener">
          CDC
        </a>
        ,{' '}
        <a href="https://www.epa.gov/ground-water-and-drinking-water/emergency-disinfection-drinking-water" target="_blank" rel="noopener">
          EPA
        </a>
      </div>
      <PageList items={pagesFor('water')} />
    </Page>
  );
}
