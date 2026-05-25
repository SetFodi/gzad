import type { SupabaseClient } from '@supabase/supabase-js'

export const SLOTS_PER_DEVICE = 5

export type SlotDuration = 10 | 20 | 30
export type SlotType = 'customer' | 'house' | 'empty'

export interface SlotEntry {
  index: number // 1..5
  type: SlotType
  campaignId?: string
  campaignName?: string
  mediaId?: string
  mediaUrl?: string
  mediaType?: 'image' | 'video' | string
  durationSeconds: SlotDuration
}

export interface CampaignMediaRow {
  campaignId: string
  campaignName: string
  mediaId: string
  mediaUrl: string
  mediaType: string
  durationSeconds: SlotDuration
}

/**
 * Fetches active campaigns for a given device group along with each campaign's
 * first approved ad_media, in display order (campaign.created_at ASC, then media.uploaded_at ASC).
 * Returns one row per (campaign, media) pair so callers can decide to take the first per campaign
 * (one slot per campaign) or all of them (flattened playlist).
 *
 * Mirrors the SELECT logic in src/app/api/devices/sync-single/route.ts so the admin slot view
 * matches what would actually be pushed to the device.
 */
export async function getActiveCampaignMediaForGroup(
  supabase: SupabaseClient,
  groupId: string | null | undefined,
): Promise<CampaignMediaRow[]> {
  if (!groupId) return []

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name')
    .eq('status', 'active')
    .eq('device_group_id', groupId)
    .order('created_at', { ascending: true })

  if (!campaigns || campaigns.length === 0) return []

  const rows: CampaignMediaRow[] = []
  for (const c of campaigns) {
    const { data: approved } = await supabase
      .from('ad_media')
      .select('id, file_url, file_type, display_duration_seconds, uploaded_at')
      .eq('campaign_id', c.id)
      .eq('status', 'approved')
      .order('uploaded_at', { ascending: true })

    if (!approved || approved.length === 0) continue

    for (const m of approved) {
      const raw = m.display_duration_seconds ?? 10
      const duration: SlotDuration = raw === 20 ? 20 : raw === 30 ? 30 : 10
      rows.push({
        campaignId: c.id,
        campaignName: c.name,
        mediaId: m.id,
        mediaUrl: m.file_url,
        mediaType: (m.file_type || '').toLowerCase().startsWith('video') ? 'video' : 'image',
        durationSeconds: duration,
      })
    }
  }
  return rows
}

/**
 * Computes the 5-slot view for a single device.
 * Customer campaigns fill slots first (one slot per campaign — only the first approved media of each).
 * Any remaining slots up to SLOTS_PER_DEVICE are flagged as 'house' (placeholder).
 * Returns exactly SLOTS_PER_DEVICE entries.
 */
export async function getDeviceSlots(
  supabase: SupabaseClient,
  groupId: string | null | undefined,
): Promise<SlotEntry[]> {
  const rows = await getActiveCampaignMediaForGroup(supabase, groupId)

  // One slot per campaign — pick the first media for each unique campaign.
  const seen = new Set<string>()
  const customerSlots: SlotEntry[] = []
  for (const r of rows) {
    if (seen.has(r.campaignId)) continue
    seen.add(r.campaignId)
    if (customerSlots.length >= SLOTS_PER_DEVICE) break
    customerSlots.push({
      index: customerSlots.length + 1,
      type: 'customer',
      campaignId: r.campaignId,
      campaignName: r.campaignName,
      mediaId: r.mediaId,
      mediaUrl: r.mediaUrl,
      mediaType: r.mediaType,
      durationSeconds: r.durationSeconds,
    })
  }

  // Fill the rest with house placeholders (always 10s default).
  const slots: SlotEntry[] = [...customerSlots]
  while (slots.length < SLOTS_PER_DEVICE) {
    slots.push({
      index: slots.length + 1,
      type: 'house',
      durationSeconds: 10,
    })
  }
  return slots
}

/** Cycle time = sum of slot durations on a device. */
export function cycleTimeSeconds(slots: SlotEntry[]): number {
  return slots.reduce((sum, s) => sum + s.durationSeconds, 0)
}
