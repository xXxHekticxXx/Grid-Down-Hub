import { ReactNode, useEffect, useState } from 'react';
import data from './generated/content.json';

export const DISCLAIMER = 'This is not a substitute for training. If phones work, call 911 first.';

export type CPage = { id: string; title: string; section: string; medical: boolean; html: string };
export const PAGES = data.pages as CPage[];
export const pagesFor = (section: string) => PAGES.filter((p) => p.section === section);
export const BUILT = (data as { built: string }).built;
export const VERIFIED = '2026-10-26';

export const SECTION_TITLE: Record<string, string> = {
  firstaid: 'First Aid',
  water: 'Water & Food',
  hazards: 'Hazards',
  comms: 'Comms & Local',
  library: 'Library'
};

export function useRoute() {
  const read = () => decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/').filter(Boolean);
  const [parts, setParts] = useState<string[]>(read);
  useEffect(() => {
    const f = () => {
      setParts(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return parts;
}

export const Back = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

export function Page({ title, back = '#/', medical, right, children }: { title: string; back?: string; medical?: boolean; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="wrap">
      <div className="bar">
        <a className="back" href={back} aria-label="Back">
          <Back />
        </a>
        <h1>{title}</h1>
        {right}
      </div>
      {children}
      {medical ? <div className="foot">{DISCLAIMER}</div> : <div className="foot">Grid-Down Hub · content verified {VERIFIED}</div>}
    </div>
  );
}

export function Prose({ html }: { html: string }) {
  return <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function PageList({ items, base = '#/p/' }: { items: { id: string; title: string }[]; base?: string }) {
  return (
    <div className="list">
      {items.map((p) => (
        <a key={p.id} className="item" href={base + p.id}>
          <span className="bar2" />
          <span>{p.title}</span>
          <span className="chev">›</span>
        </a>
      ))}
    </div>
  );
}
