// Mounts interactive tools (bleach calculator, timers, CPR beat...) into article HTML.
import { useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ToolById } from './registry';
import { SettingsProvider } from '../lib/settings';

export function Html({ html, className }: { html: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const roots: Root[] = [];
    el.querySelectorAll<HTMLElement>('.tool-embed').forEach((node) => {
      const r = createRoot(node);
      r.render(
        <SettingsProvider>
          <ToolById id={node.dataset.tool!} minutes={Number(node.dataset.minutes || 0)} label={node.dataset.label} embedded />
        </SettingsProvider>,
      );
      roots.push(r);
    });
    return () => {
      const rs = roots.splice(0);
      setTimeout(() => rs.forEach((r) => r.unmount()), 0);
    };
  }, [html]);
  return <div ref={ref} className={className ?? 'prose'} dangerouslySetInnerHTML={{ __html: html }} />;
}
