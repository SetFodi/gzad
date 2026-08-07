import type { SupabaseClient } from '@supabase/supabase-js'
import { getGroupSlots, SLOTS_PER_DEVICE, type CampaignSlot } from '@/lib/slots'
import { tbilisiToday } from '@/lib/campaigns'

// Server-side only — talks to the Realtime Server with the shared secret.
// Single source of truth for "what should this device be playing right now",
// used by sync-single, billing, and admin sync routes.

const REALTIME_SERVER_URL = process.env.REALTIME_SERVER_URL || 'http://localhost:8081'
const REALTIME_SERVER_SECRET = process.env.REALTIME_SERVER_SECRET || ''

/**
 * How many times the slot rotation repeats inside one pushed program. A
 * campaign with several creatives shows the next one each cycle, so the program
 * has to be long enough to contain a whole rotation. Bounded so a campaign with
 * many creatives can't inflate the program past what the controller handles.
 */
const MAX_CYCLES = 6

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
  /** Live campaigns that didn't fit in SLOTS_PER_DEVICE. */
  overflow: number
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

function lcm(a: number, b: number): number {
  return (a * b) / gcd(a, b)
}

/** How many rotations are needed for every slot to show all of its creatives. */
export function rotationCycles(slots: Pick<CampaignSlot, 'creatives'>[], maxCycles = MAX_CYCLES): number {
  if (slots.length === 0) return 0
  const full = slots.reduce((acc, s) => lcm(acc, Math.max(1, s.creatives.length)), 1)
  return Math.min(full, maxCycles)
}

/**
 * Expands a group's slots into the flat item list the controller plays.
 *
 * Each cycle emits one creative per occupied slot, in slot order, so every
 * campaign gets exactly one appearance per cycle no matter how many files it
 * uploaded — that is the unit that billing charges for.
 */
export function slotsToMediaItems(slots: CampaignSlot[]): PlaylistMediaItem[] {
  const cycles = rotationCycles(slots)
  const items: PlaylistMediaItem[] = []
  for (let cycle = 0; cycle < cycles; cycle++) {
    for (const slot of slots) {
      const creative = slot.creatives[cycle % slot.creatives.length]
      items.push({
        url: creative.url,
        type: creative.mime,
        duration: creative.durationSeconds,
        campaignName: slot.campaignName,
      })
    }
  }
  return items
}

/** Builds the playlist for a device group from its live campaigns' approved media. */
export async function buildGroupPlaylist(
  supabase: SupabaseClient,
  groupId: string,
  today: string = tbilisiToday(),
): Promise<GroupPlaylist> {
  const { slots, overflow } = await getGroupSlots(supabase, groupId, today)
  const campaignNames = slots.map(s => s.campaignName)

  return {
    programName: campaignNames.length === 1 ? campaignNames[0] : 'gzad playlist',
    mediaItems: slotsToMediaItems(slots),
    campaignNames,
    overflow,
  }
}

/** Pushes a playlist to one device, or clears it when the playlist is empty. */
export async function pushPlaylistToDevice(
  cardId: string,
  playlist: GroupPlaylist,
): Promise<{ ok: boolean; cleared: boolean; error?: string }> {
  try {
    if (playlist.mediaItems.length === 0) {
      const res = await fetch(`${REALTIME_SERVER_URL}/devices/${cardId}/clear-program`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${REALTIME_SERVER_SECRET}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      return { ok: res.ok, cleared: true, error: res.ok ? undefined : `clear-program returned ${res.status}` }
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
    return { ok: res.ok, cleared: false, error: res.ok ? undefined : `push-program returned ${res.status}` }
  } catch (err) {
    return { ok: false, cleared: false, error: err instanceof Error ? err.message : 'Realtime Server unreachable' }
  }
}

export interface DeviceSyncResult {
  pushed: boolean
  cleared: boolean
  media: number
  campaigns: number
  overflow: number
  reason?: string
  error?: string
}

/** Re-syncs a single device with its group's current playlist (clears if no group/campaigns). */
export async function syncDevicePlaylist(
  supabase: SupabaseClient,
  cardId: string,
): Promise<DeviceSyncResult> {
  const { data: device } = await supabase
    .from('devices')
    .select('group_id')
    .eq('id', cardId)
    .maybeSingle()

  if (!device?.group_id) {
    // No group — leave the device alone (it may carry a manually pushed program)
    return { pushed: false, cleared: false, media: 0, campaigns: 0, overflow: 0, reason: 'no group assigned' }
  }

  const playlist = await buildGroupPlaylist(supabase, device.group_id)
  const { ok, cleared, error } = await pushPlaylistToDevice(cardId, playlist)
  return {
    pushed: ok && !cleared,
    cleared,
    media: playlist.mediaItems.length,
    campaigns: playlist.campaignNames.length,
    overflow: playlist.overflow,
    reason: playlist.mediaItems.length === 0 ? 'no live campaigns — device cleared' : undefined,
    error,
  }
}

/** Re-syncs every device in a group. Returns how many pushes succeeded. */
export async function syncGroupDevices(
  supabase: SupabaseClient,
  groupId: string,
): Promise<{ devices: number; synced: number; media: number; campaigns: number; overflow: number; errors: string[] }> {
  const [{ data: devices }, playlist] = await Promise.all([
    supabase.from('devices').select('id').eq('group_id', groupId),
    buildGroupPlaylist(supabase, groupId),
  ])

  let synced = 0
  const errors: string[] = []
  for (const d of devices || []) {
    const { ok, cleared, error } = await pushPlaylistToDevice(d.id, playlist)
    if (ok || cleared) synced++
    if (error) errors.push(`${d.id}: ${error}`)
  }

  return {
    devices: (devices || []).length,
    synced,
    media: playlist.mediaItems.length,
    campaigns: playlist.campaignNames.length,
    overflow: playlist.overflow,
    errors,
  }
}

/** Re-syncs every device in every group a campaign touches. */
export async function syncCampaignDevices(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<{ groups: number; devices: number; synced: number }> {
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('device_group_id')
    .eq('id', campaignId)
    .maybeSingle()

  if (!campaign?.device_group_id) return { groups: 0, devices: 0, synced: 0 }

  const result = await syncGroupDevices(supabase, campaign.device_group_id)
  return { groups: 1, devices: result.devices, synced: result.synced }
}

export { SLOTS_PER_DEVICE }
