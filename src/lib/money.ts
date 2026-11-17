// One way to show lari everywhere in the app: ₾1,234.50, and −₾12.30 with a
// true minus sign before the symbol for negatives.

function cents(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100) : 0
}

/** The sign and the digits separately, for big figures that style ₾ on its own. */
export function gelParts(value: number): { sign: '−' | ''; amount: string } {
  const c = cents(value)
  return {
    sign: c < 0 ? '−' : '',
    amount: (Math.abs(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  }
}

/** ₾1,234.50 / −₾12.30. With `signed`, positives get a + (for ledger rows). */
export function formatGel(value: number, { signed = false }: { signed?: boolean } = {}): string {
  const { sign, amount } = gelParts(value)
  const plus = signed && cents(value) > 0 ? '+' : ''
  return `${sign || plus}₾${amount}`
}
