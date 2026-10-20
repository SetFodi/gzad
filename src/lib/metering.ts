// Turns per-block usage and positions from the service-only billing RPCs
// into priced billing rows. Pure, so the billing route, its dry run and the
// tests all price airtime the same way.

import {
  baseRateFor,
  blockCost,
  blockDistrict,
  expectedPlays,
  loopSeconds,
  prorationFor,
  slotCost,
  timeMultiplierAt,
  type BillingWindow,
  type PositionVote,
  type PricingConfig,
} from './billing'

export interface MeteringCampaign {
  client_id: string
  slot_duration: number | null
}

export interface UsageRow {
  device_id: string
  block_start: string
  program_name: string
  campaign_id: string | null
  plays: number
  billable_plays: number
  typical_seconds: number | string | null
}

export interface PositionRow {
  device_id: string
  /** Metered reads are per campaign; absent on the legacy device-block RPC. */
  campaign_id?: string | null
  block_start: string
  lat: number | string
  lng: number | string
  n: number
  first_at: string | null
}

/** One billing_logs row as post_billing_blocks expects it. */
export interface BlockCharge {
  campaign_id: string
  device_id: string
  period_start: string
  period_end: string
  billing_unit: 'slot_hour' | 'block_10m'
  base_rate: number
  district: string
  district_tier: number
  district_multiplier: number
  time_multiplier: number
  plays: number
  expected_plays: number
  loop_seconds: number
  proration: number
  gross_cost: number
  ad_duration_seconds: number
}

export interface PricedWindow {
  charges: BlockCharge[]
  blockCount: number
  /** Device-blocks that came in through a late upload, before the recent window. */
  lateBlocks: number
  /** Device-blocks logging more airtime than they can hold: duplicates or a bad clock. */
  suspectDeviceBlocks: number
}

const blockKey = (deviceId: string, start: string) => `${deviceId}|${new Date(start).toISOString()}`

export function priceBlocks(
  window: Pick<BillingWindow, 'mode' | 'blockMinutes' | 'from'>,
  usage: UsageRow[],
  positions: PositionRow[],
  config: PricingConfig,
  campaigns: Map<string, MeteringCampaign>,
): PricedWindow {
  const votes = new Map<string, PositionVote[]>()
  for (const p of positions) {
    const block = blockKey(p.device_id, p.block_start)
    const key = p.campaign_id ? `${block}|${p.campaign_id}` : block
    const list = votes.get(key) ?? []
    list.push({ lat: Number(p.lat), lng: Number(p.lng), n: p.n, firstAt: p.first_at })
    votes.set(key, list)
  }

  const blocks = new Map<string, UsageRow[]>()
  for (const u of usage) {
    const key = blockKey(u.device_id, u.block_start)
    const list = blocks.get(key) ?? []
    list.push(u)
    blocks.set(key, list)
  }

  const metered = window.mode === 'metered'
  const blockSeconds = window.blockMinutes * 60
  const charges: BlockCharge[] = []
  let lateBlocks = 0
  let suspectDeviceBlocks = 0

  for (const [key, rows] of blocks) {
    const deviceId = rows[0].device_id
    const start = new Date(rows[0].block_start)
    if (start < window.from) lateBlocks++

    // Every program on the screen takes loop time, matched to a campaign or not.
    const programs = rows.map((r) => ({
      median: r.typical_seconds === null ? null : Number(r.typical_seconds),
      slotDuration: r.campaign_id ? campaigns.get(r.campaign_id)?.slot_duration : null,
    }))
    const loop = loopSeconds(programs)
    const expected = expectedPlays(loop, blockSeconds)

    const airtime = rows.reduce((sum, r, i) => sum + r.plays * (programs[i].median || 10), 0)
    if (airtime > blockSeconds * 1.1) suspectDeviceBlocks++

    const timeMultiplier = timeMultiplierAt(config, start)

    // A campaign can log under more than one program name; it is still one slot.
    const billableByCampaign = new Map<string, number>()
    for (const r of rows) {
      if (!r.campaign_id || r.billable_plays <= 0) continue
      billableByCampaign.set(r.campaign_id, (billableByCampaign.get(r.campaign_id) ?? 0) + r.billable_plays)
    }

    for (const [campaignId, billable] of billableByCampaign) {
      const campaign = campaigns.get(campaignId)
      if (!campaign) continue
      const district = blockDistrict(votes.get(`${key}|${campaignId}`) ?? votes.get(key) ?? [], config, metered ? 'majority' : 'first')
      const duration = campaign.slot_duration || 10
      const baseRate = baseRateFor(config, duration)
      const proration = metered ? prorationFor(billable, expected) : 1
      const gross = metered
        ? blockCost(baseRate, district.multiplier, timeMultiplier, proration)
        : slotCost(baseRate, district.multiplier, timeMultiplier)
      if (gross <= 0) continue

      charges.push({
        campaign_id: campaignId,
        device_id: deviceId,
        period_start: start.toISOString(),
        period_end: new Date(start.getTime() + blockSeconds * 1000).toISOString(),
        billing_unit: metered ? 'block_10m' : 'slot_hour',
        base_rate: baseRate,
        district: district.district,
        district_tier: district.tier,
        district_multiplier: district.multiplier,
        time_multiplier: timeMultiplier,
        plays: billable,
        expected_plays: expected,
        loop_seconds: Math.round(loop),
        proration,
        gross_cost: gross,
        ad_duration_seconds: duration,
      })
    }
  }

  return { charges, blockCount: blocks.size, lateBlocks, suspectDeviceBlocks }
}

/** Charges grouped by the client that owns each campaign. */
export function groupByClient(
  charges: BlockCharge[],
  campaigns: Map<string, Pick<MeteringCampaign, 'client_id'>>,
): Map<string, BlockCharge[]> {
  const byClient = new Map<string, BlockCharge[]>()
  for (const c of charges) {
    const clientId = campaigns.get(c.campaign_id)?.client_id
    if (!clientId) continue
    const list = byClient.get(clientId) ?? []
    list.push(c)
    byClient.set(clientId, list)
  }
  return byClient
}
