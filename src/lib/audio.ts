// Sound for the CPR metronome, timers and the distress whistle. Everything is synthesized, no files.
let ctx: AudioContext | null = null;
export function audio() {
  if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function click(at: number, accent: boolean, gain = 0.9) {
  const a = audio();
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = 'square';
  o.frequency.value = accent ? 1760 : 1175;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
  o.connect(g).connect(a.destination);
  o.start(at);
  o.stop(at + 0.08);
}

/**
 * Sample-accurate metronome. Beats are scheduled on the audio clock ahead of time
 * (not with setInterval), so the rate stays exact even when the phone is busy.
 */
export class Metronome {
  bpm: number;
  count = 0;
  private next = 0;
  private timer: number | null = null;
  private onBeat: (n: number, audioTime: number) => void;
  private accentEvery: number;
  beats: number[] = []; // audio-clock times of scheduled beats (for measuring the rate)
  constructor(bpm: number, onBeat: (n: number, t: number) => void, accentEvery = 30) {
    this.bpm = bpm;
    this.onBeat = onBeat;
    this.accentEvery = accentEvery;
  }
  start() {
    const a = audio();
    this.count = 0;
    this.beats = [];
    this.next = a.currentTime + 0.1;
    const tick = () => {
      const now = audio().currentTime;
      while (this.next < now + 0.25) {
        this.count++;
        const t = this.next;
        click(t, this.count % this.accentEvery === 0);
        this.beats.push(t);
        if (this.beats.length > 400) this.beats.shift();
        const n = this.count;
        const delay = Math.max(0, (t - now) * 1000);
        window.setTimeout(() => this.onBeat(n, t), delay);
        this.next += 60 / this.bpm;
      }
    };
    tick();
    this.timer = window.setInterval(tick, 50);
  }
  stop() {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = null;
  }
  /** Measured beats per minute over the scheduled beats. */
  measured() {
    const b = this.beats;
    if (b.length < 3) return 0;
    return (60 * (b.length - 1)) / (b[b.length - 1] - b[0]);
  }
}

export function beep(freq = 880, dur = 0.25, gain = 0.8) {
  const a = audio();
  const o = a.createOscillator();
  const g = a.createGain();
  o.frequency.value = freq;
  const t = a.currentTime;
  g.gain.setValueAtTime(gain, t);
  g.gain.setValueAtTime(gain, t + dur - 0.02);
  g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur);
}

/** Alarm pattern for timers: three pairs of tones. */
export function alarm() {
  const a = audio();
  for (let i = 0; i < 6; i++) {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'triangle';
    o.frequency.value = i % 2 ? 988 : 1319;
    const t = a.currentTime + i * 0.28;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + 0.26);
  }
}

/** Loud whistle: a pea-whistle-like warble around 3.2 kHz. Three blasts is the distress signal. */
export function whistleBlast(at: number, dur: number) {
  const a = audio();
  const o = a.createOscillator();
  const lfo = a.createOscillator();
  const lfoGain = a.createGain();
  const g = a.createGain();
  o.type = 'sine';
  o.frequency.value = 3200;
  lfo.frequency.value = 28;
  lfoGain.gain.value = 140;
  lfo.connect(lfoGain).connect(o.frequency);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(1, at + 0.03);
  g.gain.setValueAtTime(1, at + dur - 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(a.destination);
  o.start(at);
  lfo.start(at);
  o.stop(at + dur + 0.02);
  lfo.stop(at + dur + 0.02);
}

/** Morse SOS timing (units of 0.2 s): ... --- ... */
export const SOS_PATTERN: [boolean, number][] = (() => {
  const u = 0.2;
  const p: [boolean, number][] = [];
  const sym = (on: number) => {
    p.push([true, on * u]);
    p.push([false, u]);
  };
  [1, 1, 1].forEach(sym);
  p[p.length - 1] = [false, 3 * u];
  [3, 3, 3].forEach(sym);
  p[p.length - 1] = [false, 3 * u];
  [1, 1, 1].forEach(sym);
  p[p.length - 1] = [false, 7 * u];
  return p;
})();
