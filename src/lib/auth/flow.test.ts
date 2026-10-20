import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as signIn } from '@/app/api/auth/signin/route'
import { POST as verify } from '@/app/api/auth/verify/route'
import { POST as resend } from '@/app/api/auth/resend/route'
import { POST as signOut } from '@/app/api/auth/signout/route'
import { createDeviceToken, fingerprint } from './trust'
import { sealChallenge, CHALLENGE_SECONDS, type AuthChallenge } from './challenge'

// Exercise the route and the shipped Supabase/SSR clients. Only the remote
// transport is substituted; no production account or email is created.
const USER_ID = '11111111-1111-4111-8111-111111111111'
const SESSION_ID = '22222222-2222-4222-8222-222222222222'
const EMAIL = 'local-auth-test@example.invalid'
const SECRET = 'local-auth-test-secret-with-more-than-32-characters'
const DEVICE = createDeviceToken()
const headers = { 'Content-Type': 'application/json', origin: 'http://localhost', 'user-agent': 'Local browser/1.0', 'x-forwarded-for': '192.0.2.10' }

function jwt() {
  const encode = (data: unknown) => Buffer.from(JSON.stringify(data)).toString('base64url')
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: USER_ID, session_id: SESSION_ID, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.${Buffer.from('local-test-signature-only').toString('base64url')}`
}

function session() {
  return { access_token: jwt(), refresh_token: 'local-refresh-token', token_type: 'bearer', expires_in: 3600, user: { id: USER_ID, email: EMAIL, aud: 'authenticated', role: 'authenticated', email_confirmed_at: '2026-10-01T00:00:00Z', app_metadata: {}, user_metadata: {}, created_at: '2026-10-01T00:00:00Z' } }
}

function transport({ trusted = false, wrongCode = false, databaseFailure = false, rateFailure = false, role = 'client', admin = false, passwordError = '' } = {}) {
  const calls: { path: string; method: string; body: Record<string, unknown> }[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    if (url.hostname !== 'auth-test.invalid') throw new Error(`Unexpected host ${url.hostname}`)
    const method = init?.method || 'GET'
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
    calls.push({ path: url.pathname, method, body })
    const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
    if (url.pathname === '/auth/v1/token') return passwordError ? response({ code: passwordError, msg: 'Sign-in denied' }, 400) : response(session())
    if (url.pathname === '/auth/v1/user') return response(session().user)
    if (url.pathname === '/auth/v1/logout') return new Response(null, { status: 204 })
    if (url.pathname === '/auth/v1/otp' || url.pathname === '/auth/v1/resend') return response({})
    if (url.pathname === '/auth/v1/verify') return wrongCode ? response({ code: 'otp_expired', msg: 'Token has expired or is invalid' }, 403) : response(session())
    if (url.pathname === '/rest/v1/rpc/check_rate_limit') return rateFailure ? response({ code: 'XX000', message: 'Unavailable' }, 403) : response(true)
    if (url.pathname === '/rest/v1/auth_trusted_devices' && method === 'GET') return response(trusted ? { user_id: USER_ID } : null)
    if (url.pathname === '/rest/v1/clients') return response({ role, is_admin: admin })
    if (url.pathname === '/rest/v1/auth_verified_sessions' || url.pathname === '/rest/v1/auth_trusted_devices') return databaseFailure ? response({ message: 'Unavailable', code: 'XX000' }, 500) : new Response(null, { status: 201 })
    throw new Error(`Unexpected ${method} ${url.pathname}`)
  }))
  return calls
}

function request(path: string, body: unknown, cookie?: string, ip = '192.0.2.10') {
  return new NextRequest(`http://localhost/api/auth/${path}`, { method: 'POST', headers: { ...headers, 'x-forwarded-for': ip, ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) })
}

async function challengeCookie(purpose: 'signup' | 'signin' = 'signin', overrides: Partial<AuthChallenge> = {}) {
  const fp = await fingerprint(new Headers(headers))
  const value = await sealChallenge({ purpose, userId: USER_ID, email: EMAIL, deviceToken: DEVICE, ...fp, sentAt: Date.now(), expiresAt: Date.now() + CHALLENGE_SECONDS * 1000, ...overrides })
  return `gzad_auth_challenge=${value}`
}

