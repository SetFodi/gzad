import { NextRequest, NextResponse } from 'next/server'
import { allowRequest, clientIp } from '@/lib/rate-limit'
import { AuthFlowError, authClients, challengeForRequest, checkOrigin, deliverCode, flowError, requireVerificationSetup, withChallenge } from '@/lib/auth/challenge'

export async function POST(request: NextRequest) {
  try {
    checkOrigin(request)
    requireVerificationSetup()
    const { challenge } = await challengeForRequest(request)
    if (Date.now() - challenge.sentAt < 60_000) throw new AuthFlowError('WAIT_TO_RESEND', 429)
    const { admin, auth } = authClients()
    if (!await allowRequest(admin, `resend:${challenge.userId}:${clientIp(request)}`, 5, 60 * 60)) throw new AuthFlowError('TOO_MANY_ATTEMPTS', 429)
    await deliverCode(auth, challenge)
    return withChallenge(NextResponse.json({ success: true }), { ...challenge, sentAt: Date.now() })
  } catch (error) { return flowError(error) }
}
