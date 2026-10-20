import type { SupabaseClient } from '@supabase/supabase-js'

// These helpers run on the server, including Next's Edge middleware. Raw IPs,
// user-agent strings, and browser tokens never go into the trust tables.
export const AUTH_DEVICE_COOKIE = 'gzad_device'
export const TRUST_MAX_AGE_SECONDS = 180 * 24 * 60 * 60

export interface AuthFingerprint {
  ipHash: string
  agentHash: string
}

const HEX_HASH = /^[a-f0-9]{64}$/
const DEVICE_TOKEN = /^[A-Za-z0-9_-]{43,128}$/
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const encoder = new TextEncoder()

function hex(bytes: ArrayBuffer | Uint8Array): string {
  return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('')
}

async function deviceHash(token: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', encoder.encode(token)))
}

function validFingerprint(value: AuthFingerprint): boolean {
  return HEX_HASH.test(value.ipHash) && HEX_HASH.test(value.agentHash)
}

// The caller must first validate this access token with Supabase (or obtain it
// directly from a successful server-side password/OTP exchange). Decoding is
// only for reading the native session identity; it does not verify signatures.
function sessionId(userId: string, accessToken: string): string | null {
  if (!UUID.test(userId)) return null
  try {
    const parts = accessToken.split('.')
    if (parts.length !== 3) return null
    const encoded = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')))
    if (payload.sub !== userId || typeof payload.session_id !== 'string' || !UUID.test(payload.session_id)) return null
    return payload.session_id
  } catch {
    return null
  }
}

export function createDeviceToken(): string {
  return hex(crypto.getRandomValues(new Uint8Array(32)))
}

export async function fingerprint(headers: Headers): Promise<AuthFingerprint> {
  const secret = process.env.AUTH_DEVICE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('Auth device secret is not configured')
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  // Vercel owns x-vercel-forwarded-for. The remaining headers support local
  // development and other deployments behind a trusted reverse proxy.
  const forwarded = headers.get('x-vercel-forwarded-for') || headers.get('x-forwarded-for') || headers.get('x-real-ip')
  const ip = (forwarded || 'unknown').split(',')[0].trim().toLowerCase()
  if (process.env.NODE_ENV === 'production' && (!forwarded || !ip)) throw new Error('Client IP is unavailable')
  // Browser and operating-system updates change version numbers without
  // changing the remembered browser. Its random HttpOnly token is the actual
  // device credential; the normalized agent is an additional context check.
  const agent = (headers.get('user-agent') || 'unknown').slice(0, 1024).replace(/\d+(?:[._]\d+)*/g, '*')
  const digest = async (name: string, value: string) => hex(await crypto.subtle.sign('HMAC', key, encoder.encode(`${name}:${value}`)))
  return { ipHash: await digest('ip', ip), agentHash: await digest('agent', agent) }
}

export async function hasTrustedDevice(
  admin: SupabaseClient,
  userId: string,
  token: string,
  fp: AuthFingerprint,
): Promise<boolean> {
  if (!UUID.test(userId) || !DEVICE_TOKEN.test(token) || !validFingerprint(fp)) return false
  try {
    const { data, error } = await admin.from('auth_trusted_devices')
      .select('user_id')
      .eq('user_id', userId)
      .eq('device_hash', await deviceHash(token))
      .eq('ip_hash', fp.ipHash)
      .eq('agent_hash', fp.agentHash)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()
    return !error && !!data
  } catch {
    return false
  }
}

export async function approveSession(
  admin: SupabaseClient,
  userId: string,
  accessToken: string,
  token: string,
  fp: AuthFingerprint,
  remember = true,
): Promise<void> {
  const id = sessionId(userId, accessToken)
  if (!id || !DEVICE_TOKEN.test(token) || !validFingerprint(fp)) throw new Error('Invalid auth session approval')
  const identity = { user_id: userId, device_hash: await deviceHash(token), ip_hash: fp.ipHash, agent_hash: fp.agentHash }
  const now = new Date()
  const approval = {
    ...identity,
    verified_at: now.toISOString(),
    expires_at: new Date(now.getTime() + TRUST_MAX_AGE_SECONDS * 1000).toISOString(),
  }
  // A failure never reaches the caller's session-cookie publication step.
  // Remembering a browser follows successful verification of the exact session.
  const { error: sessionError } = await admin.from('auth_verified_sessions')
    .upsert({ ...approval, session_id: id }, { onConflict: 'session_id' })
  if (sessionError) throw new Error('Could not approve auth session')
  if (remember) {
    const { error: deviceError } = await admin.from('auth_trusted_devices')
      .upsert(approval, { onConflict: 'user_id,device_hash,ip_hash,agent_hash' })
    if (deviceError) throw new Error('Could not remember auth device')
  }
}

export async function isApprovedSession(
  admin: SupabaseClient,
  userId: string,
  accessToken: string,
  token: string,
  fp: AuthFingerprint,
): Promise<boolean> {
  const id = sessionId(userId, accessToken)
  if (!id || !DEVICE_TOKEN.test(token) || !validFingerprint(fp)) return false
  try {
    const { data, error } = await admin.from('auth_verified_sessions')
      .select('session_id')
      .eq('session_id', id)
      .eq('user_id', userId)
      .eq('device_hash', await deviceHash(token))
      .eq('ip_hash', fp.ipHash)
      .eq('agent_hash', fp.agentHash)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()
    return !error && !!data
  } catch {
    return false
  }
}

export async function revokeApprovedSession(admin: SupabaseClient, userId: string, accessToken: string): Promise<void> {
  const id = sessionId(userId, accessToken)
  if (!id) return
  const { error } = await admin.from('auth_verified_sessions').delete().eq('session_id', id).eq('user_id', userId)
  if (error) throw new Error('Could not revoke auth session')
}
