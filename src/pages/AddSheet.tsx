// "Add to this section": the user's own pages, photos, PDFs, checklists, map pins, voice notes and sections.
import { useEffect, useRef, useState } from 'react';
import { Sheet, Btn, Field, toast } from '../ui/ui';
import { go } from '../lib/router';
import { addUserSection, content, saveItem, checklists as allChecklists, saveChecklist } from '../lib/content';
import { put, uid, all } from '../lib/db';
import { writeFile } from '../lib/opfs';
import { pdfText } from '../lib/pdf';
import type { Checklist, Pin } from '../types';

type Mode = 'menu' | 'section' | 'checklist' | 'pin' | 'voice' | 'edit-builtin' | 'busy';

export function AddSheet({ open, onClose, section, sectionTitle }: { open: boolean; onClose: () => void; section: string; sectionTitle: string }) {
  const [mode, setMode] = useState<Mode>('menu');
  const [busy, setBusy] = useState('');
  const photoIn = useRef<HTMLInputElement>(null);
  const pdfIn = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) setMode('menu');
  }, [open]);

  const onPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setMode('busy');
    setBusy('Saving photos…');
    const ids: string[] = [];
    for (const f of Array.from(files)) {
      const id = uid();
      await put('files', id, { id, name: f.name, type: f.type, blob: f, created: Date.now() });
      ids.push(id);
    }
    const it = await saveItem({ section, kind: 'photo', title: files.length === 1 ? files[0].name.replace(/\.[^.]+$/, '') : `${files.length} photos`, body: '', fileId: ids.join(',') });
    onClose();
    go(`/item/${it.id}`);
  };

  const onPdf = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setMode('busy');
    setBusy('Saving the PDF and reading its text for search…');
    const id = uid();
    const buf = await f.arrayBuffer();
    await writeFile(`user/${id}.pdf`, buf);
    let pages: string[] = [];
    try {
      pages = await pdfText(buf, (p) => setBusy(`Reading text for search… ${Math.round(p * 100)}%`));
    } catch {
      pages = [];
    }
    await put('files', id, { id, name: f.name, type: 'application/pdf', title: f.name.replace(/\.pdf$/i, ''), bytes: f.size, pages, opfs: `user/${id}.pdf`, created: Date.now() });
    const it = await saveItem({ section, kind: 'pdf', title: f.name.replace(/\.pdf$/i, ''), fileId: id });
    toast(`Saved "${it.title}" (${pages.length} pages searchable)`);
    onClose();
    go(`/item/${it.id}`);
  };

  return (
    <Sheet open={open} onClose={onClose} title={`Add to ${sectionTitle}`}>
      {mode === 'menu' && (
        <>
          <div className="grid2">
            <Btn icon="edit" onClick={() => { onClose(); go(`/edit/new?section=${encodeURIComponent(section)}`); }}>Write a page</Btn>
            <Btn icon="camera" onClick={() => photoIn.current?.click()}>Photos</Btn>
            <Btn icon="file" onClick={() => pdfIn.current?.click()}>PDF or document</Btn>
            <Btn icon="list" onClick={() => setMode('checklist')}>Checklist</Btn>
            <Btn icon="pin" onClick={() => setMode('pin')}>Map pin</Btn>
            <Btn icon="mic" onClick={() => setMode('voice')}>Voice note</Btn>
          </div>
          <div className="grid2">
            <Btn kind="ghost" icon="plus" onClick={() => setMode('section')}>New section</Btn>
            <Btn kind="ghost" icon="edit" onClick={() => setMode('edit-builtin')}>Edit a built-in page</Btn>
          </div>
          <p className="small muted">Everything you add stays on this device, is searchable offline, and goes into your encrypted backup.</p>
          <input ref={photoIn} type="file" accept="image/*" multiple hidden onChange={(e) => onPhotos(e.target.files)} />
          <input ref={pdfIn} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => onPdf(e.target.files)} />
        </>
      )}
      {mode === 'busy' && <p>{busy}</p>}
      {mode === 'section' && <NewSection parent={section} onDone={(id) => { onClose(); go(`/cat/${id}`); }} />}
      {mode === 'checklist' && <NewChecklist section={section} onDone={(id) => { onClose(); go(`/checklist/${id}/edit`); }} />}
      {mode === 'pin' && <PickPin section={section} onDone={onClose} />}
      {mode === 'voice' && <VoiceNote section={section} onDone={(id) => { onClose(); go(`/item/${id}`); }} />}
      {mode === 'edit-builtin' && <PickBuiltin section={section} onPick={(aid) => { onClose(); go(`/edit/new?overrides=${aid}`); }} />}
    </Sheet>
  );
}

