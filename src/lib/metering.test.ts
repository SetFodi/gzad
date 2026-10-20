import { describe, expect, it } from 'vitest'
import { blockCost, parsePricingConfig, slotCost } from './billing'
import { groupByClient, priceBlocks, type PositionRow, type UsageRow } from './metering'

const config = parsePricingConfig([
  { key: 'district_tiers', value: { Vake: 1, Saburtalo: 2 } },
  { key: 'time_multipliers', value: { '12': 1.3 } }, // 08:00Z is 12:00 in Tbilisi
])
const campaigns = new Map([
  ['A', { client_id: 'c1', slot_duration: 10 }],
  ['B', { client_id: 'c1', slot_duration: 20 }],
  ['C', { client_id: 'c2', slot_duration: 30 }],
])
const START = '2026-10-15T08:00:00.000Z'
const metered = { mode: 'metered' as const, blockMinutes: 10, from: new Date(START) }

const use = (program: string, campaign: string | null, plays: number, billable: number, seconds: number, start = START): UsageRow => ({
  device_id: 'd1',
  block_start: start,
  program_name: program,
  campaign_id: campaign,
  plays,
  billable_plays: billable,
  typical_seconds: seconds,
})
const at = (lat: number, lng: number, n: number, firstAt: string, start = START): PositionRow => ({
  device_id: 'd1',
  block_start: start,
  lat,
  lng,
  n,
  first_at: firstAt,
})
const vake = (n: number, first = '2026-10-15T08:05:00Z') => at(41.73, 44.75, n, first)
const saburtalo = (n: number, first = '2026-10-15T08:01:00Z') => at(41.8, 44.75, n, first)

describe('priceBlocks (metered)', () => {
  it('prorates each campaign by its plays against the loop', () => {
    // Loop 10 + 20 = 30 s, so 20 passes fit in the block.
    const { charges } = priceBlocks(metered, [use('A', 'A', 20, 20, 10), use('B', 'B', 10, 10, 20)], [vake(15), saburtalo(5)], config, campaigns)
    const a = charges.find((c) => c.campaign_id === 'A')!
    const b = charges.find((c) => c.campaign_id === 'B')!
    expect(a).toMatchObject({ expected_plays: 20, proration: 1, district: 'Vake', time_multiplier: 1.3, billing_unit: 'block_10m' })
    expect(a.gross_cost).toBe(blockCost(2.0, 1.45, 1.3, 1))
    expect(b.proration).toBe(0.5)
    expect(b.gross_cost).toBe(blockCost(3.4, 1.45, 1.3, 0.5))
    expect(a.period_end).toBe('2026-10-15T08:10:00.000Z')
  })

  it('counts unmatched programs in the loop but never bills them', () => {
    const { charges } = priceBlocks(metered, [use('A', 'A', 15, 15, 10), use('B', 'B', 10, 10, 20), use('Other', null, 15, 0, 10)], [], config, campaigns)
    expect(charges.map((c) => c.campaign_id).sort()).toEqual(['A', 'B'])
    expect(charges[0].expected_plays).toBe(15) // 600 / 40
    expect(charges.find((c) => c.campaign_id === 'B')!.proration).toBe(0.6667)
  })

  it('bills plays only while the campaign was active', () => {
    const { charges } = priceBlocks(metered, [use('A', 'A', 60, 0, 10)], [], config, campaigns)
    expect(charges).toHaveLength(0)
  })

  it('treats two program names of one campaign as one slot', () => {
    const { charges } = priceBlocks(metered, [use('A', 'A', 10, 10, 10), use('A v2', 'A', 10, 10, 10)], [], config, campaigns)
    expect(charges).toHaveLength(1)
    expect(charges[0].plays).toBe(20)
    expect(charges[0].proration).toBe(0.6667) // loop 20 s → 30 expected
  })

  it('skips campaigns it does not know', () => {
    expect(priceBlocks(metered, [use('X', 'X', 60, 60, 10)], [], config, campaigns).charges).toHaveLength(0)
  })

  it('falls back to Unknown, tier 4, without a fix', () => {
    const { charges } = priceBlocks(metered, [use('A', 'A', 60, 60, 10)], [], config, campaigns)
    expect(charges[0]).toMatchObject({ district: 'Unknown', district_tier: 4, district_multiplier: 1 })
  })

  it('prices each campaign from its own recorded locations', () => {
    const positions = [
      { ...vake(10), campaign_id: 'A' },
      { ...saburtalo(10), campaign_id: 'B' },
    ]
    const { charges } = priceBlocks(metered, [use('A', 'A', 10, 10, 10), use('B', 'B', 10, 10, 20)], positions, config, campaigns)
    expect(charges.find(c => c.campaign_id === 'A')?.district).toBe('Vake')
    expect(charges.find(c => c.campaign_id === 'B')?.district).toBe('Saburtalo')
  })

  it('never uses another campaign location when this ad has no recorded location', () => {
    const { charges } = priceBlocks(metered, [use('A', 'A', 10, 10, 10), use('B', 'B', 10, 10, 20)], [{ ...vake(10), campaign_id: 'A' }], config, campaigns)
    expect(charges.find(c => c.campaign_id === 'B')?.district).toBe('Unknown')
  })

  it('charges a recorded play below ten percent coverage without a minimum cutoff', () => {
    const { charges } = priceBlocks(metered, [use('A', 'A', 1, 1, 10)], [], config, campaigns)
    expect(charges).toHaveLength(1)
    expect(charges[0].plays).toBe(1)
    expect(charges[0].proration).toBe(0.0167)
    expect(charges[0].gross_cost).toBeGreaterThan(0)
  })

  it('flags late blocks and blocks logging more airtime than they hold', () => {
    const late = '2026-10-15T07:00:00.000Z'
    const result = priceBlocks(
      metered,
      [use('A', 'A', 60, 60, 10), use('A', 'A', 120, 120, 10, late)],
      [],
      config,
      campaigns,
    )
    expect(result.blockCount).toBe(2)
    expect(result.lateBlocks).toBe(1)
    expect(result.suspectDeviceBlocks).toBe(1)
  })
})

describe('priceBlocks (hourly)', () => {
  const hourly = { mode: 'hourly' as const, blockMinutes: 60, from: new Date(START) }

  it('charges a full slot-hour for any play, at the first fix', () => {
    const { charges } = priceBlocks(hourly, [use('A', 'A', 3, 3, 10)], [vake(50), saburtalo(2)], config, campaigns)
    expect(charges[0]).toMatchObject({ billing_unit: 'slot_hour', proration: 1, district: 'Saburtalo' })
    expect(charges[0].gross_cost).toBe(slotCost(2.0, 1.25, 1.3))
    expect(charges[0].period_end).toBe('2026-10-15T09:00:00.000Z')
  })
})

describe('groupByClient', () => {
  it('groups charges under the campaign owner', () => {
    const { charges } = priceBlocks(metered, [use('A', 'A', 20, 20, 10), use('C', 'C', 5, 5, 30)], [], config, campaigns)
    const grouped = groupByClient(charges, campaigns)
    expect([...grouped.keys()].sort()).toEqual(['c1', 'c2'])
  })
})
