import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/campaigns/check-name — global campaign-name availability check.
// Play logs are matched back to campaigns by program name, so names must be
// unique across ALL clients; RLS hides other clients' campaigns, which is why
// this check needs the service role.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name } = await request.json()
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name required' }, { status: 400 })
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: existing } = await service
    .from('campaigns')
    .select('id')
    .ilike('name', name.trim())
    .limit(1)

  return NextResponse.json({ available: !existing || existing.length === 0 })
}
