import { afterEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { GET } from './route'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('registered device data', () => {
  function setup(error: { message: string } | null) {
    const upsert = vi.fn()
    const db = {
      auth: { getUser: async () => ({ data: { user: { id: 'admin-user' } } }) },
      from: (table: string) => {
        const query = {
          select: () => query,
          eq: () => query,
          single: async () => ({ data: { is_admin: true } }),
          order: async () => ({ data: error ? null : [], error }),
          upsert,
        }
        if (table === 'device_clock_issues') {
          return { select: async () => ({ data: [], error: null }) }
        }
        if (!['clients', 'devices'].includes(table)) throw new Error('Unexpected table')
        return query
      },
    }
    vi.mocked(createClient).mockResolvedValue(db as unknown as Awaited<ReturnType<typeof createClient>>)
    const realtime = vi.fn(async () => new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', realtime)
    return { upsert, realtime }
  }

  it('does not report an empty fleet or register live screens when the database read fails', async () => {
    const { upsert, realtime } = setup({ message: 'database unavailable' })
    const response = await GET()
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Could not load registered devices' })
    expect(realtime).not.toHaveBeenCalled()
    expect(upsert).not.toHaveBeenCalled()
  })

  it('still accepts a successful read with no registered or connected screens', async () => {
    const { upsert, realtime } = setup(null)
    const response = await GET()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ devices: [] })
    expect(realtime).toHaveBeenCalledOnce()
    expect(upsert).not.toHaveBeenCalled()
  })
})

describe('clock warnings', () => {
  const registered = [
    { id: 'y08-s26-60755', name: 'Taxi #2', last_seen_at: null, last_lat: null, last_lng: null, created_at: '2026-11-14T01:11:50Z' },
    { id: 'y1c-825-61009', name: 'Taxi #1', last_seen_at: null, last_lat: null, last_lng: null, created_at: '2026-02-07T09:33:51Z' },
  ]

  function setup(clock: { data: unknown; error: unknown }) {
    const db = {
      auth: { getUser: async () => ({ data: { user: { id: 'admin-user' } } }) },
      from: (table: string) => {
        if (table === 'device_clock_issues') return { select: async () => clock }
        const query = {
          select: () => query,
          eq: () => query,
          single: async () => ({ data: { is_admin: true } }),
          order: async () => ({ data: registered, error: null }),
          upsert: vi.fn(),
        }
        return query
      },
    }
    vi.mocked(createClient).mockResolvedValue(db as unknown as Awaited<ReturnType<typeof createClient>>)
    vi.stubGlobal('fetch', vi.fn(async () => Response.json([])))
  }

  it('marks the screen whose plays carry impossible times, and only that one', async () => {
    setup({
      data: [{ device_id: 'y08-s26-60755', bad_plays: 1, last_bad_at: '2026-11-16T21:33:00Z', last_bad_stamp: '2026-07-03T10:35:33Z' }],
      error: null,
    })
    const { devices } = await (await GET()).json()
    const byId = Object.fromEntries(devices.map((d: { cardId: string }) => [d.cardId, d]))
    expect(byId['y08-s26-60755'].clock).toEqual({
      badPlays: 1, lastBadAt: '2026-11-16T21:33:00Z', lastBadStamp: '2026-07-03T10:35:33Z',
      resolved: false, lastRestartAt: null, lastRestartOfflineSeconds: null,
    })
    expect(byId['y1c-825-61009'].clock).toBeNull()
  })

  it('reports a clock proven fixed by a long power cut', async () => {
    setup({
      data: [{
        device_id: 'y08-s26-60755', bad_plays: 2, last_bad_at: '2026-11-20T17:16:07Z', last_bad_stamp: '2026-07-03T10:35:33Z',
        last_restart_at: '2026-11-20T19:05:00Z', last_restart_offline_s: 2400, resolved: true,
      }],
      error: null,
    })
    const { devices } = await (await GET()).json()
    const clock = devices.find((d: { cardId: string }) => d.cardId === 'y08-s26-60755').clock
    expect(clock).toMatchObject({ resolved: true, lastRestartAt: '2026-11-20T19:05:00Z', lastRestartOfflineSeconds: 2400 })
  })

  it('still lists every screen when the clock check fails', async () => {
    setup({ data: null, error: { message: 'relation "device_clock_issues" does not exist' } })
    const res = await GET()
    expect(res.status).toBe(200)
    const { devices } = await res.json()
    expect(devices).toHaveLength(2)
    expect(devices.every((d: { clock: unknown }) => d.clock === null)).toBe(true)
  })
})
