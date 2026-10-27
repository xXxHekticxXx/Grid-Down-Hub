import { useEffect, useState } from 'react';
import { Screen, Btn, Field, toast, Card } from '../ui/ui';
import { get, subscribe } from '../lib/db';
import { deleteItem, saveItem } from '../lib/content';
import { renderUser } from '../lib/md';
import { Html } from '../tools/Embeds';
import { back, go, href } from '../lib/router';
import type { Pin, UserItem } from '../types';

type FileRec = { id: string; name: string; type: string; blob?: Blob; pages?: string[]; opfs?: string; title?: string; bytes?: number };

export default function ItemPage({ id }: { id: string }) {
  const [it, setIt] = useState<UserItem | null | undefined>();
  const [files, setFiles] = useState<FileRec[]>([]);
  const [pin, setPin] = useState<Pin | undefined>();
  const [title, setTitle] = useState('');
  useEffect(() => {
    const load = async () => {
      const v = await get<UserItem>('items', id);
      setIt(v ?? null);
      setTitle(v?.title ?? '');
      if (v?.fileId) setFiles((await Promise.all(v.fileId.split(',').map((f) => get<FileRec>('files', f)))).filter(Boolean) as FileRec[]);
      if (v?.pinId) setPin(await get<Pin>('pins', v.pinId));
    };
    load();
    return subscribe('items', load);
  }, [id]);
  if (it === undefined) return <Screen title="…">{null}</Screen>;
  if (it === null) return <Screen title="Not found"><p>This item was deleted.</p></Screen>;
  if (it.kind === 'page' || it.kind === 'note') {
    return (
      <Screen title={it.title} crumb="Mine" actions={<Btn to={`/edit/${it.id}`} icon="edit">Edit</Btn>}>
        <Html html={renderUser(it.body ?? '')} />
        <p className="small muted">Last changed {new Date(it.updated).toLocaleString()}</p>
      </Screen>
    );
  }
  if (it.kind === 'checklist' && it.checklistId) {
    go(`/checklist/${it.checklistId}`);
    return null;
  }
  return (
    <Screen title={it.title} crumb="Mine">
      <div className="stack">
        <Field label="Name"><input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title !== it.title && saveItem({ ...it, title })} /></Field>
        {it.kind === 'photo' && files.map((f) => f.blob && (
          <figure key={f.id} className="figure"><img src={URL.createObjectURL(f.blob)} alt={f.name} /><figcaption>{f.name}</figcaption></figure>
        ))}
        {it.kind === 'voice' && files.map((f) => f.blob && <audio key={f.id} controls src={URL.createObjectURL(f.blob)} style={{ width: '100%' }} />)}
        {it.kind === 'pdf' && files.map((f) => (
          <Card key={f.id}>
            <p><b>{f.title ?? f.name}</b> · {f.pages?.length ?? 0} pages{f.pages?.length ? ', searchable' : ''}</p>
            <Btn kind="go" icon="book" to={`/pdf/user:${f.id}`}>Open PDF</Btn>
          </Card>
        ))}
        {it.kind === 'pin' && pin && (
          <Card>
            <p><b>{pin.name}</b><br />{pin.lat.toFixed(5)}, {pin.lon.toFixed(5)}</p>
            <Btn kind="go" icon="map" to={`/map?lon=${pin.lon}&lat=${pin.lat}&z=16&pin=${pin.id}`}>Show on map</Btn>
          </Card>
        )}
        <Field label="Note"><textarea defaultValue={it.body ?? ''} onBlur={(e) => saveItem({ ...it, body: e.target.value })} /></Field>
        <Btn kind="danger" icon="trash" onClick={async () => { if (confirm(`Delete "${it.title}"?`)) { await deleteItem(it.id); toast('Deleted'); back(); } }}>Delete</Btn>
        <p className="small"><a href={href(`/cat/${it.section}`)}>Back to section</a></p>
      </div>
    </Screen>
  );
}
