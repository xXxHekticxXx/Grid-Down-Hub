import { useEffect, useState } from 'react';
import { Screen, Row, MedicalFooter } from '../ui/ui';
import { Icon } from '../ui/icons';
import { CprCard } from '../tools/Cpr';
import { content, type Content } from '../lib/content';
import { href } from '../lib/router';

export default function Emergency() {
  const [c, setC] = useState<Content | null>(null);
  useEffect(() => {
    content().then(setC);
  }, []);
  const list = c ? c.articles.filter((a) => a.emergency).sort((x, y) => (x.emergency ?? 99) - (y.emergency ?? 99)) : [];
  return (
    <Screen title="EMERGENCY" tone="red">
      <div className="stack">
        <div className="alert-strip">If phones work, call 911 first. Put it on speaker so your hands are free.</div>
        <CprCard />
        <div className="grid2">
          {list.map((a) => (
            <a key={a.id} className="row" href={href(`/a/${a.id}`)} style={{ minHeight: 68 }}>
              <span className="row-main"><span className="row-title">{a.title}</span></span>
            </a>
          ))}
        </div>
        <div className="grid2">
          <a className="btn btn-primary" href={href('/tool/sos')}><Icon name="flash" /> SOS light + whistle</a>
          <a className="btn btn-primary" href={href('/tool/timers?preset=tourniquet')}><Icon name="timer" /> Tourniquet timer</a>
          <a className="btn" href={href('/map?layer=hospital')}><Icon name="map" /> Nearest hospital</a>
          <a className="btn" href={href('/plan/medical')}><Icon name="lock" /> My medical info</a>
        </div>
        <Row to="/cat/first-aid" title="All first aid" sub="Every first aid page, A to Z" />
        <p className="small"><b>Poison Control</b> <a href="tel:18002221222">1-800-222-1222</a> · <b>Waterman ER</b> <a href="tel:3522533333">352-253-3333</a></p>
        <MedicalFooter />
      </div>
    </Screen>
  );
}
