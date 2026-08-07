import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateCallback } from '@/lib/callback-auth'

const MAX_GPS_ENTRIES = 2000

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

    // GPS callback can be array or single object
    const entries = Array.isArray(body) ? body : [body]
    if (entries.length > MAX_GPS_ENTRIES) {
      return NextResponse.json(
        { _type: 'Error', message: `Too many entries (max ${MAX_GPS_ENTRIES})` },
        { status: 413 },
      )
    }

    const deviceSerial = auth.deviceId || 'unknown'

    const rows = entries
      .map((entry: Record<string, unknown>) => {
        const lat = Number(entry.lat) || 0
        const lng = Number(entry.lng) || 0
        if (lat === 0 && lng === 0) return null
        // Out-of-range fixes are garbage, not a position — drop the row rather
        // than letting it skew district pricing.
        if (!Number.isFinite(lat) || lat < -90 || lat > 90) return null
        if (!Number.isFinite(lng) || lng < -180 || lng > 180) return null
        return {
          device_serial: deviceSerial,
          lat,
          lng,
          speed: (entry.speed as number) || 0,
          recorded_at: entry.timestamp
            ? new Date(entry.timestamp as string | number).toISOString()
            : entry.beginAt
              ? new Date(entry.beginAt as number).toISOString()
              : new Date().toISOString(),
        }
      })
      .filter(Boolean)

    if (rows.length > 0) {
      const { error: insertError } = await supabase.from('gps_logs').insert(rows)

      if (insertError) {
        console.error('GPS insert error:', insertError)
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }

      // Upsert device with last position
      const latest = rows[rows.length - 1]!
      await supabase
        .from('devices')
        .upsert(
          {
            id: deviceSerial,
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
