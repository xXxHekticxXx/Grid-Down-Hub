import { useEffect, useState } from 'react';
import { timers, startTimer, removeTimer, updateTimer, onTimers, remainingMs, fmtDur, type Timer } from './timerStore';
import { alarm } from '../lib/audio';
import { vibrate } from '../lib/native';
import { Field, Btn, Empty } from '../ui/ui';

export const PRESETS: { id: string; label: string; kind: Timer['kind']; minutes: number; note: string }[] = [
  { id: 'tourniquet', label: 'Tourniquet on', kind: 'elapsed', minutes: 0, note: 'Counts up from the moment it went on. Write "TK" and the time on the person (forehead or tag) and tell EMS.' },
  { id: 'swelling', label: 'Snakebite swelling check', kind: 'repeat', minutes: 15, note: 'Mark the edge of the swelling with a pen and the time at each alarm.' },
  { id: 'bleach', label: 'Bleach water wait', kind: 'countdown', minutes: 30, note: 'Safe to drink after 30 minutes if it smells slightly of chlorine.' },
  { id: 'boil', label: 'Boil water', kind: 'countdown', minutes: 1, note: 'Count from a full rolling boil.' },
  { id: 'meds', label: 'Medication every 4 hours', kind: 'repeat', minutes: 240, note: 'Rename it to the medicine and dose. Follow the label or prescription.' },
  { id: 'burn', label: 'Cool a burn', kind: 'countdown', minutes: 10, note: 'Cool running water on a minor burn.' },
  { id: 'heat', label: 'Heat break', kind: 'repeat', minutes: 60, note: 'Shade, water and rest. Check each other for heat illness signs.' },
];

export function useNow(ms = 1000) {
  const [n, setN] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setN(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return n;
}

export function TimersTool({ preset, minutes, label, embedded }: { preset?: string | null; minutes?: number; label?: string; embedded?: boolean }) {
  const [list, setList] = useState<Timer[]>(timers);
  const now = useNow();
  const [custom, setCustom] = useState({ label: '', minutes: '10', kind: 'countdown' as Timer['kind'] });
  useEffect(() => onTimers(() => setList(timers())), []);
  useEffect(() => {
    if (!preset || embedded) return;
    const p = PRESETS.find((x) => x.id === preset);
    if (p && !timers().some((t) => t.label === p.label && t.kind === 'elapsed')) startTimer({ label: p.label, kind: p.kind, minutes: p.minutes, note: p.note });
  }, [preset, embedded]);
  // alarms
  useEffect(() => {
    for (const t of list) {
      if (t.kind === 'countdown') {
        if (remainingMs(t, now) <= 0 && !t.fired) {
          alarm();
          vibrate([400, 200, 400]);
          updateTimer(t.id, { fired: 1 });
        }
      } else if (t.kind === 'repeat') {
        const due = Math.floor((now - t.start) / (t.minutes * 60000));
        if (due > (t.fired ?? 0)) {
          alarm();
          vibrate([400, 200, 400]);
          updateTimer(t.id, { fired: due });
        }
      }
    }
  }, [now, list]);

  if (embedded && minutes) {
    const mine = list.find((t) => t.label === label);
    return (
      <div className="card card-info" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ flex: 1 }}><b>{label}</b> · every {minutes} min</span>
        {mine ? (
          <>
            <span className="big-number" style={{ fontSize: 'calc(var(--fs)*1.6)' }}>{fmtDur(remainingMs(mine, now))}</span>
            <Btn onClick={() => removeTimer(mine.id)} icon="stop">Stop</Btn>
          </>
        ) : (
          <Btn kind="go" icon="timer" onClick={() => startTimer({ label: label ?? 'Timer', minutes, kind: 'repeat' })}>Start {minutes}-minute timer</Btn>
        )}
      </div>
    );
  }

  return (
    <div className="stack">
      {list.length === 0 && <Empty>No timers running.</Empty>}
      {list.map((t) => {
        const r = remainingMs(t, now);
        const due = t.kind === 'countdown' && r <= 0;
        return (
          <section key={t.id} className={`card ${due ? 'card-danger' : t.kind === 'elapsed' ? 'card-warn' : ''}`} data-testid="timer">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
              <input aria-label="Timer name" value={t.label} onChange={(e) => updateTimer(t.id, { label: e.target.value })} style={{ fontWeight: 700, border: 0, padding: 0, minHeight: 36, background: 'transparent' }} />
              <span className="small muted">{t.kind === 'elapsed' ? 'since' : t.kind === 'repeat' ? `every ${t.minutes} min` : `${t.minutes} min`}</span>
            </div>
            <div className="big-number">{t.kind === 'elapsed' ? fmtDur(r) : due ? 'DONE ' + fmtDur(r) : fmtDur(r)}</div>
            <div className="small">Started {new Date(t.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}{t.note ? ` · ${t.note}` : ''}</div>
            <div className="btnrow" style={{ marginTop: 8 }}>
              {t.kind !== 'elapsed' && <Btn onClick={() => updateTimer(t.id, { start: Date.now(), fired: 0 })} icon="timer">Restart</Btn>}
              <Btn kind="danger" onClick={() => removeTimer(t.id)} icon="x">Clear</Btn>
            </div>
          </section>
        );
      })}
      <h2 className="section-title">Start a timer</h2>
      <div className="grid2">
        {PRESETS.map((p) => (
          <button key={p.id} className="btn" onClick={() => startTimer({ label: p.label, kind: p.kind, minutes: p.minutes, note: p.note })}>{p.label}</button>
        ))}
      </div>
      <div className="card">
        <div className="grid2">
          <Field label="Name"><input value={custom.label} onChange={(e) => setCustom({ ...custom, label: e.target.value })} /></Field>
          <Field label="Minutes"><input type="number" min="1" value={custom.minutes} onChange={(e) => setCustom({ ...custom, minutes: e.target.value })} /></Field>
          <Field label="Type">
            <select value={custom.kind} onChange={(e) => setCustom({ ...custom, kind: e.target.value as Timer['kind'] })}>
              <option value="countdown">Count down once</option>
              <option value="repeat">Repeat (medication, checks)</option>
              <option value="elapsed">Count up</option>
            </select>
          </Field>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <Btn full kind="go" icon="plus" onClick={() => startTimer({ label: custom.label || 'Timer', minutes: Number(custom.minutes) || 1, kind: custom.kind })}>Add timer</Btn>
          </div>
        </div>
      </div>
      <p className="small muted">Alarms sound while the app is open. Timers keep counting if you close the app or restart the phone.</p>
    </div>
  );
}
