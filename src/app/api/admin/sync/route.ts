import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { syncGroupDevices } from '@/lib/device-sync'

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

// POST /api/admin/sync — re-push current playlists to devices.
// Body: { groupId } to sync one group, or { clientId } to sync every group
// that has campaigns belonging to that client (used after balance top-ups).
export async function POST(request: NextRequest) {
  if (!await verifyAdmin()) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const { groupId, clientId } = await request.json()
  if (!groupId && !clientId) {
    return NextResponse.json({ error: 'groupId or clientId required' }, { status: 400 })
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const groupIds = new Set<string>()
  if (groupId) groupIds.add(groupId)

  if (clientId) {
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('device_group_id')
      .eq('client_id', clientId)
      .not('device_group_id', 'is', null)
    for (const c of campaigns || []) {
      if (c.device_group_id) groupIds.add(c.device_group_id)
    }
  }

  let devices = 0
  let synced = 0
  for (const gid of groupIds) {
    const result = await syncGroupDevices(supabase, gid)
    devices += result.devices
    synced += result.synced
  }

  return NextResponse.json({ groups: groupIds.size, devices, synced })
}
