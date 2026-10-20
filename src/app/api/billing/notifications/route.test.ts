import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from './route'

const { requests } = vi.hoisted(() => ({ requests: [] as { path: string; method: string; body: Record<string, unknown> | null }[] }))

vi.mock('@supabase/supabase-js', async (importOriginal) => {
  const original = await importOriginal<typeof import('@supabase/supabase-js')>()
  return {
    ...original,
    createClient: vi.fn((url, key, options) => original.createClient(url, key, {
      ...options,
      global: { fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(String(input)).pathname
        const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : null
        requests.push({ path, method: init?.method ?? 'GET', body })
        if (path === '/rest/v1/billing_alerts') return Response.json([{
          id: 'a0000000-0000-0000-0000-000000000001', kind: 'low_20pct', balance: 20,
          detail: { pct: 20 }, clients: { email: 'client@example.invalid' },
        }])
        if (path === '/rest/v1/rpc/claim_billing_alert_email') {
          return Response.json({ token: 'claim-token', payload: body?.p_payload })
        }
        if (path === '/rest/v1/rpc/finish_billing_alert_email') return Response.json(null)
        throw new Error(`Unexpected database operation ${path}`)
      } },
    })),
  }
})

beforeEach(() => {
  requests.length = 0
  vi.clearAllMocks()
  vi.stubEnv('CALLBACK_SECRET', 'bridge-secret')
  vi.stubEnv('CRON_SECRET', 'scheduler-secret')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://database.example')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key')
  vi.stubEnv('BILLING_EMAIL_ENABLED', 'on')
  vi.stubEnv('RESEND_API_KEY', 're_test_never_sent')
  vi.stubEnv('BILLING_EMAIL_FROM', 'Gzad <billing@example.invalid>')
  vi.stubEnv('APP_URL', 'https://gzad.example')
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('email-only billing notification endpoint', () => {
  it.each([undefined, 'Bearer wrong-secret', 'bridge-secret'])('rejects unauthorized requests before accessing data: %s', async (authorization) => {
    const response = await GET(new NextRequest('https://gzad.example/api/billing/notifications', {
      headers: authorization ? { authorization } : {},
    }))
    expect(response.status).toBe(401)
    expect(createClient).not.toHaveBeenCalled()
    expect(requests).toEqual([])
  })

  it.each([
    [GET, 'scheduler-secret'],
    [POST, 'bridge-secret'],
  ] as const)('delivers existing alerts with %s and never invokes billing writes', async (handler, secret) => {
    const send = vi.fn(async () => Response.json({ id: 'accepted-email' }))
    vi.stubGlobal('fetch', send)
    const response = await handler(new NextRequest('https://gzad.example/api/billing/notifications', {
      method: handler === POST ? 'POST' : 'GET', headers: { authorization: `Bearer ${secret}` },
    }))
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ enabled: true, sent: 1, failed: 0, skipped: 0 })
    expect(send).toHaveBeenCalledOnce()
    expect(requests.map(({ path, method }) => ({ path, method }))).toEqual([
      { path: '/rest/v1/billing_alerts', method: 'GET' },
      { path: '/rest/v1/rpc/claim_billing_alert_email', method: 'POST' },
      { path: '/rest/v1/rpc/finish_billing_alert_email', method: 'POST' },
    ])
  })

  it('reports disabled delivery without reading the outbox or sending mail', async () => {
    vi.stubEnv('BILLING_EMAIL_ENABLED', 'off')
    const send = vi.fn()
    vi.stubGlobal('fetch', send)
    const response = await POST(new NextRequest('https://gzad.example/api/billing/notifications', {
      method: 'POST', headers: { authorization: 'Bearer bridge-secret' },
    }))
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ enabled: false, sent: 0 })
    expect(requests).toEqual([])
    expect(send).not.toHaveBeenCalled()
  })

  it('reports provider rejection so a scheduler can retry the outbox', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 429 })))
    const response = await POST(new NextRequest('https://gzad.example/api/billing/notifications', {
      method: 'POST', headers: { authorization: 'Bearer bridge-secret' },
    }))
    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({ enabled: true, sent: 0, failed: 1 })
    expect(requests.at(-1)?.body).toMatchObject({ p_provider_id: null, p_error: 'Resend HTTP 429' })
  })
})
