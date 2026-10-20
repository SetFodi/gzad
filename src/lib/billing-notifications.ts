import type { SupabaseClient } from '@supabase/supabase-js'

// Imported only by the server billing route. Keep the provider key out of client code.
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

interface EmailPayload {
  from: string
  to: string[]
  subject: string
  text: string
}

interface Claim {
  token: string
  payload: EmailPayload
}

export interface BillingNotificationResult {
  enabled: boolean
  sent: number
  failed: number
  skipped: number
  reason?: string
}

function emailPayload(alert: PendingAlert, from: string, appUrl: URL): EmailPayload | null {
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
): Promise<BillingNotificationResult> {
  if (typeof window !== 'undefined') throw new Error('Billing email is server-only')
  const result: BillingNotificationResult = { enabled: false, sent: 0, failed: 0, skipped: 0 }
  if (process.env.BILLING_EMAIL_ENABLED !== 'on') return result

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.BILLING_EMAIL_FROM
  let appUrl: URL
  try {
    appUrl = new URL(process.env.APP_URL ?? '')
    if (!['https:', 'http:'].includes(appUrl.protocol) || appUrl.username || appUrl.password) throw new Error('Invalid app URL')
    if (!apiKey || !from || /[\r\n]/.test(from)) throw new Error('Missing email configuration')
  } catch {
    return { ...result, reason: 'Email delivery needs RESEND_API_KEY, BILLING_EMAIL_FROM and APP_URL' }
  }
  result.enabled = true

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
      .limit(BATCH_SIZE)
    if (error) throw new Error(`Reading notification outbox failed: ${error.message}`)

    for (const [index, alert] of ((data ?? []) as PendingAlert[]).entries()) {
      try {
        const payload = emailPayload(alert, from, appUrl)
        if (!payload) {
          result.skipped++
          continue
        }
        const { data: claimed, error: claimError } = await supabase.rpc('claim_billing_alert_email', {
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
        let providerId: string | null = null
        let sendError: string | null = null
        try {
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'Idempotency-Key': `billing-alert/${alert.id}`,
            },
            body: JSON.stringify(claim.payload),
            signal: AbortSignal.timeout(5000),
          })
          if (!response.ok) throw new Error(`Resend HTTP ${response.status}`)
          const body = await response.json() as { id?: unknown }
          if (typeof body.id !== 'string' || !body.id) throw new Error('Resend response has no email ID')
          providerId = body.id
        } catch (err) {
          sendError = err instanceof Error ? err.message : 'Email request failed'
        }
        const { error: finishError } = await supabase.rpc('finish_billing_alert_email', {
          p_alert_id: alert.id,
          p_claim_token: claim.token,
          p_provider_id: providerId,
          p_error: sendError,
        })
        if (finishError) throw new Error(`Saving email result failed: ${finishError.message}`)
        if (providerId) result.sent++
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
