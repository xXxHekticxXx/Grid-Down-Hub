import { useMemo, useState } from 'react';
import MiniSearch from 'minisearch';
import data from '../generated/content.json';
import { BUILT, Page, PageList, PAGES, pagesFor, Prose, SECTION_TITLE, VERIFIED } from '../ui';

export function SectionPage({ section }: { section: string }) {
  const items = pagesFor(section);
  return (
    <Page title={SECTION_TITLE[section] || section} medical={section !== 'comms'}>
      {section === 'firstaid' ? (
        <a className="btn red" href="#/emergency/cpr/1">
          Open emergency step cards
        </a>
      ) : null}
      <PageList items={items} />
    </Page>
  );
}

export function PageView({ id }: { id: string }) {
  const p = PAGES.find((x) => x.id === id);
  const back = p ? (p.section === 'library' ? '#/library' : '#/' + p.section) : '#/';
  if (!p) return <Page title="Not found">That page does not exist.</Page>;
  return (
    <Page title={p.title} back={back} medical={p.medical}>
      <div className="card">
        <Prose html={p.html} />
      </div>
      {p.id.includes('bleach') ? (
        <a className="btn primary" href="#/water">
          Open the bleach calculator
        </a>
      ) : null}
      {p.id.startsWith('supply-kit') ? (
        <a className="btn primary" href="#/plan/kit">
          Open the tappable kit checklist
        </a>
      ) : null}
    </Page>
  );
}

let engine: MiniSearch | null = null;
function getEngine() {
  if (!engine) {
    engine = MiniSearch.loadJS((data as unknown as { index: never }).index, {
      fields: ['title', 'text'],
      storeFields: ['title', 'section', 'url'],
      idField: 'id'
    });
  }
  return engine;
}

export function SearchPage({ q }: { q: string }) {
  const [text, setText] = useState(q);
  const results = useMemo(() => {
    if (!text.trim()) return [];
    return getEngine().search(text, { prefix: true, fuzzy: 0.2, boost: { title: 3 } }).slice(0, 25);
  }, [text]);
  return (
    <Page title="Search">
      <input className="search" type="search" autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Try: snake, bleach, tourniquet" aria-label="Search" />
      <div className="list">
        {results.map((r) => (
          <a key={r.id} className="item" href={r.url as string}>
            <span className="bar2" />
            <span>
              {r.title as string}
              <div className="muted">{(SECTION_TITLE[r.section as string] || (r.section as string)).toString()}</div>
            </span>
            <span className="chev">›</span>
          </a>
        ))}
        {text.trim() && !results.length ? <div className="card">Nothing found. Try one word, like "water" or "burn".</div> : null}
      </div>
    </Page>
  );
}

export function About() {
  return (
    <Page title="About" back="#/settings">
      <div className="card prose">
        <p>
          <b>Content verified: {VERIFIED}.</b> App built {BUILT}. Medical guidance changes (for example, the American Heart Association updated choking guidance in October 2025), so check for updates in Settings now and then.
        </p>
        <p>Sources: American Heart Association, American Red Cross, Stop the Bleed, CDC, NWS/NOAA, FEMA/Ready.gov, FCC, Florida Poison Control, UF/IFAS, Lake County Emergency Management, Army ATP 3-50.21. Each page shows its own source link.</p>
        <p>Map data © OpenStreetMap contributors.</p>
        <p>
          <b>{`This is not a substitute for training. If phones work, call 911 first.`}</b>
        </p>
        <p>Your plan and pins stay on this device. Nothing is uploaded.</p>
      </div>
    </Page>
  );
}
