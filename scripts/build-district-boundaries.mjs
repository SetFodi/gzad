// Rebuilds src/lib/district-boundaries.ts from OpenStreetMap.
//
//   node scripts/build-district-boundaries.mjs            fetch from the OSM API
//   node scripts/build-district-boundaries.mjs --data DIR  use rel-<id>.json files already downloaded
//
// Tbilisi's ten districts are mapped in OpenStreetMap as administrative
// boundaries (admin_level 10), traced from the city's official act on district
// borders (Tbilisi Sakrebulo decision 1-4 of 28 Jan 2013, as amended 5 Dec 2014,
// matsne.gov.ge document 1825602).
//
// Each border way is simplified once (Douglas–Peucker, TOLERANCE_M), so two
// districts sharing a border keep exactly the same points along it: no gaps
// or overlaps between them.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const TOLERANCE_M = 8
const OUT = join(dirname(fileURLToPath(import.meta.url)), '../src/lib/district-boundaries.ts')

// OSM relation id → the district name pricing uses (pricing_config.district_tiers).
const RELATIONS = {
  13438811: 'Mtatsminda',
  11300449: 'Vake',
  11300446: 'Saburtalo',
  13438809: 'Krtsanisi',
  13438808: 'Isani',
  11300436: 'Samgori',
  13438810: 'Chughureti',
  11300445: 'Didube',
  11300438: 'Nadzaladevi',
  13438812: 'Gldani',
}

const dataArg = process.argv.indexOf('--data')
const dataDir = dataArg > 0 ? process.argv[dataArg + 1] : null

async function load(id) {
  if (dataDir) return JSON.parse(readFileSync(join(dataDir, `rel-${id}.json`), 'utf8'))
  const res = await fetch(`https://api.openstreetmap.org/api/0.6/relation/${id}/full.json`, {
    headers: { 'User-Agent': 'gzad-district-boundaries/1.0' },
  })
  if (!res.ok) throw new Error(`relation ${id}: OSM API returned ${res.status}`)
  await new Promise((r) => setTimeout(r, 1000))   // be gentle with the public API
  return res.json()
}

const nodes = new Map()
const ways = new Map()
const rels = new Map()
for (const id of Object.keys(RELATIONS)) {
  for (const e of (await load(id)).elements) {
    if (e.type === 'node') nodes.set(e.id, [e.lat, e.lon])
    if (e.type === 'way') ways.set(e.id, e.nodes)
    if (e.type === 'relation') rels.set(e.id, e)
  }
}

// Local metres around Tbilisi.
const mPerDegLat = 111132
const mPerDegLng = 111320 * Math.cos((41.72 * Math.PI) / 180)
const xy = ([lat, lng]) => [lng * mPerDegLng, lat * mPerDegLat]

function simplify(points) {
  if (points.length <= 2) return points
  const p = points.map(xy)
  const keep = new Uint8Array(points.length)
  keep[0] = keep[points.length - 1] = 1
  const stack = [[0, points.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()
    const [ax, ay] = p[a]
    const dx = p[b][0] - ax, dy = p[b][1] - ay, len2 = dx * dx + dy * dy
    let worst = -1, worstD = 0
    for (let i = a + 1; i < b; i++) {
      const t = len2 ? Math.max(0, Math.min(1, ((p[i][0] - ax) * dx + (p[i][1] - ay) * dy) / len2)) : 0
      const d = Math.hypot(p[i][0] - (ax + t * dx), p[i][1] - (ay + t * dy))
      if (d > worstD) { worstD = d; worst = i }
    }
    if (worstD > TOLERANCE_M) { keep[worst] = 1; stack.push([a, worst], [worst, b]) }
  }
  return points.filter((_, i) => keep[i])
}

const simplified = new Map()
function wayPoints(id) {
  if (!simplified.has(id)) {
    const ids = ways.get(id)
    const pts = ids.map((n) => { const c = nodes.get(n); if (!c) throw new Error(`node ${n} missing`); return c })
    let out
    if (ids[0] === ids.at(-1) && pts.length > 4) {   // a ring in one way: simplify in two halves so it can't collapse
      const mid = Math.floor(pts.length / 2)
      out = [...simplify(pts.slice(0, mid + 1)).slice(0, -1), ...simplify(pts.slice(mid))]
    } else out = simplify(pts)
    simplified.set(id, { first: ids[0], last: ids.at(-1), pts: out })
  }
  return simplified.get(id)
}

function outerRings(rel) {
  const parts = rel.members.filter((m) => m.type === 'way' && (m.role === 'outer' || m.role === '')).map((m) => wayPoints(m.ref))
  if (rel.members.some((m) => m.role === 'inner')) throw new Error(`${rel.tags['name:en']} has holes: the district model needs extending`)
  const rings = []
  while (parts.length) {
    const first = parts.shift()
    const ring = [...first.pts]
    let end = first.last
    while (end !== first.first) {
      const i = parts.findIndex((p) => p.first === end || p.last === end)
      if (i < 0) throw new Error(`${rel.tags['name:en']}: border does not close at node ${end}`)
      const p = parts.splice(i, 1)[0]
      ring.push(...(p.first === end ? p.pts : [...p.pts].reverse()).slice(1))
      end = p.first === end ? p.last : p.first
    }
    ring.pop()   // closing point repeats the first
    rings.push(ring)
  }
  return rings
}

const round = (v) => Math.round(v * 1e5) / 1e5   // ~1 m
const entries = []
for (const [id, name] of Object.entries(RELATIONS)) {
  const rel = rels.get(Number(id))
  if (!rel) throw new Error(`relation ${id} (${name}) not in the data`)
  const rings = outerRings(rel)
  if (rings.length !== 1) throw new Error(`${name} has ${rings.length} separate parts: the district model needs extending`)
  const ring = rings[0].map(([lat, lng]) => [round(lat), round(lng)])
  const lines = []
  for (let i = 0; i < ring.length; i += 8) lines.push('    ' + ring.slice(i, i + 8).map(([a, b]) => `[${a}, ${b}]`).join(', ') + ',')
  entries.push(`  // ${rel.tags.name} (${rel.tags['name:en']}), OSM relation ${id}, version ${rel.version}, ${ring.length} points\n  ${name}: [\n${lines.join('\n')}\n  ],`)
}
const stamp = [...rels.values()].map((r) => r.timestamp).sort().at(-1)

writeFileSync(OUT, `// Generated by scripts/build-district-boundaries.mjs. Do not edit by hand:
// run the script again to update from OpenStreetMap.
//
// Tbilisi district borders: OpenStreetMap administrative boundaries, last
// edited ${stamp}, simplified to within ${TOLERANCE_M} m with shared borders kept identical.
// © OpenStreetMap contributors, available under the Open Database License (ODbL):
// https://www.openstreetmap.org/copyright
//
// Each border is a closed ring of [lat, lng] points (the first point is not repeated).

export const DISTRICT_BOUNDARIES: Record<string, [number, number][]> = {
${entries.join('\n')}
}
`)
console.log(`wrote ${OUT}: ${entries.length} districts, OSM data as of ${stamp}`)
