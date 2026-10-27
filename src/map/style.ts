// Map styles for the OpenMapTiles schema (built with Planetiler from OpenStreetMap).
// Everything (fonts, icons) is bundled with the app; nothing loads from the internet.
import type { StyleSpecification, LayerSpecification, ExpressionSpecification } from 'maplibre-gl';

export type Palette = {
  bg: string; water: string; waterLine: string; wood: string; grass: string; wetland: string; sand: string; farm: string;
  residential: string; industrial: string; park: string; parkLine: string; building: string; buildingLine: string;
  motorway: string; trunk: string; primary: string; secondary: string; minor: string; casing: string; track: string; path: string; rail: string;
  boundary: string; text: string; textMuted: string; halo: string; waterText: string; parkText: string;
};

export const PALETTES: Record<'day' | 'dark' | 'night', Palette> = {
  day: {
    bg: '#EEEBE2', water: '#A9C8DE', waterLine: '#7FA9C7', wood: '#CFDDBF', grass: '#DCE6CC', wetland: '#C7D9CF', sand: '#EDE2C4', farm: '#E8E5D2',
    residential: '#E6E1D6', industrial: '#E2DBD9', park: '#C6DCB4', parkLine: '#3E7A3A', building: '#D8D0C3', buildingLine: '#C4BAAA',
    motorway: '#E7894E', trunk: '#EBA35C', primary: '#F2C56B', secondary: '#F7E08F', minor: '#FFFFFF', casing: '#A89F90', track: '#8A6A3E', path: '#7A5C3A', rail: '#8C8C8C',
    boundary: '#8E6F9C', text: '#1E211D', textMuted: '#4A4F49', halo: '#FFFFFF', waterText: '#2B5D82', parkText: '#2F5D2E',
  },
  dark: {
    bg: '#1A1D1B', water: '#24384A', waterLine: '#2F4C63', wood: '#21302A', grass: '#242E25', wetland: '#22302F', sand: '#2E2B22', farm: '#262722',
    residential: '#232624', industrial: '#272425', park: '#203423', parkLine: '#5E9C5A', building: '#2D302D', buildingLine: '#383B37',
    motorway: '#B4653B', trunk: '#A86E3F', primary: '#97793F', secondary: '#7D7448', minor: '#4A4E49', casing: '#121412', track: '#9A7A4C', path: '#8B6E46', rail: '#5D5D5D',
    boundary: '#8E6F9C', text: '#E6E8E3', textMuted: '#A6ABA4', halo: '#0E100F', waterText: '#8FB7D8', parkText: '#8FC08A',
  },
  night: {
    bg: '#000000', water: '#1A0000', waterLine: '#4A0A06', wood: '#0D0202', grass: '#0A0202', wetland: '#120303', sand: '#0E0503', farm: '#0A0303',
    residential: '#0C0202', industrial: '#0E0303', park: '#100303', parkLine: '#7A140D', building: '#170404', buildingLine: '#260706',
    motorway: '#FF4A3D', trunk: '#E0392E', primary: '#C7322A', secondary: '#A82A23', minor: '#6E1A15', casing: '#000000', track: '#B3261E', path: '#9C211A', rail: '#5A120E',
    boundary: '#7A140D', text: '#FF4A3D', textMuted: '#C7322A', halo: '#000000', waterText: '#E0392E', parkText: '#C7322A',
  },
};

export const FONT = ['Noto Sans Regular'];
export const FONT_BOLD = ['Noto Sans Medium'];
export const FONT_ITALIC = ['Noto Sans Italic'];

const nameExpr: ExpressionSpecification = ['coalesce', ['get', 'name:en'], ['get', 'name_en'], ['get', 'name']];

