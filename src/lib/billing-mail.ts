import nodemailer from 'nodemailer'

export interface BillingMail {
  from: string
  to: string[]
  subject: string
  text: string
}

interface Delivery {
  providerId: string | null
  error: string | null
  retrySafe: boolean
}

interface BillingMailProvider {
  kind: 'resend' | 'smtp'
  send(mail: BillingMail, alertId: string): Promise<Delivery>
}

/** Server-only provider configuration. No network request is made until send. */
export function billingMailProvider(): BillingMailProvider {
  if (typeof window !== 'undefined') throw new Error('Billing mail is server-only')
  const provider = process.env.BILLING_EMAIL_PROVIDER || 'resend'
  if (provider === 'resend') {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) throw new Error('Resend delivery needs RESEND_API_KEY')
    return {
      kind: 'resend',
      async send(mail, alertId) {
        try {
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'Idempotency-Key': `billing-alert/${alertId}`,
            },
            body: JSON.stringify(mail),
            signal: AbortSignal.timeout(5000),
          })
          if (!response.ok) throw new Error(`Resend HTTP ${response.status}`)
          const body = await response.json() as { id?: unknown }
          if (typeof body.id !== 'string' || !body.id) throw new Error('Resend response has no email ID')
          return { providerId: body.id, error: null, retrySafe: true }
        } catch (error) {
          return { providerId: null, error: error instanceof Error ? error.message : 'Resend request failed', retrySafe: true }
        }
      },
    }
  }
  if (provider !== 'smtp') throw new Error('BILLING_EMAIL_PROVIDER must be resend or smtp')

  const host = process.env.BILLING_SMTP_HOST
  const port = Number(process.env.BILLING_SMTP_PORT || '465')
  const user = process.env.BILLING_SMTP_USER
  const pass = process.env.BILLING_SMTP_PASS
  if (!host || !/^[a-z0-9.-]+$/i.test(host) || ![465, 587].includes(port) || !user || !pass) {
    throw new Error('SMTP delivery needs BILLING_SMTP_HOST, PORT (465 or 587), USER and PASS')
  }
  const transport = nodemailer.createTransport({
    host, port,
    secure: port === 465,
    requireTLS: true,
    tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true, servername: host },
    auth: { user, pass },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
    dnsTimeout: 5000,
    disableFileAccess: true,
    disableUrlAccess: true,
    logger: false,
    debug: false,
  })
  return {
    kind: 'smtp',
    async send(mail, alertId) {
      try {
        const info = await transport.sendMail({
          ...mail,
          messageId: `<billing-alert.${alertId}@gzad.local>`,
        })
        if (info.accepted.length !== 1 || info.rejected.length !== 0) {
          return { providerId: null, error: 'SMTP recipient was not accepted', retrySafe: false }
        }
        return { providerId: info.messageId, error: null, retrySafe: false }
      } catch (error) {
        const smtp = error as { code?: string; command?: string; responseCode?: number; syscall?: string }
        // A socket error after DATA can also be labeled CONN. Only explicit
        // pre-DATA failures prove the server could not have accepted the mail.
        const retrySafe = ['EDNS', 'EAUTH', 'ETLS'].includes(smtp.code || '')
          || ['EHLO', 'HELO', 'STARTTLS', 'MAIL FROM', 'RCPT TO'].includes(smtp.command || '')
          || smtp.syscall === 'connect'
        const code = /^[A-Z_]+$/.test(smtp.code || '') ? smtp.code : 'ERROR'
        const status = Number.isInteger(smtp.responseCode) ? ` ${smtp.responseCode}` : ''
        return { providerId: null, error: `SMTP ${code}${status}${retrySafe ? '' : '; delivery uncertain, manual review required'}`, retrySafe }
      } finally {
        transport.close()
      }
    },
  }
}
