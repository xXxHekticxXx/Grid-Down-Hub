import { useEffect, useRef, useState } from 'react';
import { Screen, Row, Btn, Field, Card, Sheet, toast, Empty, SectionTitle } from '../ui/ui';
import { get, put, all, subscribe } from '../lib/db';
import { exportAll, importAll } from '../lib/backup';
import { saveFile } from '../lib/native';
import { planPdf, type PlanPrint } from '../lib/pdfmake';
import { go, href } from '../lib/router';
import { Icon } from '../ui/icons';
import type { Pin } from '../types';
import { startTimer } from '../tools/timerStore';

type FieldDef = { key: string; label: string; type?: 'text' | 'tel' | 'date' | 'textarea' | 'number'; hint?: string };
type ListDef = { id: string; title: string; sub: string; icon: string; kind: 'list' | 'form'; fields: FieldDef[]; itemTitle?: (v: Record<string, string>) => string };

export const PLAN_SECTIONS: ListDef[] = [
  { id: 'contacts', title: 'Contacts', sub: 'Family, neighbors, out-of-state contact, vet, doctor', icon: 'phone', kind: 'list', itemTitle: (v) => v.name || 'Contact',
    fields: [{ key: 'name', label: 'Name' }, { key: 'relation', label: 'Who they are' }, { key: 'phone', label: 'Phone', type: 'tel' }, { key: 'phone2', label: 'Other phone or radio call sign' }, { key: 'address', label: 'Address' }, { key: 'note', label: 'Notes', type: 'textarea' }] },
  { id: 'meeting', title: 'Meeting points', sub: 'Where to meet if you get separated', icon: 'pin', kind: 'list', itemTitle: (v) => v.name || 'Meeting point',
    fields: [{ key: 'name', label: 'Name' }, { key: 'when', label: 'When to use it', hint: 'e.g. if the house is gone, if we can’t reach each other for 24 h' }, { key: 'where', label: 'Where (address, landmark or coordinates)' }, { key: 'note', label: 'Notes', type: 'textarea' }] },
  { id: 'meds', title: 'Medications', sub: 'Name, dose, schedule, refills, storage', icon: 'medkit', kind: 'list', itemTitle: (v) => [v.name, v.dose].filter(Boolean).join(' ') || 'Medication',
    fields: [{ key: 'name', label: 'Medication' }, { key: 'for', label: 'For whom' }, { key: 'dose', label: 'Dose' }, { key: 'every', label: 'Every how many hours', type: 'number' }, { key: 'supply', label: 'Days of supply on hand', type: 'number' }, { key: 'storage', label: 'Storage needs', hint: 'e.g. keep cool, refrigerate' }, { key: 'rx', label: 'Pharmacy / Rx number' }, { key: 'note', label: 'Notes', type: 'textarea' }] },
  { id: 'medical', title: 'Medical notes', sub: 'Allergies, conditions, blood type, doctor', icon: 'heart', kind: 'form',
    fields: [{ key: 'allergies', label: 'Allergies', type: 'textarea' }, { key: 'conditions', label: 'Conditions', type: 'textarea' }, { key: 'blood', label: 'Blood type' }, { key: 'doctor', label: 'Doctor and phone' }, { key: 'insurance', label: 'Insurance' }, { key: 'note', label: 'Anything a medic should know', type: 'textarea' }] },
  { id: 'dog', title: 'Dog', sub: 'Vet, vaccines, food, meds, ID', icon: 'dog', kind: 'form',
    fields: [{ key: 'name', label: 'Name' }, { key: 'breed', label: 'Breed and color' }, { key: 'weight', label: 'Weight (lb)', type: 'number' }, { key: 'chip', label: 'Microchip number' }, { key: 'rabies', label: 'Rabies tag and date', hint: 'Pet-friendly shelters require proof of rabies and current vaccines' }, { key: 'vaccines', label: 'Other vaccines and dates' }, { key: 'vet', label: 'Vet and phone' }, { key: 'food', label: 'Food and amount per day' }, { key: 'meds', label: 'Meds, flea/tick/heartworm' }, { key: 'note', label: 'Notes', type: 'textarea' }] },
  { id: 'evac', title: 'Evacuation plan', sub: 'When to leave, where to go, how', icon: 'truck', kind: 'form',
    fields: [{ key: 'triggers', label: 'We leave when…', type: 'textarea', hint: 'e.g. any hurricane watch for Lake County (camper), fire within 5 miles, no water for 3 days' }, { key: 'dest1', label: 'First destination' }, { key: 'dest2', label: 'Backup destination' }, { key: 'routes', label: 'Routes (main and back roads)', type: 'textarea' }, { key: 'shelter', label: 'Nearest pet-friendly shelter' }, { key: 'leave', label: 'Leave a note saying where we went at…' }, { key: 'note', label: 'Notes', type: 'textarea' }] },
  { id: 'radio', title: 'Radio plan', sub: 'Channels, check-in times, call signs', icon: 'radio', kind: 'form',
    fields: [{ key: 'primary', label: 'Primary channel', hint: 'e.g. GMRS 18, privacy code off' }, { key: 'backup', label: 'Backup channel' }, { key: 'checkin', label: 'Check-in times', hint: 'e.g. top of the hour, 7 am and 7 pm' }, { key: 'calls', label: 'Call signs / names on the air' }, { key: 'noaa', label: 'NOAA radio', hint: 'KIH63 162.475 MHz, SAME 012069' }, { key: 'note', label: 'Notes', type: 'textarea' }] },
];

