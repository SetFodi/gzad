import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getDistrictsForPoint } from '@/lib/districts'

const REALTIME_SERVER_URL = process.env.REALTIME_SERVER_URL || 'http://localhost:8081'
const REALTIME_SERVER_SECRET = process.env.REALTIME_SERVER_SECRET || ''

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (token !== process.env.CALLBACK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()

  // Billing period: the last full hour
  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setMinutes(0, 0, 0)
  const periodStart = new Date(periodEnd.getTime() - 60 * 60 * 1000)

  // Current hour in Tbilisi for time multiplier
  const tbilisiHour = parseInt(
    periodStart.toLocaleString('en-GB', { timeZone: 'Asia/Tbilisi', hour: '2-digit', hour12: false }),
    10,
  )

  // Load pricing config
  const { data: configs } = await supabase.from('pricing_config').select('key, value')
  const cfg: Record<string, Record<string, number>> = {}
  for (const c of configs || []) cfg[c.key] = c.value as Record<string, number>

  const baseRates = cfg.base_rates || { '10': 2.0, '20': 3.4, '30': 4.6 }
  const districtTiers = cfg.district_tiers || {}
  const districtMultipliers = cfg.district_multipliers || {}
  const timeMultipliers = cfg.time_multipliers || {}
  const timeMult = timeMultipliers[tbilisiHour.toString()] || 1.0

  // Active campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, client_id, slot_duration')
    .eq('status', 'active')

  if (!campaigns || campaigns.length === 0) {
    return NextResponse.json({ message: 'No active campaigns', charges: 0 })
  }

  // Play logs for the billing period
  let allPlayLogs: { campaign_id: string; device_id: string; lat: number; lng: number }[] = []
  let page = 0
  const PAGE_SIZE = 1000
  while (true) {
    const { data: batch } = await supabase
      .from('play_logs')
      .select('campaign_id, device_id, lat, lng')
      .gte('began_at', periodStart.toISOString())
      .lt('began_at', periodEnd.toISOString())
      .not('campaign_id', 'is', null)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    if (!batch || batch.length === 0) break
    allPlayLogs = allPlayLogs.concat(batch)
    if (batch.length < PAGE_SIZE) break
    page++
  }

  if (allPlayLogs.length === 0) {
    return NextResponse.json({ message: 'No play logs in period', charges: 0 })
  }

  // Device GPS fallback
  const deviceIds = [...new Set(allPlayLogs.map(l => l.device_id))]
  const { data: devData } = await supabase
    .from('devices')
    .select('id, last_lat, last_lng')
    .in('id', deviceIds)
  const deviceGps: Record<string, { lat: number; lng: number }> = {}
  for (const d of devData || []) {
    deviceGps[d.id] = { lat: d.last_lat || 0, lng: d.last_lng || 0 }
  }

  // Unique (campaign, device) pairs = slot-hours
  const slotHours = new Map<string, { campaign_id: string; device_id: string; lat: number; lng: number }>()
  for (const log of allPlayLogs) {
    const key = `${log.campaign_id}|${log.device_id}`
    if (!slotHours.has(key)) {
      const lat = log.lat || deviceGps[log.device_id]?.lat || 0
      const lng = log.lng || deviceGps[log.device_id]?.lng || 0
      slotHours.set(key, { campaign_id: log.campaign_id, device_id: log.device_id, lat, lng })
    }
  }

  const campaignMap = new Map(campaigns.map(c => [c.id, c]))

  // Calculate charges per client
  const clientCharges: Record<string, { total: number; logs: {
    client_id: string; campaign_id: string; device_id: string
    period_start: string; period_end: string; base_rate: number
    district: string; district_tier: number; district_multiplier: number
    time_multiplier: number; total_cost: number; ad_duration_seconds: number
  }[] }> = {}

  for (const [, slot] of slotHours) {
    const campaign = campaignMap.get(slot.campaign_id)
    if (!campaign?.client_id) continue

    const clientId = campaign.client_id
    const duration = campaign.slot_duration || 10
    const baseRate = baseRates[duration.toString()] ?? baseRates['10'] ?? 2.0

    let districtName = 'Unknown'
    let tier = 4
    if (slot.lat && slot.lng) {
      const districts = getDistrictsForPoint(slot.lat, slot.lng)
      if (districts.length > 0) {
        districtName = districts[0]
        tier = (districtTiers as Record<string, number>)[districtName] ?? 4
      }
    }
    const districtMult = districtMultipliers[tier.toString()] ?? 1.0

    const totalCost = Math.round(baseRate * districtMult * timeMult * 100) / 100

    if (!clientCharges[clientId]) clientCharges[clientId] = { total: 0, logs: [] }
    clientCharges[clientId].total += totalCost
    clientCharges[clientId].logs.push({
      client_id: clientId,
      campaign_id: slot.campaign_id,
      device_id: slot.device_id,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      base_rate: baseRate,
      district: districtName,
      district_tier: tier,
      district_multiplier: districtMult,
      time_multiplier: timeMult,
      total_cost: totalCost,
      ad_duration_seconds: duration,
    })
  }

  // Deduct balances and insert billing logs
  let totalCharged = 0
  const pausedClients: string[] = []
  const devicesToSync = new Set<string>()

  for (const [clientId, charge] of Object.entries(clientCharges)) {
    // Insert billing logs (unique index prevents double-billing)
    if (charge.logs.length > 0) {
      await supabase.from('billing_logs').upsert(charge.logs, {
        onConflict: 'campaign_id,device_id,period_start',
        ignoreDuplicates: true,
      })
    }

    // Deduct
    const { data: client } = await supabase
      .from('clients')
      .select('balance')
      .eq('id', clientId)
      .single()

    const newBalance = Math.round(((client?.balance || 0) - charge.total) * 100) / 100
    await supabase.from('clients').update({ balance: newBalance }).eq('id', clientId)
    totalCharged += charge.total

    // Pause campaigns if balance depleted
    if (newBalance <= 0) {
      const { data: paused } = await supabase
        .from('campaigns')
        .update({ status: 'paused_billing' })
        .eq('client_id', clientId)
        .eq('status', 'active')
        .select('id')

      if (paused && paused.length > 0) {
        pausedClients.push(clientId)
        // Collect devices that need resync
        for (const log of charge.logs) devicesToSync.add(log.device_id)
      }
    }
  }

  // Resync affected devices so they stop playing paused ads
  for (const deviceId of devicesToSync) {
    const devGps = deviceGps[deviceId]
    fetch(`${REALTIME_SERVER_URL}/devices/${deviceId}/clear-program`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${REALTIME_SERVER_SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).catch(() => {})
  }

  return NextResponse.json({
    period: { start: periodStart.toISOString(), end: periodEnd.toISOString() },
    hour: tbilisiHour,
    timeMultiplier: timeMult,
    slotHours: slotHours.size,
    totalCharged: Math.round(totalCharged * 100) / 100,
    clientsCharged: Object.keys(clientCharges).length,
    pausedClients: pausedClients.length,
  })
}
