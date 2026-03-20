// Tbilisi administrative district polygons
// Coordinates are [lat, lng] pairs forming closed polygons
// Approximate boundaries based on official raion divisions

export interface District {
  name: string
  color: string
  neighborhoods: string[]
  polygon: [number, number][]
}

export const TBILISI_DISTRICTS: District[] = [
  {
    name: 'Mtatsminda',
    color: '#FF3333',
    neighborhoods: ['Rustaveli', 'Liberty Square', 'Sololaki', 'Okrokana'],
    polygon: [
      [41.706, 44.768],
      [41.706, 44.826],
      [41.693, 44.826],
      [41.682, 44.812],
      [41.678, 44.795],
      [41.680, 44.768],
    ],
  },
  {
    name: 'Vake',
    color: '#00BFA5',
    neighborhoods: ['Vake', 'Vera', 'Bagebi', 'Tskneti'],
    polygon: [
      [41.776, 44.718],
      [41.776, 44.800],
      [41.706, 44.800],
      [41.706, 44.768],
      [41.695, 44.718],
    ],
  },
  {
    name: 'Saburtalo',
    color: '#0288D1',
    neighborhoods: ['Saburtalo', 'Didi Dighomi', 'Nutsubidze', 'Lisi'],
    polygon: [
      [41.842, 44.718],
      [41.842, 44.802],
      [41.776, 44.802],
      [41.776, 44.718],
    ],
  },
  {
    name: 'Chughureti',
    color: '#2E7D32',
    neighborhoods: ['Marjanishvili', 'Plekhanov', 'Station Square'],
    polygon: [
      [41.739, 44.782],
      [41.739, 44.850],
      [41.683, 44.850],
      [41.683, 44.826],
      [41.693, 44.826],
      [41.706, 44.826],
      [41.706, 44.782],
    ],
  },
  {
    name: 'Didube',
    color: '#F9A825',
    neighborhoods: ['Tsereteli', 'Didube', 'Dighomi Massive'],
    polygon: [
      [41.796, 44.782],
      [41.796, 44.850],
      [41.739, 44.850],
      [41.739, 44.782],
    ],
  },
  {
    name: 'Nadzaladevi',
    color: '#AB47BC',
    neighborhoods: ['Temka', 'Sanzona', 'Lotkini'],
    polygon: [
      [41.800, 44.848],
      [41.800, 44.915],
      [41.739, 44.915],
      [41.739, 44.848],
    ],
  },
  {
    name: 'Gldani',
    color: '#00897B',
    neighborhoods: ['Gldani', 'Mukhiani', 'Avchala'],
    polygon: [
      [41.895, 44.798],
      [41.895, 44.915],
      [41.800, 44.915],
      [41.800, 44.798],
    ],
  },
  {
    name: 'Isani',
    color: '#F57F17',
    neighborhoods: ['Avlabari', 'Isani', 'Vazisubani'],
    polygon: [
      [41.706, 44.826],
      [41.706, 44.910],
      [41.660, 44.910],
      [41.660, 44.826],
      [41.682, 44.812],
      [41.693, 44.826],
    ],
  },
  {
    name: 'Samgori',
    color: '#E64A19',
    neighborhoods: ['Varketili', 'Airport', 'Lilo', 'Africa'],
    polygon: [
      [41.693, 44.908],
      [41.693, 45.015],
      [41.605, 45.015],
      [41.605, 44.908],
    ],
  },
  {
    name: 'Krtsanisi',
    color: '#1565C0',
    neighborhoods: ['Old Town', 'Ortachala', 'Ponichala'],
    polygon: [
      [41.700, 44.793],
      [41.700, 44.870],
      [41.660, 44.870],
      [41.655, 44.840],
      [41.660, 44.826],
      [41.660, 44.793],
    ],
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

export function getDistrictsForPoint(lat: number, lng: number): string[] {
  return TBILISI_DISTRICTS
    .filter(d => pointInPolygon(lat, lng, d.polygon))
    .map(d => d.name)
}
