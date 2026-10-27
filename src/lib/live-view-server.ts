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
