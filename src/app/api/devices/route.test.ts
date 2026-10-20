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
