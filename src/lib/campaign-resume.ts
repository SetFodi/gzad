import type { SupabaseClient } from '@supabase/supabase-js'
import { syncGroupDevices } from '@/lib/device-sync'

/**
 * Brings back the campaigns billing paused for running out of balance, and
 * pushes their groups' playlists again so the ads actually resume. Used after
 * a top-up and when an account is made billing-exempt.
 */
export async function resumeBillingPaused(
  service: SupabaseClient,
  clientId: string,
): Promise<{ reactivated: number; devicesSynced: number }> {
  const { data: resumed, error } = await service
    .from('campaigns')
    .update({ status: 'active' })
    .eq('client_id', clientId)
    .eq('status', 'paused_billing')
    .select('device_group_id')
  if (error) throw new Error(`Resuming campaigns failed: ${error.message}`)

  let devicesSynced = 0
  const groups = new Set((resumed || []).map((c) => c.device_group_id).filter(Boolean) as string[])
  for (const groupId of groups) {
    try {
      const result = await syncGroupDevices(service, groupId)
      devicesSynced += result.synced
    } catch (err) {
      console.error(`Resync of group ${groupId} failed:`, err instanceof Error ? err.message : err)
    }
  }
  return { reactivated: (resumed || []).length, devicesSynced }
}
