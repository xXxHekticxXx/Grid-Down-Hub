// CPR card with a 110-per-minute metronome (AHA 2025: push 100 to 120 times a minute).
import { useEffect, useRef, useState } from 'react';
import { Metronome } from '../lib/audio';
import { keepAwake, vibrate } from '../lib/native';
import { Icon } from '../ui/icons';
import { href } from '../lib/router';

type Who = 'adult' | 'child' | 'infant';

const STEPS: Record<Who, { title: string; steps: string[] }> = {
  adult: {
    title: 'CPR — Adult',
    steps: [
      'Not responding and not breathing normally (or only gasping)? Shout for help, call 911, send someone for an AED. Start now.',
      'Heel of one hand on the center of the chest (lower half of the breastbone), other hand on top. Arms straight, shoulders over hands.',
      'Push hard and fast: at least 2 inches deep but not more than 2.4 inches, 100 to 120 a minute. Let the chest come all the way back up.',
      'Trained: 30 pushes, then 2 breaths (tilt head, lift chin, pinch nose, 1 second each, watch the chest rise). Not trained or unwilling: keep pushing, no breaths.',
      'Use an AED the moment it arrives. Turn it on and do what it says.',
      'Do not stop (pauses under 10 seconds) until help takes over, the AED tells you to, or the person moves, opens their eyes or breathes normally.',
    ],
  },
  child: {
    title: 'CPR — Child (1 year to puberty)',
    steps: [
      'Not responding and not breathing normally? Shout for help. Alone with no phone: do 2 minutes of CPR first, then call 911.',
      'One or two hands on the lower half of the breastbone.',
      'Push about 2 inches deep (one-third of the chest), 100 to 120 a minute. Let the chest come back up.',
      '30 pushes then 2 breaths if you are alone. Two trained rescuers: 15 pushes, 2 breaths.',
      'Use an AED as soon as you have one (child pads if it has them).',
    ],
  },
  infant: {
    title: 'CPR — Infant (under 1 year)',
    steps: [
      'Not responding and not breathing normally? Shout for help. Alone with no phone: do 2 minutes of CPR first, then call 911.',
      'Heel of one hand on the center of the chest just below the nipple line, or both thumbs with hands wrapped around the chest. (The old two-finger method is no longer recommended.)',
      'Push about 1½ inches deep (one-third of the chest), 100 to 120 a minute.',
      '30 pushes, then 2 gentle puffs that cover the mouth and nose, each just enough to make the chest rise. Two trained rescuers: 15 to 2.',
    ],
  },
};

export function CprCard({ initial = 'adult' }: { initial?: Who }) {
  const [who, setWho] = useState<Who>(initial);
  const [running, setRunning] = useState(false);
  const [count, setCount] = useState(0);
  const [pulse, setPulse] = useState(false);
  const [breaths, setBreaths] = useState(true);
  const [measured, setMeasured] = useState(0);
  const m = useRef<Metronome | null>(null);
  const started = useRef(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => () => {
    m.current?.stop();
    void keepAwake(false);
  }, []);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started.current) / 1000)), 500);
    return () => clearInterval(t);
  }, [running]);

  const toggle = () => {
    if (running) {
      m.current?.stop();
      setRunning(false);
      void keepAwake(false);
      return;
    }
    started.current = Date.now();
    setElapsed(0);
    setCount(0);
    const met = new Metronome(110, (n) => {
      setCount(n);
      setPulse(true);
      setTimeout(() => setPulse(false), 120);
      if (n % 30 === 0) vibrate(300);
      setMeasured(met.measured());
    });
    (window as unknown as { __cprMetronome?: Metronome }).__cprMetronome = met; // exposed for the automated rate test
    m.current = met;
    met.start();
    setRunning(true);
    void keepAwake(true);
  };

  const inCycle = count === 0 ? 0 : ((count - 1) % 30) + 1;
  const s = STEPS[who];
  return (
    <section className="card cpr" aria-labelledby="cpr-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <h2 id="cpr-title" style={{ fontSize: 'calc(var(--fs)*1.9)' }}>{s.title}</h2>
        <span className="small muted">AHA 2025</span>
      </div>
      <ol className="prose" style={{ fontSize: 'calc(var(--fs)*.98)' }}>
        {s.steps.map((t, i) => <li key={i}>{t}</li>)}
      </ol>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
        <button className={`cpr-start ${running ? 'running' : ''}`} onClick={toggle} aria-pressed={running} data-testid="cpr-start">
          <Icon name={running ? 'stop' : 'play'} size={28} /> {running ? 'STOP' : 'START BEAT · 110'}
        </button>
        <div className={`beat ${pulse ? 'pulse' : ''}`} aria-live="off">
          <b data-testid="cpr-count">{breaths ? inCycle : count}</b>
          <span className="small">{breaths ? 'of 30' : 'pushes'}</span>
        </div>
      </div>
      {running && (
        <p className="small" style={{ marginTop: 8 }} data-testid="cpr-rate">
          {breaths && inCycle === 30 ? <b>Give 2 breaths now. </b> : null}
          Time {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')} · total pushes {count}
          {measured ? ` · beat ${measured.toFixed(1)}/min` : ''}
          {elapsed >= 120 && Math.floor(elapsed / 120) !== Math.floor((elapsed - 1) / 120) ? ' · Switch rescuers if you can.' : ''}
        </p>
      )}
      <label className="toggle" style={{ borderBottom: 0 }}>
        <span><span className="toggle-label">Count 30, then breaths</span><span className="toggle-sub">Off = hands-only CPR (keeps counting)</span></span>
        <input type="checkbox" checked={breaths} onChange={(e) => setBreaths(e.target.checked)} />
      </label>
      <div className="grid3" style={{ marginTop: 6 }}>
        {(['adult', 'child', 'infant'] as Who[]).map((w) => (
          <button key={w} className={`btn ${who === w ? 'btn-primary' : ''}`} onClick={() => setWho(w)} aria-pressed={who === w}>
            {w[0].toUpperCase() + w.slice(1)}
          </button>
        ))}
      </div>
      <div className="btnrow" style={{ marginTop: 8 }}>
        <a className="btn" href={href('/a/cpr')}>Full CPR page</a>
        <a className="btn" href={href('/a/dog-first-aid')}>Dog</a>
      </div>
    </section>
  );
}
