import type { SupabaseClient } from '@supabase/supabase-js'

// Staff-facing timeline of what the system did (migration
// 20261026120000_system_events.sql). Writing an event must never break the
// thing being recorded: failures are logged and swallowed.

export type EventCategory = 'screen' | 'billing' | 'system'
export type EventSeverity = 'info' | 'success' | 'warning' | 'error'

export interface SystemEvent {
  category: EventCategory
  kind: string
  severity?: EventSeverity
  title: string
  device_id?: string | null
  client_id?: string | null
  campaign_id?: string | null
  detail?: Record<string, unknown>
  occurred_at?: string
}

export async function recordEvents(supabase: SupabaseClient, events: SystemEvent[]): Promise<void> {
  if (events.length === 0) return
  try {
    const { error } = await supabase.from('system_events').insert(
      events.map((e) => ({ severity: 'info', detail: {}, ...e })),
    )
    if (error) console.warn('Recording system events failed:', error.message)
  } catch (err) {
    console.warn('Recording system events failed:', err instanceof Error ? err.message : err)
  }
}

export interface BillingRunSummary {
  mode: string
  totalCharged: number
  blocks: number
  lateBlocks: number
  failedClients: number
  durationMs: number
  charges: { clientId: string; client: string; charged: number; balance: number }[]
  paused: { campaignId: string; campaign: string; client: string; reason: 'balance' | 'cap' }[]
  completed: string[]
  resumed: string[]
  devicesSynced: number
  error?: string
}

const gel = (n: number) => `₾${n.toFixed(2)}`
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** One readable entry per billing run, with everything it did in `detail`. */
export function billingRunEvent(run: BillingRunSummary): SystemEvent {
  if (run.error) {
    return {
      category: 'billing',
      kind: 'billing_run_failed',
      severity: 'error',
      title: `Billing run failed: ${run.error}`,
      detail: { mode: run.mode, duration_ms: run.durationMs },
    }
  }

  const parts: string[] = []
  parts.push(run.totalCharged > 0 ? `${gel(run.totalCharged)} charged` : 'nothing to charge')
  if (run.paused.length) parts.push(`${plural(run.paused.length, 'campaign', 'campaigns')} paused`)
  if (run.completed.length) parts.push(`${plural(run.completed.length, 'campaign', 'campaigns')} ended`)
  if (run.resumed.length) parts.push(`${plural(run.resumed.length, 'campaign', 'campaigns')} back after daily cap`)
  if (run.failedClients) parts.push(`${plural(run.failedClients, 'client', 'clients')} failed`)

  const severity: EventSeverity = run.failedClients
    ? 'error'
    : run.paused.length
      ? 'warning'
      : run.totalCharged > 0
        ? 'success'
        : 'info'

  return {
    category: 'billing',
    kind: 'billing_run',
    severity,
    title: `Billing: ${parts.join(', ')}`,
    detail: {
      mode: run.mode,
      charged: run.totalCharged,
      blocks: run.blocks,
      late_blocks: run.lateBlocks,
      failed_clients: run.failedClients,
      duration_ms: run.durationMs,
      devices_synced: run.devicesSynced,
      charges: run.charges,
      paused: run.paused,
      completed: run.completed,
      resumed: run.resumed,
    },
  }
}

export type DeviceEventKind = 'connected' | 'disconnected' | 'restarted' | 'setup_failed'

/** Screen events reported by the realtime server. */
export function deviceEvent(cardId: string, kind: DeviceEventKind, detail: Record<string, unknown> = {}): SystemEvent {
  const connectedFor = typeof detail.connected_seconds === 'number' ? detail.connected_seconds : null
  const titles: Record<DeviceEventKind, [string, EventSeverity]> = {
    connected: [`${cardId} connected`, 'success'],
    disconnected: [
      `${cardId} disconnected${connectedFor !== null ? ` after ${formatDuration(connectedFor)} online` : ''}`,
      'warning',
    ],
    restarted: [`${cardId} restarted`, 'info'],
    setup_failed: [`${cardId}: setting up play reporting failed`, 'error'],
  }
  const [title, severity] = titles[kind]
  return { category: 'screen', kind, severity, title, device_id: cardId, detail }
}

/** "3 h 20 min", "45 min", "12 s". */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h < 48) return m ? `${h} h ${m} min` : `${h} h`
  return `${Math.round(h / 24)} days`
}
