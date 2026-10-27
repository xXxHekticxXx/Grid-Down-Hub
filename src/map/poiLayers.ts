// Map point layers built from OpenStreetMap (and the county shelter list), drawn as bold
// lettered markers that stay readable on the TV and in red night mode.
export type PoiLayer = { id: string; title: string; file: string; color: string; letter: string; minzoom: number; group: string; note?: string };

export const POI_LAYERS: PoiLayer[] = [
  { id: 'hospital', title: 'Hospitals & ERs', file: 'poi-hospital.geojson', color: '#B3141C', letter: 'H', minzoom: 6, group: 'Medical' },
  { id: 'urgent_care', title: 'Urgent care', file: 'poi-urgent_care.geojson', color: '#D0453B', letter: 'U', minzoom: 9, group: 'Medical' },
  { id: 'pharmacy', title: 'Pharmacies', file: 'poi-pharmacy.geojson', color: '#2E7D6B', letter: 'Rx', minzoom: 10, group: 'Medical' },
  { id: 'shelter', title: 'Lake County shelters', file: 'poi-shelter.geojson', color: '#1F5C36', letter: 'S', minzoom: 7, group: 'Safety', note: 'Confirm open via AlertLake' },
  { id: 'fire', title: 'Fire stations', file: 'poi-fire.geojson', color: '#C2410C', letter: 'F', minzoom: 10, group: 'Safety' },
  { id: 'police', title: 'Police', file: 'poi-police.geojson', color: '#1D4E89', letter: 'P', minzoom: 10, group: 'Safety' },
  { id: 'ranger', title: 'Ranger stations', file: 'poi-ranger.geojson', color: '#3E6B2F', letter: 'R', minzoom: 9, group: 'Safety' },
  { id: 'gas', title: 'Gas stations', file: 'poi-gas.geojson', color: '#6B4B9A', letter: 'G', minzoom: 9, group: 'Supplies' },
  { id: 'grocery', title: 'Grocery stores', file: 'poi-grocery.geojson', color: '#8A5A00', letter: 'Gr', minzoom: 10, group: 'Supplies' },
  { id: 'store', title: 'Convenience stores', file: 'poi-store.geojson', color: '#9A6A1A', letter: 'C', minzoom: 12, group: 'Supplies' },
  { id: 'hardware', title: 'Hardware & feed stores', file: 'poi-hardware.geojson', color: '#5B5B5B', letter: 'Hw', minzoom: 10, group: 'Supplies' },
  { id: 'outdoor', title: 'Outdoor & sporting goods', file: 'poi-outdoor.geojson', color: '#4D6B2E', letter: 'O', minzoom: 10, group: 'Supplies' },
  { id: 'spring', title: 'Springs', file: 'poi-spring.geojson', color: '#1E6FA8', letter: 'W', minzoom: 8, group: 'Water', note: 'Treat before drinking' },
  { id: 'water_tap', title: 'Water taps', file: 'poi-water_tap.geojson', color: '#2A86C7', letter: 'T', minzoom: 12, group: 'Water', note: 'Treat before drinking' },
  { id: 'boat_ramp', title: 'Boat ramps', file: 'poi-boat_ramp.geojson', color: '#3B7FA8', letter: 'B', minzoom: 11, group: 'Water', note: 'Treat before drinking' },
  { id: 'lake', title: 'Lakes (names)', file: 'poi-lake.geojson', color: '#4B93C3', letter: 'L', minzoom: 12, group: 'Water', note: 'Treat before drinking' },
  { id: 'campground', title: 'Campgrounds', file: 'poi-campground.geojson', color: '#2F6B3A', letter: 'Ca', minzoom: 9, group: 'Outdoors' },
  { id: 'park', title: 'Parks & forests', file: 'poi-park.geojson', color: '#3E7A3A', letter: 'Pk', minzoom: 11, group: 'Outdoors' },
  { id: 'church', title: 'Churches', file: 'poi-church.geojson', color: '#6B5A7A', letter: '+', minzoom: 13, group: 'Community' },
  { id: 'school', title: 'Schools', file: 'poi-school.geojson', color: '#7A6A3A', letter: 'Sc', minzoom: 13, group: 'Community' },
];

/** Draw a round marker with letters onto a canvas and return ImageData for map.addImage. */
export function markerImage(color: string, letter: string, night: boolean, ratio = 2) {
  const size = 30 * ratio;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.beginPath();
  g.arc(size / 2, size / 2, size / 2 - 2 * ratio, 0, Math.PI * 2);
  g.fillStyle = night ? '#000000' : color;
  g.fill();
  g.lineWidth = 2.5 * ratio;
  g.strokeStyle = night ? '#FF4A3D' : '#FFFFFF';
  g.stroke();
  g.fillStyle = night ? '#FF4A3D' : '#FFFFFF';
  g.font = `bold ${(letter.length > 1 ? 12 : 15) * ratio}px sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(letter, size / 2, size / 2 + ratio);
  return { img: g.getImageData(0, 0, size, size), ratio };
}
