import { describe, expect, it } from 'vitest'
import {
  baseRateFor,
  money,
  parsePricingConfig,
  pendingPeriods,
  resolveDistrict,
  slotCost,
  DEFAULT_BASE_RATES,
} from './billing'

const HOUR = 60 * 60 * 1000

describe('pendingPeriods', () => {
  const now = new Date('2026-08-07T14:30:00Z')

  it('bills only the previous whole hour on a normal run', () => {
    const periods = pendingPeriods(new Date('2026-08-07T13:00:00Z'), now)
    expect(periods).toHaveLength(1)
    expect(periods[0].start.toISOString()).toBe('2026-08-07T13:00:00.000Z')
    expect(periods[0].end.toISOString()).toBe('2026-08-07T14:00:00.000Z')
  })

  it('never bills the hour still in progress', () => {
    const periods = pendingPeriods(new Date('2026-08-07T14:00:00Z'), now)
    expect(periods).toHaveLength(0)
  })

  it('catches up every missed hour after an outage', () => {
    const periods = pendingPeriods(new Date('2026-08-07T09:00:00Z'), now)
    expect(periods).toHaveLength(5)
    expect(periods[0].start.toISOString()).toBe('2026-08-07T09:00:00.000Z')
    expect(periods[4].end.toISOString()).toBe('2026-08-07T14:00:00.000Z')
  })

  it('produces contiguous, non-overlapping periods', () => {
    const periods = pendingPeriods(new Date('2026-08-07T08:00:00Z'), now)
    for (let i = 1; i < periods.length; i++) {
      expect(periods[i].start.getTime()).toBe(periods[i - 1].end.getTime())
    }
  })

  it('caps a long gap and keeps the most recent hours', () => {
    const periods = pendingPeriods(new Date('2026-07-01T00:00:00Z'), now, 26)
    expect(periods).toHaveLength(26)
    expect(periods[25].end.toISOString()).toBe('2026-08-07T14:00:00.000Z')
    expect(periods[0].start.getTime()).toBe(new Date('2026-08-07T14:00:00Z').getTime() - 26 * HOUR)
  })

  it('bills a single hour on a cold start', () => {
    const periods = pendingPeriods(null, now)
    expect(periods).toHaveLength(1)
    expect(periods[0].end.toISOString()).toBe('2026-08-07T14:00:00.000Z')
  })

  it('ignores a stray future timestamp rather than billing backwards', () => {
    expect(pendingPeriods(new Date('2026-08-09T00:00:00Z'), now)).toHaveLength(0)
  })
})

describe('parsePricingConfig', () => {
  it('falls back to defaults when the table is empty', () => {
    const config = parsePricingConfig([])
    expect(config.baseRates).toEqual(DEFAULT_BASE_RATES)
    expect(config.districtMultipliers['4']).toBe(1.0)
  })

  it('reads configured values', () => {
    const config = parsePricingConfig([
      { key: 'base_rates', value: { '10': 3, '20': 5, '30': 7 } },
      { key: 'time_multipliers', value: { '18': 1.3 } },
    ])
    expect(config.baseRates['30']).toBe(7)
    expect(config.timeMultipliers['18']).toBe(1.3)
  })
})

describe('baseRateFor', () => {
  const config = parsePricingConfig([])

  it('prices each slot length separately', () => {
    expect(baseRateFor(config, 10)).toBe(2.0)
    expect(baseRateFor(config, 20)).toBe(3.4)
    expect(baseRateFor(config, 30)).toBe(4.6)
  })

  it('falls back to the 10s rate for unknown durations', () => {
    expect(baseRateFor(config, 45)).toBe(2.0)
    expect(baseRateFor(config, null)).toBe(2.0)
  })
})

describe('slotCost', () => {
  it('multiplies base rate by district and time', () => {
    expect(slotCost(2.0, 1.45, 1.3)).toBe(3.77)
  })

  it('leaves the base rate alone when both multipliers are neutral', () => {
    expect(slotCost(4.6, 1.0, 1.0)).toBe(4.6)
  })

  it('rounds to whole tetri', () => {
    expect(slotCost(2.0, 1.45, 0.75)).toBe(2.18)
  })
})

describe('money', () => {
  it('rounds to two decimals', () => {
    expect(money(1.005)).toBe(1.01)
    expect(money(0.1 + 0.2)).toBe(0.3)
    expect(money(-3.456)).toBe(-3.46)
  })
})

describe('resolveDistrict', () => {
  it('treats a missing GPS fix as the cheapest tier', () => {
    expect(resolveDistrict(0, 0, { Vake: 1 })).toEqual({ district: 'Unknown', tier: 4 })
  })

  it('falls back to tier 4 for a district with no configured tier', () => {
    const result = resolveDistrict(41.7151, 44.8271, {})
    expect(result.tier).toBe(4)
  })
})
