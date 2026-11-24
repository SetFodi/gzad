import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { allowRequest } from '@/lib/rate-limit'
import { POST as forgot } from '../forgot/route'
import { POST as reset } from './route'

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ allowRequest: vi.fn(), clientIp: () => '127.0.0.1' }))

const post = (path: string, body: unknown) => new NextRequest(`http://localhost${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

function fakeSupabase({ verifyError = null as unknown, updateError = null as unknown } = {}) {
  const deleted = vi.fn(async () => ({ error: null }))
  const client = {
    auth: {
      resetPasswordForEmail: vi.fn(async () => ({ data: {}, error: null })),
      verifyOtp: vi.fn(async () => verifyError
        ? { data: { user: null, session: null }, error: verifyError }
        : { data: { user: { id: 'user-1' }, session: { access_token: 'a', refresh_token: 'r' } }, error: null }),
      updateUser: vi.fn(async () => ({ data: {}, error: updateError })),
      signOut: vi.fn(async () => ({ error: null })),
    },
    from: () => ({ delete: () => ({ eq: deleted }) }),
  }
  vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)
  return { client, deleted }
}

beforeEach(() => { vi.mocked(allowRequest).mockResolvedValue(true) })
afterEach(() => { vi.clearAllMocks() })

describe('forgot password', () => {
  it('emails a reset code and answers the same way for any address', async () => {
    const { client } = fakeSupabase()
    const res = await forgot(post('/api/auth/forgot', { email: ' Someone@Example.com ' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith('someone@example.com')
  })

  it('rejects a malformed email and respects the rate limit', async () => {
    fakeSupabase()
    expect((await forgot(post('/api/auth/forgot', { email: 'nope' }))).status).toBe(400)
    vi.mocked(allowRequest).mockResolvedValue(false)
    expect((await forgot(post('/api/auth/forgot', { email: 'a@b.ge' }))).status).toBe(429)
  })
})

describe('reset password', () => {
  it('checks the code, saves the new password and ends every session', async () => {
    const { client, deleted } = fakeSupabase()
    const res = await reset(post('/api/auth/reset', { email: 'a@b.ge', code: '123456', password: 'new-password' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, next: '/portal/login?reset=1' })
    expect(client.auth.verifyOtp).toHaveBeenCalledWith({ email: 'a@b.ge', token: '123456', type: 'recovery' })
    expect(client.auth.updateUser).toHaveBeenCalledWith({ password: 'new-password' })
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'global' })
    expect(deleted).toHaveBeenCalledWith('user_id', 'user-1')
  })

  it('refuses a wrong code without touching the password', async () => {
    const { client } = fakeSupabase({ verifyError: { status: 403, code: 'otp_expired' } })
    const res = await reset(post('/api/auth/reset', { email: 'a@b.ge', code: '123456', password: 'new-password' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('INVALID_CODE')
    expect(client.auth.updateUser).not.toHaveBeenCalled()
  })

  it('refuses a short password before checking the code', async () => {
    const { client } = fakeSupabase()
    const res = await reset(post('/api/auth/reset', { email: 'a@b.ge', code: '123456', password: 'short' }))
    expect((await res.json()).error).toBe('PASSWORD_TOO_SHORT')
    expect(client.auth.verifyOtp).not.toHaveBeenCalled()
  })

  it('says so when the new password is the old one', async () => {
    fakeSupabase({ updateError: { code: 'same_password' } })
    const res = await reset(post('/api/auth/reset', { email: 'a@b.ge', code: '123456', password: 'old-password' }))
    expect((await res.json()).error).toBe('SAME_PASSWORD')
  })
})
