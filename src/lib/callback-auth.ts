import { timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

// Authentication for device-originated callbacks (play logs, GPS).
//
// Two callers exist and they are trusted differently:
//
//   Bearer header  — the Realtime Server forwarding on a device's behalf. It
//                    runs on our own VPS and holds the shared CALLBACK_SECRET.
//   ?key= param    — a controller posting directly, using the URL we wrote into
//                    its firmware. Controllers sit in taxis and can be opened
//                    up, so each one gets its own key from devices.api_key and
//                    can only speak for itself.
//
// Until every controller has been re-provisioned, the shared secret is still
// accepted in the query string. Set STRICT_DEVICE_KEYS=true to close that door
// once `Provisioned with shared secret` no longer appears in the logs.

export interface CallbackAuthResult {
  ok: boolean
  /** Device the caller is allowed to speak for; null means "any" (trusted server). */
  deviceId: string | null
  status: number
  reason?: string
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/** Device id from the header or query string, before any body is read. */
export function deviceIdFromRequest(request: NextRequest): string | null {
  return request.headers.get('card-id') || request.nextUrl.searchParams.get('device') || null
}

export async function authenticateCallback(
  supabase: SupabaseClient,
  request: NextRequest,
): Promise<CallbackAuthResult> {
  const secret = process.env.CALLBACK_SECRET
  if (!secret) {
    console.error('CALLBACK_SECRET not configured')
    return { ok: false, deviceId: null, status: 500, reason: 'Server misconfigured' }
  }

  const deviceId = deviceIdFromRequest(request)

  const authHeader = request.headers.get('authorization')
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (bearer && safeEqual(bearer, secret)) {
    return { ok: true, deviceId, status: 200 }
  }

  const key = request.nextUrl.searchParams.get('key')
  if (!key) {
    return { ok: false, deviceId, status: 401, reason: 'Unauthorized' }
  }

  if (!deviceId) {
    return { ok: false, deviceId, status: 401, reason: 'Device not identified' }
  }

  const { data: device, error } = await supabase
    .from('devices')
    .select('api_key')
    .eq('id', deviceId)
    .maybeSingle()

  // Column missing means the migration hasn't run; fall through to the shared
  // secret rather than dropping the fleet's telemetry.
  const apiKeyAvailable = error?.code !== '42703'

  if (apiKeyAvailable && device?.api_key && safeEqual(key, device.api_key)) {
    return { ok: true, deviceId, status: 200 }
  }

  if (safeEqual(key, secret)) {
    if (process.env.STRICT_DEVICE_KEYS === 'true') {
      return { ok: false, deviceId, status: 401, reason: 'Shared secret rejected — device must use its own key' }
    }
    console.warn(`Provisioned with shared secret: ${deviceId} — re-run setup-callbacks to issue a device key`)
    return { ok: true, deviceId, status: 200 }
  }

  return { ok: false, deviceId, status: 401, reason: 'Unauthorized' }
}
