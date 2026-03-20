import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isPointInDistrict } from '@/lib/districts'

const REALTIME_SERVER_URL = process.env.REALTIME_SERVER_URL || 'http://localhost:8081'
const REALTIME_SERVER_SECRET = process.env.REALTIME_SERVER_SECRET || ''

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Called by the realtime server when a device's district changes.
// Re-pushes the correct geo-filtered playlist for that device.
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (token !== process.env.CALLBACK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { cardId, lat, lng } = await request.json()
  if (!cardId) return NextResponse.json({ error: 'cardId required' }, { status: 400 })

  const supabase = getSupabase()

  // Get device's group
  const { data: device } = await supabase
    .from('devices')
    .select('group_id')
    .eq('id', cardId)
    .maybeSingle()

  if (!device?.group_id) {
    return NextResponse.json({ skipped: true, reason: 'no group assigned' })
  }

  // Get active campaigns in this group
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, districts')
    .eq('status', 'active')
    .eq('device_group_id', device.group_id)
    .order('created_at', { ascending: true })

  if (!campaigns || campaigns.length === 0) {
    return NextResponse.json({ skipped: true, reason: 'no active campaigns in group' })
  }

  // Filter by district
  const qualifying = campaigns.filter(c => {
    if (!c.districts || c.districts.length === 0) return true
    if (!lat || !lng) return true
    return c.districts.some((d: string) => isPointInDistrict(lat, lng, d))
  })

  // If nothing qualifies, clear the device
  if (qualifying.length === 0) {
    await fetch(`${REALTIME_SERVER_URL}/devices/${cardId}/clear-program`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${REALTIME_SERVER_SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    return NextResponse.json({ pushed: false, reason: 'no qualifying campaigns — device cleared' })
  }

  // Fetch approved media
  const mediaItems: { url: string; type: string; duration: number; campaignName: string }[] = []
  const campaignNames: string[] = []

  for (const c of qualifying) {
    const { data: approved } = await supabase
      .from('ad_media')
      .select('file_url, file_type')
      .eq('campaign_id', c.id)
      .eq('status', 'approved')

    if (approved && approved.length > 0) {
      campaignNames.push(c.name)
      for (const m of approved) {
        mediaItems.push({ url: m.file_url, type: m.file_type, duration: 10, campaignName: c.name })
      }
    }
  }

  if (mediaItems.length === 0) {
    return NextResponse.json({ skipped: true, reason: 'no approved media' })
  }

  const programName = campaignNames.length === 1 ? campaignNames[0] : 'gzad playlist'

  const res = await fetch(`${REALTIME_SERVER_URL}/devices/${cardId}/push-program`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${REALTIME_SERVER_SECRET}`,
    },
    body: JSON.stringify({
      name: programName,
      mediaItems,
      schedule: { startTime: '00:00', endTime: '23:59' },
      width: 240,
      height: 80,
    }),
  })

  const result = await res.json()
  console.log(`[sync-single] ${cardId}: pushed ${mediaItems.length} items from ${campaignNames.length} campaigns`)
  return NextResponse.json({ pushed: true, campaigns: campaignNames.length, media: mediaItems.length, result })
}
