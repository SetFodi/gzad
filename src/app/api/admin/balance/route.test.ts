import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { adjustBalance } from '@/lib/balance'
import { resumeBillingPaused } from '@/lib/campaign-resume'
import { POST } from './route'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/balance', () => ({ adjustBalance: vi.fn() }))
vi.mock('@/lib/campaign-resume', () => ({ resumeBillingPaused: vi.fn() }))

type Target = { id: string; balance: number | null; billing_exempt?: boolean }

function signedIn(isAdmin = true) {
  const single = async () => ({ data: { id: 'admin-1', is_admin: isAdmin } })
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    from: () => ({ select: () => ({ eq: () => ({ single }) }) }),
  } as unknown as Awaited<ReturnType<typeof createClient>>)
}

function target(row: Target | null) {
  const maybeSingle = async () => ({ data: row, error: null })
  vi.mocked(createServiceClient).mockReturnValue({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
  } as unknown as ReturnType<typeof createServiceClient>)
}

const post = (body: unknown) => new NextRequest('http://localhost/api/admin/balance', { method: 'POST', body: JSON.stringify(body) })

beforeEach(() => {
  signedIn()
  vi.mocked(adjustBalance).mockImplementation(async (_db, { amount }) => ({ balance: -9.81 + amount, ledgered: true, atomic: true }))
  vi.mocked(resumeBillingPaused).mockResolvedValue({ reactivated: 2, devicesSynced: 1 })
})
afterEach(() => { vi.clearAllMocks() })

describe('POST /api/admin/balance with setTo', () => {
  it('sets an internal account to the exact amount and resumes its campaigns', async () => {
    target({ id: 'c1', balance: -9.81, billing_exempt: true })
    const res = await POST(post({ clientId: 'c1', setTo: 1000 }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ balance: 1000, reactivated: 2, devicesSynced: 1 })
    expect(adjustBalance).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      clientId: 'c1', amount: 1009.81, type: 'adjustment', note: 'Test balance set to ₾1000.00', actorId: 'admin-1',
    }))
  })

  it('refuses accounts that billing still charges', async () => {
    target({ id: 'c1', balance: 5, billing_exempt: false })
    const res = await POST(post({ clientId: 'c1', setTo: 1000 }))
    expect(res.status).toBe(400)
    expect(adjustBalance).not.toHaveBeenCalled()
  })

  it('writes nothing when the balance is already that amount', async () => {
    target({ id: 'c1', balance: 1000, billing_exempt: true })
    const res = await POST(post({ clientId: 'c1', setTo: 1000 }))
    expect((await res.json()).balance).toBe(1000)
    expect(adjustBalance).not.toHaveBeenCalled()
  })

  it('rejects negative and oversized amounts', async () => {
    target({ id: 'c1', balance: 0, billing_exempt: true })
    expect((await POST(post({ clientId: 'c1', setTo: -1 }))).status).toBe(400)
    expect((await POST(post({ clientId: 'c1', setTo: 100_001 }))).status).toBe(400)
    expect(adjustBalance).not.toHaveBeenCalled()
  })

  it('is admin-only', async () => {
    signedIn(false)
    target({ id: 'c1', balance: 0, billing_exempt: true })
    expect((await POST(post({ clientId: 'c1', setTo: 1000 }))).status).toBe(403)
  })

  it('still adds a plain amount as a top-up', async () => {
    target({ id: 'c1', balance: -9.81 })
    const res = await POST(post({ clientId: 'c1', amount: 50 }))
    expect(res.status).toBe(200)
    expect(adjustBalance).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ amount: 50, type: 'topup', note: null }))
  })
})
