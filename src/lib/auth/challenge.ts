import { createClient as createSupabaseClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { fingerprint, type AuthFingerprint } from './trust'

export const CHALLENGE_COOKIE = 'gzad_auth_challenge'
export const CHALLENGE_SECONDS = 10 * 60

export interface AuthChallenge {
  purpose: 'signup' | 'signin'
  userId: string
  email: string
  deviceToken: string
  ipHash: string
  agentHash: string
  sentAt: number
  expiresAt: number
}

export class AuthFlowError extends Error {
  constructor(public code: string, public status = 400) { super(code) }
}

export const verificationEnabled = () => process.env.AUTH_DEVICE_VERIFICATION === 'on'

export function requireVerificationSetup() {
  if (!verificationEnabled()) throw new AuthFlowError('AUTH_SETUP_REQUIRED', 503)
}

export function checkOrigin(request: NextRequest) {
  const origin = request.headers.get('origin')
  const internal = new URL(request.url)
  // Next can normalize 127.0.0.1 to localhost internally. Compare against the
  // incoming Host and the deployment proxy's protocol, as the browser sees it.
  const host = request.headers.get('host') || internal.host
  const protocol = request.headers.get('x-forwarded-proto')?.split(',')[0].trim() || internal.protocol.slice(0, -1)
  if (!['http', 'https'].includes(protocol)) throw new AuthFlowError('INVALID_ORIGIN', 403)
  const expectedOrigin = new URL(`${protocol}://${host}`).origin
  if ((origin && origin !== expectedOrigin) || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new AuthFlowError('INVALID_ORIGIN', 403)
  }
}

export function authClients() {
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  return {
    admin: createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, options),
    auth: createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, options),
  }
}

function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decode(value: string): Uint8Array {
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
}

async function encryptionKey() {
  const secret = process.env.AUTH_DEVICE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret || secret.length < 32) throw new AuthFlowError('AUTH_SETUP_REQUIRED', 503)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`gzad:auth-challenge:v1:${secret}`))
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function sealChallenge(challenge: AuthChallenge): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(), new TextEncoder().encode(JSON.stringify(challenge)))
  return `${encode(iv)}.${encode(new Uint8Array(encrypted))}`
}

export async function readChallenge(value: string | undefined, context: AuthFingerprint): Promise<AuthChallenge> {
  try {
    const [iv, data, extra] = (value || '').split('.')
    if (!iv || !data || extra || value!.length > 4096) throw new Error('Invalid challenge')
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(iv) as Uint8Array<ArrayBuffer> }, await encryptionKey(), decode(data) as Uint8Array<ArrayBuffer>)
    const c = JSON.parse(new TextDecoder().decode(plaintext)) as AuthChallenge
    if (!['signup', 'signin'].includes(c.purpose) || typeof c.userId !== 'string' || typeof c.email !== 'string' || typeof c.deviceToken !== 'string' || !Number.isFinite(c.expiresAt) || c.expiresAt < Date.now() || c.ipHash !== context.ipHash || c.agentHash !== context.agentHash) throw new Error('Expired or changed context')
    return c
  } catch { throw new AuthFlowError('CHALLENGE_EXPIRED') }
}

export async function challengeForRequest(request: NextRequest) {
  const context = await fingerprint(request.headers)
  return { context, challenge: await readChallenge(request.cookies.get(CHALLENGE_COOKIE)?.value, context) }
}

const secureCookie = () => process.env.NODE_ENV === 'production'

export async function withChallenge(response: NextResponse, challenge: AuthChallenge) {
  response.cookies.set(CHALLENGE_COOKIE, await sealChallenge(challenge), {
    httpOnly: true, secure: secureCookie(), sameSite: 'lax', path: '/', maxAge: Math.max(0, Math.floor((challenge.expiresAt - Date.now()) / 1000)),
  })
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export function clearChallenge(response: NextResponse) {
  response.cookies.set(CHALLENGE_COOKIE, '', { httpOnly: true, secure: secureCookie(), sameSite: 'lax', path: '/', maxAge: 0 })
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export async function deliverCode(auth: SupabaseClient, challenge: AuthChallenge) {
  const { error } = challenge.purpose === 'signup'
    ? await auth.auth.resend({ type: 'signup', email: challenge.email })
    : await auth.auth.signInWithOtp({ email: challenge.email, options: { shouldCreateUser: false } })
  if (error) throw new AuthFlowError(error.status === 429 ? 'TOO_MANY_ATTEMPTS' : 'EMAIL_DELIVERY_FAILED', error.status === 429 ? 429 : 503)
}

export async function destination(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin.from('clients').select('role, is_admin').eq('auth_user_id', userId).single()
  if (error || !data) throw new AuthFlowError('PROFILE_UNAVAILABLE', 503)
  return data.is_admin ? '/admin' : data.role === 'fleet' ? '/fleet' : '/portal/dashboard'
}

/** Publish a Supabase session only after the server has approved its exact session_id. */
export async function withSession(request: NextRequest, response: NextResponse, session: Session) {
  const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: values => values.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
    },
  })
  const { error } = await client.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token })
  if (error) throw new AuthFlowError('SESSION_FAILED', 503)
  return clearChallenge(response)
}

export function flowError(error: unknown) {
  const known = error instanceof AuthFlowError
  return NextResponse.json({ error: known ? error.code : 'AUTH_UNAVAILABLE' }, { status: known ? error.status : 503, headers: { 'Cache-Control': 'no-store' } })
}
