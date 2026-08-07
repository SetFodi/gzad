// Pure billing math — no I/O, no Supabase. Kept separate from the route so the
// pricing rules can be unit tested without a database.

import { getDistrictsForPoint } from '@/lib/districts'

export interface PricingConfig {
  baseRates: Record<string, number>
  districtTiers: Record<string, number>
  districtMultipliers: Record<string, number>
  timeMultipliers: Record<string, number>
}

export const DEFAULT_BASE_RATES: Record<string, number> = { '10': 2.0, '20': 3.4, '30': 4.6 }

/** Turns the pricing_config key/value rows into a typed config with defaults. */
export function parsePricingConfig(
  rows: { key: string; value: unknown }[] | null | undefined,
): PricingConfig {
  const cfg: Record<string, Record<string, number>> = {}
  for (const row of rows || []) {
    cfg[row.key] = (row.value || {}) as Record<string, number>
  }
  return {
    baseRates: Object.keys(cfg.base_rates || {}).length ? cfg.base_rates : DEFAULT_BASE_RATES,
    districtTiers: cfg.district_tiers || {},
    districtMultipliers: cfg.district_multipliers || { '1': 1.45, '2': 1.25, '3': 1.1, '4': 1.0 },
    timeMultipliers: cfg.time_multipliers || {},
  }
}

/**
 * Rounds to two decimals (tetri), half away from zero.
 *
 * Shifting through the decimal string rather than multiplying by 100 avoids the
 * binary artefact that makes 2.0 × 1.45 × 0.75 land on 217.49999999999997 and
 * round down to 2.17 when the correct charge is 2.18.
 */
export function money(value: number): number {
  if (!Number.isFinite(value)) return 0
  const shifted = Number(`${value}e2`)
  if (!Number.isFinite(shifted)) return Math.round(value * 100) / 100
  return Number(`${Math.round(shifted)}e-2`)
}

/** Resolves a GPS fix to a district name and its pricing tier. Tier 4 is the fallback. */
export function resolveDistrict(
  lat: number,
  lng: number,
  tiers: Record<string, number>,
): { district: string; tier: number } {
  if (!lat || !lng) return { district: 'Unknown', tier: 4 }
  const districts = getDistrictsForPoint(lat, lng)
  if (districts.length === 0) return { district: 'Unknown', tier: 4 }
  const district = districts[0]
  return { district, tier: tiers[district] ?? 4 }
}

/** Cost of a single slot-hour: base rate scaled by where and when it played. */
export function slotCost(baseRate: number, districtMultiplier: number, timeMultiplier: number): number {
  // Round the product of the multipliers first so the price doesn't depend on
  // the order the two factors happen to be applied in.
  return money(baseRate * Number((districtMultiplier * timeMultiplier).toFixed(6)))
}

export function baseRateFor(config: PricingConfig, slotDuration: number | null | undefined): number {
  const key = String(slotDuration || 10)
  return config.baseRates[key] ?? config.baseRates['10'] ?? DEFAULT_BASE_RATES['10']
}

export interface BillingPeriod {
  start: Date
  end: Date
}

/**
 * The whole hours that still need billing, oldest first.
 *
 * `lastBilledEnd` is the end of the most recent period already in billing_logs;
 * pass null on a cold start. Periods are capped at `maxPeriods` so a long outage
 * (or an empty table) can't fan out into an unbounded backfill — the remainder
 * is picked up by the next run.
 */
export function pendingPeriods(
  lastBilledEnd: Date | null,
  now: Date = new Date(),
  maxPeriods = 26,
): BillingPeriod[] {
  const HOUR = 60 * 60 * 1000

  // Never bill the hour in progress — only whole elapsed hours.
  const currentHourStart = new Date(now)
  currentHourStart.setMinutes(0, 0, 0)
  const latestEnd = currentHourStart.getTime()

  let cursor = lastBilledEnd
    ? new Date(lastBilledEnd).setMinutes(0, 0, 0)
    : latestEnd - HOUR

  if (cursor >= latestEnd) return []

  // On a long gap, bill the most recent hours rather than the oldest ones —
  // play_logs for very old periods are the least likely to still be actionable.
  const earliest = latestEnd - maxPeriods * HOUR
  if (cursor < earliest) cursor = earliest

  const periods: BillingPeriod[] = []
  for (let t = cursor; t < latestEnd; t += HOUR) {
    periods.push({ start: new Date(t), end: new Date(t + HOUR) })
  }
  return periods
}
