import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // Verify caller is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: admin } = await supabase
    .from('clients')
    .select('is_admin')
    .eq('auth_user_id', user.id)
    .single()

  if (!admin?.is_admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const { email, password, company_name, contact_name, phone } = await request.json()

  if (!email || !password || !company_name || !contact_name) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Use service role key to create user (admin action)
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
  const { error: clientError } = await supabase.from('clients').insert({
    auth_user_id: authUser.user.id,
    email,
    company_name,
    contact_name,
    phone: phone || null,
    is_admin: false,
  })

  if (clientError) {
    // Rollback: delete auth user if client record fails
    await adminSupabase.auth.admin.deleteUser(authUser.user.id)
    return NextResponse.json({ error: clientError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, id: authUser.user.id })
}

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: admin } = await supabase
    .from('clients')
    .select('is_admin')
    .eq('auth_user_id', user.id)
    .single()

  if (!admin?.is_admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .eq('is_admin', false)
    .order('created_at', { ascending: false })

  return NextResponse.json(clients || [])
}
