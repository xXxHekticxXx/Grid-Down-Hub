import { useEffect, useState } from 'react';
import { Screen, Toggle, Btn, Row, SectionTitle, Card, Field, toast } from '../ui/ui';
import { useSettings, type Theme } from '../lib/settings';
import { content, type Content } from '../lib/content';
import { BackupSheet } from './Plan';
import { get, put } from '../lib/db';
import { DEFAULT_REMOTE } from '../lib/packs';

declare const __BUILD_DATE__: string;

export default function Settings() {
  const { s, set } = useSettings();
  const [c, setC] = useState<Content | null>(null);
  const [backup, setBackup] = useState(false);
  const [base, setBase] = useState('');
  useEffect(() => {
    content().then(setC);
    get<string>('kv', 'dataBase').then((v) => setBase(v ?? ''));
  }, []);
  const themes: [Theme, string][] = [['day', 'Day'], ['dark', 'Dark'], ['night', 'Night red']];
  return (
    <Screen title="Settings">
      <SectionTitle>Display</SectionTitle>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', minHeight: 60 }}>
          <b>Theme</b>
          <div className="seg">{themes.map(([id, l]) => <button key={id} aria-pressed={s.theme === id} onClick={() => set({ theme: id })} data-testid={`theme-${id}`}>{l}</button>)}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, minHeight: 60 }}>
          <b>Text size {Math.round(s.textScale * 100)}%</b>
          <div className="btnrow" style={{ flex: '0 0 auto' }}>
            <button className="btn" aria-label="Smaller text" onClick={() => set({ textScale: Math.max(0.8, +(s.textScale - 0.1).toFixed(2)) })}>A−</button>
            <button className="btn" aria-label="Larger text" onClick={() => set({ textScale: Math.min(1.8, +(s.textScale + 0.1).toFixed(2)) })}>A+</button>
          </div>
        </div>
        <Toggle label="TV mode" sub="Bigger everything, for the laptop on the 4K TV across the room" checked={s.tv} onChange={(v) => set({ tv: v })} />
        <Toggle label="Battery saver" sub="Black screen, no animations, lighter map, GPS only while the map is open" checked={s.saver} onChange={(v) => set({ saver: v })} />
        <Toggle label="Metric units" checked={s.metric} onChange={(v) => set({ metric: v })} />
      </Card>
      <SectionTitle>Offline data</SectionTitle>
      <div className="list">
        <Row to="/setup" title="Maps and Library downloads" sub="Install, check SHA-256, remove, or install from a file" />
        <Row to="/maps" title="Maps you added" sub="Imported map packs, GPX/KML, paper map photos, tracks" />
      </div>
      <SectionTitle>Your data</SectionTitle>
      <div className="list">
        <Row onClick={() => setBackup(true)} title="Export / import (encrypted)" sub="Move everything you made to another device" />
        <Row to="/plan" title="My Plan" sub="Contacts, meds, dog, evacuation, radio" />
      </div>
      <SectionTitle>Reminders</SectionTitle>
      <Card tone="warn">
        <p style={{ margin: 0 }}>Sign up for <b>AlertLake</b> at <a href="https://alertlake.com" target="_blank" rel="noreferrer">alertlake.com</a> while you have signal. It's how Lake County announces evacuations and which shelters are open.</p>
      </Card>
      {c && (
        <>
          <SectionTitle>Local numbers</SectionTitle>
          <div className="list">
            {c.local.numbers.map((n) => <Row key={n.label} title={n.label} sub={n.note} right={<a className="btn" href={`tel:${n.phone}`}>{n.phone}</a>} />)}
          </div>
        </>
      )}
      <SectionTitle>Advanced</SectionTitle>
      <Card>
        <Field label="Download data from" hint={`Default: ${DEFAULT_REMOTE}. Change only if you host the data packs yourself (for example on the Raspberry Pi).`}>
          <input value={base} onChange={(e) => setBase(e.target.value)} />
        </Field>
        <div className="btnrow" style={{ marginTop: 8 }}>
          <Btn onClick={async () => { await put('kv', 'dataBase', base.trim()); toast('Saved'); }}>Save</Btn>
          <Btn onClick={async () => { await put('kv', 'dataBase', ''); setBase(''); toast('Back to default'); }}>Use default</Btn>
        </div>
      </Card>
      <SectionTitle>About</SectionTitle>
      <p className="small muted">Grid-Down Hub, app version {__BUILD_DATE__}. Content checked {c?.local.checked}. Maps © OpenStreetMap contributors (ODbL), tiles © OpenMapTiles; USGS US Topo, ATP 3-50.21, ATP 4-02.11 and FEMA P-2064 are U.S. government works. Not a substitute for training. If phones work, call 911 first.</p>
      <BackupSheet open={backup} onClose={() => setBackup(false)} />
    </Screen>
  );
}
