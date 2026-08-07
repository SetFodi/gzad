import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  baseRateFor,
  money,
  parsePricingConfig,
  pendingPeriods,
  resolveDistrict,
  slotCost,
  type BillingPeriod,
  type PricingConfig,
} from '@/lib/billing'
import { isWithinWindow, tbilisiHour } from '@/lib/campaigns'
import { adjustBalance } from '@/lib/balance'
import { syncGroupDevices } from '@/lib/device-sync'
import { TZ } from '@/lib/campaigns'

// Charges every whole hour that hasn't been billed yet, so a missed run is
// picked up by the next one instead of losing the revenue permanently. Safe to
// call repeatedly: billing_logs has a unique index on
// (campaign_id, device_id, period_start) and only rows actually inserted are
// deducted from a balance.

export const maxDuration = 60

const PAGE_SIZE = 1000

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function authorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return false
  // CRON_SECRET is what Vercel's scheduler sends; CALLBACK_SECRET is used by the
  // realtime server's own trigger.
  const accepted = [process.env.CALLBACK_SECRET, process.env.CRON_SECRET].filter(Boolean)
  return accepted.includes(token)
}

interface CampaignRow {
  id: string
  name: string
  client_id: string
  slot_duration: number | null
  start_date: string | null
  end_date: string | null
  device_group_id: string | null
  status: string
}

interface PlayLogRow {
  campaign_id: string
  device_id: string
  lat: number
  lng: number
}

/** The Tbilisi calendar date a billing period belongs to. */
function periodDate(period: BillingPeriod): string {
  return period.start.toLocaleDateString('en-CA', { timeZone: TZ })
}

async function fetchPlayLogs(
  supabase: SupabaseClient,
  period: BillingPeriod,
): Promise<PlayLogRow[]> {
  let all: PlayLogRow[] = []
  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .from('play_logs')
      .select('campaign_id, device_id, lat, lng')
      .gte('began_at', period.start.toISOString())
      .lt('began_at', period.end.toISOString())
      .not('campaign_id', 'is', null)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (error) throw new Error(`play_logs read failed: ${error.message}`)
    if (!data || data.length === 0) break
    all = all.concat(data as PlayLogRow[])
    if (data.length < PAGE_SIZE) break
  }
  return all
}

interface PeriodResult {
  period: string
  slotHours: number
  charged: number
  clients: number
  depletedClients: string[]
}

async function billPeriod(
  supabase: SupabaseClient,
  period: BillingPeriod,
  config: PricingConfig,
  campaigns: Map<string, CampaignRow>,
  deviceGps: Map<string, { lat: number; lng: number }>,
): Promise<PeriodResult> {
  const logs = await fetchPlayLogs(supabase, period)
  const today = periodDate(period)
  const timeMultiplier = config.timeMultipliers[String(tbilisiHour(period.start))] || 1.0

  // One charge per (campaign, device) pair per hour — that pair is the slot-hour
  // the price list is built on, no matter how many times the ad looped.
  const slotHours = new Map<string, PlayLogRow>()
  for (const log of logs) {
    const campaign = campaigns.get(log.campaign_id)
    // Only bill airtime the advertiser actually bought: inside the date window.
    if (!campaign || !isWithinWindow(campaign, today)) continue

    const key = `${log.campaign_id}|${log.device_id}`
    if (slotHours.has(key)) continue

    const fallback = deviceGps.get(log.device_id)
    slotHours.set(key, {
      ...log,
      lat: log.lat || fallback?.lat || 0,
      lng: log.lng || fallback?.lng || 0,
    })
  }

  interface ChargeLog {
    client_id: string
    campaign_id: string
    device_id: string
    period_start: string
    period_end: string
    base_rate: number
    district: string
    district_tier: number
    district_multiplier: number
    time_multiplier: number
    total_cost: number
    ad_duration_seconds: number
  }

  const byClient = new Map<string, ChargeLog[]>()

  for (const slot of slotHours.values()) {
    const campaign = campaigns.get(slot.campaign_id)!
    const duration = campaign.slot_duration || 10
    const baseRate = baseRateFor(config, duration)
    const { district, tier } = resolveDistrict(slot.lat, slot.lng, config.districtTiers)
    const districtMultiplier = config.districtMultipliers[String(tier)] ?? 1.0

    const entry: ChargeLog = {
      client_id: campaign.client_id,
      campaign_id: slot.campaign_id,
      device_id: slot.device_id,
      period_start: period.start.toISOString(),
      period_end: period.end.toISOString(),
      base_rate: baseRate,
      district,
      district_tier: tier,
      district_multiplier: districtMultiplier,
      time_multiplier: timeMultiplier,
      total_cost: slotCost(baseRate, districtMultiplier, timeMultiplier),
      ad_duration_seconds: duration,
    }

    const existing = byClient.get(campaign.client_id)
    if (existing) existing.push(entry)
    else byClient.set(campaign.client_id, [entry])
  }

  let charged = 0
  const depletedClients: string[] = []

  for (const [clientId, entries] of byClient) {
    // ignoreDuplicates + .select() means a repeated run returns only the rows it
    // actually inserted, so re-running never double-charges.
    const { data: inserted, error } = await supabase
      .from('billing_logs')
      .upsert(entries, { onConflict: 'campaign_id,device_id,period_start', ignoreDuplicates: true })
      .select('total_cost')

    if (error) {
      console.error(`billing_logs insert failed for client ${clientId}:`, error.message)
      continue
    }

    const amount = money((inserted || []).reduce((sum, r) => sum + Number(r.total_cost), 0))
    if (amount === 0) continue

    const { balance } = await adjustBalance(supabase, {
      clientId,
      amount: -amount,
      type: 'billing',
      note: `Slot-hours ${period.start.toISOString()} → ${period.end.toISOString()}`,
    })
    charged = money(charged + amount)

    if (balance <= 0) depletedClients.push(clientId)
  }

  return {
    period: period.start.toISOString(),
    slotHours: slotHours.size,
    charged,
    clients: byClient.size,
    depletedClients,
  }
}

