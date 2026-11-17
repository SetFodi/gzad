import { describe, expect, it } from 'vitest'
import { formatGel, gelParts } from './money'

describe('formatGel', () => {
  it('groups thousands and keeps two decimals', () => {
    expect(formatGel(1000)).toBe('₾1,000.00')
    expect(formatGel(3.4)).toBe('₾3.40')
  })

  it('puts a true minus before the symbol', () => {
    expect(formatGel(-57.03)).toBe('−₾57.03')
  })

  it('never shows minus zero', () => {
    expect(formatGel(-0.001)).toBe('₾0.00')
    expect(formatGel(Number.NaN)).toBe('₾0.00')
  })

  it('adds a plus for signed ledger amounts', () => {
    expect(formatGel(50, { signed: true })).toBe('+₾50.00')
    expect(formatGel(-39.74, { signed: true })).toBe('−₾39.74')
    expect(formatGel(0, { signed: true })).toBe('₾0.00')
  })
})

describe('gelParts', () => {
  it('splits sign and digits for big figures', () => {
    expect(gelParts(-1234.5)).toEqual({ sign: '−', amount: '1,234.50' })
    expect(gelParts(12)).toEqual({ sign: '', amount: '12.00' })
  })
})
