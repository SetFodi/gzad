import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const REALTIME_SERVER_URL = process.env.REALTIME_SERVER_URL || 'http://localhost:8081'
const REALTIME_SERVER_SECRET = process.env.REALTIME_SERVER_SECRET || ''

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data: admin } = await supabase
    .from('clients')
    .select('is_admin')
    .eq('auth_user_id', user.id)
    .single()

  return admin?.is_admin === true
}

// GET /api/devices — merge registered devices (Supabase) with live status (Realtime Server)
export async function GET() {
  const supabase = await createClient()

  if (!await verifyAdmin()) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  // Fetch registered devices from Supabase
  const { data: registeredDevices } = await supabase
    .from('devices')
    .select('id, name, last_seen_at, last_lat, last_lng, created_at')
    .order('created_at', { ascending: true })

  // Try to fetch live devices from Realtime Server
  let liveDevices: Array<{
    cardId: string
    online: boolean
    connectedAt: string
    lastSeen: string
    info: Record<string, unknown>
  }> = []
  let realtimeError = ''

  try {
    const res = await fetch(`${REALTIME_SERVER_URL}/devices`, {
      headers: { 'Authorization': `Bearer ${REALTIME_SERVER_SECRET}` },
      cache: 'no-store',
    })
    if (res.ok) {
      liveDevices = await res.json()
    } else {
      realtimeError = `Realtime server: ${res.status}`
    }
  } catch (err) {
    realtimeError = err instanceof Error ? err.message : 'Failed to reach Realtime Server'
  }

  // Build a lookup of live devices by cardId
  const liveMap = new Map(liveDevices.map(d => [d.cardId, d]))

  // Merge: start with registered devices, add live status
  const merged = (registeredDevices || []).map(reg => {
    const live = liveMap.get(reg.id)
    liveMap.delete(reg.id) // remove from map so we can find unregistered ones
    return {
      cardId: reg.id,
      name: reg.name,
      online: live ? live.online : false,
      connectedAt: live?.connectedAt || null,
      lastSeen: live?.lastSeen || reg.last_seen_at || null,
      info: live?.info || {},
      registered: true,
    }
  })

  // Add any live devices not yet registered in Supabase
  for (const [, live] of liveMap) {
    merged.push({
      cardId: live.cardId,
      name: null,
      online: live.online,
      connectedAt: live.connectedAt,
      lastSeen: live.lastSeen,
      info: live.info,
      registered: false,
    })

    // Auto-register the new device in Supabase
    await supabase
      .from('devices')
      .upsert({ id: live.cardId, name: live.cardId }, { onConflict: 'id' })
  }

  // Sort: online first, then by name/cardId
  merged.sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1
    return (a.name || a.cardId).localeCompare(b.name || b.cardId)
  })

  return NextResponse.json({
    devices: merged,
    realtimeError: realtimeError || undefined,
  })
}
