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

    if (process.env.CALLBACK_SECRET && callbackKey !== process.env.CALLBACK_SECRET && bearerToken !== process.env.CALLBACK_SECRET) {
      return NextResponse.json({ _type: 'Error', message: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // The controller POSTs an array of play log objects:
    // [{ beginAt, duration, lat, lng, name, pid, type }, ...]
    const logs = Array.isArray(body) ? body : [body]

    if (logs.length === 0) {
      return NextResponse.json({ _type: 'success', count: 0 })
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
        // Build case-insensitive map: lowercase program name -> campaign id
        const campaignLookup = new Map(
          campaigns.map(c => [c.name.toLowerCase(), c.id])
        )
        for (const name of programNames) {
          const id = campaignLookup.get(name.toLowerCase())
          if (id) campaignMap[name] = id
        }
      }
    }

    // Insert raw play logs
    const rows = logs.map((log: Record<string, unknown>) => {
      const beginAt = log.beginAt as number
      return {
        device_id: deviceId,
        campaign_id: campaignMap[log.name as string] || null,
        program_name: (log.name as string) || 'unknown',
        program_id: (log.pid as string) || null,
        play_type: (log.type as string) || 'program',
        began_at: beginAt ? new Date(beginAt).toISOString() : new Date().toISOString(),
        duration_seconds: (log.duration as number) || 0,
        lat: (log.lat as number) || 0,
        lng: (log.lng as number) || 0,
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

    // Upsert aggregated stats using RPC to avoid race conditions
    for (const stat of Object.values(statsMap)) {
      // Use upsert: if row exists for campaign+date, increment values
      const { data: existing } = await supabase
        .from('play_stats')
        .select('id, play_count, total_duration_seconds, unique_taxis')
        .eq('campaign_id', stat.campaign_id)
        .eq('date', stat.date)
        .maybeSingle()

      if (existing) {
        await supabase.from('play_stats').update({
          play_count: existing.play_count + stat.play_count,
          total_duration_seconds: existing.total_duration_seconds + stat.total_duration,
          unique_taxis: (existing.unique_taxis || 0) + 1,
        }).eq('id', existing.id)
      } else {
        await supabase.from('play_stats').insert({
          campaign_id: stat.campaign_id,
          date: stat.date,
          play_count: stat.play_count,
          total_duration_seconds: stat.total_duration,
          unique_taxis: 1,
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
