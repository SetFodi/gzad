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
 * Authentication endpoints fail closed if their counter cannot be checked.
 * Missing migrations or database outages must not remove attempt limits.
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
    console.warn('Authentication rate limit check unavailable')
    return false
  }
  return data === true
}
