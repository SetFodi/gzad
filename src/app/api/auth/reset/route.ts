import { NextRequest, NextResponse } from 'next/server'
import { allowRequest, clientIp } from '@/lib/rate-limit'
import { AuthFlowError, authClients, checkOrigin, flowError } from '@/lib/auth/challenge'

// Step two of a password reset: the emailed code proves the person owns the
// address, then the new password is saved and every existing session ends, so
// anyone signed in with the old password is signed out.

const MIN_PASSWORD_LENGTH = 8

export async function POST(request: NextRequest) {
  try {
    checkOrigin(request)
    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const code = typeof body.code === 'string' ? body.code.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (!email || !/^\d{6,10}$/.test(code)) throw new AuthFlowError('INVALID_CODE')
    if (password.length < MIN_PASSWORD_LENGTH) throw new AuthFlowError('PASSWORD_TOO_SHORT')

    const { admin, auth } = authClients()
    if (!await allowRequest(admin, `reset:${email}:${clientIp(request)}`, 8, 10 * 60)) throw new AuthFlowError('TOO_MANY_ATTEMPTS', 429)

    const { data, error } = await auth.auth.verifyOtp({ email, token: code, type: 'recovery' })
    if (error || !data.user || !data.session) throw new AuthFlowError('INVALID_CODE', error?.status === 429 ? 429 : 400)

    const { error: updateError } = await auth.auth.updateUser({ password })
    if (updateError) {
      await auth.auth.signOut({ scope: 'local' })
      if (updateError.code === 'same_password') throw new AuthFlowError('SAME_PASSWORD')
      if (updateError.code === 'weak_password') throw new AuthFlowError('PASSWORD_TOO_SHORT')
      throw new AuthFlowError('RESET_FAILED', 503)
    }

    // End every session, including the one the code just opened, and drop the
    // database's record of verified sessions so old tokens stop working at once.
    await auth.auth.signOut({ scope: 'global' })
    await admin.from('auth_verified_sessions').delete().eq('user_id', data.user.id)

    return NextResponse.json({ success: true, next: '/portal/login?reset=1' }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return flowError(error) }
}
