import { describe, expect, it } from 'vitest'
import { buildActivity, type EventRow, type StatusRow } from './activity'
import { translate } from './admin-i18n'
import { billingRunEvent, deviceEvent, type SystemEvent } from './system-events'

const event = (over: Partial<EventRow>): EventRow => ({
  id: 1,
  occurred_at: '2026-10-22T18:10:30Z',
  category: 'billing',
  kind: 'billing_run',
  severity: 'warning',
  title: 'Billing: ₾14.40 charged, 2 campaigns paused',
  device_id: null,
  client_id: null,
  campaign_id: null,
  detail: {},
  ...over,
})

const status = (id: number, status: string, at: string, campaign = 'sunny'): StatusRow => ({
  id, campaign_id: 'c1', status, changed_at: at, campaign, client: 'PSP',
})

describe('buildActivity', () => {
  it('spells out what a billing run did', () => {
    const [item] = buildActivity({
      events: [event({
        detail: {
          mode: 'hourly',
          charges: [{ client: 'PSP', charged: 5.76, balance: -5.26 }],
          paused: [{ campaign: 'sunny', client: 'PSP', reason: 'balance' }],
          duration_ms: 1840,
        },
      })],
      statuses: [], transactions: [], alerts: [],
    })
    expect(item.category).toBe('billing')
    expect(item.detail).toEqual([
      ['Mode', 'Whole hours'],
      ['Charged PSP', '₾5.76, balance now −₾5.26'],
      ['Paused sunny', 'PSP, out of balance'],
      ['Took', '1.8 s'],
    ])
    expect(item.quiet).toBe(false)
  })

  it('hides billing runs that charged nothing', () => {
    const [item] = buildActivity({ events: [event({ severity: 'info', title: 'Billing: nothing to charge' })], statuses: [], transactions: [], alerts: [] })
    expect(item.quiet).toBe(true)
  })

  it('reads status changes against the previous status', () => {
    const items = buildActivity({
      events: [],
      statuses: [
        status(3, 'active', '2026-10-22T18:12:00Z'),
        status(1, 'pending_review', '2026-10-01T09:00:00Z'),
        status(2, 'active', '2026-10-01T10:00:00Z'),
        status(4, 'paused_billing', '2026-10-22T18:10:31Z'),
      ],
      transactions: [], alerts: [],
    })
    expect(items.map((i) => i.title)).toEqual([
      'sunny back on air',
      'sunny paused: out of balance',
      'sunny approved and live',
      'sunny submitted for review',
    ])
    expect(items[0].detail).toEqual([['Before', 'Paused: out of balance']])
  })

  it('describes balance movements and alerts in plain words', () => {
    const items = buildActivity({
      events: [],
      statuses: [],
      transactions: [
        { id: 't1', created_at: '2026-10-22T17:49:00Z', client_id: 'k', amount: 50, balance_after: 50, type: 'topup', note: 'Billing test', client: 'PSP', actor: 'Luka' },
        { id: 't2', created_at: '2026-10-22T18:10:31Z', client_id: 'k', amount: -2.88, balance_after: -2.38, type: 'billing', note: null, client: 'PSP', actor: null },
      ],
      alerts: [{ id: 'a1', created_at: '2026-10-22T18:10:35Z', kind: 'depleted', balance: -2.38, sent_at: '2026-10-22T18:10:39Z', client_id: 'k', client: 'PSP', campaign: null }],
    })
    expect(items.map((i) => [i.category, i.title])).toEqual([
      ['alert', 'PSP: balance used up, ads paused'],
      ['billing', 'PSP charged ₾2.88 for airtime'],
      ['balance', 'PSP topped up ₾50.00'],
    ])
    expect(items[2].detail).toContainEqual(['By', 'Luka'])
    expect(items[0].detail).toContainEqual(['Email', 'Sent'])
  })

  it('rebuilds stored event titles word for word, then in Georgian', () => {
    const run = billingRunEvent({
      mode: 'hourly', totalCharged: 14.4, blocks: 0, lateBlocks: 0, failedClients: 0, durationMs: 900, devicesSynced: 1,
      charges: [{ clientId: 'k', client: 'PSP', charged: 14.4, balance: 2 }],
      paused: [{ campaignId: 'c', campaign: 'sunny', client: 'PSP', reason: 'balance' }, { campaignId: 'd', campaign: 'rain', client: 'PSP', reason: 'cap' }],
      completed: ['old'], resumed: [],
    })
    const stored: SystemEvent[] = [
      run,
      deviceEvent('960-D24-A1', 'connected'),
      deviceEvent('960-D24-A1', 'disconnected', { connected_seconds: 12_000 }),
      { category: 'screen', kind: 'playlist_pushed', title: '960-D24-A1: playlist pushed, 2 campaigns, 1 file', device_id: '960-D24-A1', detail: { pushed: true, campaigns: 2, media: 1 } },
    ]
    const rows = stored.map((e, i) => event({ ...e, id: i, severity: e.severity ?? 'info', device_id: e.device_id ?? null, detail: e.detail ?? {} }))
    const input = { events: rows, statuses: [], transactions: [], alerts: [] }

    expect(buildActivity(input).map((i) => i.title).sort()).toEqual(stored.map((e) => e.title).sort())
    const ge = buildActivity(input, (en, vars) => translate('ge', en, vars)).map((i) => i.title)
    expect(ge).toContain('960-D24-A1 გაითიშა 3 სთ 20 წთ ონლაინ ყოფნის შემდეგ')
    expect(ge.join(' ')).not.toMatch(/connected|playlist|charged|paused/)
  })
})
