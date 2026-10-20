import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  billingWindows,
  lowBalanceAlerts,
  money,
  parseBillingSettings,
  parseMeteredFrom,
  parsePricingConfig,
  BLOCK_MINUTES,
  type BillingSettings,
  type BillingWindow,
  type PricingConfig,
} from '@/lib/billing'
import {
  groupByClient,
  priceBlocks,
  type BlockCharge,
  type PositionRow,
  type UsageRow,
} from '@/lib/metering'
import { syncGroupDevices } from '@/lib/device-sync'
import { TZ } from '@/lib/campaigns'
import { deliverBillingNotifications } from '@/lib/billing-notifications'

// Bills airtime per (campaign, device, block) — docs/billing-metering-plan.md.
//
// Until BILLING_METERED_FROM, blocks are whole hours charged like before
// (a full slot-hour for any play, first-fix district). From it on, blocks are
// 10 minutes, priced by the district majority and prorated by the plays that
// actually happened. Either way:
//   - only plays made while the campaign was active count (status history);
//   - late uploads are found by received_at and billed when they arrive;
//   - rows, the daily cap, the balance and the ledger move together in one
//     transaction per client (post_billing_blocks), so a repeat run charges 0.
//
// Called every 15 minutes by the realtime server and daily by Vercel's cron.

export const maxDuration = 60

const PAGE_SIZE = 1000
const LATE_OVERLAP_MS = 5 * 60 * 1000
const MAX_DRY_RUN_MS = 2 * 24 * 60 * 60 * 1000

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
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
  device_group_id: string | null
  status: string
}

interface PostResult {
  charged: number
  exact: number
  rows: number
  balance: number
  capped: string[]
}

/** Reads every row of a set-returning RPC, past PostgREST's page cap. */
async function rpcAll<T>(supabase: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T[]> {
  const all: T[] = []
  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .rpc(fn, args)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    if (error) throw new Error(`${fn} failed: ${error.message}`)
    const rows = (data || []) as T[]
    all.push(...rows)
    if (rows.length < PAGE_SIZE) break
  }
  return all
}

async function readState<T>(supabase: SupabaseClient, key: string): Promise<T | null> {
  const { data, error } = await supabase.from('billing_state').select('value').eq('key', key).maybeSingle()
  if (error) throw new Error(`billing_state read failed: ${error.message}`)
  return (data?.value as T) ?? null
}

async function writeState(supabase: SupabaseClient, key: string, value: unknown): Promise<void> {
  const { error } = await supabase
    .from('billing_state')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw new Error(`billing_state write failed: ${error.message}`)
}

const tbilisiDate = (at: Date) => at.toLocaleDateString('en-CA', { timeZone: TZ })
const tbilisiTime = (at: Date) =>
  at.toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false })

/**
 * Prices every candidate block in one window. Pure apart from the two reads, so
 * the dry run shares it with the real run.
 */
async function priceWindow(
  supabase: SupabaseClient,
  window: BillingWindow,
  receivedSince: Date | null,
  config: PricingConfig,
  campaigns: Map<string, CampaignRow>,
) {
  const args = {
    p_from: window.from.toISOString(),
    p_to: window.to.toISOString(),
    p_received_since: receivedSince?.toISOString() ?? null,
    p_late_from: window.lateFrom.toISOString(),
    p_block_minutes: window.blockMinutes,
  }
  const [usage, positions] = await Promise.all([
    rpcAll<UsageRow>(supabase, 'billing_block_usage', args),
    rpcAll<PositionRow>(supabase, window.mode === 'metered' ? 'billing_campaign_positions' : 'billing_block_positions', args),
  ])

  return priceBlocks(window, usage, positions, config, campaigns)
}

function postNote(charges: BlockCharge[]): string {
  const starts = charges.map((c) => new Date(c.period_start).getTime())
  const ends = charges.map((c) => new Date(c.period_end).getTime())
  const unit = charges.every((c) => c.billing_unit === 'slot_hour') ? 'slot-hours' : 'blocks'
  return `Airtime ${tbilisiTime(new Date(Math.min(...starts)))}–${tbilisiTime(new Date(Math.max(...ends)))} (${charges.length} ${unit})`
}

