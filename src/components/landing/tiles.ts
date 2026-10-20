// A tile map of the ten districts the platform bills against (lib/districts.ts),
// laid out on a 4 × 4 grid in roughly their real positions, north at the top.

export type Tier = '1' | '2' | '3' | '4'

export interface DistrictTile {
  name: string
  col: number
  colSpan: number
  row: number
  rowSpan: number
  /** Example pricing tier used by the pricing illustration. Real tiers live in pricing_config. */
  tier: Tier
}

export const TILES: DistrictTile[] = [
  { name: 'Saburtalo', col: 1, colSpan: 1, row: 1, rowSpan: 2, tier: '2' },
  { name: 'Gldani', col: 2, colSpan: 3, row: 1, rowSpan: 1, tier: '4' },
  { name: 'Didube', col: 2, colSpan: 1, row: 2, rowSpan: 1, tier: '3' },
  { name: 'Nadzaladevi', col: 3, colSpan: 2, row: 2, rowSpan: 1, tier: '4' },
  { name: 'Vake', col: 1, colSpan: 1, row: 3, rowSpan: 2, tier: '1' },
  { name: 'Mtatsminda', col: 2, colSpan: 1, row: 3, rowSpan: 1, tier: '1' },
  { name: 'Chughureti', col: 3, colSpan: 1, row: 3, rowSpan: 1, tier: '2' },
  { name: 'Samgori', col: 4, colSpan: 1, row: 3, rowSpan: 2, tier: '4' },
  { name: 'Krtsanisi', col: 2, colSpan: 1, row: 4, rowSpan: 1, tier: '3' },
  { name: 'Isani', col: 3, colSpan: 1, row: 4, rowSpan: 1, tier: '3' },
]

export const tileByName = Object.fromEntries(TILES.map((t) => [t.name, t])) as Record<string, DistrictTile>

export const gridArea = (t: DistrictTile) => ({
  gridColumn: `${t.col} / span ${t.colSpan}`,
  gridRow: `${t.row} / span ${t.rowSpan}`,
})

/** Top-right corner of a tile as a percentage of the map, for placing a marker on it. */
export const tileCorner = (t: DistrictTile) => ({
  x: ((t.col - 1 + t.colSpan) / 4) * 100,
  y: ((t.row - 1) / 4) * 100,
})
