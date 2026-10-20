import { createClient } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { deliverBillingNotifications } from './billing-notifications'
import * as mailProvider from './billing-mail'

const ALERT_ID = 'a0000000-0000-0000-0000-000000000001'
const now = new Date('2026-10-20T10:00:00Z')
const alert = {
  id: ALERT_ID,
  kind: 'low_20pct',
  balance: '19.50',
  detail: { pct: 20 },
  clients: { email: 'client@example.com' },
}

function configured() {
  vi.stubEnv('BILLING_EMAIL_PROVIDER', 'resend')
  vi.stubEnv('BILLING_EMAIL_ENABLED', 'on')
  vi.stubEnv('RESEND_API_KEY', 're_test_never_sent')
  vi.stubEnv('BILLING_EMAIL_FROM', 'Gzad <billing@example.com>')
  vi.stubEnv('APP_URL', 'https://gzad.example')
}

function database(options: { claim?: boolean; readError?: boolean; finishError?: boolean; alerts?: typeof alert[] } = {}) {
  const requests: { url: URL; body: Record<string, unknown> | null }[] = []
  const dbFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : null
    requests.push({ url, body })
    let data: unknown
    if (url.pathname.endsWith('/billing_alerts')) {
      if (options.readError) return Response.json({ message: 'database unavailable' }, { status: 503 })
      data = options.alerts ?? [alert]
    } else if (url.pathname.endsWith('/claim_billing_alert_email') || url.pathname.endsWith('/claim_billing_alert_smtp')) {
      data = options.claim === false ? null : { token: 'claim-token', payload: body?.p_payload }
    } else if (url.pathname.endsWith('/finish_billing_alert_email') || url.pathname.endsWith('/finish_billing_alert_smtp')) {
      if (options.finishError) return Response.json({ message: 'write unavailable' }, { status: 503 })
      data = null
    } else throw new Error(`Unexpected database request ${url.pathname}`)
    return Response.json(data)
  })
  const supabase = createClient('https://database.example', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: dbFetch },
  })
  return { supabase, requests, dbFetch }
}

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('billing notification delivery', () => {
  it('stays disabled even if a Resend key is present until explicitly enabled', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_never_sent')
    vi.stubEnv('BILLING_EMAIL_ENABLED', '')
    const { supabase, dbFetch } = database()
    const send = vi.fn()
    vi.stubGlobal('fetch', send)
    expect(await deliverBillingNotifications(supabase, now)).toMatchObject({ enabled: false, sent: 0, failed: 0 })
    expect(dbFetch).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })

  it('sends the claimed Georgian email through Resend and records acceptance', async () => {
    configured()
    const { supabase, requests } = database()
    const send = vi.fn(async () => Response.json({ id: 'resend-email-id' }))
    vi.stubGlobal('fetch', send)
    expect(await deliverBillingNotifications(supabase, now)).toEqual({ enabled: true, sent: 1, failed: 0, skipped: 0 })
    const [endpoint, options] = send.mock.calls[0] as unknown as [string, RequestInit]
    expect(endpoint).toBe('https://api.resend.com/emails')
    expect(options.headers).toMatchObject({ Authorization: 'Bearer re_test_never_sent', 'Idempotency-Key': `billing-alert/${ALERT_ID}` })
    const payload = JSON.parse(String(options.body))
    expect(payload.to).toEqual(['client@example.com'])
    expect(payload.text).toContain('₾19.50')
    expect(payload.text).toContain('20%')
    expect(payload.text).toContain('https://gzad.example/portal/dashboard/billing')
    expect(requests[0].url.searchParams.get('sent_at')).toBe('is.null')
    expect(requests[0].url.searchParams.get('dismissed_at')).toBe('is.null')
    expect(requests[0].url.searchParams.get('created_at')).toBe('gte.2026-10-19T10:00:00.000Z')
    expect(requests.at(-1)?.body).toMatchObject({ p_alert_id: ALERT_ID, p_claim_token: 'claim-token', p_provider_id: 'resend-email-id', p_error: null })
  })

  it('does not send an alert already claimed or resolved by another run', async () => {
    configured()
    const { supabase } = database({ claim: false })
    const send = vi.fn()
    vi.stubGlobal('fetch', send)
    expect(await deliverBillingNotifications(supabase, now)).toMatchObject({ sent: 0, skipped: 1, failed: 0 })
    expect(send).not.toHaveBeenCalled()
  })

  it('keeps a rejected delivery pending without failing billing', async () => {
    configured()
    const { supabase, requests } = database()
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ message: 'rate limited' }, { status: 429 })))
    expect(await deliverBillingNotifications(supabase, now)).toMatchObject({ sent: 0, failed: 1 })
    expect(requests.at(-1)?.body).toMatchObject({ p_provider_id: null, p_error: 'Resend HTTP 429' })
  })

  it('records a timeout for retry and does not turn it into a billing error', async () => {
    configured()
    const { supabase, requests } = database()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Request timed out') }))
    await expect(deliverBillingNotifications(supabase, now)).resolves.toMatchObject({ sent: 0, failed: 1 })
    expect(requests.at(-1)?.body).toMatchObject({ p_provider_id: null, p_error: 'Request timed out' })
  })

  it('does not send if the durable outbox cannot be read', async () => {
    configured()
    const { supabase } = database({ readError: true })
    const send = vi.fn()
    vi.stubGlobal('fetch', send)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(deliverBillingNotifications(supabase, now)).resolves.toMatchObject({ sent: 0, failed: 1 })
    expect(send).not.toHaveBeenCalled()
  })

  it('reports an acknowledgement failure without undoing a completed charge', async () => {
    configured()
    const { supabase } = database({ finishError: true })
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ id: 'accepted-email' })))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(deliverBillingNotifications(supabase, now)).resolves.toMatchObject({ sent: 0, failed: 1 })
  })

  it('gives the daily email-only run capacity for 50 pending alerts', async () => {
    configured()
    vi.useFakeTimers()
    const { supabase, requests } = database({ alerts: Array.from({ length: 50 }, (_, index) => ({
      ...alert, id: `a0000000-0000-0000-0000-${String(index).padStart(12, '0')}`,
    })) })
    const send = vi.fn(async () => Response.json({ id: 'accepted-email' }))
    vi.stubGlobal('fetch', send)
    const pending = deliverBillingNotifications(supabase, now, { maxAlerts: 50, budgetMs: 45000 })
    await vi.runAllTimersAsync()
    expect(await pending).toMatchObject({ sent: 50, failed: 0 })
    expect(requests[0].url.searchParams.get('limit')).toBe('50')
    expect(send).toHaveBeenCalledTimes(50)
  })

  it('stops before starting another delivery when its wall-clock budget is used', async () => {
    configured()
    let clock = 0
    vi.spyOn(Date, 'now').mockImplementation(() => clock)
    const { supabase, requests } = database({ alerts: [alert, { ...alert, id: 'second' }, { ...alert, id: 'third' }] })
    const send = vi.fn(async () => { clock += 20000; return Response.json({ id: 'accepted' }) })
    vi.stubGlobal('fetch', send)
    const result = await deliverBillingNotifications(supabase, now, { maxAlerts: 50, budgetMs: 45000 })
    expect(result.sent).toBe(2)
    expect(send).toHaveBeenCalledTimes(2)
    expect(requests.filter(({ url }) => url.pathname.endsWith('/claim_billing_alert_email'))).toHaveLength(2)
  })

  it.each([true, false])('uses the durable SMTP claim and records retry safety as %s', async retrySafe => {
    configured()
    const { supabase, requests } = database()
    const send = vi.fn(async () => ({ providerId: null, error: 'SMTP failure', retrySafe }))
    vi.spyOn(mailProvider, 'billingMailProvider').mockReturnValue({ kind: 'smtp', send })
    const result = await deliverBillingNotifications(supabase, now)
    expect(result).toMatchObject({ sent: 0, failed: 1 })
    expect(requests[1].url.pathname).toBe('/rest/v1/rpc/claim_billing_alert_smtp')
    expect(requests.at(-1)?.url.pathname).toBe('/rest/v1/rpc/finish_billing_alert_smtp')
    expect(requests.at(-1)?.body).toMatchObject({ p_provider_id: null, p_retry_safe: retrySafe })
  })

  it('does not send SMTP when its durable claim cannot be confirmed', async () => {
    configured()
    const { supabase } = database({ claim: false })
    const send = vi.fn()
    vi.spyOn(mailProvider, 'billingMailProvider').mockReturnValue({ kind: 'smtp', send })
    expect(await deliverBillingNotifications(supabase, now)).toMatchObject({ sent: 0, skipped: 1 })
    expect(send).not.toHaveBeenCalled()
  })
})
