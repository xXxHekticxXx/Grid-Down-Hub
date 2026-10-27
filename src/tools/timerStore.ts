// Timers are saved on the device, so a tourniquet or medication timer survives closing the app or a restart.
export type Timer = {
  id: string;
  label: string;
  kind: 'countdown' | 'elapsed' | 'repeat';
  start: number; // ms epoch
  minutes: number; // countdown length or repeat interval
  note?: string;
  fired?: number; // how many times it has alarmed
};
const KEY = 'gdh-timers';
type L = () => void;
const ls = new Set<L>();

export function timers(): Timer[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return mem;
  }
}
let mem: Timer[] = [];
function save(t: Timer[]) {
  mem = t;
  try {
    localStorage.setItem(KEY, JSON.stringify(t));
  } catch {
    /* storage blocked; keep in memory */
  }
  ls.forEach((f) => f());
}
export const onTimers = (f: L) => {
  ls.add(f);
  return () => {
    ls.delete(f);
  };
};
export function startTimer(t: Partial<Timer> & { label: string; minutes: number }) {
  const n: Timer = { id: Math.random().toString(36).slice(2), kind: 'countdown', start: Date.now(), fired: 0, ...t };
  save([...timers(), n]);
  return n;
}
export function updateTimer(id: string, p: Partial<Timer>) {
  save(timers().map((t) => (t.id === id ? { ...t, ...p } : t)));
}
export function removeTimer(id: string) {
  save(timers().filter((t) => t.id !== id));
}

export function remainingMs(t: Timer, now = Date.now()) {
  if (t.kind === 'elapsed') return now - t.start;
  if (t.kind === 'repeat') {
    const per = t.minutes * 60000;
    const since = now - t.start;
    return per - (since % per);
  }
  return t.start + t.minutes * 60000 - now;
}

export function fmtDur(ms: number) {
  const neg = ms < 0;
  let s = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  return `${neg ? '+' : ''}${h ? h + ':' : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(s).padStart(2, '0')}`;
}
