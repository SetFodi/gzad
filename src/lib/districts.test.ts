import { describe, expect, it } from 'vitest'
import { DISTRICT_NAMES, TBILISI_DISTRICTS, getDistrictsForPoint } from './districts'

// Places with well-known districts, positions from OpenStreetMap.
const PLACES: [string, number, number, string][] = [
  ['Freedom Square', 41.69383, 44.80142, 'Mtatsminda'],
  ['Rustaveli metro', 41.70318, 44.79113, 'Mtatsminda'],
  ['Sololaki', 41.69052, 44.79802, 'Mtatsminda'],
  ['Vake Park', 41.70854, 44.74779, 'Vake'],
  ['Bagebi', 41.70821, 44.73109, 'Vake'],
  ['Didi Dighomi', 41.78844, 44.75283, 'Saburtalo'],
  ['Marjanishvili metro', 41.70959, 44.79687, 'Chughureti'],
  ['Station Square', 41.72111, 44.79803, 'Chughureti'],
  ['Tsereteli metro', 41.72641, 44.78766, 'Didube'],
  ['Dighomi Massive', 41.76266, 44.77492, 'Didube'],
  // The official border leaves the Didube railway yard, and the metro station beside it, out of Didube district.
  ['Didube metro', 41.75002, 44.78051, 'Nadzaladevi'],
  ['Sanzona', 41.76597, 44.79256, 'Nadzaladevi'],
  ['Lotkini', 41.73551, 44.81667, 'Nadzaladevi'],
  ['Akhmeteli Theatre metro', 41.79106, 44.815, 'Gldani'],
  ['Mukhiani', 41.78671, 44.84083, 'Gldani'],
  ['Avlabari metro', 41.69254, 44.81466, 'Isani'],
  ['Isani metro', 41.68663, 44.83996, 'Isani'],
  ['Varketili metro', 41.6919, 44.87088, 'Samgori'],
  ['Lilo', 41.70896, 44.98381, 'Samgori'],
  ['Tbilisi International Airport', 41.66855, 44.95593, 'Samgori'],
  ['Ortachala bus station', 41.67557, 44.83435, 'Krtsanisi'],
  ['Ponichala', 41.64436, 44.91076, 'Krtsanisi'],
]

describe('Tbilisi districts', () => {
  it('are the ten districts pricing tiers are keyed by', () => {
    expect([...DISTRICT_NAMES].sort()).toEqual(
      ['Chughureti', 'Didube', 'Gldani', 'Isani', 'Krtsanisi', 'Mtatsminda', 'Nadzaladevi', 'Saburtalo', 'Samgori', 'Vake'])
  })

  it.each(PLACES)('puts %s in the right district', (_place, lat, lng, district) => {
    expect(getDistrictsForPoint(lat, lng)).toEqual([district])
  })

  it('leaves places outside Tbilisi out of every district', () => {
    expect(getDistrictsForPoint(41.5495, 45.0010)).toEqual([])   // Rustavi
    expect(getDistrictsForPoint(41.8458, 44.7209)).toEqual([])   // Mtskheta
  })

  it('never puts a point in two districts', () => {
    const all = TBILISI_DISTRICTS.flatMap(d => d.polygon)
    const lats = all.map(p => p[0]), lngs = all.map(p => p[1])
    let inside = 0
    for (let lat = Math.min(...lats); lat <= Math.max(...lats); lat += 0.002) {
      for (let lng = Math.min(...lngs); lng <= Math.max(...lngs); lng += 0.002) {
        const hits = getDistrictsForPoint(lat, lng)
        expect(hits.length, `${lat.toFixed(4)}, ${lng.toFixed(4)} in ${hits.join(' and ')}`).toBeLessThanOrEqual(1)
        inside += hits.length
      }
    }
    expect(inside).toBeGreaterThan(5000)   // the grid really crossed the city
  })
})
