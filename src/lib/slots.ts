import type { SupabaseClient } from '@supabase/supabase-js'
import { applyLiveWindow, tbilisiToday } from '@/lib/campaigns'

// The device's advertising inventory model, and the single source of truth for
// it. Both the admin slot view and the playlist actually pushed to hardware are
// derived from these functions, so what an operator sees is what a screen plays.
//
// A device runs SLOTS_PER_DEVICE slots. One live campaign occupies exactly one
// slot regardless of how many creatives it has uploaded — that is what a
// slot-hour is priced on. A campaign's creatives rotate between cycles.

export const SLOTS_PER_DEVICE = 5

export type SlotDuration = 10 | 20 | 30
export type SlotType = 'customer' | 'house' | 'empty'

export interface SlotCreative {
  id: string
  url: string
  /** Coarse kind, for display. */
  type: 'image' | 'video' | string
  /** Original MIME type — the device needs it to pick a decoder and file extension. */
  mime: string
  durationSeconds: SlotDuration
}

export interface CampaignSlot {
  index: number // 1..SLOTS_PER_DEVICE
  campaignId: string
  campaignName: string
  creatives: SlotCreative[]
}

export interface GroupSlots {
  slots: CampaignSlot[]
  /** Live campaigns that had no free slot on this device. */
  overflow: number
}

/** Flat view of one slot, padded out to SLOTS_PER_DEVICE for the admin UI. */
export interface SlotEntry {
  index: number
  type: SlotType
  campaignId?: string
  campaignName?: string
  mediaId?: string
  mediaUrl?: string
  mediaType?: 'image' | 'video' | string
  durationSeconds: SlotDuration
  /** How many creatives rotate through this slot. */
  creativeCount?: number
}

function normalizeDuration(raw: number | null | undefined): SlotDuration {
  return raw === 20 ? 20 : raw === 30 ? 30 : 10
}

/**
 * Occupied slots for a device group: live campaigns (active, inside their date
 * window, with at least one approved creative) in display order, capped at
 * SLOTS_PER_DEVICE.
 */
export async function getGroupSlots(
  supabase: SupabaseClient,
  groupId: string | null | undefined,
  today: string = tbilisiToday(),
): Promise<GroupSlots> {
  if (!groupId) return { slots: [], overflow: 0 }

  const { data: campaigns } = await applyLiveWindow(
    supabase
      .from('campaigns')
      .select('id, name')
      .eq('status', 'active')
      .eq('device_group_id', groupId),
    today,
  ).order('created_at', { ascending: true })

  if (!campaigns || campaigns.length === 0) return { slots: [], overflow: 0 }

  const slots: CampaignSlot[] = []
  let overflow = 0

  for (const campaign of campaigns) {
    const { data: approved } = await supabase
      .from('ad_media')
      .select('id, file_url, file_type, display_duration_seconds')
      .eq('campaign_id', campaign.id)
      .eq('status', 'approved')
      .order('uploaded_at', { ascending: true })

    if (!approved || approved.length === 0) continue

    if (slots.length >= SLOTS_PER_DEVICE) {
      overflow++
      continue
    }

    slots.push({
      index: slots.length + 1,
      campaignId: campaign.id,
      campaignName: campaign.name,
      creatives: approved.map(m => ({
        id: m.id,
        url: m.file_url,
        type: (m.file_type || '').toLowerCase().startsWith('video') ? 'video' : 'image',
        mime: m.file_type || 'video/mp4',
        durationSeconds: normalizeDuration(m.display_duration_seconds),
      })),
    })
  }

  return { slots, overflow }
}

/**
 * The SLOTS_PER_DEVICE-entry view used by the admin slots page. Occupied slots
 * show their first creative; the rest are house placeholders.
 */
export async function getDeviceSlots(
  supabase: SupabaseClient,
  groupId: string | null | undefined,
  today: string = tbilisiToday(),
): Promise<SlotEntry[]> {
  const { slots: occupied } = await getGroupSlots(supabase, groupId, today)

  const entries: SlotEntry[] = occupied.map(slot => ({
    index: slot.index,
    type: 'customer' as const,
    campaignId: slot.campaignId,
    campaignName: slot.campaignName,
    mediaId: slot.creatives[0].id,
    mediaUrl: slot.creatives[0].url,
    mediaType: slot.creatives[0].type,
    durationSeconds: slot.creatives[0].durationSeconds,
    creativeCount: slot.creatives.length,
  }))

  while (entries.length < SLOTS_PER_DEVICE) {
    entries.push({ index: entries.length + 1, type: 'house', durationSeconds: 10 })
  }
  return entries
}

/** Cycle time = sum of slot durations on a device. */
export function cycleTimeSeconds(slots: SlotEntry[]): number {
  return slots.reduce((sum, s) => sum + s.durationSeconds, 0)
}
