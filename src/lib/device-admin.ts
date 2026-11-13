import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// Adding a screen happens in one place, the admin Devices page. The devices
// table is the registry: the Realtime Server asks /api/devices/authorize
// before it accepts a controller, so a row here is all a new screen needs.

/** Controller ids look like y08-s26-60755: letters, digits, dashes. */
export const CARD_ID_PATTERN = /^[a-z0-9_-]{4,64}$/

/** Controllers report their id in lower case; a pasted id may not be. */
export function normalizeCardId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const id = value.trim().toLowerCase()
  return CARD_ID_PATTERN.test(id) ? id : null
}

export function serviceClient(): SupabaseClient {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export type ManagerCheck =
  | { ok: true; db: SupabaseClient }
  | { ok: false; status: 401 | 403; error: string }

/** The signed-in user must be an admin listed in device_managers. */
export async function requireDeviceManager(): Promise<ManagerCheck> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401, error: 'Unauthorized' }

  const db = serviceClient()
  const { data: client } = await db
    .from('clients')
    .select('id, is_admin')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!client?.is_admin) return { ok: false, status: 403, error: 'Admin access required' }

  const { data: manager } = await db
    .from('device_managers')
    .select('client_id')
    .eq('client_id', client.id)
    .maybeSingle()
  if (!manager) return { ok: false, status: 403, error: 'Only device managers can add or remove screens' }

  return { ok: true, db }
}

const REALTIME_SERVER_URL = () => process.env.REALTIME_SERVER_URL || 'http://localhost:8081'
const REALTIME_SERVER_SECRET = () => process.env.REALTIME_SERVER_SECRET || ''

async function realtime(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${REALTIME_SERVER_URL()}${path}`, {
    ...init,
    headers: { ...init.headers, 'Authorization': `Bearer ${REALTIME_SERVER_SECRET()}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  })
}

/**
 * What to type into LEDOK's "Realtime (Plat 4) Address" for a new screen.
 * The Realtime Server builds it, since it holds the connection token.
 */
export async function fetchDeviceAddress(): Promise<string | null> {
  try {
    const res = await realtime('/provisioning')
    if (!res.ok) return null
    const { address } = await res.json()
    return typeof address === 'string' && address ? address : null
  } catch {
    return null
  }
}

export interface PendingScreen {
  cardId: string
  firstSeen: string
  lastSeen: string
  attempts: number
}

/**
 * Controllers that tried to connect but nobody has added: a screen pointed
 * at the server shows up here, so adding it is one click, no typing.
 */
export async function fetchPendingScreens(): Promise<PendingScreen[]> {
  try {
    const res = await realtime('/pending-devices')
    if (!res.ok) return []
    const list = await res.json()
    if (!Array.isArray(list)) return []
    return list
      .filter((p) => typeof p?.cardId === 'string' && normalizeCardId(p.cardId) === p.cardId)
      .map((p) => ({ cardId: p.cardId, firstSeen: p.firstSeen, lastSeen: p.lastSeen, attempts: Number(p.attempts) || 1 }))
  } catch {
    return []
  }
}

/**
 * Tells the Realtime Server a screen's registration changed, so it doesn't
 * wait out its cache. Best effort: a server that misses this catches up when
 * its cache expires.
 */
export async function notifyRegistryChange(cardId: string, disconnect = false): Promise<void> {
  try {
    await realtime(`/registry/${encodeURIComponent(cardId)}/forget`, {
      method: 'POST',
      body: JSON.stringify({ disconnect }),
    })
  } catch {
    // ignored, see above
  }
}
