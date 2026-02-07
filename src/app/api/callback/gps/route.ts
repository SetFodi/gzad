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
    // Auth: check shared secret
    const callbackKey = request.nextUrl.searchParams.get('key')
    if (process.env.CALLBACK_SECRET && callbackKey !== process.env.CALLBACK_SECRET) {
      return NextResponse.json({ _type: 'Error', message: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // GPS callback can be array or single object
    const entries = Array.isArray(body) ? body : [body]

    const deviceId = request.headers.get('card-id')
      || request.nextUrl.searchParams.get('device')
      || 'unknown'

    const rows = entries
      .map((entry: Record<string, unknown>) => {
        const lat = (entry.lat as number) || 0
        const lng = (entry.lng as number) || 0
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

      // Upsert device with last position (create if doesn't exist)
      const latest = rows[rows.length - 1]!
      await supabase
        .from('devices')
        .upsert(
          {
            id: deviceId,
            last_seen_at: new Date().toISOString(),
            last_lat: latest.lat,
            last_lng: latest.lng,
          },
          { onConflict: 'id' }
        )
    }

    return NextResponse.json({ _type: 'success', count: rows.length })
  } catch (err) {
    console.error('GPS callback error:', err)
    return NextResponse.json({ _type: 'Error', message: 'Invalid request' }, { status: 400 })
  }
}
