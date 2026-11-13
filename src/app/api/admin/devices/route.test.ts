import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { DELETE, GET, POST } from './route'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }))

type Row = Record<string, unknown>

// A tiny stand-in for the service-role client: clients, device_managers and
// devices, with just the query shapes the route uses.
function fakeDb({ isAdmin = true, isManager = true, devices = [] as Row[], insertError = null as Row | null } = {}) {
  const tables: Record<string, Row[]> = {
    clients: [{ id: 'client-1', auth_user_id: 'user-1', is_admin: isAdmin }],
    device_managers: isManager ? [{ client_id: 'client-1' }] : [],
    devices: [...devices],
  }
  const inserted: Row[] = []
  const deleted: string[] = []

  const from = (table: string) => {
    const filters: [string, unknown][] = []
    const rows = () => tables[table].filter(r => filters.every(([k, v]) => r[k] === v))
    const query = {
      select: () => query,
      eq: (k: string, v: unknown) => { filters.push([k, v]); return query },
      in: async (k: string, vs: unknown[]) => ({ data: tables[table].filter(r => vs.includes(r[k])), error: null }),
      maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
      insert: async (row: Row) => {
        if (insertError) return { error: insertError }
        inserted.push(row)
        tables[table].push(row)
        return { error: null }
      },
      delete: () => ({
        eq: (k: string, v: unknown) => ({
          select: async () => {
            const hit = tables[table].filter(r => r[k] === v)
            tables[table] = tables[table].filter(r => r[k] !== v)
            hit.forEach(r => deleted.push(String(r.id)))
            return { data: hit.map(r => ({ id: r.id })), error: null }
          },
        }),
      }),
    }
    return query
  }
  return { client: { from }, inserted, deleted }
}

function signedIn(user: { id: string } | null = { id: 'user-1' }) {
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user } }) },
  } as unknown as Awaited<ReturnType<typeof createClient>>)
}

function useDb(db: ReturnType<typeof fakeDb>) {
  vi.mocked(createServiceClient).mockReturnValue(db.client as unknown as ReturnType<typeof createServiceClient>)
}

function stubRealtime(address = '203.0.113.5:3100?token=t0k', pending: Row[] = []) {
  const calls: { url: string; body?: string }[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body as string | undefined })
    if (url.endsWith('/provisioning')) return Response.json({ address })
    if (url.endsWith('/pending-devices')) return Response.json(pending)
    return Response.json({ success: true })
  }))
  return calls
}

const asking = (cardId: string) => ({ cardId, firstSeen: '2026-11-14T10:00:00Z', lastSeen: '2026-11-14T10:05:00Z', ip: '198.51.100.7', attempts: 12 })

const post = (body: unknown) => new NextRequest('http://localhost/api/admin/devices', { method: 'POST', body: JSON.stringify(body) })

beforeEach(() => signedIn())
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('GET /api/admin/devices', () => {
  it('tells an admin who is not a device manager that they cannot add screens', async () => {
    useDb(fakeDb({ isManager: false }))
    const calls = stubRealtime('203.0.113.5:3100?token=abc', [asking('y08-s26-60755')])
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ canManage: false, address: null, pending: [] })
    expect(calls).toEqual([])
  })

  it('gives a device manager the LEDOK address and the screens asking to join', async () => {
    useDb(fakeDb())
    stubRealtime('203.0.113.5:3100?token=abc', [asking('y08-s26-60755')])
    expect(await (await GET()).json()).toEqual({
      canManage: true,
      address: '203.0.113.5:3100?token=abc',
      pending: [{ cardId: 'y08-s26-60755', firstSeen: '2026-11-14T10:00:00Z', lastSeen: '2026-11-14T10:05:00Z', attempts: 12 }],
    })
  })

  it('leaves out a waiting screen that was added in the meantime', async () => {
    useDb(fakeDb({ devices: [{ id: 'y08-s26-60755', name: 'Taxi #2' }] }))
    stubRealtime(undefined, [asking('y08-s26-60755'), asking('y08-s26-70000')])
    const { pending } = await (await GET()).json()
    expect(pending.map((p: Row) => p.cardId)).toEqual(['y08-s26-70000'])
  })

  it('refuses a signed-out caller', async () => {
    signedIn(null)
    useDb(fakeDb())
    expect((await GET()).status).toBe(401)
  })
})

describe('POST /api/admin/devices', () => {
  it('adds the screen with its id in lower case and lets the server admit it at once', async () => {
    const db = fakeDb()
    useDb(db)
    const calls = stubRealtime()
    const res = await POST(post({ cardId: '  Y08-S26-60755 ', name: 'Taxi #2', groupId: null }))
    expect(res.status).toBe(201)
    expect(db.inserted).toEqual([{ id: 'y08-s26-60755', name: 'Taxi #2', group_id: null }])
    expect(calls.some(c => c.url.endsWith('/registry/y08-s26-60755/forget'))).toBe(true)
    expect((await res.json()).address).toBe('203.0.113.5:3100?token=t0k')
  })

  it('names an unnamed screen after its id', async () => {
    const db = fakeDb()
    useDb(db)
    stubRealtime()
    await POST(post({ cardId: 'y08-s26-60755' }))
    expect(db.inserted[0].name).toBe('y08-s26-60755')
  })

  it('rejects an id LEDOK could not have shown', async () => {
    const db = fakeDb()
    useDb(db)
    stubRealtime()
    const res = await POST(post({ cardId: 'y08 s26/60755' }))
    expect(res.status).toBe(400)
    expect(db.inserted).toEqual([])
  })

  it('reports a screen that is already added', async () => {
    useDb(fakeDb({ insertError: { code: '23505', message: 'duplicate key' } }))
    stubRealtime()
    const res = await POST(post({ cardId: 'y1c-825-61009' }))
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'This screen is already added' })
  })

  it('does not let an admin who is not a device manager add screens', async () => {
    const db = fakeDb({ isManager: false })
    useDb(db)
    const calls = stubRealtime()
    const res = await POST(post({ cardId: 'y08-s26-60755' }))
    expect(res.status).toBe(403)
    expect(db.inserted).toEqual([])
    expect(calls).toEqual([])
  })

  it('does not let a non-admin add screens even if listed as a manager', async () => {
    useDb(fakeDb({ isAdmin: false }))
    stubRealtime()
    expect((await POST(post({ cardId: 'y08-s26-60755' }))).status).toBe(403)
  })
})

describe('DELETE /api/admin/devices', () => {
  const del = (cardId: string) => new NextRequest(`http://localhost/api/admin/devices?cardId=${cardId}`, { method: 'DELETE' })

  it('removes the screen and has the server disconnect it', async () => {
    const db = fakeDb({ devices: [{ id: 'y08-s26-60755', name: 'Taxi #2' }] })
    useDb(db)
    const calls = stubRealtime()
    const res = await DELETE(del('y08-s26-60755'))
    expect(res.status).toBe(200)
    expect(db.deleted).toEqual(['y08-s26-60755'])
    const forget = calls.find(c => c.url.endsWith('/registry/y08-s26-60755/forget'))
    expect(JSON.parse(forget!.body!)).toEqual({ disconnect: true })
  })

  it('says so when the screen is not registered', async () => {
    useDb(fakeDb())
    stubRealtime()
    expect((await DELETE(del('y08-s26-60755'))).status).toBe(404)
  })
})
