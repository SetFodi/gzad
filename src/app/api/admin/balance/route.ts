import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { adjustBalance } from '@/lib/balance'
import { syncGroupDevices } from '@/lib/device-sync'

// Credits and debits to client balance. This is the only write path for
// clients.balance — the browser must never update it directly, so that every
// movement lands in the ledger with an author attached.

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

  const { clientId, amount, note } = await request.json()

  if (!clientId || typeof clientId !== 'string') {
    return NextResponse.json({ error: 'clientId required' }, { status: 400 })
  }

  const value = Number(amount)
  if (!Number.isFinite(value) || value === 0) {
    return NextResponse.json({ error: 'amount must be a non-zero number' }, { status: 400 })
  }
  if (Math.abs(value) > MAX_ADJUSTMENT) {
    return NextResponse.json({ error: `amount must be within ±${MAX_ADJUSTMENT} GEL` }, { status: 400 })
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: target } = await service
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .maybeSingle()

  if (!target) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  let balance: number
  try {
    const result = await adjustBalance(service, {
      clientId,
      amount: Math.round(value * 100) / 100,
      type: value > 0 ? 'topup' : 'adjustment',
      note: typeof note === 'string' && note.trim() ? note.trim().slice(0, 500) : null,
      actorId: admin.id,
    })
    balance = result.balance
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
    const { data: resumed } = await service
      .from('campaigns')
      .update({ status: 'active' })
      .eq('client_id', clientId)
      .eq('status', 'paused_billing')
      .select('device_group_id')

    reactivated = (resumed || []).length
    const groups = new Set((resumed || []).map(c => c.device_group_id).filter(Boolean) as string[])

    for (const groupId of groups) {
      try {
        const result = await syncGroupDevices(service, groupId)
        devicesSynced += result.synced
      } catch (err) {
        console.error(`Resync of group ${groupId} failed:`, err instanceof Error ? err.message : err)
      }
    }
  }

  return NextResponse.json({ balance, reactivated, devicesSynced })
}
