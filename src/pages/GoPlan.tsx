import { useEffect, useState } from 'react';
import { Screen, Row, Btn, Field, Card, SectionTitle, toast } from '../ui/ui';
import { get, put, all } from '../lib/db';
import { content, checklist, type Content } from '../lib/content';
import { FuelRangeTool } from '../tools/FuelRange';
import { WaterNeedTool } from '../tools/WaterNeed';
import { href } from '../lib/router';
import type { Checklist, Pin } from '../types';

type GoData = { primary?: string; fallback?: string; route?: string; leaveBy?: string; note?: string };

export default function GoPlan({ mode }: { mode: 'go' | 'stay' }) {
  const [c, setC] = useState<Content | null>(null);
  const [d, setD] = useState<GoData>({});
  const [pins, setPins] = useState<Pin[]>([]);
  const [list, setList] = useState<Checklist | undefined>();
  const key = mode === 'go' ? 'goplan' : 'stayplan';
  useEffect(() => {
    content().then(setC);
    get<GoData>('kv', key).then((v) => setD(v ?? {}));
    all<Pin>('pins').then(setPins);
    checklist(mode === 'go' ? 'truck-load' : 'stay-home').then(setList);
  }, [key, mode]);
  const save = async (p: Partial<GoData>) => {
    const n = { ...d, ...p };
    setD(n);
    await put('kv', key, n);
  };
  const arts = c?.articles.filter((a) => (mode === 'go' ? a.category === 'bug-out' : ['stay-or-go', 'hurricane-before', 'hurricane-during', 'hurricane-after', 'generator-co-safety', 'cool-camper-no-ac', 'solar-power-station', 'water-storage', 'fridge-freezer-food-safety', 'storm-prep-10-acres', 'looting-security'].includes(a.id))) ?? [];
  const done = list ? list.sections.reduce((s, x) => s + x.items.filter((i) => i.done).length, 0) : 0;
  const total = list ? list.sections.reduce((s, x) => s + x.items.length, 0) : 0;
  const pinOpt = (
    <>
      <option value="">Pick a pin…</option>
      {pins.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </>
  );
  const pinById = (id?: string) => pins.find((p) => p.id === id);
  return (
    <Screen title={mode === 'go' ? 'GO PLAN' : 'STAY PLAN'} tone={mode === 'go' ? 'green' : undefined}>
      <div className="stack">
        <Row to="/a/stay-or-go" title="Stay or go?" sub="The decision in plain steps. For a camper, hurricanes mean go." tone="warn" />
        {mode === 'go' ? (
          <>
            <Card title="Where">
              <div className="stack">
                <Field label="Primary destination"><select value={d.primary ?? ''} onChange={(e) => save({ primary: e.target.value })}>{pinOpt}</select></Field>
                <Field label="Fallback destination"><select value={d.fallback ?? ''} onChange={(e) => save({ fallback: e.target.value })}>{pinOpt}</select></Field>
                <Field label="Route and back roads"><textarea defaultValue={d.route ?? ''} onBlur={(e) => save({ route: e.target.value })} /></Field>
                <div className="btnrow">
                  <Btn kind="go" icon="map" to={pinById(d.primary) ? `/map?lon=${pinById(d.primary)!.lon}&lat=${pinById(d.primary)!.lat}&z=12&pin=${d.primary}&routes=1` : '/map?routes=1'}>Show on map</Btn>
                  <Btn icon="route" to="/map?routes=1">Planned routes</Btn>
                </div>
                {pins.length === 0 && <p className="small">Drop your destinations as pins first (long-press on the map). The Ocala National Forest springs (Alexander, Juniper, Salt Springs) are on the map under Springs and Campgrounds.</p>}
              </div>
            </Card>
            <FuelRangeTool />
          </>
        ) : (
          <WaterNeedTool />
        )}
        <Card title={mode === 'go' ? 'Load the truck' : 'Hold at home'}>
          <p>{total ? `${done} of ${total} checked.` : ''}</p>
          <div className="btnrow">
            <Btn kind="primary" icon="list" to={`/checklist/${mode === 'go' ? 'truck-load' : 'stay-home'}`}>Open checklist</Btn>
            <Btn icon="edit" to={`/checklist/${mode === 'go' ? 'truck-load' : 'stay-home'}/edit`}>Edit it</Btn>
          </div>
        </Card>
        <Row to="/plan/evac" title="Leave-now triggers and evacuation plan" sub="In My Plan" />
        <Row to="/checklists" title="All checklists" sub="Go-bag, hurricane, Ready.gov kit, dog" />
        <SectionTitle>{mode === 'go' ? 'Go Plan & Field guides' : 'Holding at home'}</SectionTitle>
        <div className="list">{arts.map((a) => <Row key={a.id} to={`/a/${a.id}`} title={a.title} sub={a.summary} />)}</div>
        <Field label="Notes"><textarea defaultValue={d.note ?? ''} onBlur={(e) => { void save({ note: e.target.value }); toast('Saved'); }} /></Field>
        <p className="small"><a href={href('/plan')}>My Plan</a></p>
      </div>
    </Screen>
  );
}
