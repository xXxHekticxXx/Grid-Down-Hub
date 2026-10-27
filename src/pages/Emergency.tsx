import { useEffect } from 'react';
import cards from '../../content/emergency.json';
import { DISCLAIMER } from '../ui';
import { Back } from '../ui';
import { useMetronome } from '../lib/metronome';
import { loadSettings } from '../lib/util';

type Step = { h: string; t: string; m?: boolean; call?: string };
type Card = { id: string; title: string; short: string; metronome?: boolean; source: string; url: string; steps: Step[] };
const CARDS = cards as Card[];

export default function Emergency({ id, step }: { id: string; step: number }) {
  const card = CARDS.find((c) => c.id === id) || CARDS[0];
  const n = card.steps.length;
  const i = Math.min(Math.max(step, 1), n);
  const s = card.steps[i - 1];
  const settings = loadSettings();
  const met = useMetronome(110, settings.sound);
  const showMetro = !!card.metronome && !!s.m;

  useEffect(() => {
    if (!card.metronome) met.stop();
  }, [card.metronome]); // eslint-disable-line

  const go = (k: number) => (location.hash = `#/emergency/${card.id}/${k}`);

  return (
    <div className="wrap">
      <div className="bar">
        <a className="back" href="#/" aria-label="Back to home">
          <Back />
        </a>
        <h1>{card.title}</h1>
        <span className="muted" style={{ fontWeight: 700 }}>
          Step {i} of {n}
        </span>
      </div>
      <div className="chips" role="tablist" aria-label="Other emergencies">
        {CARDS.map((c) => (
          <a key={c.id} className={'chip' + (c.id === card.id ? ' on' : '')} href={`#/emergency/${c.id}/1`}>
            {c.short}
          </a>
        ))}
      </div>
      <div className="steps" aria-hidden="true">
        {card.steps.map((_, k) => (
          <i key={k} className={k < i ? 'on' : ''} />
        ))}
      </div>
      <div className="card" style={{ padding: '1.2rem' }}>
        <div className="tag">{i === 1 ? 'DO THIS FIRST' : `STEP ${i}`}</div>
        <h2 className="big">{s.h}</h2>
        <p className="bigp">{s.t}</p>
        {s.call ? (
          <p>
            <a className="btn red" href={s.call}>
              Call Poison Control
            </a>
          </p>
        ) : null}
        {i === 1 && card.id === 'cpr' ? (
          <p>
            <a className="btn red" href="tel:911">
              Call 911
            </a>
          </p>
        ) : null}
        <div className="muted">
          Source:{' '}
          <a href={card.url} target="_blank" rel="noopener">
            {card.source}
          </a>
        </div>
      </div>
      {showMetro ? (
        <div className="metro">
          <div className={'pulse' + (met.running ? ' beat' : '')} key={met.beat} aria-hidden="true">
            110
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>Metronome</div>
            <div style={{ opacity: 0.85, fontSize: '.85rem' }}>110 beats per minute (range 100 to 120){settings.sound ? '' : ' · sound off in Settings'}</div>
          </div>
          <button className="btn" onClick={met.running ? met.stop : met.start} aria-pressed={met.running}>
            {met.running ? 'Stop' : 'Start'}
          </button>
        </div>
      ) : null}
      <div className="nav2">
        <button className="btn" style={{ flex: 1 }} disabled={i <= 1} onClick={() => go(i - 1)}>
          Back
        </button>
        {i < n ? (
          <button className="btn red" style={{ flex: 2 }} onClick={() => go(i + 1)}>
            Next
          </button>
        ) : (
          <a className="btn primary" style={{ flex: 2 }} href="#/firstaid">
            More first aid
          </a>
        )}
      </div>
      <div className="foot">{DISCLAIMER}</div>
    </div>
  );
}