export default function Plan({ section }: { section?: string }) {
  if (section) return <PlanSection id={section} />;
  return <PlanHome />;
}

function PlanHome() {
  const [backupOpen, setBackupOpen] = useState(false);
  const [pins, setPins] = useState<Pin[]>([]);
  useEffect(() => {
    all<Pin>('pins').then(setPins);
  }, []);
  return (
    <Screen title="My Plan" badge={<span className="badge"><Icon name="lock" size={14} /> This device only</span>}>
      <div className="list">
        {PLAN_SECTIONS.map((s) => <Row key={s.id} to={`/plan/${s.id}`} title={s.title} sub={s.sub} />)}
        <Row to="/checklist/documents" title="Documents checklist" sub="IDs, insurance, titles, deeds, copies" />
        <Row to="/map" title="Meeting points & pins on the map" sub={`${pins.length} pin${pins.length === 1 ? '' : 's'} saved`} />
        <Row to="/stay" title="Stay plan" sub="Holding at home" />
        <Row to="/go" title="Go plan" sub="Leaving: route, fuel, load list" />
      </div>
      <div className="stack" style={{ marginTop: 16 }}>
        <div className="grid2">
          <Btn kind="primary" icon="lock" onClick={() => setBackupOpen(true)}>Export / import</Btn>
          <Btn icon="print" onClick={async () => toast(await saveFile('my-plan.pdf', planPdf(await planPrint())))}>Print plan (PDF)</Btn>
        </div>
        <p className="small muted">Your plan is stored only on this device. It never goes to the internet or into the app's code. To move it to another device, export it as one file locked with a passphrase, then import that file there.</p>
      </div>
      <BackupSheet open={backupOpen} onClose={() => setBackupOpen(false)} />
    </Screen>
  );
}

