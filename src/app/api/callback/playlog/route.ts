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
    const body = await request.json()

    // The controller POSTs an array of play log objects:
    // [{ beginAt, duration, lat, lng, name, pid, type }, ...]
    const logs = Array.isArray(body) ? body : [body]

    if (logs.length === 0) {
      return NextResponse.json({ ok: true, count: 0 })
    }

    // Extract device ID from query param or header
    const deviceId = request.nextUrl.searchParams.get('device')
      || request.headers.get('x-device-id')
      || 'unknown'

    // Update device last_seen
    await supabase
      .from('devices')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', deviceId)

    // Try to match program names to campaigns
    const programNames = [...new Set(logs.map((l: Record<string, unknown>) => l.name as string).filter(Boolean))]

    let campaignMap: Record<string, string> = {}
    if (programNames.length > 0) {
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id, name')
        .in('name', programNames)

      if (campaigns) {
        campaignMap = Object.fromEntries(campaigns.map(c => [c.name, c.id]))
      }
    }

    // Insert raw play logs
    const rows = logs.map((log: Record<string, unknown>) => ({
      device_id: deviceId,
      campaign_id: campaignMap[log.name as string] || null,
      program_name: (log.name as string) || 'unknown',
      program_id: (log.pid as string) || null,
      play_type: (log.type as string) || 'program',
      began_at: new Date(log.beginAt as number).toISOString(),
      duration_seconds: (log.duration as number) || 0,
      lat: (log.lat as number) || 0,
      lng: (log.lng as number) || 0,
    }))

    const { error: insertError } = await supabase.from('play_logs').insert(rows)

    if (insertError) {
      console.error('Play log insert error:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Also aggregate into play_stats for the dashboard
    // Group logs by campaign + date
    const statsMap: Record<string, {
      campaign_id: string
      date: string
      play_count: number
      total_duration: number
      lat: number
      lng: number
      devices: Set<string>
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
          lat: row.lat,
          lng: row.lng,
          devices: new Set(),
        }
      }
      statsMap[key].play_count++
      statsMap[key].total_duration += row.duration_seconds
      statsMap[key].devices.add(row.device_id)
    }

    // Upsert aggregated stats
    for (const stat of Object.values(statsMap)) {
      // Check if a row exists for this campaign+date
      const { data: existing } = await supabase
        .from('play_stats')
        .select('id, play_count, total_duration_seconds, unique_taxis')
        .eq('campaign_id', stat.campaign_id)
        .eq('date', stat.date)
        .single()

      if (existing) {
        await supabase.from('play_stats').update({
          play_count: existing.play_count + stat.play_count,
          total_duration_seconds: existing.total_duration_seconds + stat.total_duration,
          unique_taxis: Math.max(existing.unique_taxis, stat.devices.size),
        }).eq('id', existing.id)
      } else {
        await supabase.from('play_stats').insert({
          campaign_id: stat.campaign_id,
          date: stat.date,
          play_count: stat.play_count,
          total_duration_seconds: stat.total_duration,
          unique_taxis: stat.devices.size,
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
