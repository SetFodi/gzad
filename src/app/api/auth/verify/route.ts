import { NextRequest, NextResponse } from 'next/server'
import { allowRequest, clientIp } from '@/lib/rate-limit'
import { AUTH_DEVICE_COOKIE, TRUST_MAX_AGE_SECONDS, approveSession } from '@/lib/auth/trust'
import { AuthFlowError, authClients, challengeForRequest, checkOrigin, clearChallenge, destination, flowError, requireVerificationSetup, withSession } from '@/lib/auth/challenge'

export async function POST(request: NextRequest) {
  try {
    checkOrigin(request)
    requireVerificationSetup()
    const { challenge, context } = await challengeForRequest(request)
    const { code } = await request.json()
    if (typeof code !== 'string' || !/^\d{6,10}$/.test(code)) throw new AuthFlowError('INVALID_CODE')
    const { admin, auth } = authClients()
    if (!await allowRequest(admin, `verify:${challenge.userId}:${clientIp(request)}`, 8, 10 * 60)) throw new AuthFlowError('TOO_MANY_ATTEMPTS', 429)
    const { data, error } = await auth.auth.verifyOtp({ email: challenge.email, token: code, type: 'email' })
    if (error || !data.user || !data.session || data.user.id !== challenge.userId || !data.user.email_confirmed_at) {
      if (data.session) await auth.auth.signOut({ scope: 'local' })
      throw new AuthFlowError('INVALID_CODE', error?.status === 429 ? 429 : 400)
    }
    if (challenge.purpose === 'signup') {
      // Signup confirmation does not trust the browser or sign the account in.
      // Its first password sign-in is a separate challenge, as requested.
      await auth.auth.signOut({ scope: 'local' })
      return clearChallenge(NextResponse.json({ success: true, next: '/portal/login?verified=1' }))
    }

    try {
      const next = await destination(admin, data.user.id)
      await approveSession(admin, data.user.id, data.session.access_token, challenge.deviceToken, context)
      const response = NextResponse.json({ success: true, next })
      response.cookies.set(AUTH_DEVICE_COOKIE, challenge.deviceToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: TRUST_MAX_AGE_SECONDS })
      return await withSession(request, response, data.session)
    } catch (failure) { await auth.auth.signOut({ scope: 'local' }); throw failure }
  } catch (error) { return flowError(error) }
}
