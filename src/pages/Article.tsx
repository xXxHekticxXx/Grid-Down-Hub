import { useEffect, useState } from 'react';
import { Screen, MedicalFooter, Btn, Row, SectionTitle, Card } from '../ui/ui';
import { content, overrideFor, userItems, deleteItem, type Content } from '../lib/content';
import { Html } from '../tools/Embeds';
import { sectionsFrom } from '../lib/md';
import { subscribe } from '../lib/db';
import { go, href } from '../lib/router';
import type { Article, ArticleSection, UserItem } from '../types';
import { AddSheet } from './AddSheet';

const TONE: Record<string, 'warn' | 'danger' | undefined> = { escalate: 'warn', dont: 'danger' };

export function ArticleBody({ sections }: { sections: ArticleSection[] }) {
  return (
    <div className="stack">
      {sections.map((s, i) =>
        s.title ? (
          <Card key={i} tone={TONE[s.key]} title={s.title}>
            <Html html={s.html} />
          </Card>
        ) : (
          <Html key={i} html={s.html} />
        ),
      )}
    </div>
  );
}

export default function ArticlePage({ id }: { id: string }) {
  const [c, setC] = useState<Content | null>(null);
  const [ov, setOv] = useState<UserItem | undefined>();
  const [notes, setNotes] = useState<UserItem[]>([]);
  const [showOriginal, setShowOriginal] = useState(false);
  const [adding, setAdding] = useState(false);
  useEffect(() => {
    content().then(setC);
  }, []);
  useEffect(() => {
    const load = () => {
      overrideFor(id).then(setOv);
      userItems(id).then(setNotes);
    };
    load();
    return subscribe('items', load);
  }, [id]);
  if (!c) return <Screen title="…">{null}</Screen>;
  const a: Article | undefined = c.articles.find((x) => x.id === id);
  if (!a) return <Screen title="Not found"><p>That page isn't in this version of the app.</p><Btn to="/">Home</Btn></Screen>;
  const cat = c.categories.find((x) => x.id === a.category);
  const sections = ov && !showOriginal ? sectionsFrom(ov.body ?? '') : a.sections;
  return (
    <Screen title={a.title} crumb={cat?.title} tone={a.emergency ? 'red' : undefined}
      actions={<button className="btn" onClick={() => go(ov ? `/edit/${ov.id}` : `/edit/new?overrides=${a.id}`)}>Edit</button>}>
      {a.plant && (
        <div className="article-meta">
          <i>{a.plant.scientific}</i>{' '}
          <span className={`badge ${a.plant.edible === 'toxic' ? 'red' : a.plant.edible === 'no' ? 'warn' : ''}`}>
            {a.plant.edible === 'yes' ? 'Edible' : a.plant.edible === 'parts' ? 'Some parts edible' : a.plant.edible === 'toxic' ? 'POISONOUS' : 'Not for eating'}
          </span>{' '}
          {a.plant.evidence && a.plant.evidence !== 'none' && <span className="badge warn">Evidence: {EVIDENCE[a.plant.evidence]}</span>}
          {a.plant.season && <span> · {a.plant.season}</span>}
        </div>
      )}
      {a.plant?.figure && (
        <figure className="figure plant-figure"><img src={import.meta.env.BASE_URL + a.plant.figure} alt={`Drawing of ${a.title}`} loading="lazy" /><figcaption>Illustration from ATP 3-50.21 (U.S. Army, public release).</figcaption></figure>
      )}
      {a.summary && !a.plant && <p className="muted" style={{ marginTop: 0 }}>{a.summary}</p>}
      {ov && (
        <div className="card card-ok" style={{ marginBottom: 12 }}>
          <b>{showOriginal ? 'Showing the original page.' : 'This page has your edits.'}</b>{' '}
          <button className="btn" style={{ minHeight: 48 }} onClick={() => setShowOriginal(!showOriginal)}>{showOriginal ? 'Show my version' : 'Show original'}</button>{' '}
          <button className="btn" style={{ minHeight: 48 }} onClick={async () => { if (confirm('Delete your edits and go back to the original page?')) await deleteItem(ov.id); }}>Restore original</button>
        </div>
      )}
      <ArticleBody sections={sections} />
      {notes.filter((n) => !n.overrides).length > 0 && <SectionTitle>Your notes on this page</SectionTitle>}
      <div className="list">
        {notes.filter((n) => !n.overrides).map((n) => <Row key={n.id} tone="mine" to={`/item/${n.id}`} title={n.title} sub="Mine" />)}
      </div>
      <div className="btnrow" style={{ marginTop: 12 }}>
        <Btn icon="plus" onClick={() => setAdding(true)}>Add note, photo or file</Btn>
      </div>
      {a.sources.length > 0 && (
        <>
          <SectionTitle>Sources</SectionTitle>
          <ul className="sources">
            {a.sources.map((s, i) => (
              <li key={i}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> · checked {s.checked}</li>
            ))}
          </ul>
        </>
      )}
      {a.medical && <MedicalFooter />}
      <p className="small"><a href={href(`/cat/${a.category}`)}>More in {cat?.title}</a></p>
      <AddSheet open={adding} onClose={() => setAdding(false)} section={a.id} sectionTitle={a.title} />
    </Screen>
  );
}

const EVIDENCE: Record<string, string> = {
  traditional: 'traditional use, little clinical proof',
  limited: 'limited studies',
  moderate: 'some clinical evidence',
  strong: 'good clinical evidence',
};
