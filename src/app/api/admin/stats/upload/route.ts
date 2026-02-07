import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // Verify admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: admin } = await supabase
    .from('clients')
    .select('is_admin')
    .eq('auth_user_id', user.id)
    .single()

  if (!admin?.is_admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const { campaign_id, stats } = await request.json()

  if (!campaign_id || !Array.isArray(stats) || stats.length === 0) {
    return NextResponse.json({ error: 'Missing campaign_id or stats array' }, { status: 400 })
  }

  const rows = stats.map((s: Record<string, unknown>) => ({
    campaign_id,
    date: s.date as string,
    play_count: Number(s.play_count) || 0,
    total_duration_seconds: Number(s.total_duration_seconds) || 0,
    unique_taxis: Number(s.unique_taxis) || 0,
    km_covered: Number(s.km_covered) || 0,
  }))

  const { error: insertError } = await supabase.from('play_stats').insert(rows)

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, count: rows.length })
}