beforeEach(() => {
  vi.stubEnv('AUTH_DEVICE_VERIFICATION', 'on')
  vi.stubEnv('AUTH_DEVICE_SECRET', SECRET)
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://auth-test.invalid')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'local-anon-test-key')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'local-service-role-test-key')
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe('password sign-in while email verification is awaiting setup', () => {
  it('keeps confirmed accounts able to sign in without sending email or using trust tables', async () => {
    vi.stubEnv('AUTH_DEVICE_VERIFICATION', 'off')
    vi.stubEnv('NODE_ENV', 'production')
    const calls = transport({ admin: true })
    const req = request('signin', { email: EMAIL, password: 'local-password' })
    req.headers.delete('x-forwarded-for')
    const response = await signIn(req)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, next: '/admin' })
    expect(response.headers.get('set-cookie')).toContain('sb-auth-test-auth-token=')
    expect(calls.some(c => c.path === '/rest/v1/rpc/check_rate_limit')).toBe(true)
    expect(calls.some(c => c.path === '/auth/v1/otp' || c.path === '/auth/v1/resend')).toBe(false)
    expect(calls.some(c => c.path.startsWith('/rest/v1/auth_'))).toBe(false)
  })

  it.each(['invalid_credentials', 'email_not_confirmed'])('denies %s without publishing a session or sending email', async passwordError => {
    vi.stubEnv('AUTH_DEVICE_VERIFICATION', 'off')
    const calls = transport({ passwordError })
    const response = await signIn(request('signin', { email: EMAIL, password: 'invalid-or-unconfirmed' }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'INVALID_CREDENTIALS' })
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(calls.some(c => c.path === '/auth/v1/otp' || c.path === '/auth/v1/resend')).toBe(false)
    expect(calls.some(c => c.path.startsWith('/rest/v1/auth_'))).toBe(false)
  })

  it('denies password sign-in when rate-limit storage is unavailable', async () => {
    vi.stubEnv('AUTH_DEVICE_VERIFICATION', 'off')
    const calls = transport({ rateFailure: true })
    const response = await signIn(request('signin', { email: EMAIL, password: 'local-password' }))
    expect(response.status).toBe(429)
    expect(calls.some(c => c.path === '/auth/v1/token')).toBe(false)
    expect(response.headers.get('set-cookie')).toBeNull()
  })
})

