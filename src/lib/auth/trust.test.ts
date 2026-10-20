import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import {
  approveSession,
  createDeviceToken,
  fingerprint,
  hasTrustedDevice,
  isApprovedSession,
  revokeApprovedSession,
  TRUST_MAX_AGE_SECONDS,
} from './trust'

const USER = '11111111-1111-4111-8111-111111111111'
const OTHER_USER = '22222222-2222-4222-8222-222222222222'
const SESSION = '33333333-3333-4333-8333-333333333333'
const OTHER_SESSION = '44444444-4444-4444-8444-444444444444'

function accessToken(user = USER, session = SESSION) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'fixture' })}.${encode({ sub: user, session_id: session })}.fixture`
}

function database() {
  const tables = new Map<string, Record<string, unknown>[]>()
  const calls: { method: string; url: URL; body: Record<string, unknown> | null }[] = []
  let unavailable = false
  const client = createClient('https://fixture.invalid', 'fixture-service-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async (input, init) => {
        const url = new URL(String(input))
        const method = init?.method || 'GET'
        const body = init?.body ? JSON.parse(String(init.body)) : null
        calls.push({ method, url, body })
        if (unavailable) return new Response(JSON.stringify({ message: 'fixture unavailable', code: 'XX000' }), { status: 403 })
        const table = url.pathname.split('/').at(-1)!
        const rows = tables.get(table) || []
        if (method === 'POST') {
          const existing = rows.findIndex(row => table === 'auth_verified_sessions'
            ? row.session_id === body.session_id
            : ['user_id', 'device_hash', 'ip_hash', 'agent_hash'].every(key => row[key] === body[key]))
          if (existing < 0) rows.push(body)
          else rows[existing] = { ...rows[existing], ...body }
          tables.set(table, rows)
          return new Response(null, { status: 204 })
        }
        const selected = rows.filter(row => [...url.searchParams].every(([key, filter]) => {
          if (key === 'select') return true
          if (filter.startsWith('eq.')) return String(row[key]) === filter.slice(3)
          if (filter.startsWith('gt.')) return String(row[key]) > filter.slice(3)
          throw new Error(`Unhandled filter ${key}`)
        }))
        if (method === 'DELETE') {
          tables.set(table, rows.filter(row => !selected.includes(row)))
          return new Response(null, { status: 204 })
        }
        return new Response(JSON.stringify(selected), { status: 200, headers: { 'Content-Type': 'application/json' } })
      },
    },
  })
  return { client, tables, calls, fail: () => { unavailable = true } }
}

beforeEach(() => { vi.stubEnv('AUTH_DEVICE_SECRET', 'local-fixture-secret-with-sufficient-entropy') })
afterEach(() => { vi.unstubAllEnvs() })

describe('trusted browser and verified Supabase sessions', () => {
  it('keeps fingerprints private, stable, and sensitive to IP or browser changes', async () => {
    const headers = new Headers({ 'x-forwarded-for': '198.51.100.2', 'user-agent': 'fixture-browser' })
    const original = await fingerprint(headers)
    expect(await fingerprint(headers)).toEqual(original)
    expect(original.ipHash).toMatch(/^[a-f0-9]{64}$/)
    expect(original.agentHash).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(original)).not.toContain('fixture-browser')
    const newIp = await fingerprint(new Headers({ 'x-forwarded-for': '198.51.100.3', 'user-agent': 'fixture-browser' }))
    expect(newIp.ipHash).not.toBe(original.ipHash)
    expect(newIp.agentHash).toBe(original.agentHash)
    const newBrowser = await fingerprint(new Headers({ 'x-forwarded-for': '198.51.100.2', 'user-agent': 'other-browser' }))
    expect(newBrowser.agentHash).not.toBe(original.agentHash)
  })

  it('uses the platform supplied client IP before a forwarded chain', async () => {
    const platform = await fingerprint(new Headers({ 'x-vercel-forwarded-for': '198.51.100.2', 'x-forwarded-for': '203.0.113.99' }))
    expect(platform).toEqual(await fingerprint(new Headers({ 'x-forwarded-for': '198.51.100.2' })))
  })

  it('preserves browser trust across automatic browser and operating-system version updates', async () => {
    const before = new Headers({ 'x-forwarded-for': '198.51.100.2', 'user-agent': 'Mozilla/5.0 (Mac OS X 14_0_1) AppleWebKit/537.36 Chrome/140.0.7339.80 Safari/537.36' })
    const after = new Headers({ 'x-forwarded-for': '198.51.100.2', 'user-agent': 'Mozilla/5.0 (Mac OS X 15_1_0) AppleWebKit/537.36 Chrome/141.0.7390.12 Safari/537.36' })
    expect(await fingerprint(after)).toEqual(await fingerprint(before))
  })

  it('rejects missing client IP headers in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    await expect(fingerprint(new Headers({ 'user-agent': 'fixture-browser' }))).rejects.toThrow('Client IP is unavailable')
    await expect(fingerprint(new Headers({ 'x-forwarded-for': '   ' }))).rejects.toThrow('Client IP is unavailable')
  })

  it('requires a server secret instead of an unkeyed hash of private IP addresses', async () => {
    vi.stubEnv('AUTH_DEVICE_SECRET', '')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    await expect(fingerprint(new Headers())).rejects.toThrow('Auth device secret is not configured')
  })

  it('requires both an approved native session and the original browser/IP', async () => {
    const db = database()
    const token = createDeviceToken()
    const fp = await fingerprint(new Headers({ 'x-forwarded-for': '198.51.100.2', 'user-agent': 'fixture-browser' }))
    expect(await hasTrustedDevice(db.client, USER, token, fp)).toBe(false)
    expect(await isApprovedSession(db.client, USER, accessToken(), token, fp)).toBe(false)
    await approveSession(db.client, USER, accessToken(), token, fp)
    expect(await hasTrustedDevice(db.client, USER, token, fp)).toBe(true)
    expect(await isApprovedSession(db.client, USER, accessToken(), token, fp)).toBe(true)
    expect(await isApprovedSession(db.client, USER, accessToken(USER, OTHER_SESSION), token, fp)).toBe(false)
    expect(await isApprovedSession(db.client, USER, accessToken(), createDeviceToken(), fp)).toBe(false)
    const changedIp = await fingerprint(new Headers({ 'x-forwarded-for': '198.51.100.3', 'user-agent': 'fixture-browser' }))
    expect(await hasTrustedDevice(db.client, USER, token, changedIp)).toBe(false)
    expect(await isApprovedSession(db.client, USER, accessToken(), token, changedIp)).toBe(false)
    expect(await isApprovedSession(db.client, OTHER_USER, accessToken(), token, fp)).toBe(false)
    expect(JSON.stringify([...db.tables])).not.toContain(token)
    expect(JSON.stringify([...db.tables])).not.toContain('198.51.100.2')
    expect(JSON.stringify([...db.tables])).not.toContain('fixture-browser')
    expect(TRUST_MAX_AGE_SECONDS).toBeGreaterThan(24 * 60 * 60)
  })

  it('allows a session without remembering the browser, and rejects expired approvals', async () => {
    const db = database()
    const token = createDeviceToken()
    const fp = await fingerprint(new Headers())
    await approveSession(db.client, USER, accessToken(), token, fp, false)
    expect(await isApprovedSession(db.client, USER, accessToken(), token, fp)).toBe(true)
    expect(await hasTrustedDevice(db.client, USER, token, fp)).toBe(false)
    db.tables.get('auth_verified_sessions')![0].expires_at = '2000-01-01T00:00:00.000Z'
    expect(await isApprovedSession(db.client, USER, accessToken(), token, fp)).toBe(false)
  })

  it('revokes the current session at logout while remembering the verified browser', async () => {
    const db = database()
    const token = createDeviceToken()
    const fp = await fingerprint(new Headers())
    await approveSession(db.client, USER, accessToken(), token, fp)
    await revokeApprovedSession(db.client, USER, accessToken())
    expect(await isApprovedSession(db.client, USER, accessToken(), token, fp)).toBe(false)
    expect(await hasTrustedDevice(db.client, USER, token, fp)).toBe(true)
  })

  it('fails closed on unavailable storage and never approves a different user or malformed token', async () => {
    const db = database()
    const token = createDeviceToken()
    const fp = await fingerprint(new Headers())
    await expect(approveSession(db.client, USER, accessToken(OTHER_USER), token, fp)).rejects.toThrow()
    await expect(approveSession(db.client, USER, 'invalid', token, fp)).rejects.toThrow()
    expect(db.calls).toHaveLength(0)
    db.fail()
    expect(await hasTrustedDevice(db.client, USER, token, fp)).toBe(false)
    expect(await isApprovedSession(db.client, USER, accessToken(), token, fp)).toBe(false)
    await expect(approveSession(db.client, USER, accessToken(), token, fp)).rejects.toThrow('Could not approve auth session')
  })
})
