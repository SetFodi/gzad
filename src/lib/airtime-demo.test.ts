import { describe, expect, it } from 'vitest'
import { advanceDemo, demoRate, freshDemo, parseDemoTopUp } from './airtime-demo'
import { blockCost, parsePricingConfig, type PricingConfig } from './billing'

const config: PricingConfig = {
  ...parsePricingConfig(null),
  districtTiers: { Saburtalo: 2, Vake: 1, Mtatsminda: 1 },
  timeMultipliers: { '6': .75, '7': 1.3 },
}
const tick = (state: ReturnType<typeof freshDemo>, cap: number | null = null) => advanceDemo(state, { type: 'tick', duration: 20, cap, config })

describe('custom demo top-ups', () => {
  it.each(['400', '1500', '1377', '1377.25', '0.01', '100000'])('accepts a valid lari amount: %s', text => {
    expect(parseDemoTopUp(text)).toBe(Number(text))
    expect(freshDemo(Number(text)).balance).toBe(Number(text))
  })
  it.each(['', ' ', 'NaN', 'Infinity', '-4', '0', '0.001', '1377.255', '100000.01'])('rejects an invalid amount: %s', text => {
    expect(parseDemoTopUp(text)).toBeNull()
  })
  it.each([400, 1500, 1377, 1377.25])('posts the actual cost from a ₾%s top-up', amount => {
    let state = freshDemo(amount)
    state = tick(state) // 06:35
    state = tick(state) // 06:40, first block
    const expected = blockCost(3.4, 1.25, .75, 1)
    expect(state.total).toBe(expected)
    expect(state.pending).toBe(expected)
    expect(state.balance).toBe(amount)
    state = tick(state) // 06:45, posted in tetri
    expect(state.post?.amount).toBe(.53)
    expect(state.balance).toBeCloseTo(amount - .53, 8)
  })
  it.each([.01, .53, .54, 1.37, 400, 1377, 1500])('never overdraws and conserves every tetri for ₾%s', amount => {
    let state = freshDemo(amount)
    let posted = 0
    for (let n = 0; n < 15000 && state.balance > 0; n++) {
      const prior = state
      state = tick(state)
      if (state.post?.id !== prior.post?.id) posted += state.post?.amount ?? 0
      expect(state.balance).toBeGreaterThanOrEqual(0)
      expect(state.pending + state.carry).toBeLessThanOrEqual(state.balance + .000001)
      expect(state.total).toBeCloseTo(posted + state.pending + state.carry, 5)
      expect(state.balance + posted).toBeCloseTo(amount, 6)
    }
    if (amount < 2) expect(state.balance).toBe(0)
  })
  it('resets all practice state for a custom top-up', () => {
    let state = freshDemo(1000)
    for (let i = 0; i < 6; i++) state = tick(state)
    expect(advanceDemo(state, { type: 'topUp', amount: 1377 })).toEqual(freshDemo(1377))
  })
  it('honors a daily cap and resumes at Tbilisi midnight', () => {
    let state = freshDemo(1377)
    while (!state.capped) state = tick(state, 1)
    expect(state.today).toBe(1)
    const cappedTotal = state.total
    while (state.minute !== 0) {
      state = tick(state, 1)
      expect(state.total).toBe(cappedTotal)
    }
    expect(state.today).toBe(0)
    expect(state.capped).toBe(false)
    for (let i = 0; i < 4; i++) state = tick(state, 1)
    expect(state.total).toBeGreaterThan(cappedTotal)
  })
  it('does not charge an offline block, and uses updated configured rates', () => {
    let state = freshDemo(1377)
    for (let i = 0; i < 12; i++) state = tick(state)
    expect(state.blocks[0]).toMatchObject({ status: 'off', share: 0, cost: 0 })
    expect(demoRate(config, 20, 'Saburtalo', 390)).toBe(3.1875)
    expect(demoRate({ ...config, baseRates: { '20': 8 } }, 20, 'Saburtalo', 390)).toBe(7.5)
  })
})
