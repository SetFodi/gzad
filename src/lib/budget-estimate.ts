import { DEFAULT_BASE_RATES } from './billing'

// Landing-page budget calculator: what a top-up buys, before signing up. The
// client doesn't pick districts (the price follows wherever the taxi drives),
// so the estimate is a range from the dearest district tier to the cheapest.
// Rates are the billing defaults, which match the live pricing_config.

export type Band = 'any' | 'night' | 'day' | 'evening' | 'rush'

/** Hours of the Tbilisi day in each time band, and its multiplier (admin pricing page). */
export const BANDS: Record<Exclude<Band, 'any'>, { hours: number; multiplier: number }> = {
  night: { hours: 6, multiplier: 0.75 }, // 01–07
  rush: { hours: 6, multiplier: 1.3 }, // 07–10, 17–20
  day: { hours: 7, multiplier: 1.0 }, // 10–17
  evening: { hours: 5, multiplier: 1.15 }, // 20–01
}

/** Any time: the bands weighted by how many hours of the day each covers. */
export function bandMultiplier(band: Band): number {
  if (band !== 'any') return BANDS[band].multiplier
  const all = Object.values(BANDS)
  return all.reduce((sum, b) => sum + b.hours * b.multiplier, 0) / all.reduce((sum, b) => sum + b.hours, 0)
}

export const PRIME_MULTIPLIER = 1.45
export const STANDARD_MULTIPLIER = 1.0

/** The loop has five slots; the other four are assumed to be 10-second ads. */
export const OTHER_SLOTS_SECONDS = 4 * 10

export function playsPerHour(adSeconds: number): number {
  return Math.floor(3600 / (adSeconds + OTHER_SLOTS_SECONDS))
}

export interface Range {
  min: number
  max: number
}

export interface BudgetEstimate {
  /** Screen-hours on air in total. */
  hours: Range
  plays: Range
  costPerPlay: Range
  /** Hours on each screen when the budget is spread across `screens`. */
  hoursPerScreen: Range
  playsPerHour: number
}

export function estimateBudget(input: { budget: number; adSeconds: number; band: Band; screens: number }): BudgetEstimate {
  const base = DEFAULT_BASE_RATES[String(input.adSeconds)] ?? DEFAULT_BASE_RATES['10']
  const time = bandMultiplier(input.band)
  const dearest = base * PRIME_MULTIPLIER * time
  const cheapest = base * STANDARD_MULTIPLIER * time
  const budget = Math.max(0, input.budget)
  const screens = Math.max(1, Math.floor(input.screens))
  const perHour = playsPerHour(input.adSeconds)

  const hours = { min: budget / dearest, max: budget / cheapest }
  return {
    hours,
    plays: { min: Math.floor(hours.min * perHour), max: Math.floor(hours.max * perHour) },
    costPerPlay: { min: cheapest / perHour, max: dearest / perHour },
    hoursPerScreen: { min: hours.min / screens, max: hours.max / screens },
    playsPerHour: perHour,
  }
}

/** Rounds a count for display: an estimate shouldn't look more exact than it is. */
export function roughCount(n: number): number {
  if (n < 100) return Math.round(n)
  if (n < 1000) return Math.round(n / 10) * 10
  return Math.round(n / 50) * 50
}
