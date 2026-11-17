import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { adjustBalance } from '@/lib/balance'
import { resumeBillingPaused } from '@/lib/campaign-resume'

// Credits and debits to client balance. This is the only write path for
// clients.balance — the browser must never update it directly, so that every
// movement lands in the ledger with an author attached.
//
// `setTo` sets an exact test balance instead of adding to it. It only works on
// internal accounts (billing_exempt), which billing never charges, so the
// amount stays put while staff test.

const MAX_ADJUSTMENT = 100_000

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: admin } = await supabase
    .from('clients')
    .select('id, is_admin')
    .eq('auth_user_id', user.id)
    .single()

  if (!admin?.is_admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const { clientId, amount, note, setTo } = await request.json().catch(() => ({}))

  if (!clientId || typeof clientId !== 'string') {
    return NextResponse.json({ error: 'clientId required' }, { status: 400 })
  }

  const testBalance = setTo === undefined || setTo === null ? null : Number(setTo)
  if (testBalance !== null) {
    if (!Number.isFinite(testBalance) || testBalance < 0 || testBalance > MAX_ADJUSTMENT) {
      return NextResponse.json({ error: `setTo must be between 0 and ${MAX_ADJUSTMENT} GEL` }, { status: 400 })
    }
  }

  const value = Number(amount)
  if (testBalance === null) {
    if (!Number.isFinite(value) || value === 0) {
      return NextResponse.json({ error: 'amount must be a non-zero number' }, { status: 400 })
    }
    if (Math.abs(value) > MAX_ADJUSTMENT) {
      return NextResponse.json({ error: `amount must be within ±${MAX_ADJUSTMENT} GEL` }, { status: 400 })
    }
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: target } = await service
    .from('clients')
    .select(testBalance === null ? 'id, balance' : 'id, balance, billing_exempt')
    .eq('id', clientId)
    .maybeSingle<{ id: string; balance: number | null; billing_exempt?: boolean }>()

  if (!target) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  if (testBalance !== null && !target.billing_exempt) {
    return NextResponse.json(
      { error: 'A test balance can only be set on an internal account. Mark it "never charged" first.' },
      { status: 400 },
    )
  }

  const cleanNote = typeof note === 'string' && note.trim() ? note.trim().slice(0, 500) : null
  // Internal accounts are charged ₾0, so nothing moves the balance between
  // this read and the adjustment below.
  const change = testBalance === null
    ? Math.round(value * 100) / 100
    : Math.round((testBalance - Number(target.balance ?? 0)) * 100) / 100

  let balance = Number(target.balance ?? 0)
  try {
    if (change !== 0) {
      const result = await adjustBalance(service, {
        clientId,
        amount: change,
        type: testBalance === null && change > 0 ? 'topup' : 'adjustment',
        note: cleanNote ?? (testBalance === null ? null : `Test balance set to ₾${testBalance.toFixed(2)}`),
        actorId: admin.id,
      })
      balance = result.balance
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Balance update failed' },
      { status: 500 },
    )
  }

  // Credit restored: bring back campaigns that billing had paused, and push the
  // playlists again so the ads actually resume.
  let reactivated = 0
  let devicesSynced = 0

  if (balance > 0) {
    try {
      ({ reactivated, devicesSynced } = await resumeBillingPaused(service, clientId))
    } catch (err) {
      console.error('Resuming campaigns after top-up failed:', err instanceof Error ? err.message : err)
    }
  }

  return NextResponse.json({ balance, reactivated, devicesSynced })
}
