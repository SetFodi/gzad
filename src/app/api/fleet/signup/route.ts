import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { allowRequest, clientIp } from '@/lib/rate-limit'

// Public endpoint that creates confirmed auth users with the service role, so
// it is the most abusable surface in the app. Keep the limits tight.
const SIGNUPS_PER_IP = 5
const SIGNUP_WINDOW_SECONDS = 60 * 60

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8

export async function POST(request: NextRequest) {
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

  const { email, password, contact_name, phone, role, company_name } = await request.json()

  if (!email || !password || !contact_name || !role) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (typeof email !== 'string' || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
  }

  if (role !== 'client' && role !== 'fleet') {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  if (role === 'client' && !company_name) {
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
    email_confirm: true,
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  // Create client record
  const { error: clientError } = await adminSupabase.from('clients').insert({
    auth_user_id: authUser.user.id,
    email,
    company_name: role === 'client' ? company_name : contact_name,
    contact_name,
    phone: phone || null,
    is_admin: false,
    role,
  })

  if (clientError) {
    await adminSupabase.auth.admin.deleteUser(authUser.user.id)
    return NextResponse.json({ error: clientError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
