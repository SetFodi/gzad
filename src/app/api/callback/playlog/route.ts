import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    // The controller POSTs an array of play log objects:
    // [{ beginAt, duration, lat, lng, name, pid, type }, ...]
    const logs = Array.isArray(body) ? body : [body]

    if (logs.length === 0) {
      return NextResponse.json({ _type: 'success', count: 0 })
    }

    // Limit batch size to prevent DoS
    if (logs.length > 500) {
      return NextResponse.json({ _type: 'Error', message: 'Too many entries (max 500)' }, { status: 413 })
    }

    // Extract device ID: prefer Card-Id header (sent by controller per SDK),
    // then query param, then fallback
    const deviceId = request.headers.get('card-id')
      || request.nextUrl.searchParams.get('device')
      || 'unknown'

    // Upsert device record (create if doesn't exist, update if does)
    await supabase
      .from('devices')
      .upsert(
        { id: deviceId, last_seen_at: new Date().toISOString() },
        { onConflict: 'id' }
      )

    // Try to match program names to campaigns (case-insensitive)
    const programNames = [...new Set(
      logs.map((l: Record<string, unknown>) => l.name as string).filter(Boolean)
    )]

    let campaignMap: Record<string, string> = {}
    if (programNames.length > 0) {
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id, name')

      if (campaigns) {
        // Build case-insensitive map: lowercase campaign name -> campaign id
        const campaignLookup = new Map(
          campaigns.map(c => [c.name.toLowerCase(), c.id])
        )
        for (const name of programNames) {
          // Direct match first
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

    // Insert raw play logs with validation
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

    const { error: insertError } = await supabase.from('play_logs').insert(rows)

    if (insertError) {
      console.error('Play log insert error:', insertError)
      // Don't fail completely — still try to aggregate stats
    }

    // Aggregate into play_stats for the dashboard
    // Group logs by campaign + date
    const statsMap: Record<string, {
      campaign_id: string
      date: string
      play_count: number
      total_duration: number
    }> = {}

    for (const row of rows) {
      if (!row.campaign_id) continue
      const date = row.began_at.split('T')[0]
      const key = `${row.campaign_id}_${date}`

      if (!statsMap[key]) {
        statsMap[key] = {
          campaign_id: row.campaign_id,
          date,
          play_count: 0,
          total_duration: 0,
        }
      }
      statsMap[key].play_count++
      statsMap[key].total_duration += row.duration_seconds
    }

    // Upsert aggregated stats
    for (const stat of Object.values(statsMap)) {
      const { data: existing } = await supabase
        .from('play_stats')
        .select('id, play_count, total_duration_seconds')
        .eq('campaign_id', stat.campaign_id)
        .eq('date', stat.date)
        .maybeSingle()

      // Count unique devices for this campaign+date from all play_logs
      const { count: uniqueDevices } = await supabase
        .from('play_logs')
        .select('device_id', { count: 'exact', head: true })
        .eq('campaign_id', stat.campaign_id)
        .gte('began_at', stat.date + 'T00:00:00')
        .lt('began_at', stat.date + 'T23:59:59.999')

      if (existing) {
        await supabase.from('play_stats').update({
          play_count: existing.play_count + stat.play_count,
          total_duration_seconds: existing.total_duration_seconds + stat.total_duration,
          unique_taxis: uniqueDevices || 1,
        }).eq('id', existing.id)
      } else {
        await supabase.from('play_stats').insert({
          campaign_id: stat.campaign_id,
          date: stat.date,
          play_count: stat.play_count,
          total_duration_seconds: stat.total_duration,
          unique_taxis: uniqueDevices || 1,
          km_covered: 0,
        })
      }
    }

    // Controller expects {"_type":"success"} per SDK protocol
    return NextResponse.json({ _type: 'success', count: rows.length })
  } catch (err) {
    console.error('Playlog callback error:', err)
    return NextResponse.json({ _type: 'Error', message: 'Invalid request' }, { status: 400 })
  }
}
