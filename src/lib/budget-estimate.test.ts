import { describe, expect, it } from 'vitest'
import { bandMultiplier, estimateBudget, playsPerHour, roughCount } from './budget-estimate'

describe('budget estimate', () => {
  it('plays a slot once per loop of five', () => {
    expect(playsPerHour(10)).toBe(72) // 50 s loop
    expect(playsPerHour(20)).toBe(60)
    expect(playsPerHour(30)).toBe(51)
  })

  it('weights "any time" by the hours each band covers', () => {
    expect(bandMultiplier('rush')).toBe(1.3)
    expect(bandMultiplier('any')).toBeCloseTo((6 * 0.75 + 6 * 1.3 + 7 * 1 + 5 * 1.15) / 24, 10)
  })

  it('turns ₾100 of 10-second ads in the evening into a district range', () => {
    const e = estimateBudget({ budget: 100, adSeconds: 10, band: 'evening', screens: 1 })
    // ₾2 × 1.15 = ₾2.30 an hour in standard districts, × 1.45 in prime ones.
    expect(e.hours.max).toBeCloseTo(100 / 2.3, 6)
    expect(e.hours.min).toBeCloseTo(100 / (2.3 * 1.45), 6)
    expect(e.plays).toEqual({ min: Math.floor((100 / 3.335) * 72), max: Math.floor((100 / 2.3) * 72) })
    expect(e.costPerPlay.min).toBeCloseTo(2.3 / 72, 6)
  })

  it('spreads the hours across screens', () => {
    const e = estimateBudget({ budget: 500, adSeconds: 20, band: 'day', screens: 5 })
    expect(e.hoursPerScreen.max).toBeCloseTo(e.hours.max / 5, 6)
    expect(e.plays.max).toBe(Math.floor((500 / 3.4) * 60))
  })

  it('treats nonsense input as nothing bought', () => {
    const e = estimateBudget({ budget: -5, adSeconds: 10, band: 'any', screens: 0 })
    expect(e.plays).toEqual({ min: 0, max: 0 })
    expect(e.hoursPerScreen.max).toBe(0)
  })

  it('rounds counts like an estimate', () => {
    expect(roughCount(87.4)).toBe(87)
    expect(roughCount(2134)).toBe(2150)
    expect(roughCount(3130)).toBe(3150)
    expect(roughCount(456)).toBe(460)
  })
})
