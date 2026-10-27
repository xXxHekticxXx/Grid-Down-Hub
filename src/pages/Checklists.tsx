import { useEffect, useState } from 'react';
import { Screen, Row, Btn, Field, toast, Empty, SectionTitle } from '../ui/ui';
import { checklists, checklist, saveChecklist, restoreChecklist, deleteChecklist, content } from '../lib/content';
import { get, put, uid, subscribe } from '../lib/db';
import { go } from '../lib/router';
import { Icon } from '../ui/icons';
import { checklistPdf } from '../lib/pdfmake';
import { saveFile } from '../lib/native';
import type { Checklist, ChecklistItem } from '../types';

export default function Checklists({ id, edit }: { id?: string; edit?: boolean }) {
  if (!id) return <ChecklistIndex />;
  return edit ? <ChecklistEditor id={id} /> : <ChecklistView id={id} />;
}

function ChecklistIndex() {
  const [list, setList] = useState<Checklist[]>([]);
  useEffect(() => {
    const load = () => checklists().then(setList);
    load();
    return subscribe('checklists', load);
  }, []);
  return (
    <Screen title="Checklists" actions={<Btn kind="go" icon="plus" onClick={async () => { const c: Checklist = { id: 'my-' + uid(), title: 'New checklist', sections: [{ title: 'Items', items: [] }] }; await saveChecklist(c); go(`/checklist/${c.id}/edit`); }}>New</Btn>}>
      <div className="list">
        {list.map((c) => {
          const n = c.sections.reduce((s, x) => s + x.items.length, 0);
          const d = c.sections.reduce((s, x) => s + x.items.filter((i) => i.done).length, 0);
          return <Row key={c.id} to={`/checklist/${c.id}`} title={c.title} sub={`${d} of ${n} done${c.builtin === false || c.id.startsWith('my-') ? ' · mine' : ''}`} />;
        })}
      </div>
    </Screen>
  );
}

function useChecklist(id: string) {
  const [c, setC] = useState<Checklist | null | undefined>();
  const [builtin, setBuiltin] = useState(false);
  useEffect(() => {
    const load = async () => {
      setC((await checklist(id)) ?? null);
      setBuiltin((await content()).checklists.some((x) => x.id === id));
    };
    load();
    return subscribe('checklists', load);
  }, [id]);
  return { c, setC, builtin };
}

