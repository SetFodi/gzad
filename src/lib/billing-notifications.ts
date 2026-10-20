import type { SupabaseClient } from '@supabase/supabase-js'
import { billingMailProvider, type BillingMail } from './billing-mail'

// Imported only by server billing routes. Keep provider credentials out of client code.
const EMAIL_KINDS = ['low_20pct', 'runway_1d', 'depleted'] as const
const DAY_MS = 24 * 60 * 60 * 1000
const BATCH_SIZE = 5

interface PendingAlert {
  id: string
  kind: typeof EMAIL_KINDS[number]
  balance: number | string | null
  detail: { pct?: number } | null
  clients: { email: string } | { email: string }[] | null
}

interface Claim {
  token: string
  payload: BillingMail
}

export interface BillingNotificationResult {
  enabled: boolean
  sent: number
  failed: number
  skipped: number
  reason?: string
}

function emailPayload(alert: PendingAlert, from: string, appUrl: URL): BillingMail | null {
  const client = Array.isArray(alert.clients) ? alert.clients[0] : alert.clients
  if (!client?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email)) return null
  const balance = Number(alert.balance)
  if (alert.balance === null || !Number.isFinite(balance)) return null

  let message: string
  let subject: string
  if (alert.kind === 'depleted') {
    subject = 'Gzad: ბალანსი ამოიწურა'
    message = 'ბალანსი ამოიწურა. თქვენი აქტიური კამპანიები შეჩერებულია. რეკლამის გასაგრძელებლად შეავსეთ ბალანსი.'
  } else if (alert.kind === 'runway_1d') {
    subject = 'Gzad: ბალანსი დაახლოებით ერთი დღის რეკლამას ეყოფა'
    message = 'ბოლო დღეების ხარჯის მიხედვით, ბალანსი დაახლოებით ერთი დღის რეკლამას ეყოფა. კამპანიის შეუფერხებლად გასაგრძელებლად შეავსეთ ბალანსი.'
  } else {
    const pct = Number(alert.detail?.pct)
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return null
    subject = 'Gzad: ბალანსი იწურება'
    message = `ბალანსი ბოლო შევსების შემდეგ არსებული თანხის ${pct}%-მდე შემცირდა. კამპანიის შეუფერხებლად გასაგრძელებლად შეავსეთ ბალანსი.`
  }
  return {
    from,
    to: [client.email],
    subject,
    text: `${message}\n\nდარჩენილი ბალანსი: ₾${balance.toFixed(2)}\n\nბალანსი და ხარჯები: ${new URL('/portal/dashboard/billing', appUrl).toString()}`,
  }
}

/**
 * Drains the low-balance outbox after billing has posted. Nothing is sent until
 * explicitly enabled and configured. Provider failures stay in the outbox and
 * never undo a charge. Claims freeze each payload and serialize overlapping runs.
 */
export async function deliverBillingNotifications(
  supabase: SupabaseClient,
  now = new Date(),
  options: { maxAlerts?: number; budgetMs?: number } = {},
): Promise<BillingNotificationResult> {
  if (typeof window !== 'undefined') throw new Error('Billing email is server-only')
  const result: BillingNotificationResult = { enabled: false, sent: 0, failed: 0, skipped: 0 }
  if (process.env.BILLING_EMAIL_ENABLED !== 'on') return result

  const from = process.env.BILLING_EMAIL_FROM
  let appUrl: URL
  let provider: ReturnType<typeof billingMailProvider>
  try {
    appUrl = new URL(process.env.APP_URL ?? '')
    if (!['https:', 'http:'].includes(appUrl.protocol) || appUrl.username || appUrl.password) throw new Error('Invalid app URL')
    if (!from || /[\r\n]/.test(from)) throw new Error('Email delivery needs BILLING_EMAIL_FROM')
    provider = billingMailProvider()
  } catch (error) {
    return { ...result, reason: error instanceof Error ? error.message : 'Email delivery needs valid sender, provider and APP_URL configuration' }
  }
  result.enabled = true
  const deadline = Date.now() + Math.min(options.budgetMs ?? 45000, 45000)
  const batchSize = Math.max(1, Math.min(options.maxAlerts ?? BATCH_SIZE, 50))

  try {
    const { data, error } = await supabase
      .from('billing_alerts')
      .select('id, kind, balance, detail, clients(email)')
      .in('kind', [...EMAIL_KINDS])
      .is('sent_at', null)
      .is('dismissed_at', null)
      .gte('created_at', new Date(now.getTime() - DAY_MS).toISOString())
      .or(`email_next_attempt_at.is.null,email_next_attempt_at.lte.${now.toISOString()}`)
      .order('created_at')
      .order('id')
      .limit(batchSize)
    if (error) throw new Error(`Reading notification outbox failed: ${error.message}`)

    for (const [index, alert] of ((data ?? []) as PendingAlert[]).entries()) {
      // Stop starting sends with ten seconds left. This is a best-effort
      // budget: SMTP timeouts are per phase/inactivity, not a total deadline.
      // The route's 60-second runtime limit is the final bound. Unprocessed
      // rows stay pending, and an interrupted SMTP claim stays blocked.
      if (Date.now() >= deadline - 10000) break
      try {
        const payload = emailPayload(alert, from, appUrl)
        if (!payload) {
          result.skipped++
          continue
        }
        const { data: claimed, error: claimError } = await supabase.rpc(provider.kind === 'smtp' ? 'claim_billing_alert_smtp' : 'claim_billing_alert_email', {
          p_alert_id: alert.id,
          p_payload: payload,
        })
        if (claimError) throw new Error(`Claiming notification failed: ${claimError.message}`)
        if (!claimed) {
          result.skipped++
          continue
        }
        const claim = claimed as Claim
        // Space this small batch to leave capacity for other transactional mail.
        if (index > 0) await new Promise(resolve => setTimeout(resolve, 600))
        const delivery = await provider.send(claim.payload, alert.id)
        const { error: finishError } = await supabase.rpc(provider.kind === 'smtp' ? 'finish_billing_alert_smtp' : 'finish_billing_alert_email', {
          p_alert_id: alert.id,
          p_claim_token: claim.token,
          p_provider_id: delivery.providerId,
          p_error: delivery.error,
          ...(provider.kind === 'smtp' ? { p_retry_safe: delivery.retrySafe } : {}),
        })
        if (finishError) throw new Error(`Saving email result failed: ${finishError.message}`)
        if (delivery.providerId) result.sent++
        else result.failed++
      } catch (err) {
        result.failed++
        console.error('Billing email delivery failed:', err instanceof Error ? err.message : 'Unknown error')
      }
    }
  } catch (err) {
    result.failed++
    console.error('Billing email delivery failed:', err instanceof Error ? err.message : 'Unknown error')
  }
  return result
}
