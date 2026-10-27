import { useEffect, useState } from 'react';
import { Screen, Btn, Field, Empty, Sheet, toast } from '../ui/ui';
import { all, put, del, uid, subscribe } from '../lib/db';
import { inventoryPdf } from '../lib/pdfmake';
import { saveFile } from '../lib/native';

export type Inv = { id: string; name: string; qty: string; unit: string; where: string; category: string; expires?: string; note?: string; updated: number };
const CATS = ['Water', 'Food', 'Medical', 'Dog', 'Power & fuel', 'Tools', 'Ammo & firearms', 'Hygiene', 'Documents', 'Other'];

export function daysLeft(d?: string) {
  if (!d) return null;
  return Math.ceil((new Date(d + 'T12:00:00').getTime() - Date.now()) / 86400000);
}

export default function Inventory() {
  const [list, setList] = useState<Inv[]>([]);
  const [edit, setEdit] = useState<Inv | null>(null);
  const [filter, setFilter] = useState('All');
  useEffect(() => {
    const load = () => all<Inv>('inventory').then(setList);
    load();
    return subscribe('inventory', load);
  }, []);
  const shown = list.filter((i) => filter === 'All' || (filter === 'Expiring' ? (daysLeft(i.expires) ?? 9999) <= 60 : i.category === filter)).sort((a, b) => (a.expires || '9999').localeCompare(b.expires || '9999'));
  const blank = (): Inv => ({ id: uid(), name: '', qty: '1', unit: '', where: '', category: 'Food', updated: Date.now() });
  return (
    <Screen title="Inventory" actions={<Btn kind="go" icon="plus" onClick={() => setEdit(blank())}>Add</Btn>}>
      <div className="btnrow" style={{ marginBottom: 10 }}>
        {['All', 'Expiring', ...CATS].map((c) => <button key={c} className={`btn ${filter === c ? 'btn-primary' : ''}`} style={{ flex: '0 1 auto', minHeight: 44 }} onClick={() => setFilter(c)}>{c}</button>)}
      </div>
      {shown.length === 0 && <Empty>{list.length === 0 ? 'Nothing tracked yet. Add what you have, how much, where it is and when it expires.' : 'Nothing in this filter.'}</Empty>}
      <div className="list">
        {shown.map((i) => {
          const dl = daysLeft(i.expires);
          return (
            <button key={i.id} className={`row ${dl != null && dl <= 30 ? 'row-warn' : ''}`} onClick={() => setEdit(i)}>
              <span className="row-main">
                <span className="row-title">{i.name} <span className="muted">· {i.qty} {i.unit}</span></span>
                <span className="row-sub">{[i.category, i.where, i.expires && (dl! < 0 ? `EXPIRED ${i.expires}` : `expires ${i.expires} (${dl} days)`)].filter(Boolean).join(' · ')}</span>
              </span>
            </button>
          );
        })}
      </div>
      {list.length > 0 && <div className="btnrow" style={{ marginTop: 12 }}><Btn icon="print" onClick={async () => toast(await saveFile('inventory.pdf', inventoryPdf(list)))}>Print / PDF</Btn></div>}
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.name ? 'Edit item' : 'Add item'}>
        {edit && (
          <form className="stack" onSubmit={async (e) => { e.preventDefault(); if (!edit.name.trim()) return; await put('inventory', edit.id, { ...edit, updated: Date.now() }); setEdit(null); }}>
            <Field label="Item"><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} autoFocus /></Field>
            <div className="grid2">
              <Field label="Quantity"><input value={edit.qty} onChange={(e) => setEdit({ ...edit, qty: e.target.value })} /></Field>
              <Field label="Unit (cans, gal, rounds…)"><input value={edit.unit} onChange={(e) => setEdit({ ...edit, unit: e.target.value })} /></Field>
              <Field label="Category"><select value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></Field>
              <Field label="Expires"><input type="date" value={edit.expires ?? ''} onChange={(e) => setEdit({ ...edit, expires: e.target.value })} /></Field>
            </div>
            <Field label="Where it is"><input value={edit.where} onChange={(e) => setEdit({ ...edit, where: e.target.value })} /></Field>
            <Field label="Note"><input value={edit.note ?? ''} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></Field>
            <div className="btnrow">
              <Btn type="submit" kind="go" icon="check">Save</Btn>
              {list.some((x) => x.id === edit.id) && <Btn kind="danger" icon="trash" onClick={async () => { await del('inventory', edit.id); setEdit(null); }}>Delete</Btn>}
            </div>
          </form>
        )}
      </Sheet>
    </Screen>
  );
}