async function loadContext(supabase: SupabaseClient) {
  const { data: configRows, error: configError } = await supabase.from('pricing_config').select('key, value')
  if (configError) throw new Error(`pricing_config read failed: ${configError.message}`)
  const config = parsePricingConfig(configRows)
  const settings = parseBillingSettings(configRows?.find((r) => r.key === 'billing_settings')?.value)

  const { data: campaignRows, error: campaignError } = await supabase
    .from('campaigns')
    .select('id, name, client_id, slot_duration, device_group_id, status')
    .not('client_id', 'is', null)
  if (campaignError) throw new Error(`campaigns read failed: ${campaignError.message}`)
  const campaigns = new Map<string, CampaignRow>((campaignRows || []).map((c) => [c.id, c as CampaignRow]))

  return { config, settings, campaigns }
}

/** Refuses a switch-over that would start inside airtime already billed by the hour. */
async function checkMeteredFrom(supabase: SupabaseClient, meteredFrom: Date | null) {
  if (!meteredFrom) return
  const { data } = await supabase
    .from('billing_logs')
    .select('period_end')
    .eq('billing_unit', 'slot_hour')
    .order('period_end', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (data?.period_end && new Date(data.period_end) > meteredFrom) {
    throw new Error(
      `BILLING_METERED_FROM (${meteredFrom.toISOString()}) is before the last hourly charge (${data.period_end}); pick a later Tbilisi midnight`,
    )
  }
}

/** Marks campaigns whose end_date has passed as completed. Returns groups to resync. */
async function completeExpiredCampaigns(supabase: SupabaseClient, today: string): Promise<string[]> {
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
  return [...new Set((expired || []).map((c) => c.device_group_id).filter(Boolean) as string[])]
}

/** First run of a Tbilisi day: campaigns paused by their daily cap go back on air. */
async function resumeCappedCampaigns(supabase: SupabaseClient, today: string): Promise<string[]> {
  const last = await readState<{ date?: string }>(supabase, 'cap_resume_date')
  if (last?.date === today) return []

  const { data: capped, error } = await supabase
    .from('campaigns')
    .select('id, device_group_id, clients(balance)')
    .eq('status', 'paused_cap')
  if (error) throw new Error(`Reading capped campaigns failed: ${error.message}`)

  const groups = new Set<string>()
  for (const c of capped || []) {
    const client = (Array.isArray(c.clients) ? c.clients[0] : c.clients) as { balance?: number } | null
    const status = (client?.balance ?? 0) > 0 ? 'active' : 'paused_billing'
    const { error: updateError } = await supabase
      .from('campaigns')
      .update({ status })
      .eq('id', c.id)
      .eq('status', 'paused_cap')
    if (updateError) {
      console.error(`Resuming capped campaign ${c.id} failed:`, updateError.message)
      continue
    }
    if (c.device_group_id) groups.add(c.device_group_id)
  }
  await writeState(supabase, 'cap_resume_date', { date: today })
  return [...groups]
}

async function pauseDepletedClients(supabase: SupabaseClient, clientIds: string[]): Promise<string[]> {
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

/** Writes low-balance and cap alerts to the outbox; repeats are ignored by dedupe_key. */
async function recordAlerts(
  supabase: SupabaseClient,
  balances: Map<string, number>,
  capped: { campaignId: string; clientId: string }[],
  settings: BillingSettings,
  now: Date,
): Promise<number> {
  const today = tbilisiDate(now)
  const weekAgo = tbilisiDate(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000))
  const rows: Record<string, unknown>[] = []

  for (const [clientId, balance] of balances) {
    const { data: topup } = await supabase
      .from('balance_transactions')
      .select('id, balance_after')
      .eq('client_id', clientId)
      .eq('type', 'topup')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data: days } = await supabase
      .from('billing_daily_totals')
      .select('day, total_cost')
      .eq('client_id', clientId)
      .gte('day', weekAgo)
      .lt('day', today)
    const perDay = new Map<string, number>()
    for (const d of days || []) perDay.set(d.day, (perDay.get(d.day) ?? 0) + Number(d.total_cost))
    const spendDays = [...perDay.values()].filter((v) => v > 0)
    const avgDailySpend = spendDays.length ? spendDays.reduce((a, b) => a + b, 0) / spendDays.length : null

    for (const alert of lowBalanceAlerts({
      clientId,
      balance,
      cycleStart: topup ? { id: topup.id, balance: Number(topup.balance_after) } : null,
      avgDailySpend,
      settings,
      today,
    })) {
      rows.push({ client_id: clientId, kind: alert.kind, balance, detail: alert.detail, dedupe_key: alert.dedupeKey })
    }
  }

  for (const c of capped) {
    rows.push({
      client_id: c.clientId,
      campaign_id: c.campaignId,
      kind: 'cap_reached',
      balance: balances.get(c.clientId) ?? null,
      detail: { date: today },
      dedupe_key: `cap_reached:${c.campaignId}:${today}`,
    })
  }

  if (rows.length === 0) return 0
  const { data, error } = await supabase
    .from('billing_alerts')
    .upsert(rows, { onConflict: 'dedupe_key', ignoreDuplicates: true })
    .select('id')
  if (error) {
    console.error('Recording billing alerts failed:', error.message)
    return 0
  }
  return data?.length ?? 0
}

