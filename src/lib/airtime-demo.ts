import { baseRateFor, blockCost, exactCost as billingExactCost, money, type PricingConfig } from './billing'

// Subtracting two six-decimal amounts can leave a tiny exponential float.
// Normalize it before the billing helper's decimal-string rounding.
const exactCost = (value: number) => Math.abs(value) < .000001
  ? Math.round(value * 1e6) / 1e6 : billingExactCost(value)

export const DEMO_START = 6 * 60 + 30
export const DEMO_TICK_MS = 1100
export const DEMO_DAY: [string, number][] = [
  ['Saburtalo', 1], ['Saburtalo', 1], ['Vake', 1], ['Vake', 1], ['Vake', .5], ['Vake', 0],
  ['Vake', .7], ['Mtatsminda', 1], ['Mtatsminda', 1], ['Chughureti', 1], ['Chughureti', 1], ['Didube', 1],
  ['Saburtalo', 1], ['Nadzaladevi', 1], ['Gldani', 1], ['Gldani', 1], ['Didube', 1], ['Chughureti', 1],
  ['Isani', 1], ['Samgori', 1], ['Isani', 1], ['Krtsanisi', 1], ['Mtatsminda', 1], ['Vake', 1],
]

export function parseDemoTopUp(text: string): number | null {
  if (!text.trim()) return null
  const value = Number(text)
  return Number.isFinite(value) && value >= .01 && value <= 100_000
    && Math.abs(value * 100 - Math.round(value * 100)) < 1e-7 ? money(value) : null
}

export function demoTier(config: PricingConfig, district: string): string {
  return String(config.districtTiers[district] ?? 4)
}

export function demoRate(config: PricingConfig, duration: number, district: string, minute: number): number {
  const districtRate = config.districtMultipliers[demoTier(config, district)] ?? 1
  const timeRate = config.timeMultipliers[String(Math.floor(minute / 60) % 24)] ?? 1
  return exactCost(baseRateFor(config, duration) * districtRate * timeRate)
}

export type DemoStatus = 'played' | 'partial' | 'off' | 'capped' | 'empty'
export interface DemoBlock { id: number; minute: number; district: string; share: number; cost: number; status: DemoStatus }
export interface DemoMeter {
  minute: number; blockN: number; balance: number; topUp: number; pending: number; carry: number
  today: number; total: number; capped: boolean; blocks: DemoBlock[]; post: { id: number; amount: number } | null
}
export type DemoAction = { type: 'tick'; duration: number; cap: number | null; config: PricingConfig } | { type: 'topUp'; amount: number }

export function freshDemo(amount: number): DemoMeter {
  if (parseDemoTopUp(String(amount)) === null) throw new Error('Invalid demo top-up')
  return { minute: DEMO_START, blockN: 0, balance: amount, topUp: amount, pending: 0, carry: 0, today: 0, total: 0, capped: false, blocks: [], post: null }
}

/** Same block pricing and tetri rounding as billing, against a simulated wallet. */
export function advanceDemo(m: DemoMeter, action: DemoAction): DemoMeter {
  if (action.type === 'topUp') return freshDemo(action.amount)
  if (m.balance <= 0) return m
  const next = { ...m, minute: (m.minute + 5) % 1440 }
  if (next.minute % 10 === 0) {
    const start = (next.minute + 1430) % 1440
    const [district, requestedShare] = DEMO_DAY[m.blockN % DEMO_DAY.length]
    const base = baseRateFor(action.config, action.duration)
    const districtRate = action.config.districtMultipliers[demoTier(action.config, district)] ?? 1
    const timeRate = action.config.timeMultipliers[String(Math.floor(start / 60))] ?? 1
    const fullBlock = blockCost(base, districtRate, timeRate, 1)
    const available = Math.max(0, exactCost(m.balance - m.pending - m.carry))
    const dailyLeft = action.cap === null ? Infinity : Math.max(0, exactCost(action.cap - m.today))
    const cost = exactCost(Math.min(blockCost(base, districtRate, timeRate, requestedShare), available, dailyLeft))
    const share = fullBlock > 0 ? Math.min(requestedShare, cost / fullBlock) : requestedShare
    const status: DemoStatus = requestedShare === 0 ? 'off' : dailyLeft <= 0 ? 'capped' : available <= 0 ? 'empty' : share + 1e-6 < requestedShare || requestedShare < 1 ? 'partial' : 'played'
    next.today = exactCost(m.today + cost)
    next.total = exactCost(m.total + cost)
    next.pending = exactCost(m.pending + cost)
    next.capped = action.cap !== null && next.today >= action.cap
    next.blockN++
    next.blocks = [{ id: m.blockN, minute: start, district, share, cost, status }, ...m.blocks].slice(0, 4)
  }
  if (next.minute % 15 === 0) {
    const amount = Math.min(next.balance, Math.max(0, money(next.pending + next.carry)))
    next.carry = exactCost(next.pending + next.carry - amount)
    next.pending = 0
    next.balance = money(next.balance - amount)
    if (amount > 0) next.post = { id: next.blockN * 1440 + next.minute, amount }
  }
  if (m.minute + 5 >= 1440) { next.today = 0; next.capped = false }
  return next
}
