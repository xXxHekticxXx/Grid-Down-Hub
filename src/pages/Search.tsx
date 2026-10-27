import { useEffect, useState } from 'react';
import { Screen, Empty } from '../ui/ui';
import { search, type Hit, KIND_LABEL } from '../lib/search';
import { go, href } from '../lib/router';
import { Icon } from '../ui/icons';

const TYPE_LABEL: Record<string, string> = { article: 'Guide', book: 'Manual', pdf: 'PDF', checklist: 'Checklist', place: 'Map place', mine: 'Mine', pin: 'My pin' };

export function hitHref(h: Hit) {
  switch (h.type) {
    case 'article': return `/a/${h.ref}`;
    case 'book': {
      const [book, ch, blk] = h.ref.split('/');
      return `/book/${book}/${ch}?b=${blk}`;
    }
    case 'pdf': {
      const [doc, page] = h.ref.split('/');
      return `/pdf/${doc}?page=${page}`;
    }
    case 'checklist': return `/checklist/${h.ref}`;
    case 'place': case 'pin': {
      const [lon, lat, k] = h.ref.split(',');
      return `/map?lon=${lon}&lat=${lat}&z=16&mark=${encodeURIComponent(h.title)}&layer=${k}`;
    }
    case 'mine': return `/item/${h.ref}`;
    default: return '/';
  }
}

export default function SearchPage({ q }: { q: string }) {
  const [text, setText] = useState(q);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [filter, setFilter] = useState('all');
  useEffect(() => {
    setText(q);
    if (!q) return setHits([]);
    setHits(null);
    search(q, 120).then(setHits);
  }, [q]);
  const shown = (hits ?? []).filter((h) => filter === 'all' || h.type === filter || (filter === 'library' && (h.type === 'book' || h.type === 'pdf')));
  const types = ['all', 'article', 'library', 'place', 'checklist', 'mine'];
  return (
    <Screen title="Search">
      <form className="searchbox" role="search" onSubmit={(e) => { e.preventDefault(); go(`/search?q=${encodeURIComponent(text.trim())}`); }}>
        <Icon name="search" />
        <input type="search" aria-label="Search everything" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        <button className="btn btn-primary" type="submit" style={{ minHeight: 40 }}>Search</button>
      </form>
      <div className="btnrow" style={{ margin: '10px 0' }}>
        {types.map((t) => (
          <button key={t} className={`btn ${filter === t ? 'btn-primary' : ''}`} onClick={() => setFilter(t)} style={{ minHeight: 44, flex: '0 1 auto' }}>
            {t === 'all' ? 'All' : t === 'library' ? 'Library' : TYPE_LABEL[t]}
          </button>
        ))}
      </div>
      {hits === null && <p className="muted">Searching…</p>}
      {hits && q && shown.length === 0 && <Empty>Nothing found for "{q}". Try fewer or different words.</Empty>}
      <ol className="list" style={{ listStyle: 'none', padding: 0, margin: 0 }} data-testid="results">
        {shown.map((h) => (
          <li key={h.id}>
            <a className="row" href={href(hitHref(h))}>
              <span className="row-main">
                <span className="row-title">{h.title}</span>
                <span className="row-sub">
                  <span className="badge" style={{ marginRight: 6 }}>{h.type === 'place' ? KIND_LABEL[h.cat] ?? 'Place' : TYPE_LABEL[h.type] ?? h.type}</span>
                  {h.snippet}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ol>
    </Screen>
  );
}
