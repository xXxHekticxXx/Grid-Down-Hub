import { useCallback, useEffect, useRef, useState } from 'react';
import maplibregl, { type GeoJSONSource, type Map as MLMap, type LngLatLike } from 'maplibre-gl';
import { buildStyle } from '../map/style';
import { pmtilesUrl, assetUrl, pmtilesFromFile } from '../map/engine';
import { POI_LAYERS, markerImage } from '../map/poiLayers';
import { useSettings } from '../lib/settings';
import { content } from '../lib/content';
import { packFile, packState } from '../lib/packs';
import { all, put, del, uid, get, subscribe } from '../lib/db';
import { watchPosition, watchHeading, keepAwake, saveFile, type Fix } from '../lib/native';
import { bearingDeg, cardinal, distanceM, fmtDD, fmtDDM, fmtDistance, fmtUSNG, magneticFromTrue, pathLength } from '../lib/geo';
import { Icon } from '../ui/icons';
import { Btn, Field, toast } from '../ui/ui';
import { back, go, href } from '../lib/router';
import { mapPdf } from '../lib/pdfmake';
import { fuelMiles, DEFAULT_FUEL, type Fuel } from '../tools/FuelRange';
import { getFile } from '../lib/opfs';
import { KIND_LABEL } from '../lib/search';
import type { Pin } from '../types';
import { saveItem } from '../lib/content';
import { cornersFromTwoPoints } from '../lib/geoformats';
import { searchAddress, type AddressHit } from '../lib/address';

export type UserMap = { id: string; name: string; kind: 'pmtiles' | 'geojson' | 'image'; visible: boolean; color: string; file?: string; data?: GeoJSON.FeatureCollection; corners?: [number, number][]; opacity?: number; created: number };
export type Track = { id: string; name: string; points: [number, number, number][]; created: number; color?: string };

type Panel = null | 'layers' | 'pin' | 'pins' | 'measure' | 'tracks' | 'poi' | 'address';
const FMT = ['dd', 'ddm', 'usng'] as const;

function circle(center: [number, number], radiusM: number, n = 96): GeoJSON.Feature<GeoJSON.Polygon> {
  const [lon, lat] = center;
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const b = (i / n) * 2 * Math.PI;
    const dLat = (radiusM / 6371008.8) * Math.cos(b);
    const dLon = ((radiusM / 6371008.8) * Math.sin(b)) / Math.cos((lat * Math.PI) / 180);
    pts.push([lon + (dLon * 180) / Math.PI, lat + (dLat * 180) / Math.PI]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [pts] } };
}
const fc = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features });

