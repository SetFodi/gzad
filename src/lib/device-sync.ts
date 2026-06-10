import type { SupabaseClient } from '@supabase/supabase-js'

// Server-side only — talks to the Realtime Server with the shared secret.
// Single source of truth for "what should this device be playing right now",
// used by sync-single, billing, and admin sync routes.

const REALTIME_SERVER_URL = process.env.REALTIME_SERVER_URL || 'http://localhost:8081'
const REALTIME_SERVER_SECRET = process.env.REALTIME_SERVER_SECRET || ''

export interface PlaylistMediaItem {
  url: string
  type: string
  duration: number
  campaignName: string
}

export interface GroupPlaylist {
  programName: string
  mediaItems: PlaylistMediaItem[]
  campaignNames: string[]
}

/** Builds the playlist for a device group from its active campaigns' approved media. */
export async function buildGroupPlaylist(
  supabase: SupabaseClient,
  groupId: string,
): Promise<GroupPlaylist> {
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name')
    .eq('status', 'active')
    .eq('device_group_id', groupId)
    .order('created_at', { ascending: true })

  const mediaItems: PlaylistMediaItem[] = []
  const campaignNames: string[] = []

  for (const c of campaigns || []) {
    const { data: approved } = await supabase
      .from('ad_media')
      .select('file_url, file_type, display_duration_seconds')
      .eq('campaign_id', c.id)
      .eq('status', 'approved')

    if (approved && approved.length > 0) {
      campaignNames.push(c.name)
      for (const m of approved) {
        mediaItems.push({
          url: m.file_url,
          type: m.file_type,
          duration: m.display_duration_seconds || 10,
          campaignName: c.name,
        })
      }
    }
  }

  return {
    programName: campaignNames.length === 1 ? campaignNames[0] : 'gzad playlist',
    mediaItems,
    campaignNames,
  }
}

/** Pushes a playlist to one device, or clears it when the playlist is empty. */
export async function pushPlaylistToDevice(
  cardId: string,
  playlist: GroupPlaylist,
): Promise<{ ok: boolean; cleared: boolean }> {
  try {
    if (playlist.mediaItems.length === 0) {
      const res = await fetch(`${REALTIME_SERVER_URL}/devices/${cardId}/clear-program`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${REALTIME_SERVER_SECRET}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      return { ok: res.ok, cleared: true }
    }

    const res = await fetch(`${REALTIME_SERVER_URL}/devices/${cardId}/push-program`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${REALTIME_SERVER_SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: playlist.programName,
        mediaItems: playlist.mediaItems,
        schedule: { startTime: '00:00', endTime: '23:59' },
        width: 240,
        height: 80,
      }),
    })
    return { ok: res.ok, cleared: false }
  } catch {
    return { ok: false, cleared: false }
  }
}

/** Re-syncs a single device with its group's current playlist (clears if no group/campaigns). */
export async function syncDevicePlaylist(
  supabase: SupabaseClient,
  cardId: string,
): Promise<{ pushed: boolean; cleared: boolean; media: number; campaigns: number; reason?: string }> {
  const { data: device } = await supabase
    .from('devices')
    .select('group_id')
    .eq('id', cardId)
    .maybeSingle()

  if (!device?.group_id) {
    // No group — leave the device alone (it may carry a manually pushed program)
    return { pushed: false, cleared: false, media: 0, campaigns: 0, reason: 'no group assigned' }
  }

  const playlist = await buildGroupPlaylist(supabase, device.group_id)
  const { ok, cleared } = await pushPlaylistToDevice(cardId, playlist)
  return {
    pushed: ok && !cleared,
    cleared,
    media: playlist.mediaItems.length,
    campaigns: playlist.campaignNames.length,
    reason: playlist.mediaItems.length === 0 ? 'no active campaigns — device cleared' : undefined,
  }
}

/** Re-syncs every device in a group. Returns how many pushes succeeded. */
export async function syncGroupDevices(
  supabase: SupabaseClient,
  groupId: string,
): Promise<{ devices: number; synced: number }> {
  const [{ data: devices }, playlist] = await Promise.all([
    supabase.from('devices').select('id').eq('group_id', groupId),
    buildGroupPlaylist(supabase, groupId),
  ])

  let synced = 0
  for (const d of devices || []) {
    const { ok, cleared } = await pushPlaylistToDevice(d.id, playlist)
    if (ok || cleared) synced++
  }
  return { devices: (devices || []).length, synced }
}
