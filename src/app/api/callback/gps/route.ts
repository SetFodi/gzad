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

    // GPS callback can be array or single object
    // Format: [{ type: "gps", lat, lng, beginAt, ... }] or { lat, lng }
    const entries = Array.isArray(body) ? body : [body]

    const deviceId = request.nextUrl.searchParams.get('device')
      || request.headers.get('x-device-id')
      || 'unknown'

    const rows = entries
      .map((entry: Record<string, unknown>) => {
        const lat = (entry.lat as number) || 0
        const lng = (entry.lng as number) || 0
        // Skip entries with no real GPS data
        if (lat === 0 && lng === 0) return null
        return {
          device_id: deviceId,
          lat,
          lng,
          recorded_at: entry.beginAt
            ? new Date(entry.beginAt as number).toISOString()
            : new Date().toISOString(),
        }
      })
      .filter(Boolean)

    if (rows.length > 0) {
      const { error: insertError } = await supabase.from('gps_tracks').insert(rows)

      if (insertError) {
        console.error('GPS insert error:', insertError)
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }

      // Update device last position
      const latest = rows[rows.length - 1]!
      await supabase.from('devices').update({
        last_seen_at: new Date().toISOString(),
        last_lat: latest.lat,
        last_lng: latest.lng,
      }).eq('id', deviceId)
    }

    return NextResponse.json({ ok: true, count: rows.length })
  } catch (err) {
    console.error('GPS callback error:', err)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
