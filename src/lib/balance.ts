import type { SupabaseClient } from '@supabase/supabase-js'

// Every movement of client credit goes through here so that the balance and the
// ledger can't drift apart. Requires a service-role client.

export type BalanceTxType = 'topup' | 'adjustment' | 'billing' | 'refund'

export interface BalanceAdjustment {
  clientId: string
  /** Positive to credit, negative to charge. */
  amount: number
  type: BalanceTxType
  note?: string | null
  /** clients.id of the admin who did this, for top-ups and manual adjustments. */
  actorId?: string | null
}

export interface BalanceResult {
  balance: number
  /** False when the ledger table isn't there yet — the balance still moved. */
  ledgered: boolean
  atomic: boolean
}

function isMissingObject(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  // 42883 undefined_function, 42P01 undefined_table, PGRST202 no such RPC.
  return error.code === '42883' || error.code === '42P01' || error.code === 'PGRST202'
}

/**
 * Applies a balance change and records it in the ledger.
 *
 * Prefers the atomic adjust_client_balance() function so concurrent billing and
 * top-ups can't clobber each other. Falls back to read-modify-write when that
 * migration hasn't been applied yet, so a deploy that lands ahead of the SQL
 * degrades instead of breaking.
 */
export async function adjustBalance(
  supabase: SupabaseClient,
  { clientId, amount, type, note = null, actorId = null }: BalanceAdjustment,
): Promise<BalanceResult> {
  let balance: number | null = null
  let atomic = true

  const { data: rpcBalance, error: rpcError } = await supabase.rpc('adjust_client_balance', {
    p_client_id: clientId,
    p_amount: amount,
  })

  if (rpcError) {
    if (!isMissingObject(rpcError)) throw new Error(`Balance update failed: ${rpcError.message}`)

    atomic = false
    console.warn('adjust_client_balance() missing — falling back to read-modify-write. Apply the migration.')

    const { data: client, error: readError } = await supabase
      .from('clients')
      .select('balance')
      .eq('id', clientId)
      .single()
    if (readError) throw new Error(`Balance read failed: ${readError.message}`)

    balance = Math.round(((client?.balance || 0) + amount) * 100) / 100
    const { error: writeError } = await supabase
      .from('clients')
      .update({ balance })
      .eq('id', clientId)
    if (writeError) throw new Error(`Balance write failed: ${writeError.message}`)
  } else {
    balance = typeof rpcBalance === 'number' ? rpcBalance : Number(rpcBalance)
  }

  const { error: ledgerError } = await supabase.from('balance_transactions').insert({
    client_id: clientId,
    amount,
    balance_after: balance,
    type,
    note,
    created_by: actorId,
  })

  if (ledgerError && !isMissingObject(ledgerError)) {
    console.error('Balance ledger insert failed:', ledgerError.message)
  }

  return {
    balance: balance ?? 0,
    ledgered: !ledgerError,
    atomic,
  }
}
