import { NextResponse } from 'next/server'
import { isAdmin, realtime, serviceClient } from '@/lib/live-view-server'

// GET /api/admin/monitor — every screen the live view can show, with its group,
// vehicle plate and live connection status.
export async function GET() {
  if (!await isAdmin()) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const db = serviceClient()
  const [devicesRes, groupsRes, vehiclesRes] = await Promise.all([
    db.from('devices').select('id, name, group_id, last_seen_at'),
    db.from('device_groups').select('id, name').order('name', { ascending: true }),
    db.from('fleet_vehicles').select('device_id, license_plate').not('device_id', 'is', null),
  ])

  if (devicesRes.error) {
    return NextResponse.json({ error: devicesRes.error.message }, { status: 500 })
  }

  // Live status is best-effort: the wall still replays from play reports without it.
  const live = new Map<string, { online: boolean; lastSeen?: string }>()
  let realtimeError: string | undefined
  try {
    const res = await realtime('/devices')
    if (res.ok) {
      for (const d of (await res.json()) as { cardId: string; online: boolean; lastSeen?: string }[]) {
        live.set(d.cardId, d)
      }
    } else {
      realtimeError = `Realtime Server: ${res.status}`
    }
  } catch (err) {
    realtimeError = err instanceof Error ? err.message : 'Realtime Server unreachable'
  }

  const plates = new Map<string, string>()
  for (const v of vehiclesRes.data ?? []) {
    if (v.device_id && v.license_plate) plates.set(v.device_id, v.license_plate)
  }

  const devices = (devicesRes.data ?? []).map((d) => ({
    id: d.id as string,
    name: (d.name as string | null) ?? null,
    groupId: (d.group_id as string | null) ?? null,
    plate: plates.get(d.id) ?? null,
    online: live.get(d.id)?.online ?? false,
    lastSeen: live.get(d.id)?.lastSeen ?? (d.last_seen_at as string | null) ?? null,
  }))

  // A screen that connected but isn't registered yet still belongs on the list.
  const known = new Set(devices.map((d) => d.id))
  for (const [id, d] of live) {
    if (!known.has(id)) {
      devices.push({ id, name: null, groupId: null, plate: null, online: d.online, lastSeen: d.lastSeen ?? null })
    }
  }

  devices.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id))

  return NextResponse.json({
    devices,
    groups: (groupsRes.data ?? []).map((g) => ({ id: g.id as string, name: g.name as string })),
    realtimeError,
  })
}
