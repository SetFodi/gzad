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
// Body: one of
//   { groupId }    sync a single device group
//   { campaignId } sync the group a campaign is assigned to (after approval,
//                  status changes, or duration edits)
//   { clientId }   sync every group holding that client's campaigns (after a
//                  balance top-up)
export async function POST(request: NextRequest) {
  if (!await verifyAdmin()) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const { groupId, clientId, campaignId } = await request.json()
  if (!groupId && !clientId && !campaignId) {
    return NextResponse.json({ error: 'groupId, campaignId or clientId required' }, { status: 400 })
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const groupIds = new Set<string>()
  if (groupId) groupIds.add(groupId)

  if (campaignId) {
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('device_group_id')
      .eq('id', campaignId)
      .maybeSingle()
    if (campaign?.device_group_id) groupIds.add(campaign.device_group_id)
  }

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

  if (groupIds.size === 0) {
    return NextResponse.json({ groups: 0, devices: 0, synced: 0, message: 'No device group assigned' })
  }

  let devices = 0
  let synced = 0
  let media = 0
  let overflow = 0
  const errors: string[] = []

  for (const gid of groupIds) {
    const result = await syncGroupDevices(supabase, gid)
    devices += result.devices
    synced += result.synced
    media = Math.max(media, result.media)
    overflow += result.overflow
    errors.push(...result.errors)
  }

  return NextResponse.json({
    groups: groupIds.size,
    devices,
    synced,
    media,
    overflow,
    errors: errors.length ? errors : undefined,
  })
}
