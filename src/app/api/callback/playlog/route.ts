import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateCallback } from '@/lib/callback-auth'

const TZ = 'Asia/Tbilisi'
function toTbilisiDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ })
}
function tbilisiDayRange(date: string) {
  // Tbilisi is UTC+4 — convert day boundaries to UTC for DB queries
  const start = new Date(date + 'T00:00:00+04:00').toISOString()
  const end = new Date(date + 'T23:59:59.999+04:00').toISOString()
  return { start, end }
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  try {
    const auth = await authenticateCallback(supabase, request)
    if (!auth.ok) {
      return NextResponse.json({ _type: 'Error', message: auth.reason }, { status: auth.status })
    }

    const body = await request.json()
    // Device firmware (setUploadLogUrl) POSTs: { "sn": "...", "data": [...] }
    // XixunPlayer HTTP upload POSTs: raw JSON array [...]
    // Realtime-server forwarding POSTs: raw JSON array [...]
    const logs = Array.isArray(body)
      ? body
      : Array.isArray(body?.data) ? body.data
      : Array.isArray(body?.logs) ? body.logs
      : [body]

    if (logs.length === 0) {
      return NextResponse.json({ _type: 'success', count: 0 })
    }

    // Allow large backlogs (device may dump historical data)
    if (logs.length > 5000) {
      return NextResponse.json({ _type: 'Error', message: 'Too many entries (max 5000)' }, { status: 413 })
    }

    // A device key pins the caller to its own device id. Only the Realtime
    // Server, which authenticates with the shared secret, may name a device in
    // the body (firmware POSTs include an `sn` field).
    const deviceId = auth.deviceId
      || (!Array.isArray(body) && typeof body?.sn === 'string' ? body.sn : null)
      || 'unknown'

    // Upsert device record (last_seen_at updated on every log batch)
    await supabase
      .from('devices')
      .upsert(
        { id: deviceId, last_seen_at: new Date().toISOString() },
        { onConflict: 'id' }
      )

    // Match program names to campaigns (case-insensitive)
    const programNames = [...new Set<string>(
      logs.map((l: Record<string, unknown>) => l.name as string).filter(Boolean)
    )]

    const campaignMap: Record<string, string> = {}
    if (programNames.length > 0) {
      // Paginate past PostgREST's 1000-row cap — an unpaginated read would
      // silently stop matching plays to campaigns once the catalogue grows.
      const campaigns: { id: string; name: string }[] = []
      const CAMPAIGN_PAGE = 1000
      for (let page = 0; ; page++) {
        const { data: batch } = await supabase
          .from('campaigns')
          .select('id, name')
          .range(page * CAMPAIGN_PAGE, (page + 1) * CAMPAIGN_PAGE - 1)
        if (!batch || batch.length === 0) break
        campaigns.push(...batch)
        if (batch.length < CAMPAIGN_PAGE) break
      }

      if (campaigns.length > 0) {
        const campaignLookup = new Map(
          campaigns.map(c => [c.name.toLowerCase(), c])
        )
        for (const name of programNames) {
          let campaign = campaignLookup.get(name.toLowerCase())
          // Fallback: strip trailing _N suffix (from old buildProgram format)
          if (!campaign) {
            const stripped = name.replace(/_\d+$/, '')
            campaign = campaignLookup.get(stripped.toLowerCase())
          }
          if (campaign) {
            campaignMap[name] = campaign.id
          }
        }
      }
    }

    // Build rows with validation
    const rows = logs.map((log: Record<string, unknown>) => {
      const beginAtRaw = log.beginAt as number
      // Xixun may send beginAt in seconds or milliseconds — if < 10^10 it's seconds (before year 2286)
      const beginAt = beginAtRaw && beginAtRaw < 10_000_000_000 ? beginAtRaw * 1000 : beginAtRaw
      const duration = Math.max(0, Math.min((log.duration as number) || 0, 86400))
      let lat = (log.lat as number) || 0
      let lng = (log.lng as number) || 0
      if (lat < -90 || lat > 90) lat = 0
      if (lng < -180 || lng > 180) lng = 0

      return {
        device_id: deviceId,
        campaign_id: campaignMap[log.name as string] || null,
        program_name: ((log.name as string) || 'unknown').slice(0, 255),
        program_id: ((log.pid as string) || '').slice(0, 255) || null,
        play_type: ((log.type as string) || 'program').slice(0, 50),
        began_at: beginAt ? new Date(beginAt).toISOString() : new Date().toISOString(),
        duration_seconds: duration,
        lat,
        lng,
      }
    })

    // Insert with ON CONFLICT DO NOTHING — skips duplicates via unique index
    // Supabase JS doesn't support ON CONFLICT DO NOTHING for insert,
    // so we use upsert with ignoreDuplicates
    const { error: insertError } = await supabase
      .from('play_logs')
      .upsert(rows, { onConflict: 'device_id,program_name,began_at', ignoreDuplicates: true })

    if (insertError) {
      console.error('Play log insert error:', insertError)
    }

    // If any log has a valid GPS fix, update device last_lat/last_lng
    const gpsLog = rows.filter((r: typeof rows[number]) => r.lat !== 0 || r.lng !== 0).at(-1)
    if (gpsLog) {
      await supabase
        .from('devices')
        .upsert(
          { id: deviceId, last_lat: gpsLog.lat, last_lng: gpsLog.lng, last_seen_at: new Date().toISOString() },
          { onConflict: 'id' }
        )
    }

    // Recompute play_stats for affected campaign+date combos FROM play_logs
    // This replaces (not adds to) existing stats — idempotent
    const affectedKeys = new Set<string>()
    for (const row of rows) {
      if (!row.campaign_id) continue
      const date = toTbilisiDate(row.began_at)
      affectedKeys.add(`${row.campaign_id}|${date}`)
    }

    for (const key of affectedKeys) {
      const [campaignId, date] = key.split('|')

      // Count actual plays and duration from deduplicated play_logs
      const { data: agg } = await supabase.rpc('aggregate_play_stats', {
        p_campaign_id: campaignId,
        p_date: date,
      }).maybeSingle()

      // Fallback: manual aggregation if RPC doesn't exist
      if (!agg) {
        const { start: dayStart, end: dayEnd } = tbilisiDayRange(date)

        const { count: playCount } = await supabase
          .from('play_logs')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', campaignId)
          .gte('began_at', dayStart)
          .lt('began_at', dayEnd)

        // Paginate past PostgREST's 1000-row cap so busy days aren't undercounted
        let totalDuration = 0
        const uniqueDeviceIds = new Set<string>()
        const PAGE = 1000
        for (let page = 0; ; page++) {
          const { data: batch } = await supabase
            .from('play_logs')
            .select('duration_seconds, device_id')
            .eq('campaign_id', campaignId)
            .gte('began_at', dayStart)
            .lt('began_at', dayEnd)
            .range(page * PAGE, (page + 1) * PAGE - 1)
          if (!batch || batch.length === 0) break
          for (const r of batch) {
            totalDuration += r.duration_seconds || 0
            uniqueDeviceIds.add(r.device_id)
          }
          if (batch.length < PAGE) break
        }
        const uniqueDevices = uniqueDeviceIds.size || 1

        // Upsert — REPLACE existing stats (not add)
        await supabase
          .from('play_stats')
          .upsert({
            campaign_id: campaignId,
            date: date,
            play_count: playCount || 0,
            total_duration_seconds: totalDuration,
            unique_taxis: uniqueDevices,
            km_covered: 0,
          }, { onConflict: 'campaign_id,date' })
      }
    }

    return NextResponse.json({ _type: 'success', count: rows.length })
  } catch (err) {
    console.error('Playlog callback error:', err)
    return NextResponse.json({ _type: 'Error', message: 'Invalid request' }, { status: 400 })
  }
}