export default function MapPage({ query }: { query: URLSearchParams }) {
  const { s, set } = useSettings();
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const [fix, setFix] = useState<Fix | null>(null);
  const [gpsMsg, setGpsMsg] = useState('');
  const [heading, setHeading] = useState<number | null>(null);
  const [follow, setFollow] = useState(false);
  const [center, setCenter] = useState<[number, number]>([-81.5603, 28.8075]);
  const [zoom, setZoom] = useState(12);
  const [panel, setPanel] = useState<Panel>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [pinEdit, setPinEdit] = useState<Pin | null>(null);
  const [target, setTarget] = useState<Pin | null>(null);
  const [measure, setMeasure] = useState<[number, number][]>([]);
  const [poi, setPoi] = useState<{ props: Record<string, unknown>; lngLat: [number, number] } | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [rec, setRec] = useState<Track | null>(null);
  const [userMaps, setUserMaps] = useState<UserMap[]>([]);
  const [fuel, setFuel] = useState<Fuel>(DEFAULT_FUEL);
  const [showFuel, setShowFuel] = useState(query.get('fuel') === '1');
  const [showRoutes, setShowRoutes] = useState(query.get('routes') === '1');
  const [topoOpacity, setTopoOpacity] = useState(0.85);
  const fixRef = useRef<Fix | null>(null);
  const measureRef = useRef(measure);
  measureRef.current = measure;
  const panelRef = useRef(panel);
  panelRef.current = panel;
  const dropSection = query.get('drop');
  const calibId = query.get('calibrate');
  const [calib, setCalib] = useState<[number, number][]>([]);
  const calibRef = useRef(calib);
  calibRef.current = calib;

  // ---------- data ----------
  useEffect(() => {
    const load = () => all<Pin>('pins').then(setPins);
    load();
    const u1 = subscribe('pins', load);
    const loadT = () => all<Track>('tracks').then(setTracks);
    loadT();
    const u2 = subscribe('tracks', loadT);
    const loadU = () => all<UserMap>('usermaps').then(setUserMaps);
    loadU();
    const u3 = subscribe('usermaps', loadU);
    get<Fuel>('kv', 'fuel').then((v) => v && setFuel({ ...DEFAULT_FUEL, ...v }));
    return () => {
      u1();
      u2();
      u3();
    };
  }, []);

  // ---------- map setup ----------
  useEffect(() => {
    let disposed = false;
    (async () => {
      const c = await content();
      const [base, detail, topo] = await Promise.all([
        pmtilesUrl('maps-base', 'florida-base.pmtiles'),
        pmtilesUrl('maps-detail', 'lake-ocala-detail.pmtiles'),
        pmtilesUrl('topo-overlay', 'usgs-topo.pmtiles'),
      ]);
      const miss: string[] = [];
      if (!base) miss.push('Florida base map');
      if (!detail) miss.push('Lake County–Ocala detail map');
      if (!topo) miss.push('USGS topo overlay');
      setMissing(miss);
      const lon = Number(query.get('lon')) || c.local.mapCenter.lon;
      const lat = Number(query.get('lat')) || c.local.mapCenter.lat;
      const z = Number(query.get('z')) || c.local.mapCenter.zoom;
      if (disposed || !el.current) return;
      const map = new maplibregl.Map({
        container: el.current,
        style: buildStyle({ theme: s.theme, saver: s.saver, base, detail, topo, showTopo: s.topo, topoOpacity, glyphs: assetUrl('fonts/{fontstack}/{range}.pbf'), sprite: assetUrl(`sprites/${s.theme === 'day' ? 'light' : 'dark'}`) }),
        center: [lon, lat],
        zoom: z,
        maxZoom: 19,
        attributionControl: { compact: true },
        pitchWithRotate: false,
        dragRotate: true,
        fadeDuration: s.saver ? 0 : 300,
        canvasContextAttributes: { preserveDrawingBuffer: true },
      } as maplibregl.MapOptions);
      map.addControl(new maplibregl.ScaleControl({ unit: s.metric ? 'metric' : 'imperial', maxWidth: 140 }), 'bottom-left');
      mapRef.current = map;
      setZoom(map.getZoom());
      (window as unknown as { __map?: MLMap }).__map = map; // for the automated map tests
      map.on('move', () => {
        const cc = map.getCenter();
        setCenter([cc.lng, cc.lat]);
        setZoom(map.getZoom());
      });
      map.on('dragstart', () => setFollow(false));
      map.on('style.load', () => {
        void addOverlays(map);
      });
      map.on('load', () => {
        setReady(true);
        const mark = query.get('mark');
        if (mark && query.get('lon')) {
          new maplibregl.Marker({ color: '#B3141C' }).setLngLat([lon, lat]).setPopup(new maplibregl.Popup({ offset: 24 }).setText(mark)).addTo(map).togglePopup();
        }
      });
      // long press (touch) / right click (mouse) drops a pin
      let t: number | null = null;
      let startPt: { x: number; y: number } | null = null;
      map.on('touchstart', (e) => {
        if (e.originalEvent.touches.length !== 1) return;
        startPt = e.point;
        const ll = e.lngLat;
        t = window.setTimeout(() => newPinAt([ll.lng, ll.lat]), 600);
      });
      map.on('touchmove', (e) => {
        if (t && startPt && (Math.abs(e.point.x - startPt.x) > 8 || Math.abs(e.point.y - startPt.y) > 8)) {
          clearTimeout(t);
          t = null;
        }
      });
      map.on('touchend', () => {
        if (t) clearTimeout(t);
        t = null;
      });
      map.on('contextmenu', (e) => newPinAt([e.lngLat.lng, e.lngLat.lat]));
      map.on('click', (e) => {
        if (calibId) {
          const next = [...calibRef.current, [e.lngLat.lng, e.lngLat.lat] as [number, number]];
          setCalib(next);
          if (next.length === 2) void finishCalib(next);
          return;
        }
        if (panelRef.current === 'measure') {
          setMeasure((m) => [...m, [e.lngLat.lng, e.lngLat.lat]]);
          return;
        }
        const layers = map.getStyle().layers.filter((l) => l.id.startsWith('poi-') || l.id === 'pins-sym').map((l) => l.id);
        const f = map.queryRenderedFeatures(e.point, { layers }).find(Boolean);
        if (f) {
          const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
          if (f.layer.id === 'pins-sym') {
            const p = pinsRef.current.find((x) => x.id === f.properties.id);
            if (p) {
              setPinEdit(p);
              setPanel('pin');
            }
            return;
          }
          setPoi({ props: f.properties, lngLat: coords });
          setPanel('poi');
        }
      });
    })();
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // the map is created once; theme and overlays update it in place
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pinsRef = useRef(pins);
  pinsRef.current = pins;

  // restyle when theme / saver / topo changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (async () => {
      const [base, detail, topo] = await Promise.all([
        pmtilesUrl('maps-base', 'florida-base.pmtiles'),
        pmtilesUrl('maps-detail', 'lake-ocala-detail.pmtiles'),
        pmtilesUrl('topo-overlay', 'usgs-topo.pmtiles'),
      ]);
      map.setStyle(buildStyle({ theme: s.theme, saver: s.saver, base, detail, topo, showTopo: s.topo, topoOpacity, glyphs: assetUrl('fonts/{fontstack}/{range}.pbf'), sprite: assetUrl(`sprites/${s.theme === 'day' ? 'light' : 'dark'}`) }), { diff: false });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.theme, s.saver]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getLayer('topo')) return;
    map.setLayoutProperty('topo', 'visibility', s.topo ? 'visible' : 'none');
    map.setPaintProperty('topo', 'raster-opacity', topoOpacity);
  }, [s.topo, topoOpacity, ready]);

  // ---------- overlays (re-added after every style change) ----------
  const addOverlays = useCallback(async (map: MLMap) => {
    const night = document.documentElement.dataset.theme === 'night';
    const halo = night ? '#000' : '#fff';
    const ink = night ? '#FF4A3D' : '#161A17';
    const addSrc = (id: string, data: GeoJSON.FeatureCollection = fc([])) => {
      if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data });
    };
    // user maps first (under everything else)
    for (const um of await all<UserMap>('usermaps')) {
      if (!um.visible) continue;
      const sid = `um-${um.id}`;
      if (map.getSource(sid)) continue;
      if (um.kind === 'geojson' && um.data) {
        map.addSource(sid, { type: 'geojson', data: um.data });
        map.addLayer({ id: `${sid}-line`, type: 'line', source: sid, filter: ['!=', ['geometry-type'], 'Point'], paint: { 'line-color': um.color, 'line-width': 3.5, 'line-opacity': 0.9 } });
        map.addLayer({ id: `${sid}-pt`, type: 'circle', source: sid, filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-color': um.color, 'circle-radius': 7, 'circle-stroke-color': halo, 'circle-stroke-width': 2 } });
        map.addLayer({ id: `${sid}-label`, type: 'symbol', source: sid, filter: ['has', 'name'], layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 13, 'text-offset': [0, 1.2] }, paint: { 'text-color': ink, 'text-halo-color': halo, 'text-halo-width': 2 } });
      } else if (um.kind === 'image' && um.corners && um.file) {
        const f = await getFile(um.file);
        if (!f) continue;
        map.addSource(sid, { type: 'image', url: URL.createObjectURL(f), coordinates: um.corners as [[number, number], [number, number], [number, number], [number, number]] });
        map.addLayer({ id: `${sid}-img`, type: 'raster', source: sid, paint: { 'raster-opacity': um.opacity ?? 0.75 } });
      } else if (um.kind === 'pmtiles' && um.file) {
        const f = await getFile(um.file);
        if (!f) continue;
        const { url, header } = await pmtilesFromFile(um.id, f);
        if (header.tileType === 1) continue; // vector user archives are listed but drawn only if raster
        map.addSource(sid, { type: 'raster', url, tileSize: 256 });
        map.addLayer({ id: `${sid}-r`, type: 'raster', source: sid, paint: { 'raster-opacity': um.opacity ?? 0.85 } });
      }
    }
    // planned routes bundled with the app
    if (!map.getSource('routes')) {
      try {
        const r = await fetch(import.meta.env.BASE_URL + 'content/routes.geojson');
        if (r.ok) {
          map.addSource('routes', { type: 'geojson', data: await r.json() });
          map.addLayer({ id: 'routes-line', type: 'line', source: 'routes', layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['coalesce', ['get', 'color'], '#1F5C36'], 'line-width': 6, 'line-opacity': 0.8 } });
          map.addLayer({ id: 'routes-label', type: 'symbol', source: 'routes', layout: { visibility: 'none', 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Medium'], 'text-size': 13 }, paint: { 'text-color': ink, 'text-halo-color': halo, 'text-halo-width': 2 } });
        }
      } catch {
        /* no routes file */
      }
    }
    addSrc('fuel');
    if (!map.getLayer('fuel-line')) map.addLayer({ id: 'fuel-line', type: 'line', source: 'fuel', paint: { 'line-color': '#6B4B9A', 'line-width': 3, 'line-dasharray': [3, 2] } });
    addSrc('tracks');
    if (!map.getLayer('tracks-line')) map.addLayer({ id: 'tracks-line', type: 'line', source: 'tracks', paint: { 'line-color': ['coalesce', ['get', 'color'], '#C2410C'], 'line-width': 4 } });
    // POIs
    const st = await packState('pois');
    if (st.complete) {
      for (const L of POI_LAYERS) {
        const sid = `poi-${L.id}`;
        if (!map.getSource(sid)) {
          const f = await packFile('pois', L.file);
          if (!f) continue;
          map.addSource(sid, { type: 'geojson', data: JSON.parse(await f.text()) });
        }
        if (!map.hasImage(`m-${L.id}`)) {
          const m = markerImage(L.color, L.letter, night);
          map.addImage(`m-${L.id}`, m.img, { pixelRatio: m.ratio });
        }
        if (!map.getLayer(sid)) {
          map.addLayer({
            id: sid, type: 'symbol', source: sid, minzoom: L.minzoom,
            layout: {
              visibility: currentLayers.current.includes(L.id) ? 'visible' : 'none',
              'icon-image': `m-${L.id}`, 'icon-allow-overlap': L.id === 'hospital' || L.id === 'shelter', 'icon-size': 1,
              'text-field': ['step', ['zoom'], '', 13, ['coalesce', ['get', 'name'], '']], 'text-font': ['Noto Sans Medium'], 'text-size': 12, 'text-offset': [0, 1.5], 'text-anchor': 'top', 'text-optional': true,
            },
            paint: { 'text-color': ink, 'text-halo-color': halo, 'text-halo-width': 2 },
          });
        }
      }
    }
    // measure, target line, pins, me
    addSrc('measure');
    if (!map.getLayer('measure-line')) {
      map.addLayer({ id: 'measure-line', type: 'line', source: 'measure', paint: { 'line-color': '#B3141C', 'line-width': 3, 'line-dasharray': [2, 1] } });
      map.addLayer({ id: 'measure-pt', type: 'circle', source: 'measure', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 6, 'circle-color': '#B3141C', 'circle-stroke-color': halo, 'circle-stroke-width': 2 } });
    }
    addSrc('target');
    if (!map.getLayer('target-line')) map.addLayer({ id: 'target-line', type: 'line', source: 'target', paint: { 'line-color': '#1F5C36', 'line-width': 3, 'line-dasharray': [1, 1.5] } });
    addSrc('pins');
    if (!map.hasImage('pin-img')) {
      const m = markerImage('#161A17', '★', night);
      map.addImage('pin-img', m.img, { pixelRatio: m.ratio });
    }
    if (!map.getLayer('pins-sym')) {
      map.addLayer({ id: 'pins-sym', type: 'symbol', source: 'pins', layout: { visibility: currentLayers.current.includes('mypins') ? 'visible' : 'none', 'icon-image': 'pin-img', 'icon-allow-overlap': true, 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Medium'], 'text-size': 13, 'text-offset': [0, 1.5], 'text-anchor': 'top' }, paint: { 'text-color': ink, 'text-halo-color': halo, 'text-halo-width': 2 } });
    }
    addSrc('me');
    if (!map.getLayer('me-acc')) {
      map.addLayer({ id: 'me-acc', type: 'fill', source: 'me', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': '#2E6FD8', 'fill-opacity': 0.15 } });
      map.addLayer({ id: 'me-dot', type: 'circle', source: 'me', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 9, 'circle-color': night ? '#FF4A3D' : '#2E6FD8', 'circle-stroke-color': halo, 'circle-stroke-width': 3 } });
    }
    refreshAll.current();
  }, []);

  const currentLayers = useRef(s.layers);
  currentLayers.current = s.layers;

  // push state into sources
  const refreshAll = useRef(() => undefined as void);
  refreshAll.current = () => {
    const map = mapRef.current;
    if (!map) return;
    const setData = (id: string, d: GeoJSON.FeatureCollection) => (map.getSource(id) as GeoJSONSource | undefined)?.setData(d);
    setData('pins', fc(pins.map((p) => ({ type: 'Feature', properties: { id: p.id, name: p.name, kind: p.kind }, geometry: { type: 'Point', coordinates: [p.lon, p.lat] } }))));
    setData('measure', fc([
      ...(measure.length > 1 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: measure } } as GeoJSON.Feature] : []),
      ...measure.map((m) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: m } }) as GeoJSON.Feature),
    ]));
    const me = fix ? [fix.lon, fix.lat] as [number, number] : null;
    setData('me', fc(me ? [circle(me, Math.min(fix!.acc, 2000)), { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: me } }] : []));
    const from = me ?? center;
    setData('target', fc(target ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [from, [target.lon, target.lat]] } }] : []));
    const r = fuelMiles(fuel);
    setData('fuel', fc(showFuel && r.usable > 0 ? [circle(from, r.usable * 1609.344)] : []));
    const all = [...tracks, ...(rec ? [rec] : [])];
    setData('tracks', fc(all.filter((t) => t.points.length > 1).map((t) => ({ type: 'Feature', properties: { name: t.name, color: t.color }, geometry: { type: 'LineString', coordinates: t.points.map((p) => [p[0], p[1]]) } }))));
    for (const L of POI_LAYERS) if (map.getLayer(`poi-${L.id}`)) map.setLayoutProperty(`poi-${L.id}`, 'visibility', s.layers.includes(L.id) ? 'visible' : 'none');
    if (map.getLayer('pins-sym')) map.setLayoutProperty('pins-sym', 'visibility', s.layers.includes('mypins') ? 'visible' : 'none');
    for (const id of ['routes-line', 'routes-label']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', showRoutes ? 'visible' : 'none');
  };
  useEffect(() => {
    if (ready) refreshAll.current();
  }, [ready, pins, measure, fix, target, fuel, showFuel, tracks, rec, s.layers, showRoutes, center]);

  // layer forced on from a link (e.g. "nearest hospital")
  useEffect(() => {
    const l = query.get('layer');
    if (l && (POI_LAYERS.some((p) => p.id === l) || l === 'mypins') && !s.layers.includes(l)) set({ layers: [...s.layers, l] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- GPS & compass ----------
  useEffect(() => {
    const stop = watchPosition(
      (f) => {
        setFix(f);
        fixRef.current = f;
        setGpsMsg('');
      },
      (m) => setGpsMsg(m),
    );
    const stopH = watchHeading(setHeading);
    return () => {
      stop();
      stopH();
    };
  }, []);
  useEffect(() => {
    if (follow && fix && mapRef.current) mapRef.current.easeTo({ center: [fix.lon, fix.lat], duration: s.saver ? 0 : 400 });
  }, [follow, fix, s.saver]);
  // track recording
  useEffect(() => {
    if (!rec || !fix) return;
    const last = rec.points[rec.points.length - 1];
    if (!last || distanceM([last[0], last[1]], [fix.lon, fix.lat]) > Math.max(8, fix.acc / 2)) {
      const n = { ...rec, points: [...rec.points, [fix.lon, fix.lat, fix.time] as [number, number, number]] };
      setRec(n);
      void put('tracks', n.id, n);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fix]);

  // ---------- actions ----------
  async function finishCalib(ground: [number, number][]) {
    const a = (query.get('a') ?? '0,0').split(',').map(Number) as [number, number];
    const b = (query.get('b') ?? '0,0').split(',').map(Number) as [number, number];
    const w = Number(query.get('w'));
    const h = Number(query.get('h'));
    try {
      const corners = cornersFromTwoPoints(w, h, a, b, ground[0], ground[1]);
      const um = await get<UserMap>('usermaps', calibId!);
      if (um) await put('usermaps', um.id, { ...um, corners, visible: true, opacity: um.opacity ?? 0.75 });
      toast('Paper map placed. Adjust its opacity in Maps.');
      go('/maps');
    } catch (e) {
      toast((e as Error).message);
      setCalib([]);
    }
  }
  async function newPinAt(ll: [number, number], name?: string, note?: string) {
    const p: Pin = { id: uid(), name: name || `Pin ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`, lon: ll[0], lat: ll[1], kind: 'pin', note, created: Date.now(), updated: Date.now() };
    await put('pins', p.id, p);
    if (!currentLayers.current.includes('mypins')) set({ layers: [...currentLayers.current, 'mypins'] });
    setPinEdit(p);
    setPanel('pin');
    if (dropSection) await saveItem({ section: dropSection, kind: 'pin', title: p.name, pinId: p.id });
  }
  const pdf = async () => {
    const map = mapRef.current;
    if (!map) return;
    const canvas = map.getCanvas();
    await new Promise<void>((res) => {
      map.once('render', () => res());
      map.triggerRepaint();
    });
    const img = canvas.toDataURL('image/png');
    const c = map.getCenter();
    const mpp = (40075016.686 * Math.cos((c.lat * Math.PI) / 180)) / (512 * 2 ** map.getZoom());
    const inchesPerPx = 1 / 96;
    const scale = `about 1:${Math.round(mpp / (inchesPerPx * 0.0254)).toLocaleString()} on screen`;
    const blob = mapPdf(img, canvas.width, canvas.height, { title: 'Grid-Down Hub map', center: fmtDD(c.lat, c.lng), usng: fmtUSNG(c.lat, c.lng), scale, attribution: '© OpenMapTiles © OpenStreetMap contributors · USGS US Topo (public domain)' });
    toast(await saveFile(`map-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.pdf`, blob));
  };
  const toggleLayer = (id: string) => set({ layers: s.layers.includes(id) ? s.layers.filter((x) => x !== id) : [...s.layers, id] });
  const here: [number, number] = fix ? [fix.lon, fix.lat] : center;
  const coordLat = fix ? fix.lat : center[1];
  const coordLon = fix ? fix.lon : center[0];
  const fmt = s.coordFormat;
  const coordText = fmt === 'dd' ? fmtDD(coordLat, coordLon) : fmt === 'ddm' ? fmtDDM(coordLat, coordLon) : 'USNG ' + fmtUSNG(coordLat, coordLon);

  return (
    <div className="map-screen">
      <div className="map-wrap">
        <div ref={el} className="map-canvas" data-testid="map" aria-label="Map" />
        <div className="map-top">
          <button className="map-coords" onClick={() => set({ coordFormat: FMT[(FMT.indexOf(fmt) + 1) % 3] })} aria-label="Coordinates, tap to change format" data-testid="coords">
            <b>{fix ? 'You' : 'Map center'}: {coordText}</b>
            <br />
            {fmt !== 'dd' && <span>{fmtDD(coordLat, coordLon)} · </span>}
            {fmt !== 'ddm' && <span>{fmtDDM(coordLat, coordLon)} · </span>}
            {fmt !== 'usng' && <span>USNG {fmtUSNG(coordLat, coordLon)}</span>}
            <br />
            <span className="small muted">{fix ? `GPS ± ${fmtDistance(fix.acc, s.metric)}` : gpsMsg || 'Waiting for GPS…'} · z{zoom.toFixed(1)}</span>
          </button>
        </div>
        <div className="map-side">
          <button className="map-fab" aria-pressed={follow} onClick={() => { setFollow(true); if (fix) mapRef.current?.flyTo({ center: [fix.lon, fix.lat], zoom: Math.max(zoom, 15) }); else toast(gpsMsg || 'Waiting for GPS. GPS works without cell service.'); }} aria-label="Center on my location" data-testid="locate"><Icon name="locate" /></button>
          <button className="map-fab" onClick={() => mapRef.current?.resetNorth()} aria-label={heading == null ? 'North up' : `Heading ${Math.round(heading)} degrees, tap for north up`}>{heading == null ? 'N' : `${cardinal(heading)} ${Math.round(heading)}°`}</button>
          <button className="map-fab" aria-pressed={panel === 'layers'} onClick={() => setPanel(panel === 'layers' ? null : 'layers')} aria-label="Layers" data-testid="layers-btn"><Icon name="layers" /></button>
          <button className="map-fab" aria-pressed={panel === 'measure'} onClick={() => { setPanel(panel === 'measure' ? null : 'measure'); setMeasure([]); }} aria-label="Measure distance"><Icon name="ruler" /></button>
          <button className="map-fab" aria-pressed={panel === 'pins'} onClick={() => setPanel(panel === 'pins' ? null : 'pins')} aria-label="My pins"><Icon name="pin" /></button>
          <button className="map-fab" onClick={pdf} aria-label="Export this view to PDF">PDF</button>
        </div>
        {calibId && (
          <div className="card card-info" style={{ position: 'absolute', left: 10, right: 10, top: 96, zIndex: 7, maxWidth: 440 }}>
            <b>Placing your paper map:</b> zoom in and tap where point <b>{calib.length === 0 ? 'A' : 'B'}</b> is on the real map.
          </div>
        )}
        {missing.length > 0 && ready && (
          <div className="map-msg card card-warn" style={{ maxWidth: 420 }}>
            <b>Not installed yet:</b> {missing.join(', ')}.
            <div className="btnrow" style={{ marginTop: 8 }}><Btn kind="go" icon="download" to="/setup">Download map data</Btn></div>
          </div>
        )}
        {target && (
          <div className="card" style={{ position: 'absolute', left: 10, bottom: panel ? 'auto' : 10, top: panel ? 150 : 'auto', zIndex: 5, maxWidth: 320, padding: 10 }}>
            <b>To {target.name}</b>
            <div>{fmtDistance(distanceM(here, [target.lon, target.lat]), s.metric)} · {Math.round(bearingDeg(here, [target.lon, target.lat]))}° true ({cardinal(bearingDeg(here, [target.lon, target.lat]))}) · {Math.round(magneticFromTrue(bearingDeg(here, [target.lon, target.lat]), here))}° magnetic</div>
            <div className="small muted">{fix ? 'from your GPS position' : 'from the map center'} · straight line</div>
            <button className="btn" style={{ minHeight: 48, marginTop: 6 }} onClick={() => setTarget(null)}>Stop</button>
          </div>
        )}
        {panel && (
          <div className="map-panel" role="region" aria-label="Map panel">
            <div className="grab" />
            {panel === 'layers' && <LayersPanel s={s} toggle={toggleLayer} set={set} topoOpacity={topoOpacity} setTopoOpacity={setTopoOpacity} showFuel={showFuel} setShowFuel={setShowFuel} showRoutes={showRoutes} setShowRoutes={setShowRoutes} userMaps={userMaps} onClose={() => setPanel(null)} rec={rec} startRec={() => { const t: Track = { id: uid(), name: `Track ${new Date().toLocaleString()}`, points: [], created: Date.now() }; setRec(t); void put('tracks', t.id, t); void keepAwake(true); toast('Recording your track. Keep the app open.'); }} stopRec={() => { setRec(null); void keepAwake(false); toast('Track saved'); }} tracks={tracks} />}
            {panel === 'measure' && (
              <div className="stack">
                <b>Measure</b>
                <p className="small">Tap the map to add points.</p>
                <div className="big-number" data-testid="measure-total">{fmtDistance(pathLength(measure), s.metric)}</div>
                <div className="btnrow">
                  <Btn onClick={() => setMeasure((m) => m.slice(0, -1))}>Undo</Btn>
                  <Btn onClick={() => setMeasure([])}>Clear</Btn>
                  <Btn kind="go" disabled={measure.length < 2} onClick={async () => { const t: Track = { id: uid(), name: `Route ${new Date().toLocaleDateString()}`, points: measure.map((m) => [m[0], m[1], Date.now()]), created: Date.now(), color: '#1F5C36' }; await put('tracks', t.id, t); toast('Saved as a route in Tracks'); }}>Save as route</Btn>
                  <Btn onClick={() => setPanel(null)}>Done</Btn>
                </div>
              </div>
            )}
            {panel === 'pins' && (
              <div className="stack">
                <b>My pins ({pins.length})</b>
                <p className="small">Long-press the map (or right-click with a mouse) to drop a pin.</p>
                <div className="list">
                  {pins.map((p) => (
                    <button key={p.id} className="row" onClick={() => { mapRef.current?.flyTo({ center: [p.lon, p.lat], zoom: Math.max(zoom, 14) }); setPinEdit(p); setPanel('pin'); }}>
                      <span className="row-main"><span className="row-title">{p.name}</span><span className="row-sub">{fmtDistance(distanceM(here, [p.lon, p.lat]), s.metric)} · {Math.round(bearingDeg(here, [p.lon, p.lat]))}° {cardinal(bearingDeg(here, [p.lon, p.lat]))}</span></span>
                    </button>
                  ))}
                </div>
                <Btn icon="plus" onClick={() => newPinAt(fix ? [fix.lon, fix.lat] : center)}>Pin {fix ? 'my location' : 'the map center'}</Btn>
              </div>
            )}
            {panel === 'address' && (
              <AddressPanel here={here} metric={s.metric}
                onShow={(h) => { mapRef.current?.flyTo({ center: [h.lon, h.lat], zoom: 17 }); }}
                onSave={async (h, name) => { mapRef.current?.flyTo({ center: [h.lon, h.lat], zoom: 17 }); await newPinAt([h.lon, h.lat], name || h.label, h.label); toast('Pin saved'); }}
                onClose={() => setPanel(null)} />
            )}
            {panel === 'pin' && pinEdit && (
              <PinEditor pin={pinEdit} here={here} metric={s.metric} onGo={() => { setTarget(pinEdit); setPanel(null); }} onClose={() => setPanel(null)} />
            )}
            {panel === 'poi' && poi && (
              <div className="stack" data-testid="poi-panel">
                <b style={{ fontSize: 'calc(var(--fs)*1.15)' }}>{String(poi.props.name ?? KIND_LABEL[String(poi.props.k)] ?? 'Place')}</b>
                <span className="badge">{KIND_LABEL[String(poi.props.k)] ?? String(poi.props.k)}</span>
                {(poi.props.street || poi.props.city) ? <div>{[poi.props.housenumber, poi.props.street, poi.props.city].filter(Boolean).join(' ')}</div> : null}
                {poi.props.phone ? <a href={`tel:${poi.props.phone}`}>{String(poi.props.phone)}</a> : null}
                {poi.props.opening_hours ? <div className="small">Hours: {String(poi.props.opening_hours)}</div> : null}
                {poi.props.er === true || poi.props.er === 'true' ? <span className="badge red">Emergency room</span> : null}
                {poi.props.pets === true || poi.props.pets === 'true' ? <span className="badge">Pet-friendly (2024)</span> : null}
                {poi.props.note ? <div className="card card-warn small"><b>{String(poi.props.note)}</b></div> : null}
                <div>{fmtDistance(distanceM(here, poi.lngLat), s.metric)} · {Math.round(bearingDeg(here, poi.lngLat))}° {cardinal(bearingDeg(here, poi.lngLat))} {fix ? 'from you' : 'from map center'}</div>
                <div className="small muted">{fmtDD(poi.lngLat[1], poi.lngLat[0])} · USNG {fmtUSNG(poi.lngLat[1], poi.lngLat[0])} · © OpenStreetMap contributors</div>
                <div className="btnrow">
                  <Btn kind="go" icon="route" onClick={() => { setTarget({ id: 'poi', name: String(poi.props.name ?? 'place'), lon: poi.lngLat[0], lat: poi.lngLat[1], kind: 'pin', created: 0, updated: 0 }); setPanel(null); }}>Go to</Btn>
                  <Btn icon="pin" onClick={async () => { const p: Pin = { id: uid(), name: String(poi.props.name ?? 'Saved place'), lon: poi.lngLat[0], lat: poi.lngLat[1], kind: 'pin', note: [poi.props.street, poi.props.phone].filter(Boolean).join(' · '), created: Date.now(), updated: Date.now() }; await put('pins', p.id, p); toast('Saved as a pin'); }}>Save as pin</Btn>
                  <Btn onClick={() => setPanel(null)}>Close</Btn>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <nav className="dock map-dock" aria-label="Map buttons">
        <button className="btn dock-back" onClick={back} data-testid="back"><Icon name="back" size={24} /><span>Back</span></button>
        <button className="btn btn-go" aria-pressed={panel === 'address'} onClick={() => setPanel(panel === 'address' ? null : 'address')} data-testid="pin-address-btn"><Icon name="pin" size={22} /><span>Pin by address</span></button>
      </nav>
    </div>
  );
}

function PinEditor({ pin, here, metric, onGo, onClose }: { pin: Pin; here: [number, number]; metric: boolean; onGo: () => void; onClose: () => void }) {
  const [p, setP] = useState(pin);
  useEffect(() => setP(pin), [pin]);
  const d = distanceM(here, [p.lon, p.lat]);
  const b = bearingDeg(here, [p.lon, p.lat]);
  return (
    <form className="stack" onSubmit={async (e) => { e.preventDefault(); await put('pins', p.id, { ...p, updated: Date.now() }); toast('Pin saved'); onClose(); }} data-testid="pin-editor">
      <Field label="Name"><input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} data-testid="pin-name" /></Field>
      <div className="grid2">
        <Field label="Type">
          <select value={p.kind} onChange={(e) => setP({ ...p, kind: e.target.value as Pin['kind'] })}>
            <option value="pin">Pin</option><option value="home">Home</option><option value="meeting">Meeting point</option><option value="camp">Camp</option><option value="cache">Supply cache</option><option value="water">Water source</option><option value="danger">Danger / avoid</option>
          </select>
        </Field>
        <div className="small" style={{ alignSelf: 'end' }}>{fmtDistance(d, metric)} · {Math.round(b)}° true ({cardinal(b)})<br />{Math.round(magneticFromTrue(b, here))}° on a hand compass</div>
      </div>
      <Field label="Note"><input value={p.note ?? ''} onChange={(e) => setP({ ...p, note: e.target.value })} /></Field>
      <div className="small muted">{fmtDD(p.lat, p.lon)} · {fmtDDM(p.lat, p.lon)} · USNG {fmtUSNG(p.lat, p.lon)}</div>
      <div className="btnrow">
        <Btn type="submit" kind="go" icon="check">Save</Btn>
        <Btn icon="route" onClick={onGo}>Go to</Btn>
        <Btn kind="danger" icon="trash" onClick={async () => { if (confirm(`Delete pin "${p.name}"?`)) { await del('pins', p.id); onClose(); } }}>Delete</Btn>
      </div>
    </form>
  );
}

function LayersPanel(props: {
  s: ReturnType<typeof useSettings>['s']; set: ReturnType<typeof useSettings>['set']; toggle: (id: string) => void; topoOpacity: number; setTopoOpacity: (n: number) => void;
  showFuel: boolean; setShowFuel: (b: boolean) => void; showRoutes: boolean; setShowRoutes: (b: boolean) => void; userMaps: UserMap[]; onClose: () => void;
  rec: Track | null; startRec: () => void; stopRec: () => void; tracks: Track[];
}) {
  const { s, set, toggle } = props;
  const groups = [...new Set(POI_LAYERS.map((l) => l.group))];
  const night = s.theme === 'night';
  return (
    <div className="stack" data-testid="layers-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 'calc(var(--fs)*1.3)', fontFamily: 'var(--head)' }}>Layers</b>
        <div className="seg">
          <button aria-pressed={!s.topo} onClick={() => set({ topo: false })}>Streets</button>
          <button aria-pressed={s.topo} onClick={() => set({ topo: true })} data-testid="topo-toggle">+ USGS topo</button>
        </div>
      </div>
      {s.topo && <Field label={`Topo opacity ${Math.round(props.topoOpacity * 100)}%`}><input type="range" min="0.2" max="1" step="0.05" value={props.topoOpacity} onChange={(e) => props.setTopoOpacity(Number(e.target.value))} /></Field>}
      {groups.map((g) => (
        <div key={g} className="layer-group">
          <div className="small muted"><b>{g}</b></div>
          <div className="layer-grid">
            {POI_LAYERS.filter((l) => l.group === g).map((l) => (
              <label key={l.id}>
                <input type="checkbox" checked={s.layers.includes(l.id)} onChange={() => toggle(l.id)} data-testid={`layer-${l.id}`} />
                <span className="swatch" style={{ background: night ? '#000' : l.color, border: night ? '2px solid #FF4A3D' : 0, color: night ? '#FF4A3D' : '#fff' }}>{l.letter}</span>
                {l.title}
              </label>
            ))}
          </div>
        </div>
      ))}
      <div className="layer-group">
        <div className="small muted"><b>Mine</b></div>
        <div className="layer-grid">
          <label><input type="checkbox" checked={s.layers.includes('mypins')} onChange={() => toggle('mypins')} /> My pins</label>
          <label><input type="checkbox" checked={props.showRoutes} onChange={(e) => props.setShowRoutes(e.target.checked)} /> Planned routes</label>
          <label><input type="checkbox" checked={props.showFuel} onChange={(e) => props.setShowFuel(e.target.checked)} /> Fuel range ring</label>
        </div>
      </div>
      <div className="btnrow">
        {props.rec ? <Btn kind="danger" icon="stop" onClick={props.stopRec}>Stop track ({props.rec.points.length} pts)</Btn> : <Btn icon="route" onClick={props.startRec}>Record a track</Btn>}
        <Btn icon="layers" onClick={() => go('/maps')}>Manage &amp; add maps</Btn>
      </div>
      <p className="small muted">{props.tracks.length} saved track{props.tracks.length === 1 ? '' : 's'} · {props.userMaps.length} map{props.userMaps.length === 1 ? '' : 's'} you added. Water sources: treat before drinking. Shelters: confirm open via AlertLake. Map data © OpenStreetMap contributors, © OpenMapTiles; topo: USGS.</p>
      <p className="small"><a href={href('/a/reading-usgs-topo')}>How to read a topo map</a></p>
      <Btn onClick={props.onClose}>Close</Btn>
    </div>
  );
}

export function flyTo(map: MLMap | null, ll: LngLatLike, z = 15) {
  map?.flyTo({ center: ll, zoom: z });
}

function AddressPanel({ here, metric, onShow, onSave, onClose }: { here: [number, number]; metric: boolean; onShow: (h: AddressHit) => void; onSave: (h: AddressHit, name: string) => Promise<void>; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<AddressHit[] | null>([]);
  const [sel, setSel] = useState<AddressHit | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    const r = await searchAddress(q, here);
    setHits(r);
    setSel(r && r[0] ? r[0] : null);
    if (r && r[0]) onShow(r[0]);
    setBusy(false);
  };
  return (
    <div className="stack" data-testid="address-panel">
      <b style={{ fontSize: 'calc(var(--fs)*1.2)' }}>Pin by address</b>
      <form className="btnrow" onSubmit={run}>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Address, street, town or coordinates" style={{ flex: '1 1 200px' }} data-testid="address-input" enterKeyHint="search" />
        <Btn type="submit" kind="primary" icon="search" disabled={busy || !q.trim()}>{busy ? 'Looking…' : 'Find'}</Btn>
      </form>
      <p className="small muted">Works offline: about 2 million Florida addresses from OpenStreetMap. Also takes a street, a town, or coordinates. Rural house numbers are sometimes missing; you'll get the closest number or the street.</p>
      {hits === null && (
        <div className="card card-warn">The address list isn't on this device yet. <a href={href('/setup')}>Download it in Setup</a> (about 62 MB).</div>
      )}
      {hits && hits.length === 0 && q && !busy && <p className="small">Nothing found. Try the street without the number, or the town.</p>}
      {hits && hits.length > 0 && (
        <div className="list" data-testid="address-results">
          {hits.map((h) => (
            <button key={h.label + h.lat} className={`row${sel === h ? ' row-mine' : ''}`} aria-pressed={sel === h} onClick={() => { setSel(h); onShow(h); }}>
              <span className="row-main"><span className="row-title">{h.label}</span><span className="row-sub">{h.sub} · {fmtDistance(distanceM(here, [h.lon, h.lat]), metric)}, {Math.round(bearingDeg(here, [h.lon, h.lat]))}° {cardinal(bearingDeg(here, [h.lon, h.lat]))} from you</span></span>
            </button>
          ))}
        </div>
      )}
      {sel && (
        <form className="stack" onSubmit={async (e) => { e.preventDefault(); await onSave(sel, name.trim()); }}>
          <Field label="Pin name (optional)"><input value={name} onChange={(e) => setName(e.target.value)} data-testid="address-pin-name" /></Field>
          <div className="btnrow">
            <Btn type="submit" kind="go" icon="check">Save pin</Btn>
            <Btn onClick={onClose}>Close</Btn>
          </div>
        </form>
      )}
      {!sel && <div className="btnrow"><Btn onClick={onClose}>Close</Btn></div>}
    </div>
  );
}
