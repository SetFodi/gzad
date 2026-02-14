import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    // Auth: check shared secret via query param OR Authorization header
    const callbackKey = request.nextUrl.searchParams.get('key')
    const authHeader = request.headers.get('authorization')
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    const secret = process.env.CALLBACK_SECRET
    if (!secret) {
      console.error('CALLBACK_SECRET not configured')
      return NextResponse.json({ _type: 'Error', message: 'Server misconfigured' }, { status: 500 })
    }
    if (callbackKey !== secret && bearerToken !== secret) {
      return NextResponse.json({ _type: 'Error', message: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const logs = Array.isArray(body) ? body : [body]

    if (logs.length === 0) {
      return NextResponse.json({ _type: 'success', count: 0 })
    }

    // Allow large backlogs (device may dump historical data)
    if (logs.length > 5000) {
      return NextResponse.json({ _type: 'Error', message: 'Too many entries (max 5000)' }, { status: 413 })
    }

    const deviceId = request.headers.get('card-id')
      || request.nextUrl.searchParams.get('device')
      || 'unknown'

    // Upsert device record
    await supabase
      .from('devices')
      .upsert(
        { id: deviceId, last_seen_at: new Date().toISOString() },
        { onConflict: 'id' }
      )

    // Match program names to campaigns (case-insensitive)
    const programNames = [...new Set(
      logs.map((l: Record<string, unknown>) => l.name as string).filter(Boolean)
    )]

    let campaignMap: Record<string, string> = {}
    if (programNames.length > 0) {
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id, name')

      if (campaigns) {
        const campaignLookup = new Map(
          campaigns.map(c => [c.name.toLowerCase(), c.id])
        )
        for (const name of programNames) {
          let id = campaignLookup.get(name.toLowerCase())
          // Fallback: strip trailing _N suffix (from old buildProgram format)
          if (!id) {
            const stripped = name.replace(/_\d+$/, '')
            id = campaignLookup.get(stripped.toLowerCase())
          }
          if (id) campaignMap[name] = id
        }
      }
    }

    // Build rows with validation
    const rows = logs.map((log: Record<string, unknown>) => {
      const beginAt = log.beginAt as number
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

        const { data: durationData } = await supabase
          .from('play_logs')
          .select('duration_seconds')
          .eq('campaign_id', campaignId)
          .gte('began_at', dayStart)
          .lt('began_at', dayEnd)

        const totalDuration = durationData?.reduce((sum, r) => sum + r.duration_seconds, 0) || 0

        const { data: deviceData } = await supabase
          .from('play_logs')
          .select('device_id')
          .eq('campaign_id', campaignId)
          .gte('began_at', dayStart)
          .lt('began_at', dayEnd)

        const uniqueDevices = new Set(deviceData?.map(d => d.device_id)).size || 1

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
