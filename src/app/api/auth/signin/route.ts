import { NextRequest, NextResponse } from 'next/server'
import { allowRequest, clientIp } from '@/lib/rate-limit'
import { AUTH_DEVICE_COOKIE, approveSession, createDeviceToken, fingerprint, hasTrustedDevice } from '@/lib/auth/trust'
import { AuthFlowError, CHALLENGE_SECONDS, authClients, checkOrigin, deliverCode, destination, flowError, verificationEnabled, withChallenge, withSession, type AuthChallenge } from '@/lib/auth/challenge'

export async function POST(request: NextRequest) {
  try {
    checkOrigin(request)
    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!email || typeof body.password !== 'string' || !body.password) throw new AuthFlowError('INVALID_CREDENTIALS')
    const { admin, auth } = authClients()
    if (!await allowRequest(admin, `signin:${clientIp(request)}`, 20, 15 * 60)) throw new AuthFlowError('TOO_MANY_ATTEMPTS', 429)

    // This client never writes browser cookies or localStorage. When verification
    // is enabled, the database gate requires approval of this exact session ID.
    const { data, error } = await auth.auth.signInWithPassword({ email, password: body.password })
    if (!verificationEnabled()) {
      // Preserve existing password access until SMTP and the matching database
      // gate are activated together. Unconfirmed accounts still cannot sign in.
      if (error || !data.user || !data.session || !data.user.email_confirmed_at) throw new AuthFlowError('INVALID_CREDENTIALS', error?.status === 429 ? 429 : 400)
      try {
        const next = await destination(admin, data.user.id)
        return await withSession(request, NextResponse.json({ success: true, next }), data.session)
      } catch (failure) { await auth.auth.signOut({ scope: 'local' }); throw failure }
    }
    const context = await fingerprint(request.headers)
    const deviceToken = request.cookies.get(AUTH_DEVICE_COOKIE)?.value || createDeviceToken()

    if (error?.code === 'email_not_confirmed') {
      const { data: profile, error: profileError } = await admin.from('clients').select('auth_user_id').eq('email', email).single()
      if (profileError || !profile?.auth_user_id) throw new AuthFlowError('INVALID_CREDENTIALS')
      const challenge: AuthChallenge = { purpose: 'signup', userId: profile.auth_user_id, email, deviceToken, ...context, sentAt: Date.now(), expiresAt: Date.now() + CHALLENGE_SECONDS * 1000 }
      await deliverCode(auth, challenge)
      return withChallenge(NextResponse.json({ verificationRequired: true, next: '/portal/verify' }), challenge)
    }
    if (error || !data.user || !data.session || !data.user.email_confirmed_at) throw new AuthFlowError('INVALID_CREDENTIALS', error?.status === 429 ? 429 : 400)

    let trusted = false
    try { trusted = await hasTrustedDevice(admin, data.user.id, deviceToken, context) }
    catch (failure) { await auth.auth.signOut({ scope: 'local' }); throw failure }
    if (trusted) {
      try {
        const next = await destination(admin, data.user.id)
        await approveSession(admin, data.user.id, data.session.access_token, deviceToken, context)
        return await withSession(request, NextResponse.json({ success: true, next }), data.session)
      } catch (failure) { await auth.auth.signOut({ scope: 'local' }); throw failure }
    }

    await auth.auth.signOut({ scope: 'local' })
    const challenge: AuthChallenge = { purpose: 'signin', userId: data.user.id, email, deviceToken, ...context, sentAt: Date.now(), expiresAt: Date.now() + CHALLENGE_SECONDS * 1000 }
    await deliverCode(auth, challenge)
    return withChallenge(NextResponse.json({ verificationRequired: true, next: '/portal/verify' }), challenge)
  } catch (error) { return flowError(error) }
}
