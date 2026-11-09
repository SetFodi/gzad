import { baseRateFor, DEFAULT_BASE_RATES, type PricingConfig } from './billing'

// Client guide estimates follow the configured rates. The client cannot pick
// districts, so the result spans the district tiers in use, including fallback.

export type Band = 'any' | 'night' | 'day' | 'evening' | 'rush'

/** Hours of the Tbilisi day in each time band, and its multiplier (admin pricing page). */
export const BANDS: Record<Exclude<Band, 'any'>, { hours: number; multiplier: number }> = {
  night: { hours: 6, multiplier: 0.75 }, // 01–07
  rush: { hours: 6, multiplier: 1.3 }, // 07–10, 17–20
  day: { hours: 7, multiplier: 1.0 }, // 10–17
  evening: { hours: 5, multiplier: 1.15 }, // 20–01
}

/** Any time: the bands weighted by how many hours of the day each covers. */
export function bandMultiplier(band: Band, config?: PricingConfig): number {
  if (config) {
    const hours = Array.from({ length: 24 }, (_, hour) => hour).filter(hour =>
      band === 'any' || (band === 'night' && hour >= 1 && hour < 7)
      || (band === 'rush' && ((hour >= 7 && hour < 10) || (hour >= 17 && hour < 20)))
      || (band === 'day' && hour >= 10 && hour < 17)
      || (band === 'evening' && (hour >= 20 || hour === 0)),
    )
    return hours.reduce((sum, hour) => sum + (config.timeMultipliers[String(hour)] ?? 1), 0) / hours.length
  }
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

export function estimateBudget(input: { budget: number; adSeconds: number; band: Band; screens: number }, config?: PricingConfig): BudgetEstimate {
  const base = config ? baseRateFor(config, input.adSeconds) : DEFAULT_BASE_RATES[String(input.adSeconds)] ?? DEFAULT_BASE_RATES['10']
  const time = bandMultiplier(input.band, config)
  const districtRates = config
    ? [...new Set([4, ...Object.values(config.districtTiers)])].map(tier => config.districtMultipliers[String(tier)] ?? 1)
    : [STANDARD_MULTIPLIER, PRIME_MULTIPLIER]
  const dearest = base * Math.max(...districtRates) * time
  const cheapest = base * Math.min(...districtRates) * time
  const budget = Number.isFinite(input.budget) ? Math.max(0, input.budget) : 0
  const screens = Number.isFinite(input.screens) ? Math.max(1, Math.floor(input.screens)) : 1
  const perHour = playsPerHour(input.adSeconds)

  const hours = { min: budget === 0 ? 0 : budget / dearest, max: budget === 0 ? 0 : budget / cheapest }
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
