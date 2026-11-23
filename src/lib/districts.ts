// Tbilisi's ten administrative districts. Billing prices a play by the
// district its GPS position falls in (pricing_config.district_tiers is keyed by
// these names), unless Admin has saved its own map (district_polygons).
//
// Borders are the official ones as mapped in OpenStreetMap, generated into
// district-boundaries.ts by scripts/build-district-boundaries.mjs. Polygons are
// closed rings of [lat, lng] pairs.

import { DISTRICT_BOUNDARIES } from './district-boundaries'

export interface District {
  name: string
  color: string
  neighborhoods: string[]
  polygon: [number, number][]
}

function border(name: string): [number, number][] {
  const ring = DISTRICT_BOUNDARIES[name]
  if (!ring) throw new Error(`No border for district ${name}`)
  return ring
}

export const TBILISI_DISTRICTS: District[] = [
  {
    name: 'Mtatsminda',
    color: '#FF3333',
    neighborhoods: ['Rustaveli', 'Liberty Square', 'Sololaki', 'Vera', 'Okrokana'],
    polygon: border('Mtatsminda'),
  },
  {
    name: 'Vake',
    color: '#00BFA5',
    neighborhoods: ['Vake', 'Bagebi', 'Nutsubidze Plateau', 'Tskneti'],
    polygon: border('Vake'),
  },
  {
    name: 'Saburtalo',
    color: '#0288D1',
    neighborhoods: ['Saburtalo', 'Didi Dighomi', 'Lisi'],
    polygon: border('Saburtalo'),
  },
  {
    name: 'Chughureti',
    color: '#2E7D32',
    neighborhoods: ['Marjanishvili', 'Plekhanov', 'Station Square'],
    polygon: border('Chughureti'),
  },
  {
    name: 'Didube',
    color: '#F9A825',
    neighborhoods: ['Tsereteli', 'Didube', 'Dighomi Massive'],
    polygon: border('Didube'),
  },
  {
    name: 'Nadzaladevi',
    color: '#AB47BC',
    neighborhoods: ['Temka', 'Sanzona', 'Lotkini'],
    polygon: border('Nadzaladevi'),
  },
  {
    name: 'Gldani',
    color: '#00897B',
    neighborhoods: ['Gldani', 'Mukhiani', 'Avchala'],
    polygon: border('Gldani'),
  },
  {
    name: 'Isani',
    color: '#F57F17',
    neighborhoods: ['Avlabari', 'Isani', 'Vazisubani'],
    polygon: border('Isani'),
  },
  {
    name: 'Samgori',
    color: '#E64A19',
    neighborhoods: ['Varketili', 'Airport', 'Lilo', 'Africa'],
    polygon: border('Samgori'),
  },
  {
    name: 'Krtsanisi',
    color: '#1565C0',
    neighborhoods: ['Kala (Old Town)', 'Ortachala', 'Ponichala'],
    polygon: border('Krtsanisi'),
  },
]

export const DISTRICT_NAMES = TBILISI_DISTRICTS.map(d => d.name)

export function getDistrict(name: string): District | undefined {
  return TBILISI_DISTRICTS.find(d => d.name === name)
}

// Ray-casting point-in-polygon
function pointInPolygon(lat: number, lng: number, polygon: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i]
    const [yj, xj] = polygon[j]
    const intersect = ((yi > lat) !== (yj > lat)) &&
      (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

export function isPointInDistrict(lat: number, lng: number, districtName: string): boolean {
  const district = getDistrict(districtName)
  if (!district) return false
  return pointInPolygon(lat, lng, district.polygon)
}

export function getDistrictsForPoint(
  lat: number,
  lng: number,
  districts: Pick<District, 'name' | 'polygon'>[] = TBILISI_DISTRICTS,
): string[] {
  return districts
    .filter(d => pointInPolygon(lat, lng, d.polygon))
    .map(d => d.name)
}
