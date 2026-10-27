// Read GPX, KML and GeoJSON files into GeoJSON, and write tracks/pins out as GPX.
type FC = GeoJSON.FeatureCollection;

const num = (s: string | null) => Number(s);
function textOf(el: Element, tag: string) {
  return el.getElementsByTagName(tag)[0]?.textContent?.trim() ?? '';
}

export function parseGpx(xml: string): FC {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('That GPX file could not be read.');
  const features: GeoJSON.Feature[] = [];
  for (const w of Array.from(doc.getElementsByTagName('wpt'))) {
    features.push({ type: 'Feature', properties: { name: textOf(w, 'name'), desc: textOf(w, 'desc') }, geometry: { type: 'Point', coordinates: [num(w.getAttribute('lon')), num(w.getAttribute('lat'))] } });
  }
  const lines = (parent: Element, tag: string) => Array.from(parent.getElementsByTagName(tag)).map((p) => [num(p.getAttribute('lon')), num(p.getAttribute('lat'))]);
  for (const t of Array.from(doc.getElementsByTagName('trk'))) {
    const segs = Array.from(t.getElementsByTagName('trkseg')).map((s) => lines(s, 'trkpt')).filter((s) => s.length > 1);
    if (segs.length) features.push({ type: 'Feature', properties: { name: textOf(t, 'name') }, geometry: { type: 'MultiLineString', coordinates: segs } });
  }
  for (const r of Array.from(doc.getElementsByTagName('rte'))) {
    const c = lines(r, 'rtept');
    if (c.length > 1) features.push({ type: 'Feature', properties: { name: textOf(r, 'name') }, geometry: { type: 'LineString', coordinates: c } });
  }
  return { type: 'FeatureCollection', features };
}

export function parseKml(xml: string): FC {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('That KML file could not be read.');
  const coords = (s: string) => s.trim().split(/\s+/).map((t) => t.split(',').slice(0, 2).map(Number));
  const features: GeoJSON.Feature[] = [];
  for (const pm of Array.from(doc.getElementsByTagName('Placemark'))) {
    const props = { name: textOf(pm, 'name'), desc: textOf(pm, 'description') };
    for (const p of Array.from(pm.getElementsByTagName('Point'))) features.push({ type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: coords(textOf(p, 'coordinates'))[0] } });
    for (const l of Array.from(pm.getElementsByTagName('LineString'))) features.push({ type: 'Feature', properties: props, geometry: { type: 'LineString', coordinates: coords(textOf(l, 'coordinates')) } });
    for (const g of Array.from(pm.getElementsByTagName('Polygon'))) {
      const outer = g.getElementsByTagName('outerBoundaryIs')[0];
      if (outer) features.push({ type: 'Feature', properties: props, geometry: { type: 'Polygon', coordinates: [coords(textOf(outer, 'coordinates'))] } });
    }
  }
  return { type: 'FeatureCollection', features };
}

export function parseGeoJson(text: string): FC {
  const j = JSON.parse(text);
  if (j.type === 'FeatureCollection') return j;
  if (j.type === 'Feature') return { type: 'FeatureCollection', features: [j] };
  if (j.type && j.coordinates) return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: j }] };
  throw new Error('That is not a GeoJSON file.');
}

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);

export function toGpx(opts: { name: string; tracks?: { name: string; points: [number, number, number?][] }[]; pins?: { name: string; lon: number; lat: number; note?: string }[] }) {
  const wpts = (opts.pins ?? []).map((p) => `  <wpt lat="${p.lat}" lon="${p.lon}"><name>${esc(p.name)}</name>${p.note ? `<desc>${esc(p.note)}</desc>` : ''}</wpt>`).join('\n');
  const trks = (opts.tracks ?? []).map((t) => `  <trk><name>${esc(t.name)}</name><trkseg>\n${t.points.map((p) => `    <trkpt lat="${p[1]}" lon="${p[0]}">${p[2] ? `<time>${new Date(p[2]).toISOString()}</time>` : ''}</trkpt>`).join('\n')}\n  </trkseg></trk>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Grid-Down Hub" xmlns="http://www.topografix.com/GPX/1/1">\n  <metadata><name>${esc(opts.name)}</name></metadata>\n${wpts}\n${trks}\n</gpx>\n`;
}

// ---- two-point calibration for a photo of a paper map ----
const R = 6378137;
const toMerc = ([lon, lat]: [number, number]) => [(R * lon * Math.PI) / 180, R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))];
const fromMerc = ([x, y]: number[]): [number, number] => [(x / R) * (180 / Math.PI), (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * (180 / Math.PI)];

/**
 * Given two image points (pixels, y down) and where they are on the ground, return the four corners
 * of the image on the map (top-left, top-right, bottom-right, bottom-left), allowing for scale and rotation.
 */
export function cornersFromTwoPoints(w: number, h: number, a: [number, number], b: [number, number], A: [number, number], B: [number, number]) {
  const za = { re: a[0], im: -a[1] };
  const zb = { re: b[0], im: -b[1] };
  const [Ax, Ay] = toMerc(A);
  const [Bx, By] = toMerc(B);
  const dz = { re: zb.re - za.re, im: zb.im - za.im };
  const dw = { re: Bx - Ax, im: By - Ay };
  const den = dz.re * dz.re + dz.im * dz.im;
  if (den === 0) throw new Error('Pick two different points on the photo.');
  const s = { re: (dw.re * dz.re + dw.im * dz.im) / den, im: (dw.im * dz.re - dw.re * dz.im) / den };
  const t = { re: Ax - (s.re * za.re - s.im * za.im), im: Ay - (s.re * za.im + s.im * za.re) };
  const map = (x: number, y: number) => {
    const z = { re: x, im: -y };
    return fromMerc([s.re * z.re - s.im * z.im + t.re, s.re * z.im + s.im * z.re + t.im]);
  };
  return [map(0, 0), map(w, 0), map(w, h), map(0, h)];
}
