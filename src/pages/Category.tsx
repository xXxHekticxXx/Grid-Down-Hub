import { useEffect, useState } from 'react';
import { Screen, Row, SectionTitle, Btn, Empty } from '../ui/ui';
import { content, userItems, userSections, type Content, type UserSection } from '../lib/content';
import { subscribe } from '../lib/db';
import { AddSheet } from './AddSheet';
import type { UserItem } from '../types';

export const HUBS: Record<string, { title: string; cats: string[] }> = {
  field: { title: 'Bushcraft & Shelter', cats: ['skills', 'power-shelter'] },
  'plants-food': { title: 'Plants, Food & Herbal', cats: ['plants', 'food'] },
};

const ITEM_LABEL: Record<UserItem['kind'], string> = { page: 'Page', photo: 'Photos', pdf: 'PDF', checklist: 'Checklist', pin: 'Map pin', voice: 'Voice note', note: 'Note' };

export default function Category({ id, hub }: { id: string; hub?: boolean }) {
  const [c, setC] = useState<Content | null>(null);
  const [items, setItems] = useState<UserItem[]>([]);
  const [sections, setSections] = useState<UserSection[]>([]);
  const [adding, setAdding] = useState(false);
  useEffect(() => {
    content().then(setC);
  }, []);
  useEffect(() => {
    const load = () => {
      userItems().then(setItems);
      userSections().then(setSections);
    };
    load();
    const a = subscribe('items', load);
    const b = subscribe('kv', load);
    return () => {
      a();
      b();
    };
  }, [id]);
  if (!c) return <Screen title="…">{null}</Screen>;

  const userSec = sections.find((s) => s.id === id);
  const cats = hub ? HUBS[id]?.cats ?? [] : [id];
  const title = hub ? HUBS[id]?.title : c.categories.find((x) => x.id === id)?.title ?? userSec?.title ?? 'Section';
  const blurb = hub ? '' : c.categories.find((x) => x.id === id)?.blurb ?? userSec?.blurb ?? '';
  const overridden = new Set(items.filter((i) => i.overrides).map((i) => i.overrides));
  return (
    <Screen title={title} actions={<Btn kind="go" icon="plus" onClick={() => setAdding(true)}>Add</Btn>}>
      {blurb && <p className="muted" style={{ marginTop: 0 }}>{blurb}</p>}
      {cats.map((cat) => {
        const cc = c.categories.find((x) => x.id === cat);
        const arts = c.articles.filter((a) => a.category === cat);
        const mine = items.filter((i) => i.section === cat && !i.overrides);
        const subs = sections.filter((s) => s.parent === cat);
        return (
          <div key={cat}>
            {hub && <SectionTitle>{cc?.title}</SectionTitle>}
            <div className="list">
              {mine.map((i) => <Row key={i.id} tone="mine" to={`/item/${i.id}`} title={i.title} sub={<><span className="badge">Mine</span> {ITEM_LABEL[i.kind]}</>} />)}
              {subs.map((s) => <Row key={s.id} tone="mine" to={`/cat/${s.id}`} title={s.title} sub={<><span className="badge">My section</span> {s.blurb}</>} />)}
              {arts.map((a) => (
                <Row key={a.id} to={`/a/${a.id}`} title={a.title} sub={<>{overridden.has(a.id) && <span className="badge" style={{ marginRight: 6 }}>Edited by you</span>}{a.summary}</>} />
              ))}
            </div>
          </div>
        );
      })}
      {userSec && (
        <div className="list">
          {items.filter((i) => i.section === id).map((i) => <Row key={i.id} tone="mine" to={`/item/${i.id}`} title={i.title} sub={ITEM_LABEL[i.kind]} />)}
          {items.filter((i) => i.section === id).length === 0 && <Empty>Nothing here yet. Tap Add to put pages, photos, PDFs, checklists or map pins in this section.</Empty>}
        </div>
      )}
      <AddSheet open={adding} onClose={() => setAdding(false)} section={hub ? cats[0] : id} sectionTitle={title ?? ''} />
    </Screen>
  );
}