function NewSection({ parent, onDone }: { parent: string; onDone: (id: string) => void }) {
  const [t, setT] = useState('');
  const [b, setB] = useState('');
  return (
    <form className="stack" onSubmit={async (e) => { e.preventDefault(); if (!t.trim()) return; const s = await addUserSection(t.trim(), b.trim(), parent); onDone(s.id); }}>
      <Field label="Section name"><input value={t} onChange={(e) => setT(e.target.value)} /></Field>
      <Field label="What goes in it (optional)"><input value={b} onChange={(e) => setB(e.target.value)} /></Field>
      <Btn type="submit" kind="go" icon="check">Create section</Btn>
    </form>
  );
}

function NewChecklist({ section, onDone }: { section: string; onDone: (id: string) => void }) {
  const [t, setT] = useState('');
  const [from, setFrom] = useState('');
  const [lists, setLists] = useState<Checklist[]>([]);
  useEffect(() => {
    allChecklists().then(setLists);
  }, []);
  return (
    <form className="stack" onSubmit={async (e) => {
      e.preventDefault();
      const src = lists.find((l) => l.id === from);
      const id = 'my-' + uid();
      const c: Checklist = src
        ? { ...structuredClone(src), id, title: t.trim() || `${src.title} (my copy)`, builtin: false }
        : { id, title: t.trim() || 'My checklist', sections: [{ title: 'Items', items: [] }] };
      await saveChecklist(c);
      await saveItem({ section, kind: 'checklist', title: c.title, checklistId: id });
      onDone(id);
    }}>
      <Field label="Checklist name"><input value={t} onChange={(e) => setT(e.target.value)} /></Field>
      <Field label="Start from">
        <select value={from} onChange={(e) => setFrom(e.target.value)}>
          <option value="">Blank</option>
          {lists.map((l) => <option key={l.id} value={l.id}>Copy of {l.title}</option>)}
        </select>
      </Field>
      <Btn type="submit" kind="go" icon="check">Create and edit</Btn>
    </form>
  );
}

function PickPin({ section, onDone }: { section: string; onDone: () => void }) {
  const [pins, setPins] = useState<Pin[]>([]);
  useEffect(() => {
    all<Pin>('pins').then(setPins);
  }, []);
  return (
    <div className="stack">
      <Btn kind="go" icon="map" onClick={() => { onDone(); go(`/map?drop=${encodeURIComponent(section)}`); }}>Drop a new pin on the map</Btn>
      {pins.length > 0 && <p className="small muted">Or link a pin you already have:</p>}
      <div className="list">
        {pins.map((p) => (
          <button key={p.id} className="row" onClick={async () => { await saveItem({ section, kind: 'pin', title: p.name, pinId: p.id }); toast(`Linked "${p.name}"`); onDone(); }}>
            <span className="row-main"><span className="row-title">{p.name}</span><span className="row-sub">{p.lat.toFixed(5)}, {p.lon.toFixed(5)}</span></span>
          </button>
        ))}
      </div>
    </div>
  );
}

function VoiceNote({ section, onDone }: { section: string; onDone: (id: string) => void }) {
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [secs, setSecs] = useState(0);
  const [err, setErr] = useState('');
  const [title, setTitle] = useState('');
  const chunks = useRef<Blob[]>([]);
  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [rec]);
  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: r.mimeType || 'audio/webm' });
        const id = uid();
        await put('files', id, { id, name: 'voice-note', type: blob.type, blob, created: Date.now() });
        const it = await saveItem({ section, kind: 'voice', title: title.trim() || `Voice note ${new Date().toLocaleString()}`, fileId: id });
        onDone(it.id);
      };
      r.start();
      setSecs(0);
      setRec(r);
    } catch {
      setErr('The microphone is not available. Allow microphone access for this app and try again.');
    }
  };
  return (
    <div className="stack">
      <Field label="Name (optional)"><input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      {rec ? (
        <Btn kind="danger" icon="stop" onClick={() => { rec.stop(); setRec(null); }}>Stop and save ({secs}s)</Btn>
      ) : (
        <Btn kind="go" icon="mic" onClick={start}>Start recording</Btn>
      )}
      {err && <p className="small">{err}</p>}
    </div>
  );
}

function PickBuiltin({ section, onPick }: { section: string; onPick: (id: string) => void }) {
  const [list, setList] = useState<{ id: string; title: string }[]>([]);
  useEffect(() => {
    content().then((c) => setList(c.articles.filter((a) => a.category === section || section.startsWith('u-')).map((a) => ({ id: a.id, title: a.title }))));
  }, [section]);
  return (
    <div className="list">
      {list.map((a) => (
        <button key={a.id} className="row" onClick={() => onPick(a.id)}><span className="row-main"><span className="row-title">{a.title}</span></span></button>
      ))}
    </div>
  );
}