function ChecklistView({ id }: { id: string }) {
  const { c, builtin } = useChecklist(id);
  const [edited, setEdited] = useState(false);
  useEffect(() => {
    get('checklists', id).then((v) => setEdited(!!v));
  }, [id, c]);
  if (c === undefined) return <Screen title="…">{null}</Screen>;
  if (c === null) return <Screen title="Not found"><Empty>This checklist was deleted.</Empty></Screen>;
  const toggle = async (si: number, ii: number) => {
    const n = structuredClone(c);
    n.sections[si].items[ii].done = !n.sections[si].items[ii].done;
    await saveChecklist(n);
  };
  const total = c.sections.reduce((s, x) => s + x.items.length, 0);
  const done = c.sections.reduce((s, x) => s + x.items.filter((i) => i.done).length, 0);
  return (
    <Screen title={c.title} crumb="Checklists" actions={<Btn icon="edit" to={`/checklist/${id}/edit`}>Edit</Btn>}>
      <p className="muted" style={{ marginTop: 0 }}>{done} of {total} done{c.source ? <> · from <a href={c.source.url} target="_blank" rel="noreferrer">{c.source.title}</a>, checked {c.source.checked}</> : null}{builtin && edited ? ' · edited by you' : ''}</p>
      {c.sections.map((s, si) => (
        <div key={si}>
          <SectionTitle>{s.title}</SectionTitle>
          <div className="card" style={{ padding: 0 }}>
            {s.items.length === 0 && <Empty>No items.</Empty>}
            {s.items.map((it, ii) => (
              <label key={it.id} className={`check-row ${it.done ? 'done' : ''}`}>
                <input type="checkbox" checked={!!it.done} onChange={() => toggle(si, ii)} />
                <span className="check-text">
                  <b>{it.text}</b>
                  {(it.qty || it.expires || it.note) && <span className="small muted" style={{ display: 'block' }}>{[it.qty && `Qty ${it.qty}`, it.expires && `Expires ${it.expires}`, it.note].filter(Boolean).join(' · ')}</span>}
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
      <div className="btnrow" style={{ marginTop: 14 }}>
        <Btn icon="check" onClick={async () => { const n = structuredClone(c); n.sections.forEach((s) => s.items.forEach((i) => (i.done = false))); await saveChecklist(n); toast('All unchecked'); }}>Uncheck all</Btn>
        <Btn icon="print" onClick={async () => toast(await saveFile(`${c.title.replace(/[^\w-]+/g, '_')}.pdf`, checklistPdf(c)))}>Print / PDF</Btn>
      </div>
    </Screen>
  );
}

function ChecklistEditor({ id }: { id: string }) {
  const { c, builtin } = useChecklist(id);
  const [d, setD] = useState<Checklist | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    if (c && !d) setD(structuredClone(c));
  }, [c, d]);
  if (!d) return <Screen title="…">{null}</Screen>;
  const upd = (f: (n: Checklist) => void) => {
    const n = structuredClone(d);
    f(n);
    setD(n);
  };
  const move = (si: number, ii: number, dir: -1 | 1) =>
    upd((n) => {
      const arr = n.sections[si].items;
      const j = ii + dir;
      if (j < 0 || j >= arr.length) {
        // move between sections
        const ns = si + dir;
        if (ns < 0 || ns >= n.sections.length) return;
        const [x] = arr.splice(ii, 1);
        if (dir > 0) n.sections[ns].items.unshift(x);
        else n.sections[ns].items.push(x);
        return;
      }
      [arr[ii], arr[j]] = [arr[j], arr[ii]];
    });
  const save = async () => {
    await saveChecklist(d);
    toast('Saved on this device');
    go(`/checklist/${d.id}`);
  };
  return (
    <Screen title="Edit checklist" actions={<Btn kind="go" icon="check" onClick={save}>Done</Btn>}>
      <div className="stack">
        <Field label="Checklist name"><input value={d.title} onChange={(e) => upd((n) => (n.title = e.target.value))} /></Field>
        <p className="small muted">Use the arrows to reorder (they also move items between sections). Tap an item to edit its details.</p>
        {d.sections.map((s, si) => (
          <div key={si} className="card stack">
            <div style={{ display: 'flex', gap: 8 }}>
              <input aria-label="Section name" value={s.title} onChange={(e) => upd((n) => (n.sections[si].title = e.target.value))} style={{ fontWeight: 800 }} />
              <button className="icon-btn" aria-label="Delete section" onClick={() => { if (s.items.length === 0 || confirm(`Delete section "${s.title}" and its ${s.items.length} items?`)) upd((n) => n.sections.splice(si, 1)); }}><Icon name="trash" /></button>
            </div>
            {s.items.map((it, ii) => (
              <div key={it.id} style={{ borderTop: '1px solid var(--soft)', paddingTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button className="icon-btn" aria-label="Move up" onClick={() => move(si, ii, -1)}>▲</button>
                  <button className="icon-btn" aria-label="Move down" onClick={() => move(si, ii, 1)}>▼</button>
                  <button className="row" style={{ border: 0, minHeight: 48, padding: '0 6px' }} onClick={() => setOpen(open === it.id ? null : it.id)}>
                    <span className="row-main"><span className="row-title">{it.text || '(new item)'}</span>{(it.qty || it.expires) && <span className="row-sub">{[it.qty && `Qty ${it.qty}`, it.expires && `Expires ${it.expires}`].filter(Boolean).join(' · ')}</span>}</span>
                    <Icon name="edit" size={20} />
                  </button>
                </div>
                {open === it.id && <ItemEditor it={it} onChange={(p) => upd((n) => Object.assign(n.sections[si].items[ii], p))} onDelete={() => upd((n) => n.sections[si].items.splice(ii, 1))} />}
              </div>
            ))}
            <Btn kind="ghost" icon="plus" onClick={() => { const nid = uid(); upd((n) => n.sections[si].items.push({ id: nid, text: '' })); setOpen(nid); }}>Add item</Btn>
          </div>
        ))}
        <div className="btnrow">
          <Btn kind="ghost" icon="plus" onClick={() => upd((n) => n.sections.push({ title: 'New section', items: [] }))}>Add section</Btn>
          <Btn icon="copy" onClick={async () => { const n = { ...structuredClone(d), id: 'my-' + uid(), title: d.title + ' (copy)', builtin: false }; await saveChecklist(n); toast('Copied'); go(`/checklist/${n.id}/edit`); }}>Duplicate list</Btn>
          {builtin && <Btn icon="back" onClick={async () => { if (confirm('Throw away your changes and restore the official version?')) { await restoreChecklist(d.id); toast('Original restored'); go(`/checklist/${d.id}`); } }}>Restore original</Btn>}
          <Btn kind="danger" icon="trash" onClick={async () => { if (confirm(`Delete "${d.title}"?`)) { await deleteChecklist(d.id); go('/checklists'); } }}>Delete list</Btn>
        </div>
        <Btn kind="go" icon="check" full onClick={save}>Save</Btn>
      </div>
    </Screen>
  );
}

function ItemEditor({ it, onChange, onDelete }: { it: ChecklistItem; onChange: (p: Partial<ChecklistItem>) => void; onDelete: () => void }) {
  return (
    <div className="stack" style={{ padding: '8px 0' }}>
      <Field label="Item"><input value={it.text} onChange={(e) => onChange({ text: e.target.value })} autoFocus /></Field>
      <div className="grid2">
        <Field label="Quantity"><input value={it.qty ?? ''} onChange={(e) => onChange({ qty: e.target.value })} /></Field>
        <Field label="Expires"><input type="date" value={it.expires ?? ''} onChange={(e) => onChange({ expires: e.target.value })} /></Field>
      </div>
      <Field label="Note"><input value={it.note ?? ''} onChange={(e) => onChange({ note: e.target.value })} /></Field>
      <div className="btnrow">
        <label className="btn"><Icon name="camera" /> Photo<input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const id = uid(); await put('files', id, { id, name: f.name, type: f.type, blob: f, created: Date.now() }); onChange({ photo: id }); toast('Photo attached'); }} /></label>
        <Btn kind="danger" icon="trash" onClick={onDelete}>Delete item</Btn>
      </div>
    </div>
  );
}
