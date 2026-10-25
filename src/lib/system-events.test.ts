import { describe, expect, it } from 'vitest'
import { billingRunEvent, deviceEvent, formatDuration, type BillingRunSummary } from './system-events'

const base: BillingRunSummary = {
  mode: 'hourly',
  totalCharged: 0,
  blocks: 0,
  lateBlocks: 0,
  failedClients: 0,
  durationMs: 820,
  charges: [],
  paused: [],
  completed: [],
  resumed: [],
  devicesSynced: 0,
}

describe('billingRunEvent', () => {
  it('marks a quiet run as info', () => {
    const e = billingRunEvent(base)
    expect(e).toMatchObject({ category: 'billing', kind: 'billing_run', severity: 'info', title: 'Billing: nothing to charge' })
  })

  it('summarises charges and pauses, worst outcome first', () => {
    const e = billingRunEvent({
      ...base,
      totalCharged: 14.4,
      charges: [{ clientId: 'c1', client: 'PSP', charged: 5.76, balance: -5.26 }],
      paused: [
        { campaignId: 'a', campaign: 'sunny', client: 'PSP', reason: 'balance' },
        { campaignId: 'b', campaign: 'sunny1', client: 'PSP', reason: 'balance' },
      ],
    })
    expect(e.severity).toBe('warning')
    expect(e.title).toBe('Billing: ₾14.40 charged, 2 campaigns paused')
    expect(e.detail?.charges).toHaveLength(1)
  })

  it('reports failures as errors', () => {
    expect(billingRunEvent({ ...base, failedClients: 1 }).severity).toBe('error')
    const failed = billingRunEvent({ ...base, error: 'timeout' })
    expect(failed).toMatchObject({ kind: 'billing_run_failed', severity: 'error', title: 'Billing run failed: timeout' })
  })
})

describe('deviceEvent', () => {
  it('says how long a screen was online when it drops', () => {
    const e = deviceEvent('y1c-825-61009', 'disconnected', { connected_seconds: 3420 })
    expect(e).toMatchObject({ category: 'screen', severity: 'warning', device_id: 'y1c-825-61009' })
    expect(e.title).toBe('y1c-825-61009 disconnected after 57 min online')
  })

  it('treats a connection as good news', () => {
    expect(deviceEvent('d1', 'connected').severity).toBe('success')
  })
})

describe('formatDuration', () => {
  it('reads naturally at every scale', () => {
    expect(formatDuration(12)).toBe('12 s')
    expect(formatDuration(45 * 60)).toBe('45 min')
    expect(formatDuration(3 * 3600 + 20 * 60)).toBe('3 h 20 min')
    expect(formatDuration(5 * 86400)).toBe('5 days')
  })
})
