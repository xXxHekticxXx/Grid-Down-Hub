import { useEffect, useRef, useState } from 'react';
import { Screen, Btn, Field, Sheet, toast, SectionTitle, Empty, Toggle } from '../ui/ui';
import { all, put, del, uid, subscribe } from '../lib/db';
import { loadManifest, packState, type Pack, type PackState } from '../lib/packs';
import { fmtBytes, writeFile, remove } from '../lib/opfs';
import { parseGpx, parseKml, parseGeoJson, toGpx } from '../lib/geoformats';
import { saveFile } from '../lib/native';
import { go } from '../lib/router';
import { pmtilesFromFile } from '../map/engine';
import type { Track, UserMap } from './MapPage';
import type { Pin } from '../types';
import { pathLength, fmtDistance } from '../lib/geo';

const COLORS = ['#C2410C', '#1F5C36', '#1D4E89', '#6B4B9A', '#B3141C', '#8A5A00'];

export default function MapsManager() {
  const [packs, setPacks] = useState<{ p: Pack; st: PackState }[]>([]);
  const [maps, setMaps] = useState<UserMap[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [edit, setEdit] = useState<UserMap | null>(null);
  const [photo, setPhoto] = useState<{ id: string; url: string; w: number; h: number; file: string } | null>(null);
  const fileIn = useRef<HTMLInputElement>(null);
  const photoIn = useRef<HTMLInputElement>(null);
  useEffect(() => {
    loadManifest().then(async (m) => {
      if (!m) return;
      setPacks(await Promise.all(m.packs.filter((p) => p.id.startsWith('maps') || p.id.startsWith('topo-overlay')).map(async (p) => ({ p, st: await packState(p.id) }))));
    });
    const lm = () => all<UserMap>('usermaps').then(setMaps);
    const lt = () => all<Track>('tracks').then(setTracks);
    lm();
    lt();
    const a = subscribe('usermaps', lm);
    const b = subscribe('tracks', lt);
    return () => {
      a();
      b();
    };
  }, []);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const ext = f.name.toLowerCase().split('.').pop();
    const id = uid();
    const base: UserMap = { id, name: f.name.replace(/\.[^.]+$/, ''), kind: 'geojson', visible: true, color: COLORS[maps.length % COLORS.length], created: Date.now() };
    try {
      if (ext === 'gpx') base.data = parseGpx(await f.text());
      else if (ext === 'kml') base.data = parseKml(await f.text());
      else if (ext === 'geojson' || ext === 'json') base.data = parseGeoJson(await f.text());
      else if (ext === 'pmtiles') {
        toast('Copying the map pack into app storage…');
        await writeFile(`usermaps/${id}.pmtiles`, f);
        base.kind = 'pmtiles';
        base.file = `usermaps/${id}.pmtiles`;
        const { header } = await pmtilesFromFile(id, f);
        if (header.tileType === 1) toast('This is a vector map pack. It is stored and listed; the map shows raster (picture) packs.');
      } else if (ext === 'mbtiles') {
        throw new Error('MBTiles files need converting to PMTiles first (on a computer: "pmtiles convert in.mbtiles out.pmtiles"). PMTiles files import directly.');
      } else throw new Error('Pick a .pmtiles, .gpx, .kml or .geojson file.');
      await put('usermaps', id, base);
      toast(`Added "${base.name}"${base.data ? ` (${base.data.features.length} items)` : ''}`);
    } catch (e) {
      toast((e as Error).message);
    }
  };

  const onPhoto = async (f: File | undefined) => {
    if (!f) return;
    const id = uid();
    const path = `usermaps/${id}.img`;
    await writeFile(path, f);
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => setPhoto({ id, url, w: img.naturalWidth, h: img.naturalHeight, file: path });
    img.src = url;
    await put('usermaps', id, { id, name: f.name.replace(/\.[^.]+$/, ''), kind: 'image', visible: false, color: '#000', file: path, created: Date.now() } as UserMap);
  };

  return (
    <Screen title="Maps">
      <SectionTitle>Built in</SectionTitle>
      <div className="list">
        {packs.map(({ p, st }) => (
          <div key={p.id} className="row">
            <span className="row-main"><span className="row-title">{p.title}</span><span className="row-sub">{p.description} · {fmtBytes(p.bytes)} · {st.complete ? 'installed' : 'not downloaded'}</span></span>
          </div>
        ))}
        {packs.length === 0 && <Empty>Map data has not been downloaded yet.</Empty>}
        <Btn icon="download" to="/setup">Download or check map data</Btn>
      </div>
      <SectionTitle>Mine</SectionTitle>
      <div className="list">
        {maps.length === 0 && <Empty>No maps added yet.</Empty>}
        {maps.map((m) => (
          <div key={m.id} className="row row-mine">
            <input type="checkbox" checked={m.visible} aria-label={`Show ${m.name}`} onChange={async (e) => { await put('usermaps', m.id, { ...m, visible: e.target.checked }); }} />
            <span className="row-main"><span className="row-title"><span className="swatch" style={{ background: m.color, marginRight: 6 }} />{m.name}</span><span className="row-sub">{m.kind === 'geojson' ? `${m.data?.features.length ?? 0} tracks/points` : m.kind === 'image' ? (m.corners ? 'Paper map photo, placed' : 'Paper map photo, not placed yet') : 'Map pack'}</span></span>
            <button className="btn" onClick={() => setEdit(m)}>Edit</button>
          </div>
        ))}
      </div>
      <SectionTitle>Add a map</SectionTitle>
      <div className="grid2">
        <Btn icon="upload" onClick={() => fileIn.current?.click()}>Map pack (.pmtiles)</Btn>
        <Btn icon="route" onClick={() => fileIn.current?.click()}>Tracks &amp; pins (.gpx .kml .geojson)</Btn>
        <Btn icon="camera" onClick={() => photoIn.current?.click()}>Photo of a paper map</Btn>
        <Btn icon="route" onClick={() => go('/map')}>Record a track (on the map)</Btn>
      </div>
      <input ref={fileIn} type="file" hidden accept=".pmtiles,.gpx,.kml,.geojson,.json,.mbtiles" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={photoIn} type="file" hidden accept="image/*" onChange={(e) => { void onPhoto(e.target.files?.[0]); e.target.value = ''; }} />
      <SectionTitle>Tracks &amp; routes</SectionTitle>
      <div className="list">
        {tracks.length === 0 && <Empty>No tracks yet. Record one on the map, or save a measured line as a route.</Empty>}
        {tracks.map((t) => (
          <div key={t.id} className="row">
            <span className="row-main"><span className="row-title">{t.name}</span><span className="row-sub">{t.points.length} points · {fmtDistance(pathLength(t.points.map((p) => [p[0], p[1]] as [number, number])))}</span></span>
            <button className="btn" onClick={async () => toast(await saveFile(`${t.name.replace(/[^\w-]+/g, '_')}.gpx`, new Blob([toGpx({ name: t.name, tracks: [t] })], { type: 'application/gpx+xml' })))}>GPX</button>
            <button className="btn" aria-label={`Delete ${t.name}`} onClick={async () => { if (confirm(`Delete track "${t.name}"?`)) await del('tracks', t.id); }}>✕</button>
          </div>
        ))}
        <Btn icon="download" onClick={async () => { const pins = await all<Pin>('pins'); toast(await saveFile('my-pins-and-tracks.gpx', new Blob([toGpx({ name: 'Grid-Down Hub', pins, tracks })], { type: 'application/gpx+xml' }))); }}>Export all pins &amp; tracks (GPX)</Btn>
      </div>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title="Edit map">
        {edit && (
          <div className="stack">
            <Field label="Name"><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            {edit.kind === 'geojson' && <Field label="Color"><div className="btnrow">{COLORS.map((c) => <button key={c} className="btn" style={{ background: c, color: '#fff', flex: '0 0 52px', outline: edit.color === c ? '4px solid var(--ink)' : 0 }} aria-label={`Color ${c}`} onClick={() => setEdit({ ...edit, color: c })}>{edit.color === c ? '✓' : ''}</button>)}</div></Field>}
            {(edit.kind === 'image' || edit.kind === 'pmtiles') && <Field label={`Opacity ${Math.round((edit.opacity ?? 0.8) * 100)}%`}><input type="range" min="0.2" max="1" step="0.05" value={edit.opacity ?? 0.8} onChange={(e) => setEdit({ ...edit, opacity: Number(e.target.value) })} /></Field>}
            <Toggle label="Show on the map" checked={edit.visible} onChange={(v) => setEdit({ ...edit, visible: v })} />
            {edit.kind === 'image' && <Btn icon="pin" onClick={async () => { const url = URL.createObjectURL((await (await navigator.storage.getDirectory()).getDirectoryHandle('usermaps').then((d) => d.getFileHandle(`${edit.id}.img`)).then((h) => h.getFile()))); const img = new Image(); img.onload = () => { setPhoto({ id: edit.id, url, w: img.naturalWidth, h: img.naturalHeight, file: edit.file! }); setEdit(null); }; img.src = url; }}>Place it again (2 points)</Btn>}
            <div className="btnrow">
              <Btn kind="go" icon="check" onClick={async () => { await put('usermaps', edit.id, edit); setEdit(null); }}>Save</Btn>
              <Btn kind="danger" icon="trash" onClick={async () => { if (!confirm(`Delete "${edit.name}"?`)) return; if (edit.file) await remove(edit.file); await del('usermaps', edit.id); setEdit(null); }}>Delete</Btn>
            </div>
          </div>
        )}
      </Sheet>
      <PhotoPoints photo={photo} onClose={() => setPhoto(null)} />
    </Screen>
  );
}

