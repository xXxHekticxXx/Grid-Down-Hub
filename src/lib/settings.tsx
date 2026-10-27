import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { get, put } from './db';

export type Theme = 'day' | 'dark' | 'night';
export type Settings = {
  theme: Theme;
  textScale: number; // 1 = 18px base
  tv: boolean; // big layout for the laptop on the 4K TV
  saver: boolean; // battery saver
  metric: boolean;
  topo: boolean; // topo overlay on by default
  layers: string[]; // map layers shown
  coordFormat: 'dd' | 'ddm' | 'usng';
};

const DEFAULTS: Settings = {
  theme: 'day',
  textScale: 1,
  tv: false,
  saver: false,
  metric: false,
  topo: false,
  layers: ['hospital', 'shelter', 'gas', 'spring', 'campground', 'mypins'],
  coordFormat: 'dd',
};

type Ctx = { s: Settings; set: (p: Partial<Settings>) => void };
const C = createContext<Ctx>({ s: DEFAULTS, set: () => undefined });

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<Settings>(() => {
    try {
      return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('gdh-settings') || '{}') };
    } catch {
      return DEFAULTS;
    }
  });
  useEffect(() => {
    get<Settings>('kv', 'settings').then((v) => v && setS((cur) => ({ ...cur, ...v })));
  }, []);
  useEffect(() => {
    const el = document.documentElement;
    el.dataset.theme = s.theme;
    el.dataset.saver = String(s.saver);
    el.dataset.tv = String(s.tv);
    el.style.setProperty('--scale', String(s.textScale * (s.tv ? 1.35 : 1)));
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', s.theme === 'day' ? '#161A17' : '#000000');
  }, [s]);
  const set = (p: Partial<Settings>) =>
    setS((cur) => {
      const n = { ...cur, ...p };
      try {
        localStorage.setItem('gdh-settings', JSON.stringify(n));
      } catch {
        /* storage may be off */
      }
      put('kv', 'settings', n);
      return n;
    });
  return <C.Provider value={{ s, set }}>{children}</C.Provider>;
}

export const useSettings = () => useContext(C);
