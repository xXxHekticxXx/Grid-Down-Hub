import { ReactNode, useRef, useState } from 'react';
import lists from '../../content/checklists.json';
import { Page } from '../ui';
import { Plan, usePlan, toExport, fromExport, Person, Med, Doc } from '../lib/plan';
import { download } from '../lib/util';

type Upd = (fn: (p: Plan) => Plan) => void;

function F({ label, value, onChange, area, type }: { label: string; value: string; onChange: (v: string) => void; area?: boolean; type?: string }) {
  const id = 'f' + label.replace(/\W/g, '');
  return (
    <>
      <label htmlFor={id}>{label}</label>
      {area ? <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} /> : <input id={id} type={type || 'text'} value={value} onChange={(e) => onChange(e.target.value)} />}
    </>
  );
}

function kitCounts(p: Plan) {
  let done = 0;
  let total = 0;
  for (const g of lists) {
    const items = [...g.items, ...(p.custom[g.id] || [])];
    total += items.length;
    items.forEach((_, i) => {
      if (p.checks[`${g.id}:${i}`]) done++;
    });
  }
  return { done, total };
}

export function PlanHome() {
  const { plan, replace, err } = usePlan();
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  if (!plan) return <Page title="My Plan">Loading…</Page>;
  const k = kitCounts(plan);
  const filled = (s: string, empty = 'Tap to add') => s.trim() || empty;
  const docsHave = plan.docs.filter((d) => d.have).length;
  const rows: [string, string, string][] = [
    ['contacts', 'PEOPLE AND CONTACTS', plan.people.length ? `${plan.people.length} saved` : 'Tap to add'],
    ['places', 'MEETING POINTS, OUT-OF-AREA CONTACT, EVACUATION', filled(plan.meetPrimary)],
    ['meds', 'MEDICATIONS AND MEDICAL NOTES', plan.meds.length ? `${plan.meds.length} medication${plan.meds.length > 1 ? 's' : ''}` : 'Tap to add'],
    ['docs', 'IMPORTANT DOCUMENTS', `${docsHave} of ${plan.docs.length} ready`],
    ['pet', 'PET', filled(plan.petName)],
    ['radio', 'RADIO PLAN (FRS / GMRS)', filled(plan.radioPrimary)],
    ['kit', 'KIT AND STORM CHECKLISTS', `${k.done} of ${k.total} done`]
  ];
  const doExport = () => {
    download(`grid-down-hub-plan-${new Date().toISOString().slice(0, 10)}.json`, toExport(plan));
    setMsg('Backup file saved to your Downloads. Keep a copy somewhere safe.');
  };
  const doImport = async (f?: File) => {
    if (!f) return;
    try {
      const p = fromExport(await f.text());
      if (!confirm('Replace everything in My Plan on this device with the backup file?')) return;
      replace(p);
      setMsg('Imported. Everything in My Plan was replaced with the backup.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not read that file.');
    }
  };
  return (
    <Page title="My Plan" right={<span className="badge ok">Stays on this device</span>}>
      <div className="muted">Your family details live only on this device. Nothing is uploaded and nothing is in the public code. Track where documents are kept, not the numbers on them.</div>
      {rows.map(([id, k2, v]) => (
        <a key={id} className="kv" href={'#/plan/' + id}>
          <b>{k2}</b>
          <span>{v}</span>
        </a>
      ))}
      <div className="row">
        <button className="btn primary grow" onClick={doExport}>
          Export backup
        </button>
        <button className="btn grow" onClick={() => file.current?.click()}>
          Import backup
        </button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { doImport(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      <button className="btn" onClick={() => window.print()}>
        Print my plan
      </button>
      {msg ? <div className="good">{msg}</div> : null}
      {err ? <div className="notice">{err}</div> : null}
      <div className="muted">Reminder: check the kit and the shelter list every June 1, the start of hurricane season.</div>
    </Page>
  );
}

function Remove({ onClick }: { onClick: () => void }) {
  return (
    <button className="btn small" onClick={onClick} style={{ marginTop: '.5rem' }}>
      Remove
    </button>
  );
}

export function PlanSection({ which }: { which: string }) {
  const { plan, update, err } = usePlan();
  if (!plan) return <Page title="My Plan" back="#/plan">Loading…</Page>;
  const set = (patch: Partial<Plan>) => update((p) => ({ ...p, ...patch }));
  let title = 'My Plan';
  let body: ReactNode = null;

  if (which === 'contacts') {
    title = 'People and contacts';
    const edit = (i: number, patch: Partial<Person>) => set({ people: plan.people.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
    body = (
      <>
        <div className="muted">Family, vet, doctor, pharmacy, insurance, county emergency management, power company outage line.</div>
        {plan.people.map((x, i) => (
          <div className="rec" key={i}>
            <F label="Name" value={x.name} onChange={(v) => edit(i, { name: v })} />
            <F label="Phone" type="tel" value={x.phone} onChange={(v) => edit(i, { phone: v })} />
            <F label="Relationship / role" value={x.relation} onChange={(v) => edit(i, { relation: v })} />
            <F label="Where they would go" value={x.where} onChange={(v) => edit(i, { where: v })} />
            <div className="row">
              {x.phone ? (
                <a className="btn small" href={'tel:' + x.phone.replace(/[^\d+]/g, '')}>
                  Call
                </a>
              ) : null}
              <Remove onClick={() => set({ people: plan.people.filter((_, j) => j !== i) })} />
            </div>
          </div>
        ))}
        <button className="btn primary" onClick={() => set({ people: [...plan.people, { name: '', phone: '', relation: '', where: '' }] })}>
          Add a person
        </button>
      </>
    );
  } else if (which === 'places') {
    title = 'Meeting points and evacuation';
    body = (
      <div className="card">
        <F label="Primary meeting point (near home)" value={plan.meetPrimary} onChange={(v) => set({ meetPrimary: v })} area />
        <F label="Secondary meeting point (out of the area)" value={plan.meetSecondary} onChange={(v) => set({ meetSecondary: v })} area />
        <F label="Out-of-area contact: name" value={plan.outName} onChange={(v) => set({ outName: v })} />
        <F label="Out-of-area contact: phone" type="tel" value={plan.outPhone} onChange={(v) => set({ outPhone: v })} />
        <F label="Hurricane evacuation: where you and the dog go, route notes, what to take" value={plan.evac} onChange={(v) => set({ evac: v })} area />
        <F label="Water sources near home" value={plan.waterSources} onChange={(v) => set({ waterSources: v })} area />
        <F label="Shelter list last checked (update each June)" value={plan.shelterChecked} onChange={(v) => set({ shelterChecked: v })} />
        <p className="muted">Add map pins for these places on the Map page. A camper is not a safe place to ride out a hurricane, so plan to leave.</p>
      </div>
    );
  } else if (which === 'meds') {
    title = 'Medications and medical notes';
    const edit = (i: number, patch: Partial<Med>) => set({ meds: plan.meds.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
    body = (
      <>
        {plan.meds.map((x, i) => (
          <div className="rec" key={i}>
            <F label="Medication" value={x.name} onChange={(v) => edit(i, { name: v })} />
            <F label="Dose" value={x.dose} onChange={(v) => edit(i, { dose: v })} />
            <F label="Schedule" value={x.schedule} onChange={(v) => edit(i, { schedule: v })} />
            <F label="Where stored" value={x.stored} onChange={(v) => edit(i, { stored: v })} />
            <F label="Refill date" value={x.refill} onChange={(v) => edit(i, { refill: v })} />
            <Remove onClick={() => set({ meds: plan.meds.filter((_, j) => j !== i) })} />
          </div>
        ))}
        <button className="btn primary" onClick={() => set({ meds: [...plan.meds, { name: '', dose: '', schedule: '', stored: '', refill: '' }] })}>
          Add a medication
        </button>
        <div className="card">
          <F label="Medical notes (blood type, allergies, conditions)" value={plan.medNotes} onChange={(v) => set({ medNotes: v })} area />
          <p className="muted">Stored only on this device.</p>
        </div>
      </>
    );
  } else if (which === 'docs') {
    title = 'Important documents';
    const edit = (i: number, patch: Partial<Doc>) => set({ docs: plan.docs.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
    body = (
      <>
        <div className="muted">Track where each is kept, not the numbers on them.</div>
        {plan.docs.map((x, i) => (
          <div className="rec" key={i}>
            <label className="chk">
              <input type="checkbox" checked={x.have} onChange={(e) => edit(i, { have: e.target.checked })} />
              <span>{x.name}</span>
            </label>
            <F label="Where it is kept" value={x.where} onChange={(v) => edit(i, { where: v })} />
            <Remove onClick={() => set({ docs: plan.docs.filter((_, j) => j !== i) })} />
          </div>
        ))}
        <button className="btn primary" onClick={() => set({ docs: [...plan.docs, { name: 'New document', where: '', have: false }] })}>
          Add a document
        </button>
      </>
    );
  } else if (which === 'pet') {
    title = 'Pet';
    body = (
      <div className="card">
        <F label="Dog's name" value={plan.petName} onChange={(v) => set({ petName: v })} />
        <F label="Vet (name and phone)" value={plan.petVet} onChange={(v) => set({ petVet: v })} />
        <F label="Vaccine records (where kept)" value={plan.petVaccines} onChange={(v) => set({ petVaccines: v })} />
        <F label="Food amount per day" value={plan.petFood} onChange={(v) => set({ petFood: v })} />
        <p className="muted">Pet-friendly shelters are listed on the Comms & Local page. Confirm before going.</p>
      </div>
    );
  } else if (which === 'radio') {
    title = 'Radio plan';
    body = (
      <div className="card">
        <F label="Primary channel (FRS / GMRS)" value={plan.radioPrimary} onChange={(v) => set({ radioPrimary: v })} />
        <F label="Backup channel" value={plan.radioBackup} onChange={(v) => set({ radioBackup: v })} />
        <F label="Check-in times (for example, the top of every hour)" value={plan.radioCheckin} onChange={(v) => set({ radioCheckin: v })} />
        <F label="NOAA SAME county code" value={plan.sameCode} onChange={(v) => set({ sameCode: v })} />
        <p className="muted">Lake County is 012069. NOAA: KIH63 at 162.475 MHz, backup KIH26 at 162.400 MHz. GMRS needs an FCC license; FRS does not.</p>
      </div>
    );
  } else if (which === 'kit') {
    title = 'Kit and storm checklists';
    body = (
      <>
        {lists.map((g) => {
          const extra = plan.custom[g.id] || [];
          const items = [...g.items, ...extra];
          return (
            <div className="card" key={g.id}>
              <h2>{g.title}</h2>
              {items.map((t, i) => {
                const key = `${g.id}:${i}`;
                return (
                  <label className="chk" key={key}>
                    <input type="checkbox" checked={!!plan.checks[key]} onChange={(e) => set({ checks: { ...plan.checks, [key]: e.target.checked } })} />
                    <span>{t}</span>
                  </label>
                );
              })}
              <AddItem onAdd={(t) => set({ custom: { ...plan.custom, [g.id]: [...extra, t] } })} />
              <div className="muted">
                Source:{' '}
                <a href={g.url} target="_blank" rel="noopener">
                  {g.source}
                </a>
              </div>
            </div>
          );
        })}
        <div className="muted">Replace expired items and re-check every year. Next check: June 1.</div>
      </>
    );
  }

  return (
    <Page title={title} back="#/plan">
      {body}
      {err ? <div className="notice">{err}</div> : null}
      <div className="muted">Saved automatically on this device.</div>
    </Page>
  );
}

function AddItem({ onAdd }: { onAdd: (t: string) => void }) {
  const [t, setT] = useState('');
  return (
    <div className="row" style={{ marginTop: '.4rem' }}>
      <input className="grow" value={t} placeholder="Add your own item" onChange={(e) => setT(e.target.value)} aria-label="Add your own item" />
      <button
        className="btn"
        onClick={() => {
          if (t.trim()) {
            onAdd(t.trim());
            setT('');
          }
        }}
      >
        Add
      </button>
    </div>
  );
}
