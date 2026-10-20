import { describe, expect, it } from 'vitest'
import {
  baseRateFor,
  billingWindows,
  blockCost,
  blockDistrict,
  blockStartOf,
  DEFAULT_BILLING_SETTINGS,
  exactCost,
  expectedPlays,
  loopSeconds,
  lowBalanceAlerts,
  money,
  parseBillingSettings,
  parseMeteredFrom,
  parsePricingConfig,
  pendingPeriods,
  postWithCarry,
  prorationFor,
  resolveDistrict,
  slotCost,
  timeMultiplierAt,
  typicalSeconds,
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

  it('uses the saved Admin map instead of the built-in district at the same point', () => {
    const config = parsePricingConfig([
      { key: 'district_tiers', value: { 'Edited district': 2 } },
      { key: 'district_polygons', value: {
        'Edited district': { color: '#123456', polygon: [[41.7, 44.7], [41.8, 44.7], [41.8, 44.8], [41.7, 44.8]] },
      } },
    ])
    expect(blockDistrict([{ lat: 41.73, lng: 44.75, n: 1 }], config)).toEqual({
      district: 'Edited district', tier: 2, multiplier: 1.25,
    })
  })

  it('refuses malformed saved boundaries rather than pricing from a different map', () => {
    expect(() => parsePricingConfig([{ key: 'district_polygons', value: {
      Vake: { polygon: [[41.7, 44.7], ['invalid', 44.8], [41.8, 44.8]] },
    } }])).toThrow(/district_polygons/)
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

// ─── Metered billing ─────────────────────────────────────────────────────────

const VAKE = { lat: 41.73, lng: 44.75 }
const SABURTALO = { lat: 41.8, lng: 44.75 }
const MTATSMINDA = { lat: 41.69, lng: 44.8 }
const pricing = {
  districtTiers: { Vake: 1, Saburtalo: 2, Mtatsminda: 1 } as Record<string, number>,
  districtMultipliers: { '1': 1.45, '2': 1.25, '3': 1.1, '4': 1.0 } as Record<string, number>,
}

describe('blockStartOf', () => {
  it('floors to the 10-minute block', () => {
    expect(blockStartOf(new Date('2026-10-20T10:07:59Z')).toISOString()).toBe('2026-10-20T10:00:00.000Z')
    expect(blockStartOf(new Date('2026-10-20T10:10:00Z')).toISOString()).toBe('2026-10-20T10:10:00.000Z')
  })

  it('makes contiguous 600-second blocks', () => {
    const a = blockStartOf(new Date('2026-10-20T10:09:59Z'))
    const b = blockStartOf(new Date('2026-10-20T10:10:01Z'))
    expect(b.getTime() - a.getTime()).toBe(600_000)
  })

  it('floors to the hour in hourly mode', () => {
    expect(blockStartOf(new Date('2026-10-20T10:59:00Z'), 60).toISOString()).toBe('2026-10-20T10:00:00.000Z')
  })
})

describe('parseMeteredFrom', () => {
  it('is off when unset', () => {
    expect(parseMeteredFrom(undefined)).toBeNull()
    expect(parseMeteredFrom('')).toBeNull()
  })

  it('accepts a Tbilisi midnight (20:00 UTC)', () => {
    expect(parseMeteredFrom('2026-11-15T20:00:00Z')?.toISOString()).toBe('2026-11-15T20:00:00.000Z')
  })

  it('rejects a time that is not on a whole hour', () => {
    expect(() => parseMeteredFrom('2026-11-15T20:10:00Z')).toThrow(/whole hour/)
    expect(() => parseMeteredFrom('not a date')).toThrow(/not a date/)
  })
})

describe('billingWindows', () => {
  const settings = DEFAULT_BILLING_SETTINGS
  const now = new Date('2026-11-20T10:27:00Z')

  it('bills whole settled hours when metering is off', () => {
    const [w, ...rest] = billingWindows(now, settings, null)
    expect(rest).toHaveLength(0)
    expect(w.mode).toBe('hourly')
    expect(w.to.toISOString()).toBe('2026-11-20T10:00:00.000Z')
    expect(w.from.toISOString()).toBe('2026-11-20T07:00:00.000Z')
  })

  it('never includes a block that ended less than the settle time ago', () => {
    const w = billingWindows(new Date('2026-11-20T10:09:00Z'), settings, new Date('2026-11-01T20:00:00Z'))
    const metered = w.find((x) => x.mode === 'metered')!
    expect(metered.to.toISOString()).toBe('2026-11-20T09:50:00.000Z')
  })

  it('stays hourly until the switch-over', () => {
    const w = billingWindows(now, settings, new Date('2026-11-21T20:00:00Z'))
    expect(w.map((x) => x.mode)).toEqual(['hourly'])
  })

  it('meets exactly at the switch-over, with no gap or overlap', () => {
    const t = new Date('2026-11-20T08:00:00Z')
    const w = billingWindows(now, settings, t)
    const hourly = w.find((x) => x.mode === 'hourly')!
    const metered = w.find((x) => x.mode === 'metered')!
    expect(hourly.to.getTime()).toBe(t.getTime())
    expect(metered.from.getTime()).toBe(t.getTime())
    expect(metered.to.toISOString()).toBe('2026-11-20T10:10:00.000Z')
    expect(metered.lateFrom.getTime()).toBe(t.getTime())
  })

  it('drops the hourly window once late logs can no longer reach it', () => {
    const w = billingWindows(now, settings, new Date('2026-11-01T20:00:00Z'))
    expect(w.map((x) => x.mode)).toEqual(['metered'])
  })
})

describe('loop and expected plays', () => {
  it('uses the median play length', () => {
    expect(typicalSeconds(20, 20)).toBe(20)
  })

  it('falls back to the slot when the median is missing or implausible', () => {
    expect(typicalSeconds(0, 20)).toBe(20)
    expect(typicalSeconds(61, 30)).toBe(30)
    expect(typicalSeconds(null, null)).toBe(10)
  })

  it('sums every program in the loop, matched or not', () => {
    expect(loopSeconds([{ median: 10, slotDuration: 10 }, { median: 30, slotDuration: 30 }, { median: 30 }])).toBe(70)
  })

  it('expects a whole number of passes', () => {
    expect(expectedPlays(10)).toBe(60)
    expect(expectedPlays(50)).toBe(12)
    expect(expectedPlays(70)).toBe(8)
    expect(expectedPlays(150)).toBe(4)
  })

  it('never expects zero plays', () => {
    expect(expectedPlays(0)).toBe(1)
    expect(expectedPlays(900)).toBe(1)
  })
})

describe('prorationFor', () => {
  it('scales with the plays that happened', () => {
    expect(prorationFor(0, 8)).toBe(0)
    expect(prorationFor(4, 8)).toBe(0.5)
  })

  it('caps at a full block, which also absorbs duplicate logs', () => {
    expect(prorationFor(9, 8)).toBe(1)
    expect(prorationFor(16, 8)).toBe(1)
  })
})

describe('blockDistrict', () => {
  it('takes the majority of fixes', () => {
    const d = blockDistrict([{ ...VAKE, n: 3 }, { ...SABURTALO, n: 7 }], pricing)
    expect(d).toEqual({ district: 'Saburtalo', tier: 2, multiplier: 1.25 })
  })

  it('weights by how often a point was seen', () => {
    const d = blockDistrict([{ ...VAKE, n: 1 }, { ...VAKE, n: 1 }, { ...SABURTALO, n: 1 }], pricing)
    expect(d.district).toBe('Vake')
  })

  it('gives a tie to the cheaper district', () => {
    const d = blockDistrict([{ ...VAKE, n: 5 }, { ...SABURTALO, n: 5 }], pricing)
    expect(d.district).toBe('Saburtalo')
  })

  it('ignores (0, 0) fixes and falls back to Unknown, tier 4', () => {
    expect(blockDistrict([{ lat: 0, lng: 0, n: 9 }], pricing)).toEqual({ district: 'Unknown', tier: 4, multiplier: 1.0 })
    expect(blockDistrict([], pricing).district).toBe('Unknown')
  })

  it('keeps the first-fix rule for hourly mode', () => {
    const d = blockDistrict(
      [
        { ...SABURTALO, n: 9, firstAt: '2026-10-20T10:20:00Z' },
        { ...MTATSMINDA, n: 1, firstAt: '2026-10-20T10:01:00Z' },
      ],
      pricing,
      'first',
    )
    expect(d.district).toBe('Mtatsminda')
  })
})

describe('timeMultiplierAt', () => {
  const config = { timeMultipliers: { '17': 1.3, '0': 1.15 } as Record<string, number> }

  it('uses the Tbilisi hour the block starts in', () => {
    expect(timeMultiplierAt(config, new Date('2026-10-20T13:50:00Z'))).toBe(1.3)
    expect(timeMultiplierAt(config, new Date('2026-10-20T20:00:00Z'))).toBe(1.15)
  })

  it('defaults to 1 for an unconfigured hour', () => {
    expect(timeMultiplierAt(config, new Date('2026-10-20T08:00:00Z'))).toBe(1)
  })
})

describe('blockCost', () => {
  it('prices a block as a sixth of the slot-hour', () => {
    expect(blockCost(2.0, 1.45, 1.3, 1)).toBe(0.628333)
  })

  it('adds six full blocks up to the slot-hour price', () => {
    const six = exactCost(6 * blockCost(2.0, 1.45, 1.3, 1))
    expect(money(six)).toBe(slotCost(2.0, 1.45, 1.3))
    expect(money(exactCost(6 * blockCost(4.6, 1.0, 1.0, 1)))).toBe(4.6)
  })

  it('scales linearly with proration and keeps six decimals', () => {
    expect(blockCost(4.6, 1.0, 0.75, 0.5)).toBe(0.2875)
    expect(blockCost(2.0, 1.0, 1.0, 1)).toBe(0.333333)
  })
})

describe('postWithCarry', () => {
  it('moves whole tetri and never drifts more than half a tetri', () => {
    let carry = 0
    let posted = 0
    for (let i = 0; i < 6; i++) {
      const r = postWithCarry(blockCost(2.0, 1.0, 1.0, 1), carry)
      carry = r.carry
      posted = money(posted + r.post)
      expect(Math.abs(carry)).toBeLessThan(0.005)
    }
    expect(posted).toBe(2.0)
  })
})

describe('parseBillingSettings', () => {
  it('falls back to defaults and ignores bad values', () => {
    expect(parseBillingSettings(null)).toEqual(DEFAULT_BILLING_SETTINGS)
    expect(parseBillingSettings({ settle_minutes: 15, recent_hours: -1 }).settleMinutes).toBe(15)
    expect(parseBillingSettings({ recent_hours: -1 }).recentHours).toBe(3)
  })
})

describe('lowBalanceAlerts', () => {
  const base = {
    clientId: 'c1',
    settings: { lowBalancePct: 20, runwayDays: 1 },
    today: '2026-10-20',
  }

  it('warns once a cycle at 20% of the last top-up', () => {
    const alerts = lowBalanceAlerts({ ...base, balance: 19, cycleStart: { id: 'tx1', balance: 100 }, avgDailySpend: null })
    expect(alerts.map((a) => a.kind)).toEqual(['low_20pct'])
    expect(alerts[0].dedupeKey).toBe('low_20pct:c1:tx1')
    const next = lowBalanceAlerts({ ...base, balance: 19, cycleStart: { id: 'tx2', balance: 100 }, avgDailySpend: null })
    expect(next[0].dedupeKey).not.toBe(alerts[0].dedupeKey)
  })

  it('warns when about a day of airtime is left', () => {
    const alerts = lowBalanceAlerts({ ...base, balance: 30, cycleStart: { id: 'tx1', balance: 100 }, avgDailySpend: 40 })
    expect(alerts.map((a) => a.kind)).toEqual(['runway_1d'])
  })

  it('stays quiet without spend history or above the thresholds', () => {
    expect(lowBalanceAlerts({ ...base, balance: 50, cycleStart: { id: 'tx1', balance: 100 }, avgDailySpend: null })).toEqual([])
  })

  it('reports an empty balance', () => {
    const alerts = lowBalanceAlerts({ ...base, balance: 0, cycleStart: { id: 'tx1', balance: 100 }, avgDailySpend: 10 })
    expect(alerts.map((a) => a.kind)).toEqual(['depleted'])
  })
})
