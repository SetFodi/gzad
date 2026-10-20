import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const PAGE_SIZE = 1000

// Fetches all rows past PostgREST's 1000-row cap.
async function fetchAll<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  let all: T[] = []
  let page = 0
  while (true) {
    const { data, error } = await query(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < PAGE_SIZE) break
    page++
  }
  return all
}

export async function GET(request: NextRequest) {
  const includeLogs = request.nextUrl.searchParams.get('detail') === '1'
  const emptyDetails = includeLogs ? { logs: [] } : {}
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: client } = await supabase
      .from('clients')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .single()

    if (!client || client.role !== 'fleet') {
      return NextResponse.json({ error: 'Fleet access required' }, { status: 403 })
    }

    // Get all vehicles for this fleet user
    const { data: vehicles, error: vehiclesError } = await supabase
      .from('fleet_vehicles')
      .select('id, make, model, year, color, license_plate, device_id')
      .eq('fleet_user_id', client.id)

    if (vehiclesError) throw vehiclesError

    if (!vehicles || vehicles.length === 0) {
      return NextResponse.json({ vehicles: [], stats: [], ...emptyDetails })
    }

    // Get device IDs that are assigned to this fleet user's vehicles
    const assignedDeviceIds = vehicles
      .filter(v => v.device_id)
      .map(v => v.device_id!)

    if (assignedDeviceIds.length === 0) {
      return NextResponse.json({ vehicles, stats: [], ...emptyDetails })
    }

    // play_logs/gps_logs have no fleet RLS policies, so read them with the
    // service role — safe because we only query this user's assigned devices.
    const service = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // Get play stats for these devices (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const playLogs = await fetchAll<{ device_id: string; duration_seconds: number; began_at: string; campaign_id: string | null; program_name?: string; lat?: number | null; lng?: number | null }>(
      (from, to) => service
        .from('play_logs')
        .select('device_id, duration_seconds, began_at, campaign_id, program_name, lat, lng')
        .in('device_id', assignedDeviceIds)
        .gte('began_at', thirtyDaysAgo.toISOString())
        .order('began_at', { ascending: false })
        .range(from, to),
    )

    // Get GPS logs for distance calculation
    const gpsLogs = await fetchAll<{ device_serial: string; lat: number; lng: number; recorded_at: string }>(
      (from, to) => service
        .from('gps_logs')
        .select('device_serial, lat, lng, recorded_at')
        .in('device_serial', assignedDeviceIds)
        .gte('recorded_at', thirtyDaysAgo.toISOString())
        .order('recorded_at', { ascending: true })
        .range(from, to),
    )

    // Aggregate stats per device
    const deviceStats = assignedDeviceIds.map(deviceId => {
      const logs = playLogs.filter(l => l.device_id === deviceId)
      const gps = gpsLogs.filter(g => g.device_serial === deviceId)

      const totalPlays = logs.length
      const totalDuration = logs.reduce((sum, l) => sum + (l.duration_seconds || 0), 0)
      const uniqueCampaigns = new Set(logs.map(l => l.campaign_id).filter(Boolean)).size

      // Simple distance calculation from GPS logs
      let totalKm = 0
      for (let i = 1; i < gps.length; i++) {
        const prev = gps[i - 1]
        const curr = gps[i]
        totalKm += haversine(Number(prev.lat), Number(prev.lng), Number(curr.lat), Number(curr.lng))
      }

      return {
        device_id: deviceId,
        total_plays: totalPlays,
        total_duration_seconds: totalDuration,
        unique_campaigns: uniqueCampaigns,
        km_covered: Math.round(totalKm * 10) / 10,
        last_play: logs[0]?.began_at || null,
      }
    })

    // Detailed statistics share the same owner-scoped query as the overview.
    // Caller-supplied device IDs never influence this service-role query.
    return NextResponse.json({ vehicles, stats: deviceStats, ...(includeLogs ? { logs: playLogs } : {}) })
  } catch {
    return NextResponse.json({ error: 'Unable to load fleet statistics' }, { status: 500 })
  }
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