function vectorLayers(src: string, p: Palette, opt: { minzoom?: number; labels: boolean; saver: boolean }): LayerSpecification[] {
  const mz = opt.minzoom ?? 0;
  const L: LayerSpecification[] = [];
  const id = (s: string) => `${src}-${s}`;
  const roadWidth = (base: number | ExpressionSpecification, extra = 0): ExpressionSpecification =>
    ['interpolate', ['exponential', 1.5], ['zoom'], 5, ['+', ['*', base, 0.3], extra], 10, ['+', ['*', base, 1.2], extra], 14, ['+', ['*', base, 4], extra], 18, ['+', ['*', base, 18], extra]] as ExpressionSpecification;
  const majorK: ExpressionSpecification = ['match', ['get', 'class'], 'motorway', 2.2, 'trunk', 2, 'primary', 1.7, 1.4];
  L.push(
    { id: id('landcover-wood'), type: 'fill', source: src, 'source-layer': 'landcover', minzoom: mz, filter: ['==', ['get', 'class'], 'wood'], paint: { 'fill-color': p.wood } },
    { id: id('landcover-grass'), type: 'fill', source: src, 'source-layer': 'landcover', minzoom: mz, filter: ['in', ['get', 'class'], ['literal', ['grass', 'farmland']]], paint: { 'fill-color': p.grass } },
    { id: id('landcover-wetland'), type: 'fill', source: src, 'source-layer': 'landcover', minzoom: mz, filter: ['==', ['get', 'class'], 'wetland'], paint: { 'fill-color': p.wetland } },
    { id: id('landcover-sand'), type: 'fill', source: src, 'source-layer': 'landcover', minzoom: mz, filter: ['==', ['get', 'class'], 'sand'], paint: { 'fill-color': p.sand } },
    { id: id('landuse-res'), type: 'fill', source: src, 'source-layer': 'landuse', minzoom: Math.max(mz, 9), filter: ['in', ['get', 'class'], ['literal', ['residential', 'suburb', 'neighbourhood']]], paint: { 'fill-color': p.residential } },
    { id: id('landuse-ind'), type: 'fill', source: src, 'source-layer': 'landuse', minzoom: Math.max(mz, 10), filter: ['in', ['get', 'class'], ['literal', ['industrial', 'commercial', 'retail', 'railway']]], paint: { 'fill-color': p.industrial } },
    { id: id('park'), type: 'fill', source: src, 'source-layer': 'park', minzoom: mz, paint: { 'fill-color': p.park, 'fill-opacity': 0.55 } },
    { id: id('park-outline'), type: 'line', source: src, 'source-layer': 'park', minzoom: Math.max(mz, 8), paint: { 'line-color': p.parkLine, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.6, 14, 2], 'line-dasharray': [3, 2], 'line-opacity': 0.8 } },
    { id: id('water'), type: 'fill', source: src, 'source-layer': 'water', minzoom: mz, paint: { 'fill-color': p.water } },
    { id: id('waterway'), type: 'line', source: src, 'source-layer': 'waterway', minzoom: Math.max(mz, 8), paint: { 'line-color': p.waterLine, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 14, ['match', ['get', 'class'], 'river', 4, 'canal', 3, 1.5], 18, ['match', ['get', 'class'], 'river', 14, 'canal', 8, 4]] } },
  );
  if (!opt.saver) {
    L.push({ id: id('building'), type: 'fill', source: src, 'source-layer': 'building', minzoom: Math.max(mz, 14), paint: { 'fill-color': p.building, 'fill-outline-color': p.buildingLine } });
  }
  L.push(
    { id: id('boundary'), type: 'line', source: src, 'source-layer': 'boundary', minzoom: mz, filter: ['all', ['<=', ['get', 'admin_level'], 6], ['!=', ['get', 'maritime'], 1]], paint: { 'line-color': p.boundary, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 12, 1.6], 'line-dasharray': [4, 2, 1, 2], 'line-opacity': 0.7 } },
    // forest roads, tracks and trails: drawn bold so they stand out for getting around the Ocala NF
    { id: id('track'), type: 'line', source: src, 'source-layer': 'transportation', minzoom: Math.max(mz, 11), filter: ['==', ['get', 'class'], 'track'], paint: { 'line-color': p.track, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.8, 14, 2, 18, 5], 'line-dasharray': [3, 1.5] } },
    { id: id('path'), type: 'line', source: src, 'source-layer': 'transportation', minzoom: Math.max(mz, 12), filter: ['==', ['get', 'class'], 'path'], paint: { 'line-color': p.path, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.6, 16, 2], 'line-dasharray': [1.5, 1.5] } },
    { id: id('rail'), type: 'line', source: src, 'source-layer': 'transportation', minzoom: Math.max(mz, 9), filter: ['==', ['get', 'class'], 'rail'], paint: { 'line-color': p.rail, 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.6, 16, 2] } },
    { id: id('road-minor-case'), type: 'line', source: src, 'source-layer': 'transportation', minzoom: Math.max(mz, 12), filter: ['in', ['get', 'class'], ['literal', ['minor', 'service', 'tertiary']]], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': p.casing, 'line-width': roadWidth(1, 1.5) } },
    { id: id('road-minor'), type: 'line', source: src, 'source-layer': 'transportation', minzoom: Math.max(mz, 10), filter: ['in', ['get', 'class'], ['literal', ['minor', 'service', 'tertiary']]], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': p.minor, 'line-width': roadWidth(1) } },
    { id: id('road-major-case'), type: 'line', source: src, 'source-layer': 'transportation', minzoom: Math.max(mz, 8), filter: ['in', ['get', 'class'], ['literal', ['primary', 'secondary', 'trunk', 'motorway']]], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': p.casing, 'line-width': roadWidth(majorK, 1.5) } },
    {
      id: id('road-major'), type: 'line', source: src, 'source-layer': 'transportation', minzoom: mz, filter: ['in', ['get', 'class'], ['literal', ['primary', 'secondary', 'trunk', 'motorway']]], layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ['match', ['get', 'class'], 'motorway', p.motorway, 'trunk', p.trunk, 'primary', p.primary, p.secondary], 'line-width': roadWidth(majorK) },
    },
  );
  if (opt.labels) {
    L.push(
      { id: id('water-name'), type: 'symbol', source: src, 'source-layer': 'water_name', minzoom: Math.max(mz, 9), layout: { 'text-field': nameExpr, 'text-font': FONT_ITALIC, 'text-size': ['interpolate', ['linear'], ['zoom'], 9, 11, 15, 16], 'text-max-width': 8 }, paint: { 'text-color': p.waterText, 'text-halo-color': p.halo, 'text-halo-width': 1.5 } },
      { id: id('waterway-name'), type: 'symbol', source: src, 'source-layer': 'waterway', minzoom: Math.max(mz, 13), layout: { 'symbol-placement': 'line', 'text-field': nameExpr, 'text-font': FONT_ITALIC, 'text-size': 12 }, paint: { 'text-color': p.waterText, 'text-halo-color': p.halo, 'text-halo-width': 1.5 } },
      { id: id('park-name'), type: 'symbol', source: src, 'source-layer': 'park', minzoom: Math.max(mz, 9), filter: ['has', 'name'], layout: { 'text-field': nameExpr, 'text-font': FONT_ITALIC, 'text-size': ['interpolate', ['linear'], ['zoom'], 9, 11, 14, 14], 'text-max-width': 9 }, paint: { 'text-color': p.parkText, 'text-halo-color': p.halo, 'text-halo-width': 1.5 } },
      { id: id('road-name'), type: 'symbol', source: src, 'source-layer': 'transportation_name', minzoom: Math.max(mz, 13), layout: { 'symbol-placement': 'line', 'text-field': nameExpr, 'text-font': FONT, 'text-size': ['interpolate', ['linear'], ['zoom'], 13, 11, 18, 16], 'text-max-angle': 30 }, paint: { 'text-color': p.text, 'text-halo-color': p.halo, 'text-halo-width': 2 } },
      { id: id('track-name'), type: 'symbol', source: src, 'source-layer': 'transportation_name', minzoom: Math.max(mz, 13), filter: ['in', ['get', 'class'], ['literal', ['track', 'path']]], layout: { 'symbol-placement': 'line', 'text-field': nameExpr, 'text-font': FONT, 'text-size': 11 }, paint: { 'text-color': p.track, 'text-halo-color': p.halo, 'text-halo-width': 2 } },
      {
        id: id('road-ref'), type: 'symbol', source: src, 'source-layer': 'transportation_name', minzoom: Math.max(mz, 8), filter: ['all', ['has', 'ref'], ['<=', ['get', 'ref_length'], 5]],
        layout: { 'symbol-placement': 'line', 'symbol-spacing': 400, 'text-field': ['get', 'ref'], 'text-font': FONT_BOLD, 'text-size': 11, 'icon-image': ['concat', 'generic_shield-', ['to-string', ['get', 'ref_length']], 'char'], 'icon-rotation-alignment': 'viewport', 'text-rotation-alignment': 'viewport' },
        paint: { 'text-color': '#1E211D' },
      },
      { id: id('housenumber'), type: 'symbol', source: src, 'source-layer': 'housenumber', minzoom: Math.max(mz, 17), layout: { 'text-field': ['get', 'housenumber'], 'text-font': FONT, 'text-size': 10 }, paint: { 'text-color': p.textMuted, 'text-halo-color': p.halo, 'text-halo-width': 1 } },
      {
        id: id('place'), type: 'symbol', source: src, 'source-layer': 'place', minzoom: mz,
        filter: ['in', ['get', 'class'], ['literal', ['city', 'town', 'village', 'hamlet', 'suburb', 'neighbourhood', 'locality']]],
        layout: {
          'text-field': nameExpr, 'text-font': ['match', ['get', 'class'], ['city', 'town'], ['literal', FONT_BOLD], ['literal', FONT]] as unknown as string[],
          'text-size': ['match', ['get', 'class'], 'city', ['interpolate', ['linear'], ['zoom'], 5, 13, 12, 22], 'town', ['interpolate', ['linear'], ['zoom'], 7, 12, 14, 19], ['interpolate', ['linear'], ['zoom'], 10, 11, 15, 15]],
          'text-max-width': 8, 'symbol-sort-key': ['get', 'rank'],
        },
        paint: { 'text-color': p.text, 'text-halo-color': p.halo, 'text-halo-width': 2 },
      },
    );
  }
  return L;
}

