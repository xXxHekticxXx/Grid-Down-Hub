import { Page, PageList, pagesFor } from '../ui';

const NUMS: [string, string, string][] = [
  ['Emergency', '911', 'tel:911'],
  ['Poison Control', '1-800-222-1222', 'tel:18002221222'],
  ['AdventHealth Waterman (Tavares ER)', '352-253-3333', 'tel:3522533333'],
  ['NOAA SAME code line', '888-697-7263', 'tel:8886977263']
];

export default function Comms() {
  return (
    <Page title="Comms & Local" back="#/">
      <div className="result">
        <div style={{ fontWeight: 700, opacity: 0.9 }}>NOAA Weather Radio, Lake County</div>
        <div className="n" style={{ fontSize: '2.4rem' }}>
          162.475 MHz
        </div>
        <div>Station KIH63 (Orlando). Backup: KIH26 at 162.400 MHz. Lake County SAME code 012069.</div>
      </div>
      <div className="card">
        <h2>Key numbers (tap to call)</h2>
        <div className="list">
          {NUMS.map(([l, n, h]) => (
            <a key={l} className="item" href={h}>
              <span>{l}</span>
              <span className="chev" style={{ color: 'var(--ink)', fontWeight: 800 }}>
                {n}
              </span>
            </a>
          ))}
          <a className="item" href="https://www.alertlake.com/" target="_blank" rel="noopener">
            <span>Sign up for AlertLake (do it while the grid is up)</span>
            <span className="chev">›</span>
          </a>
        </div>
        <p className="muted">Phone numbers work only if phones work. Add family, vet, doctor, pharmacy, insurance, county emergency management and your power company in My Plan.</p>
      </div>
      <a className="btn primary" href="#/plan/radio">
        My family radio plan
      </a>
      <PageList items={pagesFor('comms')} />
    </Page>
  );
}
