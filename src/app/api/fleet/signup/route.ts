import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const { email, password, contact_name, phone, role, company_name } = await request.json()

  if (!email || !password || !contact_name || !role) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (role !== 'client' && role !== 'fleet') {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  if (role === 'client' && !company_name) {
    return NextResponse.json({ error: 'Company name is required for advertisers' }, { status: 400 })
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
  }

  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

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
