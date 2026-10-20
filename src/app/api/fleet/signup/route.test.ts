import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { allowRequest } from '@/lib/rate-limit'
import { POST } from './route'

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ allowRequest: vi.fn(), clientIp: () => '127.0.0.1' }))

beforeEach(() => {
  vi.stubEnv('AUTH_DEVICE_VERIFICATION', 'on')
  vi.stubEnv('AUTH_DEVICE_SECRET', 'local-test-secret-which-is-at-least-32-characters')
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs() })

describe('email verification at signup', () => {
  it('keeps the chosen password and creates an unconfirmed account', async () => {
    const createUser = vi.fn(async () => ({
      data: { user: { id: 'new-auth-user', email: 'advertiser@example.invalid' } },
      error: null,
    }))
    const insert = vi.fn(async () => ({ error: null }))
    const authClient = {
      auth: {
        admin: { createUser, deleteUser: vi.fn() },
        signInWithOtp: vi.fn(async () => ({ data: { user: null, session: null }, error: null })),
        resend: vi.fn(async () => ({ data: { user: null, session: null }, error: null })),
      },
      from: () => ({ insert }),
    }
    vi.mocked(createClient).mockReturnValue(authClient as unknown as ReturnType<typeof createClient>)
    vi.mocked(allowRequest).mockResolvedValue(true)

    const response = await POST(new NextRequest('http://localhost/api/fleet/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'advertiser@example.invalid',
        password: 'chosen-password',
        contact_name: 'New advertiser',
        company_name: 'Advertiser company',
        role: 'client',
      }),
    }))

    expect(createUser).toHaveBeenCalledWith(expect.objectContaining({
      email: 'advertiser@example.invalid',
      password: 'chosen-password',
      email_confirm: false,
    }))
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      auth_user_id: 'new-auth-user',
      role: 'client',
      is_admin: false,
    }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, next: '/portal/verify' })
    expect(authClient.auth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'advertiser@example.invalid' })
    expect(response.headers.get('set-cookie')).toContain('gzad_auth_challenge=')
    expect(response.headers.get('set-cookie')).not.toContain('sb-')
  })
})
