import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { authClients, checkOrigin, clearChallenge, flowError, verificationEnabled } from '@/lib/auth/challenge'
import { revokeApprovedSession } from '@/lib/auth/trust'

export async function POST(request: NextRequest) {
  try {
    checkOrigin(request)
    const response = NextResponse.json({ success: true })
    // Read the native session even if the browser/IP has just changed, so logout
    // can revoke its approval. The persistent device cookie is intentionally kept.
    const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: { getAll: () => request.cookies.getAll(), setAll: values => values.forEach(({ name, value, options }) => response.cookies.set(name, value, options)) },
    })
    const { data: { user } } = await client.auth.getUser()
    const { data: { session } } = await client.auth.getSession()
    if (verificationEnabled() && user && session) await revokeApprovedSession(authClients().admin, user.id, session.access_token)
    await client.auth.signOut({ scope: 'local' })
    return clearChallenge(response)
  } catch (error) { return flowError(error) }
}
