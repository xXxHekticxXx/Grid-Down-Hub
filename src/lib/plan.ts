import { useEffect, useRef, useState, useCallback } from 'react';
import { idbGet, idbSet, HOME } from './util';

export type Person = { name: string; phone: string; relation: string; where: string };
export type Med = { name: string; dose: string; schedule: string; stored: string; refill: string };
export type Doc = { name: string; where: string; have: boolean };
export type Pin = { id: string; name: string; lat: number; lon: number; kind: string };
export type Plan = {
  people: Person[];
  meetPrimary: string;
  meetSecondary: string;
  outName: string;
  outPhone: string;
  evac: string;
  waterSources: string;
  meds: Med[];
  medNotes: string;
  petName: string;
  petVet: string;
  petVaccines: string;
  petFood: string;
  docs: Doc[];
  radioPrimary: string;
  radioBackup: string;
  radioCheckin: string;
  sameCode: string;
  shelterChecked: string;
  checks: Record<string, boolean>;
  custom: Record<string, string[]>;
  pins: Pin[];
};

export const DEFAULT_DOCS = ['ID (driver license, passport)', 'Insurance (home, vehicle, health)', 'Property papers', 'Vehicle title', 'Bank info'];

export const emptyPlan = (): Plan => ({
  people: [],
  meetPrimary: '',
  meetSecondary: '',
  outName: '',
  outPhone: '',
  evac: '',
  waterSources: '',
  meds: [],
  medNotes: '',
  petName: '',
  petVet: '',
  petVaccines: '',
  petFood: '',
  docs: DEFAULT_DOCS.map((name) => ({ name, where: '', have: false })),
  radioPrimary: '',
  radioBackup: '',
  radioCheckin: '',
  sameCode: '012069',
  shelterChecked: '',
  checks: {},
  custom: {},
  pins: [{ id: 'home', name: 'Home (edit me)', lat: HOME.lat, lon: HOME.lon, kind: 'home' }]
});

export function normalize(p: Partial<Plan> | undefined): Plan {
  return { ...emptyPlan(), ...(p || {}) };
}

const KEY = 'plan';
export async function loadPlan(): Promise<Plan> {
  try {
    return normalize(await idbGet<Plan>(KEY));
  } catch {
    return emptyPlan();
  }
}
export async function savePlan(p: Plan) {
  await idbSet(KEY, p);
}

// React hook: loads once, saves a moment after each change.
export function usePlan() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [err, setErr] = useState('');
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    loadPlan().then(setPlan);
  }, []);
  const update = useCallback((fn: (p: Plan) => Plan) => {
    setPlan((cur) => {
      if (!cur) return cur;
      const next = fn(cur);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        savePlan(next).then(() => setErr(''), () => setErr('Could not save on this device. Check Settings > storage.'));
      }, 300);
      return next;
    });
  }, []);
  const replace = useCallback((p: Plan) => {
    setPlan(p);
    savePlan(p).catch(() => setErr('Could not save on this device.'));
  }, []);
  return { plan, update, replace, err };
}

export const EXPORT_APP = 'grid-down-hub';
export function toExport(p: Plan): string {
  return JSON.stringify({ app: EXPORT_APP, version: 1, exported: new Date().toISOString(), plan: p }, null, 2);
}
export function fromExport(text: string): Plan {
  const o = JSON.parse(text);
  if (o?.app !== EXPORT_APP || !o.plan) throw new Error('This is not a Grid-Down Hub backup file.');
  return normalize(o.plan);
}