describe('password sign-in with remembered browser and IP', () => {
  it('sends a code for a first sign-in and publishes no native session cookie', async () => {
    const calls = transport()
    const response = await signIn(request('signin', { email: EMAIL, password: 'local-password' }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ verificationRequired: true, next: '/portal/verify' })
    expect(response.headers.get('set-cookie')).toContain('gzad_auth_challenge=')
    expect(response.headers.get('set-cookie')).not.toContain('sb-')
    expect(calls.find(c => c.path === '/auth/v1/otp')?.body).toMatchObject({ email: EMAIL, create_user: false })
    expect(calls.filter(c => c.path === '/rest/v1/auth_verified_sessions')).toHaveLength(0)
  })

  it('signs in from a trusted browser/IP without sending another code', async () => {
    const calls = transport({ trusted: true })
    const response = await signIn(request('signin', { email: EMAIL, password: 'local-password' }, `gzad_device=${DEVICE}`))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, next: '/portal/dashboard' })
    expect(response.headers.get('set-cookie')).toContain('sb-auth-test-auth-token=')
    expect(calls.some(c => c.path === '/auth/v1/otp')).toBe(false)
    expect(calls.find(c => c.path === '/rest/v1/auth_verified_sessions')?.body).toMatchObject({ session_id: SESSION_ID, user_id: USER_ID })
  })

  it('verifies the code before approving a session and remembering its browser', async () => {
    const calls = transport({ role: 'fleet' })
    const response = await verify(request('verify', { code: '123456' }, await challengeCookie()))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, next: '/fleet' })
    expect(response.headers.get('set-cookie')).toContain(`gzad_device=${DEVICE}`)
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
    expect(response.headers.get('set-cookie')).toContain('sb-auth-test-auth-token=')
    expect(calls.findIndex(c => c.path === '/auth/v1/verify')).toBeLessThan(calls.findIndex(c => c.path === '/rest/v1/auth_verified_sessions'))
  })

  it('does not approve a wrong code', async () => {
    const calls = transport({ wrongCode: true })
    const response = await verify(request('verify', { code: '000000' }, await challengeCookie()))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'INVALID_CODE' })
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(calls.some(c => c.path === '/rest/v1/auth_verified_sessions')).toBe(false)
  })

  it('rejects an IP change during verification before contacting Supabase', async () => {
    const calls = transport()
    const response = await verify(request('verify', { code: '123456' }, await challengeCookie(), '198.51.100.9'))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'CHALLENGE_EXPIRED' })
    expect(calls).toHaveLength(0)
  })

  it('confirms signup without approving a sign-in or trusting the browser', async () => {
    const calls = transport()
    const response = await verify(request('verify', { code: '123456' }, await challengeCookie('signup')))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, next: '/portal/login?verified=1' })
    expect(response.headers.get('set-cookie')).not.toContain('sb-')
    expect(response.headers.get('set-cookie')).not.toContain('gzad_device=')
    expect(calls.some(c => c.path === '/rest/v1/auth_verified_sessions')).toBe(false)
  })

  it('publishes no session when server approval fails', async () => {
    transport({ databaseFailure: true })
    const response = await verify(request('verify', { code: '123456' }, await challengeCookie()))
    expect(response.status).toBe(503)
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('does not send repeated codes inside the resend cooldown', async () => {
    const calls = transport()
    const response = await resend(request('resend', {}, await challengeCookie()))
    expect(response.status).toBe(429)
    expect(await response.json()).toEqual({ error: 'WAIT_TO_RESEND' })
    expect(calls).toHaveLength(0)
  })

  it('rejects a cross-origin login before checking the password', async () => {
    const calls = transport()
    const req = request('signin', { email: EMAIL, password: 'local-password' })
    req.headers.set('origin', 'https://unrelated.invalid')
    const response = await signIn(req)
    expect(response.status).toBe(403)
    expect(calls).toHaveLength(0)
  })

  it('revokes session approval at logout and keeps the remembered browser cookie', async () => {
    const calls = transport({ trusted: true })
    const signedIn = await signIn(request('signin', { email: EMAIL, password: 'local-password' }, `gzad_device=${DEVICE}`))
    const cookie = signedIn.cookies.getAll().filter(c => c.value).map(c => `${c.name}=${c.value}`).join('; ') + `; gzad_device=${DEVICE}`
    const response = await signOut(request('signout', {}, cookie))
    expect(response.status).toBe(200)
    expect(calls.some(c => c.path === '/rest/v1/auth_verified_sessions' && c.method === 'DELETE')).toBe(true)
    expect(response.headers.get('set-cookie')).not.toContain('gzad_device=')
  })

  it('does not check passwords when the attempt limit cannot be enforced', async () => {
    const calls = transport({ rateFailure: true })
    const response = await signIn(request('signin', { email: EMAIL, password: 'local-password' }))
    expect(response.status).toBe(429)
    expect(calls.some(c => c.path === '/auth/v1/token')).toBe(false)
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('rejects expired verification without sending or checking a code', async () => {
    const calls = transport()
    const response = await verify(request('verify', { code: '123456' }, await challengeCookie('signin', { expiresAt: Date.now() - 1 })))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'CHALLENGE_EXPIRED' })
    expect(calls).toHaveLength(0)
  })

  it('accepts the browser origin when Next normalizes the internal local hostname', async () => {
    transport()
    const req = request('signin', { email: EMAIL, password: 'local-password' })
    req.headers.set('host', '127.0.0.1')
    req.headers.set('origin', 'http://127.0.0.1')
    const response = await signIn(req)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ verificationRequired: true })
  })
})
