import { createClient as createAdminClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { fingerprint, isApprovedSession } from './trust'

/** getUser must validate the native token before this additional approval check. */
export async function sessionApproved(client: SupabaseClient, user: User, deviceToken: string | undefined, requestHeaders: Headers): Promise<boolean> {
  if (process.env.AUTH_DEVICE_VERIFICATION !== 'on') return true
  if (!deviceToken || !user.email_confirmed_at) return false
  try {
    const { data: { session }, error } = await client.auth.getSession()
    if (error || !session) return false
    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
    return await isApprovedSession(admin, user.id, session.access_token, deviceToken, await fingerprint(requestHeaders))
  } catch { return false }
}
