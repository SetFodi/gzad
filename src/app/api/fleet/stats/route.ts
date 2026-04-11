import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
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
  const { data: vehicles } = await supabase
    .from('fleet_vehicles')
    .select('id, make, model, year, color, license_plate, device_id')
    .eq('fleet_user_id', client.id)

  if (!vehicles || vehicles.length === 0) {
    return NextResponse.json({ vehicles: [], stats: [] })
  }

  // Get device IDs that are assigned to this fleet user's vehicles
  const assignedDeviceIds = vehicles
    .filter(v => v.device_id)
    .map(v => v.device_id!)

  if (assignedDeviceIds.length === 0) {
    return NextResponse.json({ vehicles, stats: [] })
  }

  // Get play stats for these devices (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: playLogs } = await supabase
    .from('play_logs')
    .select('device_id, duration_seconds, began_at, campaign_id')
    .in('device_id', assignedDeviceIds)
    .gte('began_at', thirtyDaysAgo.toISOString())
    .order('began_at', { ascending: false })

  // Get GPS logs for distance calculation
  const { data: gpsLogs } = await supabase
    .from('gps_logs')
    .select('device_serial, lat, lng, recorded_at')
    .in('device_serial', assignedDeviceIds)
    .gte('recorded_at', thirtyDaysAgo.toISOString())
    .order('recorded_at', { ascending: true })

  // Aggregate stats per device
  const deviceStats = assignedDeviceIds.map(deviceId => {
    const logs = (playLogs || []).filter(l => l.device_id === deviceId)
    const gps = (gpsLogs || []).filter(g => g.device_serial === deviceId)

    const totalPlays = logs.length
    const totalDuration = logs.reduce((sum, l) => sum + (l.duration_seconds || 0), 0)
    const uniqueCampaigns = new Set(logs.map(l => l.campaign_id).filter(Boolean)).size

    // Simple distance calculation from GPS logs
    let totalKm = 0
    for (let i = 1; i < gps.length; i++) {
      const prev = gps[i - 1]
      const curr = gps[i]
      totalKm += haversine(prev.lat, prev.lng, curr.lat, curr.lng)
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

  return NextResponse.json({ vehicles, stats: deviceStats })
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
