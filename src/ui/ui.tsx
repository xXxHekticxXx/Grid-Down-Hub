import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './icons';
import { back, href } from '../lib/router';

export function Screen({ title, children, actions, tone, crumb, noBack }: { title: string; children: ReactNode; actions?: ReactNode; tone?: 'red' | 'green'; crumb?: string; noBack?: boolean }) {
  useEffect(() => {
    document.title = `${title} · Grid-Down Hub`;
  }, [title]);
  return (
    <div className="screen">
      <header className={`bar ${tone ? 'bar-' + tone : ''}`}>
        {!noBack && (
          <button className="icon-btn" onClick={back} aria-label="Back">
            <Icon name="back" size={28} />
          </button>
        )}
        <div className="bar-title">
          {crumb && <div className="crumb">{crumb}</div>}
          <h1>{title}</h1>
        </div>
        <div className="bar-actions">{actions}</div>
      </header>
      <main className="content">{children}</main>
    </div>
  );
}

export function Tile({ to, icon, title, sub, onClick }: { to?: string; icon: string; title: string; sub?: string; onClick?: () => void }) {
  const inner = (
    <>
      <Icon name={icon} size={30} />
      <span className="tile-title">{title}</span>
      {sub && <span className="tile-sub">{sub}</span>}
    </>
  );
  return to ? (
    <a className="tile" href={href(to)}>
      {inner}
    </a>
  ) : (
    <button className="tile" onClick={onClick}>
      {inner}
    </button>
  );
}

export function Row({ to, title, sub, right, onClick, tone }: { to?: string; title: ReactNode; sub?: ReactNode; right?: ReactNode; onClick?: () => void; tone?: 'mine' | 'warn' }) {
  const body = (
    <>
      <span className="row-main">
        <span className="row-title">{title}</span>
        {sub && <span className="row-sub">{sub}</span>}
      </span>
      {right ?? <span className="row-chev" aria-hidden="true">›</span>}
    </>
  );
  const cls = `row ${tone ? 'row-' + tone : ''}`;
  if (to) return <a className={cls} href={href(to)}>{body}</a>;
  if (onClick) return <button className={cls} onClick={onClick}>{body}</button>;
  return <div className={cls}>{body}</div>;
}

export function Btn({ children, onClick, kind = 'plain', icon, disabled, to, type, full }: { children: ReactNode; onClick?: () => void; kind?: 'plain' | 'primary' | 'danger' | 'go' | 'ghost'; icon?: string; disabled?: boolean; to?: string; type?: 'submit' | 'button'; full?: boolean }) {
  const cls = `btn btn-${kind}${full ? ' btn-full' : ''}`;
  const inner = (
    <>
      {icon && <Icon name={icon} size={22} />}
      <span>{children}</span>
    </>
  );
  if (to) return <a className={cls} href={href(to)}>{inner}</a>;
  return (
    <button className={cls} onClick={onClick} disabled={disabled} type={type ?? 'button'}>
      {inner}
    </button>
  );
}

export function Card({ children, tone, title }: { children: ReactNode; tone?: 'warn' | 'danger' | 'ok' | 'info'; title?: string }) {
  return (
    <section className={`card ${tone ? 'card-' + tone : ''}`}>
      {title && <h2 className="card-title">{title}</h2>}
      {children}
    </section>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    ref.current?.querySelector<HTMLElement>('input,button,textarea,select')?.focus();
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Toggle({ label, checked, onChange, sub }: { label: string; checked: boolean; onChange: (v: boolean) => void; sub?: string }) {
  return (
    <label className="toggle">
      <span>
        <span className="toggle-label">{label}</span>
        {sub && <span className="toggle-sub">{sub}</span>}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="section-title">{children}</h2>;
}

export const MEDICAL_FOOTER = 'Not a substitute for training. If phones work, call 911 first.';

export function MedicalFooter() {
  return <p className="medical-footer">{MEDICAL_FOOTER}</p>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

export function toast(msg: string) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 400);
  }, 3200);
}

export async function confirmBox(msg: string): Promise<boolean> {
  return window.confirm(msg);
}
