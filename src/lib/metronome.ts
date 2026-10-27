import { useCallback, useEffect, useRef, useState } from 'react';

// CPR metronome. Beeps are scheduled on the audio clock so timing stays steady.
export function useMetronome(bpm: number, sound: boolean) {
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(0);
  const r = useRef<{ ctx?: AudioContext; next: number; timer?: number; lock?: WakeLockSentinel | null }>({ next: 0 });
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const stop = useCallback(() => {
    window.clearInterval(r.current.timer);
    r.current.timer = undefined;
    r.current.lock?.release().catch(() => {});
    r.current.lock = null;
    setRunning(false);
  }, []);

  const start = useCallback(() => {
    const s = r.current;
    if (s.timer) return;
    if (!s.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      s.ctx = new AC();
    }
    const ctx = s.ctx;
    ctx.resume().catch(() => {});
    s.next = ctx.currentTime + 0.05;
    const iv = 60 / bpm;
    const tick = () => {
      while (s.next < ctx.currentTime + 0.15) {
        const t = s.next;
        if (soundRef.current) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.frequency.value = 880;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.7, t + 0.005);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
          o.connect(g).connect(ctx.destination);
          o.start(t);
          o.stop(t + 0.08);
        }
        window.setTimeout(() => setBeat((b) => b + 1), Math.max(0, (t - ctx.currentTime) * 1000));
        s.next += iv;
      }
    };
    tick();
    s.timer = window.setInterval(tick, 25);
    setRunning(true);
    navigator.wakeLock?.request('screen').then((l) => (s.lock = l)).catch(() => {});
  }, [bpm]);

  useEffect(() => stop, [stop]);
  return { running, beat, start, stop };
}

// Bleach dose from CDC numbers: drops = gallons x 8 (5-9% bleach) or x 40 (1%), doubled if cloudy.
export function bleachDose(gallons: number, strong: boolean, cloudy: boolean) {
  const drops = Math.ceil(gallons * (strong ? 8 : 40) * (cloudy ? 2 : 1) - 1e-9);
  const ml = drops * 0.0625;
  return { drops, ml, tsp: ml / 4.929 };
}
export function spoonText(ml: number, tsp: number) {
  if (ml < 0.6) return 'too small for a measuring spoon: count drops with a dropper';
  if (tsp < 0.9) return `about ${Math.round(tsp * 8)}/8 teaspoon`;
  const q = Math.round(tsp * 4) / 4;
  return `about ${q} teaspoon${q === 1 ? '' : 's'}`;
}
