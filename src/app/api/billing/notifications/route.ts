import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { deliverBillingNotifications } from '@/lib/billing-notifications'

export const maxDuration = 60

async function handle(request: NextRequest) {
  const authorization = request.headers.get('authorization')
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null
  const accepted = [process.env.CALLBACK_SECRET, process.env.CRON_SECRET].filter(Boolean)
  if (!token || !accepted.includes(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // This endpoint only delivers alerts already in the outbox. Retrying mail
    // must never calculate charges or change campaign status.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    const result = await deliverBillingNotifications(supabase, new Date(), { maxAlerts: 50, budgetMs: 45000 })
    return NextResponse.json(result, {
      status: !result.enabled ? 503 : result.failed > 0 ? 502 : 200,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch {
    console.error('Billing notification run failed')
    return NextResponse.json({ error: 'Billing notification run failed' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return handle(request)
}

// Vercel's scheduler issues a GET.
export async function GET(request: NextRequest) {
  return handle(request)
}
