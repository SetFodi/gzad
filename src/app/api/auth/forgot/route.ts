import { NextRequest, NextResponse } from 'next/server'
import { allowRequest, clientIp } from '@/lib/rate-limit'
import { AuthFlowError, authClients, checkOrigin, flowError } from '@/lib/auth/challenge'

// Step one of a password reset: email a one-time code. The answer is the same
// whether or not an account exists, so this can't be used to look up emails.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  try {
    checkOrigin(request)
    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!EMAIL_PATTERN.test(email)) throw new AuthFlowError('INVALID_EMAIL')

    const { admin, auth } = authClients()
    const ip = clientIp(request)
    if (!await allowRequest(admin, `forgot:${ip}`, 10, 60 * 60)) throw new AuthFlowError('TOO_MANY_ATTEMPTS', 429)
    if (!await allowRequest(admin, `forgot-email:${email}`, 4, 60 * 60)) throw new AuthFlowError('TOO_MANY_ATTEMPTS', 429)

    const { error } = await auth.auth.resetPasswordForEmail(email)
    if (error) throw new AuthFlowError(error.status === 429 ? 'TOO_MANY_ATTEMPTS' : 'EMAIL_DELIVERY_FAILED', error.status === 429 ? 429 : 503)
    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return flowError(error) }
}