export type StyleOptions = {
  theme: 'day' | 'dark' | 'night';
  saver: boolean;
  base: string | null; // pmtiles:// urls, null when the pack isn't installed
  detail: string | null;
  topo: string | null;
  showTopo: boolean;
  topoOpacity: number;
  glyphs: string;
  sprite: string;
};

export function buildStyle(o: StyleOptions): StyleSpecification {
  const p = PALETTES[o.theme];
  const sources: StyleSpecification['sources'] = {};
  const layers: LayerSpecification[] = [{ id: 'background', type: 'background', paint: { 'background-color': p.bg } }];
  // Base: all of Florida to zoom 13 (overzoomed beyond). Detail: Lake County to Ocala NF, zoom 15.
  // The base file has the detail area cut out, so the two never draw the same roads twice.
  if (o.base) {
    sources.base = { type: 'vector', url: o.base, attribution: '© OpenMapTiles © OpenStreetMap contributors' };
    layers.push(...vectorLayers('base', p, { labels: true, saver: o.saver }));
  }
  if (o.detail) {
    sources.detail = { type: 'vector', url: o.detail, attribution: '© OpenMapTiles © OpenStreetMap contributors' };
    layers.push(...vectorLayers('detail', p, { minzoom: 6, labels: true, saver: o.saver }));
  }
  if (o.topo) {
    sources.topo = { type: 'raster', url: o.topo, tileSize: 256, attribution: 'USGS US Topo (public domain)' };
    layers.push({
      id: 'topo', type: 'raster', source: 'topo', minzoom: 9,
      layout: { visibility: o.showTopo ? 'visible' : 'none' },
      paint: {
        'raster-opacity': o.topoOpacity,
        ...(o.theme === 'night' ? { 'raster-hue-rotate': 0, 'raster-saturation': -1, 'raster-brightness-max': 0.35, 'raster-contrast': 0.2 } : o.theme === 'dark' ? { 'raster-brightness-max': 0.7 } : {}),
      },
    });
  }
  // move label layers above the topo overlay so names stay readable on top of it
  const labels = layers.filter((l) => l.type === 'symbol');
  const rest = layers.filter((l) => l.type !== 'symbol');
  return {
    version: 8,
    name: `Grid-Down Hub ${o.theme}`,
    glyphs: o.glyphs,
    sprite: o.sprite,
    sources,
    layers: [...rest, ...labels],
  };
}