export async function planPrint(): Promise<PlanPrint> {
  const sections: PlanPrint['sections'] = [];
  for (const s of PLAN_SECTIONS) {
    const v = await get<Record<string, string> | Record<string, string>[]>('plan', s.id);
    const lines: string[] = [];
    const fmt = (o: Record<string, string>) => s.fields.filter((f) => o[f.key]).map((f) => `${f.label}: ${o[f.key]}`).join(' · ');
    if (Array.isArray(v)) v.forEach((o) => lines.push('• ' + fmt(o)));
    else if (v) lines.push(...s.fields.filter((f) => v[f.key]).map((f) => `${f.label}: ${v[f.key]}`));
    sections.push({ title: s.title, lines });
  }
  const pins = await all<Pin>('pins');
  sections.push({ title: 'Pins', lines: pins.map((p) => `• ${p.name} (${p.kind}) ${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}${p.note ? ' · ' + p.note : ''}`) });
  return { title: 'My Plan', sections };
}

function PlanSection({ id }: { id: string }) {
  const def = PLAN_SECTIONS.find((s) => s.id === id);
  const [val, setVal] = useState<Record<string, string> | Record<string, string>[] | undefined>();
  const [edit, setEdit] = useState<{ i: number; v: Record<string, string> } | null>(null);
  useEffect(() => {
    setVal(undefined); // a new section: never show the previous section's values
    const load = () => get<typeof val>('plan', id).then((v) => setVal(v ?? (def?.kind === 'list' ? [] : {})));
    load();
    return subscribe('plan', load);
  }, [id, def?.kind]);
  if (!def) return <Screen title="Not found">{null}</Screen>;
  if (val === undefined) return <Screen title={def.title}>{null}</Screen>;
  if (def.kind === 'form') {
    const v = (Array.isArray(val) ? {} : val) as Record<string, string>;
    return (
      <Screen title={def.title} crumb="My Plan">
        <form className="stack" onSubmit={async (e) => { e.preventDefault(); await put('plan', id, v); toast('Saved on this device'); }}>
          {def.fields.map((f) => (
            <Field key={f.key} label={f.label} hint={f.hint}>
              {f.type === 'textarea' ? <textarea value={v[f.key] ?? ''} onChange={(e) => setVal({ ...v, [f.key]: e.target.value })} /> : <input type={f.type ?? 'text'} value={v[f.key] ?? ''} onChange={(e) => setVal({ ...v, [f.key]: e.target.value })} />}
            </Field>
          ))}
          <Btn type="submit" kind="go" icon="check">Save</Btn>
          {id === 'evac' && <p className="small"><a href={href('/go')}>Go plan</a> · <a href={href('/a/hurricane-before')}>Hurricanes: camper = evacuate</a></p>}
          {id === 'medical' && <p className="small muted">Shown from the EMERGENCY screen under "My medical info".</p>}
        </form>
      </Screen>
    );
  }
  const list = Array.isArray(val) ? val : [];
  const saveList = async (n: Record<string, string>[]) => {
    await put('plan', id, n);
  };
  return (
    <Screen title={def.title} crumb="My Plan" actions={<Btn kind="go" icon="plus" onClick={() => setEdit({ i: -1, v: {} })}>Add</Btn>}>
      {list.length === 0 && <Empty>Nothing yet. Tap Add.</Empty>}
      <div className="list">
        {list.map((o, i) => (
          <Row key={i} onClick={() => setEdit({ i, v: o })} title={def.itemTitle?.(o)} sub={def.fields.slice(1, 4).map((f) => o[f.key]).filter(Boolean).join(' · ')}
            right={o.phone ? <a className="btn" href={`tel:${o.phone}`} onClick={(e) => e.stopPropagation()} aria-label={`Call ${o.name}`}><Icon name="phone" /></a> : undefined} />
        ))}
      </div>
      {id === 'meeting' && <p className="small" style={{ marginTop: 12 }}>Tip: drop the spot as a "Meeting point" pin on the map too, so you get distance and bearing to it. <a href={href('/map')}>Open map</a></p>}
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit && edit.i >= 0 ? 'Edit' : 'Add'}>
        {edit && (
          <form className="stack" onSubmit={async (e) => { e.preventDefault(); const n = [...list]; if (edit.i >= 0) n[edit.i] = edit.v; else n.push(edit.v); await saveList(n); setEdit(null); }}>
            {def.fields.map((f) => (
              <Field key={f.key} label={f.label} hint={f.hint}>
                {f.type === 'textarea' ? <textarea value={edit.v[f.key] ?? ''} onChange={(e) => setEdit({ ...edit, v: { ...edit.v, [f.key]: e.target.value } })} /> : <input type={f.type ?? 'text'} value={edit.v[f.key] ?? ''} onChange={(e) => setEdit({ ...edit, v: { ...edit.v, [f.key]: e.target.value } })} />}
              </Field>
            ))}
            <div className="btnrow">
              <Btn type="submit" kind="go" icon="check">Save</Btn>
              {id === 'meds' && edit.v.every && <Btn icon="timer" onClick={() => { startTimer({ label: `${edit.v.name} ${edit.v.dose ?? ''}`.trim(), minutes: Number(edit.v.every) * 60, kind: 'repeat', note: edit.v.for ? `For ${edit.v.for}` : undefined }); go('/tool/timers'); }}>Start dose timer</Btn>}
              {edit.i >= 0 && <Btn kind="danger" icon="trash" onClick={async () => { if (!confirm('Delete this entry?')) return; const n = list.filter((_, j) => j !== edit.i); await saveList(n); setEdit(null); }}>Delete</Btn>}
            </div>
          </form>
        )}
      </Sheet>
    </Screen>
  );
}