/** Step 1 of placing a paper-map photo: tap two spots on the photo you can also find on the map. */
function PhotoPoints({ photo, onClose }: { photo: { id: string; url: string; w: number; h: number } | null; onClose: () => void }) {
  const [pts, setPts] = useState<[number, number][]>([]);
  useEffect(() => setPts([]), [photo]);
  if (!photo) return null;
  return (
    <Sheet open onClose={onClose} title="Place the paper map">
      <p className="small">Tap two spots on the photo that you can also find on the map, far apart (a road crossing, a lake corner, a building). Then you'll tap the same two spots on the map.</p>
      <div style={{ position: 'relative' }}>
        <img src={photo.url} alt="Your paper map" style={{ width: '100%', display: 'block', border: '2px solid var(--line)', borderRadius: 8 }}
          onClick={(e) => {
            const r = (e.target as HTMLImageElement).getBoundingClientRect();
            const x = ((e.clientX - r.left) / r.width) * photo.w;
            const y = ((e.clientY - r.top) / r.height) * photo.h;
            setPts((p) => (p.length >= 2 ? [[x, y]] : [...p, [x, y]]));
          }} />
        {pts.map((p, i) => (
          <span key={i} style={{ position: 'absolute', left: `${(p[0] / photo.w) * 100}%`, top: `${(p[1] / photo.h) * 100}%`, transform: 'translate(-50%,-50%)', width: 26, height: 26, borderRadius: 13, background: '#B3141C', color: '#fff', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i ? 'B' : 'A'}</span>
        ))}
      </div>
      <Btn kind="go" icon="map" disabled={pts.length < 2} onClick={() => { onClose(); go(`/map?calibrate=${photo.id}&a=${pts[0].map(Math.round).join(',')}&b=${pts[1].map(Math.round).join(',')}&w=${photo.w}&h=${photo.h}`); }}>Next: tap them on the map</Btn>
    </Sheet>
  );
}
