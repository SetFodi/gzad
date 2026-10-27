import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'

// Server-side only: the admin gate and Realtime Server access shared by the
// live view API routes.

const REALTIME_SERVER_URL = process.env.REALTIME_SERVER_URL || 'http://localhost:8081'
const REALTIME_SERVER_SECRET = process.env.REALTIME_SERVER_SECRET || ''

/** Card ids as controllers report them. Also keeps an id safe inside a URL path. */
export const CARD_ID = /^[a-zA-Z0-9_-]{3,64}$/

export async function isAdmin(): Promise<boolean> {
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

/** Cross-table reads after the admin check, without RLS edge cases. */
export function serviceClient(): SupabaseClient {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export interface RealtimeDevice {
  cardId: string
  online: boolean
  connectedAt?: string
  lastSeen?: string
}

/** Every screen the Realtime Server holds (connected, or dropped within the hour), by card id. */
export async function realtimeDevices(timeoutMs?: number): Promise<{ devices: Map<string, RealtimeDevice> } | { error: string }> {
  try {
    const res = await realtime('/devices', {}, timeoutMs)
    if (!res.ok) return { error: `Realtime Server: ${res.status}` }
    return { devices: new Map(((await res.json()) as RealtimeDevice[]).map((d) => [d.cardId, d])) }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Realtime Server unreachable' }
  }
}

export function realtime(path: string, init: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  return fetch(`${REALTIME_SERVER_URL}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      'Authorization': `Bearer ${REALTIME_SERVER_SECRET}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
    signal: AbortSignal.timeout(timeoutMs),
  })
}
