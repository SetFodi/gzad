import { describe, expect, it } from 'vitest'
import { isWithinWindow, tbilisiHour, tbilisiToday } from './campaigns'

describe('isWithinWindow', () => {
  const today = '2026-08-07'

  it('airs a campaign inside its window', () => {
    expect(isWithinWindow({ start_date: '2026-08-01', end_date: '2026-08-31' }, today)).toBe(true)
  })

  it('stops a campaign the day after it ends', () => {
    expect(isWithinWindow({ start_date: '2026-08-01', end_date: '2026-08-06' }, today)).toBe(false)
  })

  it('includes both boundary days', () => {
    expect(isWithinWindow({ start_date: today, end_date: today }, today)).toBe(true)
  })

  it('does not air before the start date', () => {
    expect(isWithinWindow({ start_date: '2026-09-01', end_date: null }, today)).toBe(false)
  })

  it('treats missing dates as open ended', () => {
    expect(isWithinWindow({ start_date: null, end_date: null }, today)).toBe(true)
    expect(isWithinWindow({}, today)).toBe(true)
  })
})

describe('tbilisiToday', () => {
  it('formats as YYYY-MM-DD', () => {
    expect(tbilisiToday(new Date('2026-08-07T09:00:00Z'))).toBe('2026-08-07')
  })

  it('is already tomorrow in Tbilisi late in the UTC evening', () => {
    // Tbilisi is UTC+4, so 21:00 UTC is 01:00 the next day.
    expect(tbilisiToday(new Date('2026-08-07T21:00:00Z'))).toBe('2026-08-08')
  })
})

describe('tbilisiHour', () => {
  it('shifts UTC into Tbilisi local time', () => {
    expect(tbilisiHour(new Date('2026-08-07T14:00:00Z'))).toBe(18)
  })

  it('wraps past midnight', () => {
    expect(tbilisiHour(new Date('2026-08-07T22:00:00Z'))).toBe(2)
  })
})
