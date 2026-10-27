// Page editor for the user's own pages and for edited copies of built-in pages.
import { useEffect, useRef, useState } from 'react';
import { Screen, Btn, Field, toast } from '../ui/ui';
import { content, saveItem, deleteItem } from '../lib/content';
import { get } from '../lib/db';
import { PAGE_TEMPLATE, renderUser, sectionsToMd } from '../lib/md';
import { Html } from '../tools/Embeds';
import { go } from '../lib/router';
import type { UserItem } from '../types';

export default function Editor({ id, query }: { id: string; query: URLSearchParams }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [item, setItem] = useState<UserItem | null>(null);
  const [preview, setPreview] = useState(false);
  const [ready, setReady] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const overrides = query.get('overrides') ?? undefined;
  const section = query.get('section') ?? undefined;

  useEffect(() => {
    (async () => {
      if (id !== 'new') {
        const v = await get<UserItem>('items', id);
        if (v) {
          setItem(v);
          setTitle(v.title);
          setBody(v.body ?? '');
        }
      } else if (overrides) {
        const c = await content();
        const a = c.articles.find((x) => x.id === overrides);
        if (a) {
          setTitle(a.title);
          setBody(sectionsToMd(a.sections));
        }
      } else {
        setBody(PAGE_TEMPLATE);
      }
      setReady(true);
    })();
  }, [id, overrides]);

  const insert = (s: string) => {
    const el = ta.current;
    if (!el) return setBody(body + s);
    const a = el.selectionStart;
    const b = el.selectionEnd;
    const n = body.slice(0, a) + s + body.slice(b);
    setBody(n);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = a + s.length;
    });
  };

  const save = async () => {
    if (!title.trim()) return toast('Give the page a name first.');
    let sec = item?.section ?? section ?? 'notes';
    if (overrides && !item) {
      const c = await content();
      sec = c.articles.find((x) => x.id === overrides)?.category ?? sec;
    }
    const v = await saveItem({ ...(item ?? {}), section: sec, kind: 'page', title: title.trim(), body, overrides: item?.overrides ?? overrides });
    toast('Saved on this device');
    go(v.overrides ? `/a/${v.overrides}` : `/item/${v.id}`);
  };

  if (!ready) return <Screen title="…">{null}</Screen>;
  return (
    <Screen title={overrides || item?.overrides ? 'Edit page (your copy)' : id === 'new' ? 'New page' : 'Edit page'}
      actions={<Btn kind="go" icon="check" onClick={save}>Save</Btn>}>
      <div className="stack">
        {(overrides || item?.overrides) && <p className="small card card-info">You are editing your own copy. The original stays in the app and "Restore original" brings it back.</p>}
        <Field label="Page name"><input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <div className="btnrow">
          <button className="btn" onClick={() => insert('\n## ')}>Heading</button>
          <button className="btn" onClick={() => insert('\n1. ')}>Step</button>
          <button className="btn" onClick={() => insert('\n- ')}>Bullet</button>
          <button className="btn" onClick={() => insert('**bold**')}>Bold</button>
          <button className="btn" onClick={() => insert('\n::timer 15 Check again\n')}>Timer</button>
          <button className="btn" onClick={() => insert('\n::tool bleach\n')}>Bleach calc</button>
          <button className={`btn ${preview ? 'btn-primary' : ''}`} onClick={() => setPreview(!preview)}>{preview ? 'Edit' : 'Preview'}</button>
        </div>
        {preview ? (
          <div className="card"><Html html={renderUser(body)} /></div>
        ) : (
          <Field label="Text" hint="## starts a section. 1. makes numbered steps, - makes bullets. Sections named When this applies, Do this, Warning signs, Do NOT and What you need get the same boxes as the built-in pages.">
            <textarea ref={ta} value={body} onChange={(e) => setBody(e.target.value)} style={{ minHeight: '50vh', fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 'calc(var(--fs)*.9)' }} />
          </Field>
        )}
        <div className="btnrow">
          <Btn kind="go" icon="check" onClick={save}>Save</Btn>
          {item && <Btn kind="danger" icon="trash" onClick={async () => { if (confirm('Delete this page?')) { await deleteItem(item.id); toast('Deleted'); go(item.overrides ? `/a/${item.overrides}` : `/cat/${item.section}`); } }}>Delete</Btn>}
        </div>
      </div>
    </Screen>
  );
}
