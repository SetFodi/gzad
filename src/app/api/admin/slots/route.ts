import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getDeviceSlots, cycleTimeSeconds, type SlotEntry, SLOTS_PER_DEVICE } from '@/lib/slots'

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

interface DeviceWithSlots {
  cardId: string
  name: string | null
  groupId: string | null
  groupName: string | null
  online: boolean
  lastSeen: string | null
  registered: boolean
  slots: SlotEntry[]
  cycleSeconds: number
  customerSlotCount: number
  houseSlotCount: number
  configIssue: 'no_group' | 'no_campaigns' | null
}

interface GroupSummary {
  id: string
  name: string
}

// GET /api/admin/slots — returns every device with its computed 5-slot view + group list for the filter
export async function GET() {
  if (!await verifyAdmin()) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  // Use service-role client for cross-table reads to avoid RLS edge cases
  // (this route is already gated above by verifyAdmin()).
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // 1. Load all registered devices + their group_id and group name
  const { data: registeredDevices, error: devicesErr } = await supabase
    .from('devices')
    .select('id, name, group_id, last_seen_at, created_at')
    .order('created_at', { ascending: true })

  if (devicesErr) {
    return NextResponse.json({ error: devicesErr.message }, { status: 500 })
  }

  // 2. Load all groups (for the filter dropdown and to name-resolve)
  const { data: groups } = await supabase
    .from('device_groups')
    .select('id, name')
    .order('name', { ascending: true })

  const groupMap = new Map<string, string>()
  for (const g of groups || []) groupMap.set(g.id, g.name)

  // 3. Fetch live status from Realtime Server (best-effort — degrade gracefully)
  let liveDevices: Array<{ cardId: string; online: boolean; lastSeen?: string }> = []
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
  const liveMap = new Map(liveDevices.map(d => [d.cardId, d]))

  // 4. Cache slot computations per group to avoid recomputing for every device in the same group
  const slotCache = new Map<string, SlotEntry[]>()
  const getSlotsForGroup = async (groupId: string | null): Promise<SlotEntry[]> => {
    const key = groupId ?? '__no_group__'
    const cached = slotCache.get(key)
    if (cached) return cached
    if (!groupId) {
      const empty: SlotEntry[] = Array.from({ length: SLOTS_PER_DEVICE }, (_, i) => ({
        index: i + 1,
        type: 'empty' as const,
        durationSeconds: 10 as const,
      }))
      slotCache.set(key, empty)
      return empty
    }
    const slots = await getDeviceSlots(supabase, groupId)
    slotCache.set(key, slots)
    return slots
  }

  // 5. Assemble per-device payload
  const devices: DeviceWithSlots[] = []
  for (const d of registeredDevices || []) {
    const slots = await getSlotsForGroup(d.group_id)
    const customerCount = slots.filter(s => s.type === 'customer').length
    const houseCount = slots.filter(s => s.type === 'house').length

    let configIssue: DeviceWithSlots['configIssue'] = null
    if (!d.group_id) configIssue = 'no_group'
    else if (customerCount === 0) configIssue = 'no_campaigns'

    const live = liveMap.get(d.id)

    devices.push({
      cardId: d.id,
      name: d.name,
      groupId: d.group_id ?? null,
      groupName: d.group_id ? (groupMap.get(d.group_id) ?? null) : null,
      online: live ? live.online : false,
      lastSeen: live?.lastSeen ?? d.last_seen_at ?? null,
      registered: true,
      slots,
      cycleSeconds: cycleTimeSeconds(slots),
      customerSlotCount: customerCount,
      houseSlotCount: houseCount,
      configIssue,
    })
  }

  // 6. Sort: online first, then by name/cardId (mirror /api/devices)
  devices.sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1
    return (a.name || a.cardId).localeCompare(b.name || b.cardId)
  })

  // 7. KPI aggregates (computed server-side so client doesn't re-do the math)
  const totalDevices = devices.length
  const totalOnline = devices.filter(d => d.online).length
  const totalCustomerSlots = devices.reduce((s, d) => s + d.customerSlotCount, 0)
  const totalHouseSlots = devices.reduce((s, d) => s + d.houseSlotCount, 0)
  const totalConfigIssues = devices.filter(d => d.configIssue).length

  const groupSummaries: GroupSummary[] = (groups || []).map(g => ({ id: g.id, name: g.name }))

  return NextResponse.json({
    devices,
    groups: groupSummaries,
    summary: {
      totalDevices,
      totalOnline,
      totalCustomerSlots,
      totalHouseSlots,
      totalConfigIssues,
      totalSlots: totalDevices * SLOTS_PER_DEVICE,
    },
    slotsPerDevice: SLOTS_PER_DEVICE,
    realtimeError: realtimeError || undefined,
  })
}
