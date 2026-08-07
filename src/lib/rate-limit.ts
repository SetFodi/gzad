import type { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

// Rate limiting for unauthenticated endpoints. Serverless functions don't share
// memory between invocations, so the counter lives in Postgres.

/** Caller's IP as seen through Vercel's proxy. */
export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') || 'unknown'
}

/**
 * Records a hit and reports whether it is within the limit.
 *
 * Fails open: if the rate_limits migration hasn't been applied or the database
 * is unhappy, real users still get through. This protects against floods, it is
 * not an authorization control.
 */
export async function allowRequest(
  supabase: SupabaseClient,
  key: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  })

  if (error) {
    console.warn(`Rate limit check unavailable (${error.message}) — allowing request`)
    return true
  }
  return data !== false
}
