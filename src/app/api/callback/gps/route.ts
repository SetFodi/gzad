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

    // GPS callback can be array or single object
    const entries = Array.isArray(body) ? body : [body]

    const deviceSerial = request.headers.get('card-id')
      || request.nextUrl.searchParams.get('device')
      || 'unknown'

    const rows = entries
      .map((entry: Record<string, unknown>) => {
        const lat = (entry.lat as number) || 0
        const lng = (entry.lng as number) || 0
        if (lat === 0 && lng === 0) return null
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
