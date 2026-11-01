// Screens for offline directions: the route choice panel, the driving banner and bottom bar, and the
// "block this road" confirmation. State lives in MapPage.
import type { Route, Mode, Step } from '../lib/routing';
import { arrowFor, arrival, fmtDuration, type BlockedRoad } from '../lib/nav';
import { fmtDistance } from '../lib/geo';
import { Btn } from '../ui/ui';
import { Icon } from '../ui/icons';
import { href } from '../lib/router';

export function RoutePanel(props: {
  dest: string; mode: Mode; setMode: (m: Mode) => void; routes: Route[] | null; busy: string; sel: number; setSel: (i: number) => void;
  metric: boolean; fromGps: boolean; blocked: BlockedRoad[]; onStart: () => void; onBlock: () => void; onClearBlocked: () => void; onClose: () => void; missing: boolean;
}) {
  const { routes, sel } = props;
  return (
    <div className="stack" data-testid="route-panel">
      <b style={{ fontSize: 'calc(var(--fs)*1.25)', fontFamily: 'var(--head)' }}>To {props.dest}</b>
      <div className="seg" role="group" aria-label="Travel mode">
        <button aria-pressed={props.mode === 'drive'} onClick={() => props.setMode('drive')} data-testid="mode-drive"><Icon name="truck" size={20} /> Drive</button>
        <button aria-pressed={props.mode === 'walk'} onClick={() => props.setMode('walk')} data-testid="mode-walk">Walk</button>
      </div>
      {props.missing && (
        <div className="card card-warn">Directions need the Florida road data on this device. <a href={href('/setup')}>Download it in Setup</a> (about 240 MB, on Wi-Fi).</div>
      )}
      {props.busy && <p className="small" role="status">{props.busy}</p>}
      {routes && routes.length === 0 && !props.busy && <p>No road route found. Try Walk, or check blocked roads below.</p>}
      {routes && routes.map((r, i) => (
        <button key={i} className={`row${i === sel ? ' row-mine' : ''}`} aria-pressed={i === sel} onClick={() => props.setSel(i)} data-testid={`route-${i}`}>
          <span className="row-main">
            <span className="row-title"><b>{fmtDuration(r.durationS)}</b> · {fmtDistance(r.distanceM, props.metric)}{r.via.length ? ` via ${r.via.join(', ')}` : ''}</span>
            <span className="row-sub">{i === 0 ? 'Fastest' : 'Alternate'} · arrive about {arrival(r.durationS)}</span>
          </span>
        </button>
      ))}
      {!props.fromGps && <p className="small muted">No GPS fix yet, so this starts from the middle of the map.</p>}
      <p className="small muted">Offline route on the October 2026 road map. No live traffic or closures: mark blocked roads yourself.</p>
      {props.blocked.length > 0 && (
        <div className="card card-warn small">
          <b>Blocked roads ({props.blocked.length}):</b> {props.blocked.map((b) => b.name || 'unnamed road').join(', ')}{' '}
          <button className="btn" onClick={props.onClearBlocked}>Clear all</button>
        </div>
      )}
      <div className="btnrow">
        <Btn icon="x" onClick={props.onBlock}>Avoid a road</Btn>
        <Btn kind="go" icon="play" disabled={!routes || !routes.length} onClick={props.onStart}>Start</Btn>
      </div>
      <Btn onClick={props.onClose}>Close</Btn>
    </div>
  );
}

export function NavBanner({ step, distM, then, metric }: { step: Step | undefined; distM: number; then?: Step; metric: boolean }) {
  return (
    <div className="nav-banner" role="status" aria-live="polite" data-testid="nav-banner">
      <div className="nav-turn">
        <span className="nav-arrow" aria-hidden="true">{arrowFor(step)}</span>
        <span>
          <b className="nav-dist">{fmtDistance(distM, metric)}</b>
          <span className="nav-text">{step?.text ?? 'Continue'}</span>
        </span>
      </div>
      {then && <div className="nav-then">Then {arrowFor(then)} {then.text.replace(/^Turn /, '').replace(/^Continue /, 'continue ')}</div>}
    </div>
  );
}

export function NavBottom({ remainS, remainM, metric, speedMs, overview, onOverview, onEnd }: { remainS: number; remainM: number; metric: boolean; speedMs: number | null; overview: boolean; onOverview: () => void; onEnd: () => void }) {
  return (
    <nav className="dock nav-dock" aria-label="Navigation">
      <div className="nav-eta">
        <b data-testid="nav-eta">{fmtDuration(remainS)}</b>
        <span>{fmtDistance(remainM, metric)} · arrive {arrival(remainS)}{speedMs != null && speedMs > 0.5 ? ` · ${metric ? Math.round(speedMs * 3.6) + ' km/h' : Math.round(speedMs * 2.23694) + ' mph'}` : ''}</span>
      </div>
      <div className="nav-dock-btns">
        <button className="btn" onClick={onOverview}>{overview ? 'Resume' : 'Overview'}</button>
        <button className="btn btn-danger" onClick={onEnd} data-testid="nav-end"><Icon name="x" size={22} /> End</button>
      </div>
    </nav>
  );
}

export function BlockConfirm({ name, onCancel, onBlock }: { name: string; onCancel: () => void; onBlock: () => void }) {
  return (
    <div className="stack" data-testid="block-panel">
      <b style={{ fontSize: 'calc(var(--fs)*1.25)' }}>Avoid this road?</b>
      <p>{name || 'Unnamed road'}, from crossroad to crossroad (shown in red).</p>
      <p className="small muted">Flooded, tree down, closed: it stays blocked until you clear it, and every route goes around it.</p>
      <div className="btnrow">
        <Btn onClick={onCancel}>Cancel</Btn>
        <Btn kind="danger" icon="x" onClick={onBlock}>Block &amp; re-route</Btn>
      </div>
    </div>
  );
}