/**
 * Once a day, after 04:00 Tbilisi: fold old billing detail into billing_daily
 * and prune raw logs. Deletes data, so it runs only with BILLING_RETENTION=on.
 */
async function dailyMaintenance(supabase: SupabaseClient, settings: BillingSettings, now: Date) {
  if (process.env.BILLING_RETENTION !== 'on') return null
  const today = tbilisiDate(now)
  const hour = Number(now.toLocaleString('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }))
  if (hour < 4) return null
  const last = await readState<{ date?: string }>(supabase, 'maintenance_date')
  if (last?.date === today) return null

  const day = 24 * 60 * 60 * 1000
  const result: Record<string, number> = {}

  const detailBefore = tbilisiDate(new Date(now.getTime() - settings.billingDetailKeepDays * day))
  const { data: rolled, error: rollupError } = await supabase.rpc('rollup_billing_logs', { p_before: detailBefore })
  if (rollupError) throw new Error(`rollup_billing_logs failed: ${rollupError.message}`)
  result.billingRowsRolledUp = Number(rolled) || 0

  // A few batches per run keeps it inside the function's time limit; the
  // remainder goes tomorrow.
  for (const [fn, keepDays, label] of [
    ['prune_play_logs', settings.playLogsKeepDays, 'playLogsPruned'],
    ['prune_gps_logs', settings.gpsLogsKeepDays, 'gpsLogsPruned'],
  ] as const) {
    const before = new Date(now.getTime() - Math.max(keepDays, 10) * day).toISOString()
    let total = 0
    for (let i = 0; i < 3; i++) {
      const { data, error } = await supabase.rpc(fn, { p_before: before, p_batch: 20000 })
      if (error) throw new Error(`${fn} failed: ${error.message}`)
      total += Number(data) || 0
      if (!data) break
    }
    result[label] = total
  }

  await writeState(supabase, 'maintenance_date', { date: today })
  return result
}

async function run() {
  const supabase = getSupabase()
  const now = new Date()
  const today = tbilisiDate(now)
  const meteredFrom = parseMeteredFrom(process.env.BILLING_METERED_FROM)

  const { config, settings, campaigns } = await loadContext(supabase)
  await checkMeteredFrom(supabase, meteredFrom)

  const groupsToSync = new Set<string>()
  for (const g of await completeExpiredCampaigns(supabase, today)) groupsToSync.add(g)
  for (const g of await resumeCappedCampaigns(supabase, today)) groupsToSync.add(g)

  // Late uploads: anything received since the last fully successful run.
  const watermark = await readState<{ at?: string }>(supabase, 'late_log_watermark')
  const receivedSince = watermark?.at ? new Date(new Date(watermark.at).getTime() - LATE_OVERLAP_MS) : null

  const windows = billingWindows(now, settings, meteredFrom)
  const balances = new Map<string, number>()
  const depleted = new Set<string>()
  const capped: { campaignId: string; clientId: string }[] = []
  let totalCharged = 0
  let blocks = 0
  let lateBlocks = 0
  let suspectDeviceBlocks = 0
  let failures = 0

  for (const window of windows) {
    const priced = await priceWindow(supabase, window, receivedSince, config, campaigns)
    blocks += priced.blockCount
    lateBlocks += priced.lateBlocks
    suspectDeviceBlocks += priced.suspectDeviceBlocks

    for (const [clientId, charges] of groupByClient(priced.charges, campaigns)) {
      const { data, error } = await supabase.rpc('post_billing_blocks', {
        p_client_id: clientId,
        p_rows: charges,
        p_note: postNote(charges),
      })
      if (error) {
        failures++
        console.error(`Posting charges for ${clientId} failed:`, error.message)
        continue
      }
      const result = data as PostResult
      totalCharged = money(totalCharged + Number(result.charged))
      if (Number(result.charged) !== 0) balances.set(clientId, Number(result.balance))
      if (Number(result.balance) <= 0) depleted.add(clientId)
      for (const campaignId of result.capped || []) {
        capped.push({ campaignId, clientId })
        const group = campaigns.get(campaignId)?.device_group_id
        if (group) groupsToSync.add(group)
      }
    }
  }

  // Advance only when every client posted, so a failure is retried next run.
  if (failures === 0) await writeState(supabase, 'late_log_watermark', { at: now.toISOString() })

  for (const g of await pauseDepletedClients(supabase, [...depleted])) groupsToSync.add(g)

  const alerts = await recordAlerts(supabase, balances, capped, settings, now)

  // Re-push affected groups so paused, capped and expired ads stop playing while
  // other clients' campaigns keep running.
  let devicesSynced = 0
  for (const groupId of groupsToSync) {
    try {
      const result = await syncGroupDevices(supabase, groupId)
      devicesSynced += result.synced
    } catch (err) {
      console.error(`Resync of group ${groupId} failed:`, err instanceof Error ? err.message : err)
    }
  }

  const maintenance = await dailyMaintenance(supabase, settings, now)
  const notificationDelivery = await deliverBillingNotifications(supabase, now)

  return {
    mode: meteredFrom && now >= meteredFrom ? 'metered' : 'hourly',
    // periodsBilled / totalCharged / pausedClients are read by the realtime
    // server's log line; keep their names.
    periodsBilled: blocks,
    totalCharged,
    pausedClients: depleted.size,
    blocks,
    lateBlocks,
    cappedCampaigns: capped.length,
    alerts,
    suspectDeviceBlocks,
    failedClients: failures,
    windows: windows.map((w) => ({ mode: w.mode, from: w.from.toISOString(), to: w.to.toISOString() })),
    groupsResynced: groupsToSync.size,
    devicesSynced,
    maintenance,
    notificationDelivery,
  }
}

/**
 * Prices [from, to) in 10-minute blocks without writing anything, next to what
 * billing_logs already charged for the same range. For the pre-switch-over
 * comparison (plan §8.3).
 */
async function dryRun(from: Date, to: Date) {
  if (!(to > from) || to.getTime() - from.getTime() > MAX_DRY_RUN_MS) {
    throw new Error('dryRun needs from < to, at most 2 days apart')
  }
  const supabase = getSupabase()
  const { config, campaigns } = await loadContext(supabase)
  const priced = await priceWindow(
    supabase,
    { mode: 'metered', blockMinutes: BLOCK_MINUTES, from, to, lateFrom: from },
    null,
    config,
    campaigns,
  )

  // What billing_logs already charged for airtime starting in the same range.
  const charged = new Map<string, number>()
  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .from('billing_logs')
      .select('client_id, total_cost')
      .gte('period_start', from.toISOString())
      .lt('period_start', to.toISOString())
      .order('id')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    if (error) throw new Error(`billing_logs read failed: ${error.message}`)
    for (const row of data || []) {
      if (!row.client_id) continue
      charged.set(row.client_id, (charged.get(row.client_id) ?? 0) + Number(row.total_cost))
    }
    if (!data || data.length < PAGE_SIZE) break
  }

  const clients = [...groupByClient(priced.charges, campaigns)].map(([clientId, rows]) => {
    const metered = money(rows.reduce((sum, r) => sum + r.gross_cost, 0))
    const current = money(charged.get(clientId) ?? 0)
    return {
      clientId,
      metered,
      charged: current,
      difference: money(metered - current),
      blocks: rows.length,
      partialBlocks: rows.filter((r) => r.proration < 1).length,
    }
  })

  return {
    dryRun: true,
    from: from.toISOString(),
    to: to.toISOString(),
    clients,
    deviceBlocks: priced.blockCount,
    suspectDeviceBlocks: priced.suspectDeviceBlocks,
  }
}

async function handle(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const params = request.nextUrl.searchParams
    if (params.get('dryRun') === '1') {
      const from = new Date(params.get('from') || '')
      const to = new Date(params.get('to') || '')
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        return NextResponse.json({ error: 'dryRun needs from and to as ISO dates' }, { status: 400 })
      }
      return NextResponse.json(await dryRun(from, to))
    }
    return NextResponse.json(await run())
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Billing run failed'
    console.error('Billing run failed:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return handle(request)
}

// Vercel's scheduler issues a GET.
export async function GET(request: NextRequest) {
  return handle(request)
}
