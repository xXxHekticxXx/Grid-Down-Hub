import sv from '../../content/survival.json';
import { Page } from '../ui';

type Ch = { id: string; title: string; ch: string; full: string; warn?: boolean };
const CH = sv.chapters as Ch[];

export function Survival({ chapter }: { chapter?: string }) {
  const c = CH.find((x) => x.id === chapter);
  if (c) {
    return (
      <Page title={c.title} back="#/survival" medical>
        <div className="card">
          <div className="tag">{c.ch} · ATP 3-50.21</div>
          <h2 className="big">{c.full}</h2>
          <p className="bigp">This section is chapter text in the Army survival manual. Open the manual to read it with the original wording and pictures.</p>
          {c.warn ? <div className="notice">{sv.plantWarning}</div> : null}
          <p>
            <a className="btn primary" href="#/library/atp">
              Open the manual
            </a>
          </p>
        </div>
        <div className="muted">
          Source:{' '}
          <a href={sv.sourceUrl} target="_blank" rel="noopener">
            {sv.source}
          </a>
        </div>
      </Page>
    );
  }
  return (
    <Page title="Survival skills" medical>
      <div className="notice">{sv.note}</div>
      <div className="list">
        {CH.map((x) => (
          <a key={x.id} className="item" href={'#/survival/' + x.id}>
            <span>{x.title}</span>
            <span className="chev">{x.ch}</span>
          </a>
        ))}
      </div>
      <a className="btn primary" href="#/library/atp">
        Open the full manual (PDF)
      </a>
      <div className="muted">
        {sv.title}, approved for public release. {sv.plantWarning}
      </div>
    </Page>
  );
}
