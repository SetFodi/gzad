import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { POST } from './route'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }))

function registry(ids: string[], error: { message: string } | null = null) {
  const lookups: string[] = []
  vi.mocked(createServiceClient).mockReturnValue({
    from: () => {
      let id = ''
      const query = {
        select: () => query,
        eq: (_: string, v: string) => { id = v; return query },
        maybeSingle: async () => {
          lookups.push(id)
          return error ? { data: null, error } : { data: ids.includes(id) ? { id } : null, error: null }
        },
      }
      return query
    },
  } as unknown as ReturnType<typeof createServiceClient>)
  return lookups
}

const ask = (cardId: unknown, auth = 'Bearer cb-secret') => new NextRequest('http://localhost/api/devices/authorize', {
  method: 'POST',
  headers: { authorization: auth },
  body: JSON.stringify({ cardId }),
})

beforeEach(() => { vi.stubEnv('CALLBACK_SECRET', 'cb-secret') })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs() })

describe('POST /api/devices/authorize', () => {
  it('admits a screen that was added in the admin panel', async () => {
    registry(['y08-s26-60755'])
    expect(await (await POST(ask('y08-s26-60755'))).json()).toEqual({ allowed: true })
  })

  it('turns away a controller nobody added', async () => {
    registry(['y08-s26-60755'])
    expect(await (await POST(ask('y08-s26-99999'))).json()).toEqual({ allowed: false })
  })

  it('only answers the Realtime Server', async () => {
    const lookups = registry(['y08-s26-60755'])
    expect((await POST(ask('y08-s26-60755', 'Bearer wrong'))).status).toBe(401)
    expect((await POST(ask('y08-s26-60755', ''))).status).toBe(401)
    expect(lookups).toEqual([])
  })

  it('says the registry is unavailable rather than "no" when the lookup fails', async () => {
    registry([], { message: 'timeout' })
    expect((await POST(ask('y08-s26-60755'))).status).toBe(503)
  })

  it('does not look up an id that is not a controller id', async () => {
    const lookups = registry([])
    expect(await (await POST(ask('../../etc'))).json()).toEqual({ allowed: false })
    expect(lookups).toEqual([])
  })
})