export function BackupSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [msg, setMsg] = useState('');
  const fileIn = useRef<HTMLInputElement>(null);
  return (
    <Sheet open={open} onClose={onClose} title="Export / import (encrypted)">
      <Card>
        <h3>Export</h3>
        <p className="small">Makes one file with your plan, pins, tracks, pages, photos, PDFs, checklists and inventory, locked with a passphrase (AES-256). Without the passphrase nobody can open it, including you.</p>
        <Field label="Passphrase (at least 8 characters)"><input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" data-testid="pass" /></Field>
        <Field label="Type it again"><input type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} autoComplete="new-password" data-testid="pass2" /></Field>
        <Btn kind="primary" icon="download" disabled={pass.length < 8 || pass !== pass2} onClick={async () => {
          setMsg('Encrypting…');
          const b = await exportAll(pass);
          const name = `grid-down-hub-backup-${new Date().toISOString().slice(0, 10)}.gdh`;
          setMsg(await saveFile(name, b));
        }}>Export file</Btn>
      </Card>
      <Card>
        <h3>Import</h3>
        <Field label="Passphrase used when exporting"><input type="password" value={pass} onChange={(e) => setPass(e.target.value)} data-testid="pass-import" /></Field>
        <Field label="How">
          <select value={mode} onChange={(e) => setMode(e.target.value as 'merge' | 'replace')}>
            <option value="merge">Merge (keep what's here, add and update from the file)</option>
            <option value="replace">Replace (this device ends up exactly like the file)</option>
          </select>
        </Field>
        <Btn icon="upload" onClick={() => fileIn.current?.click()}>Choose backup file</Btn>
        <input ref={fileIn} type="file" accept=".gdh,application/json" hidden data-testid="import-file" onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            setMsg('Decrypting…');
            const r = await importAll(f, pass, mode);
            setMsg(`Imported: ${Object.entries(r.counts).filter(([, n]) => n).map(([k, n]) => `${n} ${k}`).join(', ')}`);
          } catch (err) {
            setMsg((err as Error).message);
          }
          e.target.value = '';
        }} />
      </Card>
      {msg && <p role="status" data-testid="backup-msg"><b>{msg}</b></p>}
      <SectionTitle>Safe keeping</SectionTitle>
      <p className="small">Keep one copy on the phone, one on the laptop, and one on a USB stick in the go-bag. Write the passphrase on paper and keep it separate from the USB stick.</p>
    </Sheet>
  );
}
