// Pure billing math — no I/O, no Supabase. Kept separate from the route so the
// pricing rules can be unit tested without a database.

import { tbilisiHour } from '@/lib/campaigns'
import { getDistrictsForPoint, type District } from '@/lib/districts'

export interface PricingConfig {
  baseRates: Record<string, number>
  districtTiers: Record<string, number>
  districtMultipliers: Record<string, number>
  timeMultipliers: Record<string, number>
  /** Saved Admin map. Omitted only when Admin itself still shows the built-in map. */
  districtPolygons?: Pick<District, 'name' | 'polygon'>[]
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
  const map = rows?.find(row => row.key === 'district_polygons')?.value
  let districtPolygons: PricingConfig['districtPolygons']
  if (map !== undefined && map !== null) {
    if (typeof map !== 'object' || Array.isArray(map)) throw new Error('Invalid district_polygons')
    const entries = Object.entries(map)
    // An empty saved object uses the same built-in map as the Admin editor.
    if (entries.length > 0) {
      districtPolygons = entries.map(([name, value]) => {
        const polygon = (value as { polygon?: unknown } | null)?.polygon
        if (!Array.isArray(polygon) || polygon.length < 3 || polygon.some(point =>
          !Array.isArray(point) || point.length !== 2
          || !Number.isFinite(point[0]) || Math.abs(point[0]) > 90
          || !Number.isFinite(point[1]) || Math.abs(point[1]) > 180,
        )) throw new Error(`Invalid district_polygons for ${name}`)
        return { name, polygon: polygon as [number, number][] }
      })
    }
  }
  return {
    baseRates: Object.keys(cfg.base_rates || {}).length ? cfg.base_rates : DEFAULT_BASE_RATES,
    districtTiers: cfg.district_tiers || {},
    districtMultipliers: cfg.district_multipliers || { '1': 1.45, '2': 1.25, '3': 1.1, '4': 1.0 },
    timeMultipliers: cfg.time_multipliers || {},
    districtPolygons,
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

// ─── Metered billing (docs/billing-metering-plan.md) ─────────────────────────
// Airtime is billed per (campaign, device, block). In metered mode a block is
// 10 minutes, priced as base rate ÷ 6 × district × time of day × the share of
// the block the ad actually played. Hourly mode is the same pipeline with
// 60-minute blocks, a full charge for any play and the first-fix district.
// Both modes resolve boundaries from the same saved map as Admin.

export const BLOCK_MINUTES = 10
const MINUTE = 60 * 1000

export type BillingMode = 'hourly' | 'metered'

export interface BillingSettings {
  settleMinutes: number
  recentHours: number
  lateLogMaxDays: number
  lowBalancePct: number
  runwayDays: number
  playLogsKeepDays: number
  gpsLogsKeepDays: number
  billingDetailKeepDays: number
}

export const DEFAULT_BILLING_SETTINGS: BillingSettings = {
  settleMinutes: 10,
  recentHours: 3,
  lateLogMaxDays: 7,
  lowBalancePct: 20,
  runwayDays: 1,
  playLogsKeepDays: 30,
  gpsLogsKeepDays: 14,
  billingDetailKeepDays: 90,
}

/** Reads pricing_config.billing_settings (snake_case) over the defaults. */
export function parseBillingSettings(value: unknown): BillingSettings {
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const num = (key: string, fallback: number) => {
    const n = Number(v[key])
    return Number.isFinite(n) && n > 0 ? n : fallback
  }
  const d = DEFAULT_BILLING_SETTINGS
  return {
    settleMinutes: num('settle_minutes', d.settleMinutes),
    recentHours: num('recent_hours', d.recentHours),
    lateLogMaxDays: num('late_log_max_days', d.lateLogMaxDays),
    lowBalancePct: num('low_balance_pct', d.lowBalancePct),
    runwayDays: num('runway_days', d.runwayDays),
    playLogsKeepDays: num('play_logs_keep_days', d.playLogsKeepDays),
    gpsLogsKeepDays: num('gps_logs_keep_days', d.gpsLogsKeepDays),
    billingDetailKeepDays: num('billing_detail_keep_days', d.billingDetailKeepDays),
  }
}

/** Keeps six decimals: rows store exact costs, the balance moves in tetri. */
export function exactCost(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Number(`${Math.round(Number(`${value}e6`))}e-6`)
}

/** Start of the block containing `at`, on UTC boundaries (Tbilisi is UTC+4, no DST). */
export function blockStartOf(at: Date, minutes: number = BLOCK_MINUTES): Date {
  const len = minutes * MINUTE
  return new Date(Math.floor(at.getTime() / len) * len)
}

/**
 * BILLING_METERED_FROM: the instant metered billing starts. It must be a whole
 * hour so hourly rows end exactly where the first block starts.
 */
export function parseMeteredFrom(value: string | undefined | null): Date | null {
  if (!value) return null
  const at = new Date(value)
  if (Number.isNaN(at.getTime())) throw new Error(`BILLING_METERED_FROM is not a date: ${value}`)
  if (at.getTime() % (60 * MINUTE) !== 0) {
    throw new Error(`BILLING_METERED_FROM must be on a whole hour: ${value}`)
  }
  return at
}

export interface BillingWindow {
  mode: BillingMode
  blockMinutes: number
  /** Recent blocks: start in [from, to). */
  from: Date
  /** Exclusive, on a block boundary; only blocks that ended `settle` ago. */
  to: Date
  /** Oldest airtime a late upload may still bill. */
  lateFrom: Date
}

/**
 * The windows one run bills. Before `meteredFrom` (or when it is unset)
 * airtime is billed in hours; from it on, in 10-minute blocks. A run around the
 * switch-over gets both, and they meet exactly at `meteredFrom`.
 */
export function billingWindows(
  now: Date,
  settings: BillingSettings,
  meteredFrom: Date | null,
): BillingWindow[] {
  const settled = new Date(now.getTime() - settings.settleMinutes * MINUTE)
  const recent = settings.recentHours * 60 * MINUTE
  const lateFloor = new Date(now.getTime() - settings.lateLogMaxDays * 24 * 60 * MINUTE)
  const windows: BillingWindow[] = []

  let hourlyTo = blockStartOf(settled, 60)
  if (meteredFrom && meteredFrom < hourlyTo) hourlyTo = meteredFrom
  if (!meteredFrom || lateFloor < meteredFrom) {
    windows.push({
      mode: 'hourly',
      blockMinutes: 60,
      from: new Date(hourlyTo.getTime() - recent),
      to: hourlyTo,
      lateFrom: lateFloor,
    })
  }

  if (meteredFrom) {
    const meteredTo = blockStartOf(settled, BLOCK_MINUTES)
    if (meteredTo > meteredFrom) {
      const from = new Date(Math.max(meteredFrom.getTime(), meteredTo.getTime() - recent))
      windows.push({
        mode: 'metered',
        blockMinutes: BLOCK_MINUTES,
        from,
        to: meteredTo,
        lateFrom: new Date(Math.max(meteredFrom.getTime(), lateFloor.getTime())),
      })
    }
  }
  return windows
}

/**
 * A program's share of the loop: its median play length, unless that looks
 * wrong (0, or more than twice the campaign's slot), then the slot, then 10 s.
 */
export function typicalSeconds(median: number | null | undefined, slotDuration?: number | null): number {
  const slot = slotDuration && slotDuration > 0 ? slotDuration : null
  if (median && median > 0 && (!slot || median <= slot * 2)) return median
  return slot ?? 10
}

/** How long one pass of the device's loop takes in a block. */
export function loopSeconds(programs: { median: number | null | undefined; slotDuration?: number | null }[]): number {
  return programs.reduce((sum, p) => sum + typicalSeconds(p.median, p.slotDuration), 0)
}

/**
 * How many times a slot plays in a block that ran the whole time. Floor, so a
 * block that ran fully always bills 100% whatever the loop's phase.
 */
export function expectedPlays(loop: number, blockSeconds: number = BLOCK_MINUTES * 60): number {
  if (!(loop > 0) || loop > blockSeconds) return 1
  return Math.max(1, Math.floor(blockSeconds / loop))
}

/** Share of the block the ad played, capped at 1 (which also absorbs duplicate logs). */
export function prorationFor(billablePlays: number, expected: number): number {
  if (!(billablePlays > 0) || !(expected > 0)) return 0
  return Math.min(1, Math.round((billablePlays / expected) * 1e4) / 1e4)
}

export interface PositionVote {
  lat: number
  lng: number
  /** How many plays or GPS fixes landed on this rounded point. */
  n: number
  firstAt?: string | Date | null
}

export interface BlockDistrict {
  district: string
  tier: number
  multiplier: number
}

/**
 * Resolves the supplied position votes for one block. Metered callers provide
 * that campaign's billable-play positions; the legacy hourly path provides the
 * screen's positions and keeps its first-fix rule. Ties favor the cheaper rate.
 * No usable fix means Unknown, tier 4.
 */
export function blockDistrict(
  votes: PositionVote[],
  config: Pick<PricingConfig, 'districtTiers' | 'districtMultipliers' | 'districtPolygons'>,
  rule: 'majority' | 'first' = 'majority',
): BlockDistrict {
  const priced = (district: string): BlockDistrict => {
    const tier = district === 'Unknown' ? 4 : (config.districtTiers[district] ?? 4)
    return { district, tier, multiplier: config.districtMultipliers[String(tier)] ?? 1.0 }
  }
  const usable = votes.filter((v) => v.lat && v.lng && v.n > 0)
  if (usable.length === 0) return priced('Unknown')

  if (rule === 'first') {
    const first = [...usable].sort(
      (a, b) => new Date(a.firstAt ?? 0).getTime() - new Date(b.firstAt ?? 0).getTime(),
    )[0]
    return priced(getDistrictsForPoint(first.lat, first.lng, config.districtPolygons)[0] ?? 'Unknown')
  }

  const weight = new Map<string, number>()
  for (const v of usable) {
    const district = getDistrictsForPoint(v.lat, v.lng, config.districtPolygons)[0] ?? 'Unknown'
    weight.set(district, (weight.get(district) ?? 0) + v.n)
  }
  const [winner] = [...weight.entries()]
    .map(([district, n]) => ({ priced: priced(district), n }))
    .sort(
      (a, b) =>
        b.n - a.n ||
        a.priced.multiplier - b.priced.multiplier ||
        a.priced.district.localeCompare(b.priced.district),
    )
  return winner.priced
}

/** Time-of-day multiplier for the Tbilisi hour a block starts in. */
export function timeMultiplierAt(config: Pick<PricingConfig, 'timeMultipliers'>, start: Date): number {
  return config.timeMultipliers[String(tbilisiHour(start))] ?? 1.0
}

/** Exact price of one metered block. Six full blocks cost one slot-hour. */
export function blockCost(
  baseRate: number,
  districtMultiplier: number,
  timeMultiplier: number,
  proration: number,
  blocksPerHour: number = 60 / BLOCK_MINUTES,
): number {
  return exactCost(((baseRate * districtMultiplier * timeMultiplier) / blocksPerHour) * proration)
}

/**
 * What a post moves: the exact amount plus the carried remainder, in whole
 * tetri; the new remainder carries forward (mirrors post_billing_blocks).
 */
export function postWithCarry(exact: number, carry: number): { post: number; carry: number } {
  const post = money(exact + carry)
  return { post, carry: exactCost(exact + carry - post) }
}

export type AlertKind = 'low_20pct' | 'runway_1d' | 'depleted' | 'cap_reached'

export interface BalanceAlert {
  kind: AlertKind
  dedupeKey: string
  detail: Record<string, unknown>
}

/**
 * Low-balance alerts for one client after a run. Each fires once per top-up
 * cycle (or once a day for runway), keyed so the outbox ignores repeats.
 */
export function lowBalanceAlerts(input: {
  clientId: string
  balance: number
  /** balance_after of the latest top-up, and that transaction's id. */
  cycleStart: { id: string; balance: number } | null
  /** Average spend per day with spend, over the last week. Null: no history. */
  avgDailySpend: number | null
  settings: Pick<BillingSettings, 'lowBalancePct' | 'runwayDays'>
  today: string
}): BalanceAlert[] {
  const { clientId, balance, cycleStart, avgDailySpend, settings, today } = input
  const alerts: BalanceAlert[] = []
  const cycle = cycleStart?.id ?? 'initial'

  if (balance <= 0) {
    alerts.push({ kind: 'depleted', dedupeKey: `depleted:${clientId}:${cycle}`, detail: { balance } })
    return alerts
  }
  if (cycleStart && cycleStart.balance > 0 && balance <= (cycleStart.balance * settings.lowBalancePct) / 100) {
    alerts.push({
      kind: 'low_20pct',
      dedupeKey: `low_20pct:${clientId}:${cycle}`,
      detail: { balance, cycleStartBalance: cycleStart.balance, pct: settings.lowBalancePct },
    })
  }
  if (avgDailySpend && avgDailySpend > 0 && balance <= avgDailySpend * settings.runwayDays) {
    alerts.push({
      kind: 'runway_1d',
      dedupeKey: `runway_1d:${clientId}:${today}`,
      detail: { balance, avgDailySpend, runwayDays: Number((balance / avgDailySpend).toFixed(2)) },
    })
  }
  return alerts
}
