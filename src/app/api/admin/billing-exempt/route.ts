import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { resumeBillingPaused } from '@/lib/campaign-resume'
import { recordEvents } from '@/lib/system-events'

// Marks an account as internal or test: billing records its plays at ₾0 and
// never pauses its campaigns. Turning it on also resumes campaigns that
// billing had already paused for running out of balance.

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: admin } = await supabase
    .from('clients')
    .select('id, is_admin, contact_name, company_name')
    .eq('auth_user_id', user.id)
    .single()
  if (!admin?.is_admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const { clientId, exempt } = await request.json().catch(() => ({}))
  if (!clientId || typeof clientId !== 'string' || typeof exempt !== 'boolean') {
    return NextResponse.json({ error: 'clientId and exempt (boolean) required' }, { status: 400 })
  }

  const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: target, error } = await service
    .from('clients')
    .update({ billing_exempt: exempt })
    .eq('id', clientId)
    .select('id, company_name')
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  if (!target) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  let reactivated = 0
  let devicesSynced = 0
  if (exempt) {
    try {
      ({ reactivated, devicesSynced } = await resumeBillingPaused(service, clientId))
    } catch (err) {
      console.error('Resuming campaigns for exempt account failed:', err instanceof Error ? err.message : err)
    }
  }

  await recordEvents(service, [{
    category: 'billing',
    kind: exempt ? 'billing_exempt_on' : 'billing_exempt_off',
    severity: 'info',
    title: exempt
      ? `${target.company_name}: billing turned off (internal account)`
      : `${target.company_name}: billing turned back on`,
    client_id: clientId,
    detail: { by: admin.contact_name || admin.company_name, reactivated },
  }])

  return NextResponse.json({ exempt, reactivated, devicesSynced })
}