/** Marks campaigns whose end_date has passed as completed. Returns groups to resync. */
async function completeExpiredCampaigns(
  supabase: SupabaseClient,
  today: string,
): Promise<string[]> {
  const { data: expired, error } = await supabase
    .from('campaigns')
    .update({ status: 'completed' })
    .eq('status', 'active')
    .not('end_date', 'is', null)
    .lt('end_date', today)
    .select('device_group_id')

  if (error) {
    console.error('Expiring campaigns failed:', error.message)
    return []
  }
  return [...new Set((expired || []).map(c => c.device_group_id).filter(Boolean) as string[])]
}

async function pauseDepletedClients(
  supabase: SupabaseClient,
  clientIds: string[],
): Promise<string[]> {
  const groups = new Set<string>()

  for (const clientId of clientIds) {
    const { data: paused, error } = await supabase
      .from('campaigns')
      .update({ status: 'paused_billing' })
      .eq('client_id', clientId)
      .eq('status', 'active')
      .select('device_group_id')

    if (error) {
      console.error(`Pausing campaigns for ${clientId} failed:`, error.message)
      continue
    }
    for (const c of paused || []) {
      if (c.device_group_id) groups.add(c.device_group_id)
    }
  }
  return [...groups]
}

async function run() {
  const supabase = getSupabase()
  const now = new Date()
  const today = now.toLocaleDateString('en-CA', { timeZone: TZ })

  const groupsToSync = new Set<string>()
  for (const groupId of await completeExpiredCampaigns(supabase, today)) {
    groupsToSync.add(groupId)
  }

  // Resume from the newest period already billed, so a missed run self-heals.
  const { data: lastLog } = await supabase
    .from('billing_logs')
    .select('period_end')
    .order('period_end', { ascending: false })
    .limit(1)
    .maybeSingle()

  const periods = pendingPeriods(lastLog?.period_end ? new Date(lastLog.period_end) : null, now)

  if (periods.length === 0) {
    return { message: 'Nothing to bill', periodsBilled: 0, totalCharged: 0, pausedClients: 0 }
  }

  const { data: configRows } = await supabase.from('pricing_config').select('key, value')
  const config = parsePricingConfig(configRows)

  const { data: campaignRows } = await supabase
    .from('campaigns')
    .select('id, name, client_id, slot_duration, start_date, end_date, device_group_id, status')
    .not('client_id', 'is', null)
  const campaigns = new Map<string, CampaignRow>((campaignRows || []).map(c => [c.id, c as CampaignRow]))

  const { data: deviceRows } = await supabase.from('devices').select('id, last_lat, last_lng')
  const deviceGps = new Map<string, { lat: number; lng: number }>(
    (deviceRows || []).map(d => [d.id, { lat: d.last_lat || 0, lng: d.last_lng || 0 }]),
  )

  const results: PeriodResult[] = []
  const depleted = new Set<string>()
  let totalCharged = 0

  for (const period of periods) {
    const result = await billPeriod(supabase, period, config, campaigns, deviceGps)
    results.push(result)
    totalCharged = money(totalCharged + result.charged)
    for (const clientId of result.depletedClients) depleted.add(clientId)
  }

  for (const groupId of await pauseDepletedClients(supabase, [...depleted])) {
    groupsToSync.add(groupId)
  }

  // Re-push affected groups so paused and expired ads stop playing while other
  // clients' campaigns keep running.
  let devicesSynced = 0
  for (const groupId of groupsToSync) {
    try {
      const result = await syncGroupDevices(supabase, groupId)
      devicesSynced += result.synced
    } catch (err) {
      console.error(`Resync of group ${groupId} failed:`, err instanceof Error ? err.message : err)
    }
  }

  return {
    periodsBilled: periods.length,
    from: periods[0].start.toISOString(),
    to: periods[periods.length - 1].end.toISOString(),
    totalCharged,
    slotHours: results.reduce((sum, r) => sum + r.slotHours, 0),
    pausedClients: depleted.size,
    groupsResynced: groupsToSync.size,
    devicesSynced,
    periods: results,
  }
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    return NextResponse.json(await run())
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Billing run failed'
    console.error('Billing run failed:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Vercel's scheduler issues a GET.
export async function GET(request: NextRequest) {
  return POST(request)
}
