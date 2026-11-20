import { afterEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { GET } from './route'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

function eventsQuery(rows: unknown[] | null, error: unknown = null) {
  const q = {
    select: () => q, eq: () => q, in: () => q, gte: () => q, order: () => q,
    limit: async () => ({ data: rows, error }),
  }
  return q
}

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
        if (table === 'system_events') return eventsQuery([])
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
        if (table === 'system_events') return eventsQuery([])
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

describe('problems from the latest connection', () => {
  const registered = [
    { id: 'y08-s26-60759', name: 'y08-s26-60759', group_id: null, last_seen_at: null, last_lat: null, last_lng: null, created_at: '2026-11-17T01:45:23Z' },
    { id: 'y08-s26-60755', name: 'Taxi #2', group_id: 'g-1', last_seen_at: null, last_lat: null, last_lng: null, created_at: '2026-11-14T01:11:50Z' },
  ]

  function setup(events: unknown[] | null, eventsError: unknown = null) {
    const db = {
      auth: { getUser: async () => ({ data: { user: { id: 'admin-user' } } }) },
      from: (table: string) => {
        if (table === 'device_clock_issues') return { select: async () => ({ data: [], error: null }) }
        if (table === 'system_events') return eventsQuery(events, eventsError)
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
  const byId = async () => {
    const { devices } = await (await GET()).json()
    return Object.fromEntries(devices.map((d: { cardId: string }) => [d.cardId, d]))
  }
  // Newest first, as the route asks for.
  const ev = (device_id: string, kind: string, occurred_at: string, detail = {}) => ({ device_id, kind, occurred_at, detail })

  it('reports a failed playlist push and play-reporting setup from the current connection', async () => {
    setup([
      ev('y08-s26-60759', 'playlist_failed', '2026-11-17T02:29:14Z', { error: 'push-program returned 500' }),
      ev('y08-s26-60759', 'setup_failed', '2026-11-17T02:29:13Z', { errors: ['UploadPlayLogs: Command timeout'] }),
      ev('y08-s26-60759', 'connected', '2026-11-17T02:29:06Z'),
    ])
    const d = await byId()
    expect(d['y08-s26-60759'].problems).toEqual({
      playlistError: { at: '2026-11-17T02:29:14Z', error: 'push-program returned 500' },
      setupError: { at: '2026-11-17T02:29:13Z', errors: ['UploadPlayLogs: Command timeout'] },
    })
  })

  it('forgets failures from before the screen reconnected, and a later good push clears a failed one', async () => {
    setup([
      ev('y08-s26-60759', 'playlist_pushed', '2026-11-17T02:33:37Z'),
      ev('y08-s26-60759', 'connected', '2026-11-17T02:33:29Z'),
      ev('y08-s26-60759', 'setup_failed', '2026-11-17T02:29:13Z', { errors: ['x'] }),
      ev('y08-s26-60759', 'connected', '2026-11-17T02:29:06Z'),
      ev('y08-s26-60755', 'playlist_pushed', '2026-11-17T02:21:36Z'),
      ev('y08-s26-60755', 'playlist_failed', '2026-11-17T02:20:00Z', { error: 'timeout' }),
    ])
    const d = await byId()
    expect(d['y08-s26-60759'].problems).toEqual({ playlistError: null, setupError: null })
    expect(d['y08-s26-60755'].problems).toEqual({ playlistError: null, setupError: null })
  })

  it('clears a failed setup once a retry on the same connection works', async () => {
    setup([
      ev('y08-s26-60755', 'setup_ok', '2026-11-20T19:10:11Z'),
      ev('y08-s26-60755', 'setup_failed', '2026-11-20T19:09:41Z', { errors: ['UploadPlayLogs: Command timeout'] }),
      ev('y08-s26-60755', 'connected', '2026-11-20T19:09:26Z'),
      ev('y08-s26-60759', 'setup_failed', '2026-11-20T19:09:41Z', { errors: ['x'] }),
      ev('y08-s26-60759', 'setup_ok', '2026-11-20T19:05:00Z'),
      ev('y08-s26-60759', 'connected', '2026-11-20T19:04:00Z'),
    ])
    const d = await byId()
    expect(d['y08-s26-60755'].problems.setupError).toBeNull()       // the retry worked
    expect(d['y08-s26-60759'].problems.setupError).not.toBeNull()   // failed again after an earlier success
  })

  it('says which screens are in a group', async () => {
    setup([])
    const d = await byId()
    expect(d['y08-s26-60759'].grouped).toBe(false)
    expect(d['y08-s26-60755'].grouped).toBe(true)
  })

  it('still lists every screen when the event lookup fails', async () => {
    setup(null, { message: 'permission denied' })
    const d = await byId()
    expect(Object.keys(d)).toHaveLength(2)
    expect(d['y08-s26-60759'].problems).toBeNull()
  })
})
