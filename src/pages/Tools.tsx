import { useEffect, useState } from 'react';
import { Screen, Row, SectionTitle } from '../ui/ui';
import { TOOLS, ToolById } from '../tools/registry';
import { content, type Content } from '../lib/content';

export default function Tools({ id, query }: { id?: string; query?: URLSearchParams }) {
  const [c, setC] = useState<Content | null>(null);
  useEffect(() => {
    content().then(setC);
  }, []);
  if (id) {
    const t = TOOLS.find((x) => x.id === id);
    return (
      <Screen title={t?.title ?? 'Tool'} crumb="Tools & Radio" tone={id === 'cpr' ? 'red' : undefined}>
        <ToolById id={id} preset={query?.get('preset')} />
      </Screen>
    );
  }
  const radio = c?.articles.filter((a) => a.category === 'comms-nav') ?? [];
  return (
    <Screen title="Tools & Radio">
      <div className="list">
        {TOOLS.map((t) => <Row key={t.id} to={`/tool/${t.id}`} title={t.title} sub={t.sub} />)}
        <Row to="/checklists" title="Checklists" sub="Ready.gov kit, hurricane, go-bag, dog, your own" />
        <Row to="/inventory" title="Inventory" sub="What you have, how much, when it expires" />
      </div>
      <SectionTitle>Radio &amp; navigation guides</SectionTitle>
      <div className="list">
        {radio.map((a) => <Row key={a.id} to={`/a/${a.id}`} title={a.title} sub={a.summary} />)}
        <Row to="/cat/comms-nav" title="All radio & navigation pages" />
      </div>
    </Screen>
  );
}
