import { NextRequest, NextResponse } from 'next/server'
import { challengeForRequest, flowError, requireVerificationSetup } from '@/lib/auth/challenge'

export async function GET(request: NextRequest) {
  try {
    requireVerificationSetup()
    const { challenge } = await challengeForRequest(request)
    return NextResponse.json({ email: challenge.email, purpose: challenge.purpose, resendAfter: Math.max(0, Math.ceil((challenge.sentAt + 60_000 - Date.now()) / 1000)) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return flowError(error) }
}
