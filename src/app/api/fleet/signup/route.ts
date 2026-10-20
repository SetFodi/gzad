import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { allowRequest, clientIp } from '@/lib/rate-limit'
import { createDeviceToken, fingerprint } from '@/lib/auth/trust'
import { CHALLENGE_SECONDS, authClients, checkOrigin, deliverCode, flowError, requireVerificationSetup, withChallenge, type AuthChallenge } from '@/lib/auth/challenge'

// Public account provisioning keeps authorization fields on the server.
// The user must confirm their email before their first sign-in.
const SIGNUPS_PER_IP = 5
const SIGNUP_WINDOW_SECONDS = 60 * 60

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8

export async function POST(request: NextRequest) {
  try {
    checkOrigin(request)
    requireVerificationSetup()
    const adminSupabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const ip = clientIp(request)
    const allowed = await allowRequest(adminSupabase, `signup:${ip}`, SIGNUPS_PER_IP, SIGNUP_WINDOW_SECONDS)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many signup attempts. Please try again later.' },
        { status: 429 },
      )
    }

    const body = await request.json()
    const { password, contact_name, phone, role, company_name } = body
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

    if (!email || !password || typeof contact_name !== 'string' || !contact_name.trim() || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (typeof email !== 'string' || !EMAIL_PATTERN.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    if (role !== 'client' && role !== 'fleet') {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    if (role === 'client' && (typeof company_name !== 'string' || !company_name.trim())) {
      return NextResponse.json({ error: 'Company name is required for advertisers' }, { status: 400 })
    }

    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 },
      )
    }

    // Create auth user
    const { data: authUser, error: authError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // Create client record
    const { error: clientError } = await adminSupabase.from('clients').insert({
      auth_user_id: authUser.user.id,
      email,
      company_name: role === 'client' ? company_name.trim() : contact_name.trim(),
      contact_name: contact_name.trim(),
      phone: typeof phone === 'string' ? phone.trim() || null : null,
      is_admin: false,
      role,
    })

    if (clientError) {
      await adminSupabase.auth.admin.deleteUser(authUser.user.id)
      return NextResponse.json({ error: clientError.message }, { status: 400 })
    }

    try {
      const context = await fingerprint(request.headers)
      const challenge: AuthChallenge = {
        purpose: 'signup', userId: authUser.user.id, email, deviceToken: createDeviceToken(),
        ...context, sentAt: Date.now(), expiresAt: Date.now() + CHALLENGE_SECONDS * 1000,
      }
      await deliverCode(authClients().auth, challenge)
      return await withChallenge(NextResponse.json({ success: true, next: '/portal/verify' }), challenge)
    } catch (error) {
      // A newly created, unconfirmed account has no campaigns. Deleting it also
      // removes its profile, so a failed delivery can be retried from signup.
      await adminSupabase.auth.admin.deleteUser(authUser.user.id)
      throw error
    }
  } catch (error) { return flowError(error) }
}
