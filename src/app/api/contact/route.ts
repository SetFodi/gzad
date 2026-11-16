import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { checkOrigin } from '@/lib/auth/challenge'
import { allowRequest, clientIp } from '@/lib/rate-limit'
import { contactEmail, parseContact } from '@/lib/contact'
import { contactNotificationHtml } from '@/lib/email/messages'

// Website contact form. Sends one email to our inbox through Resend with the
// visitor as Reply-To. Nothing is sent to the visitor, so the form can't be
// used to deliver mail to an address someone else typed in.
const MESSAGES_PER_IP = 5
const WINDOW_SECONDS = 60 * 60
// Humans take longer than this to fill the form; most bots don't.
const MIN_FILL_MS = 3000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const reply = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export async function POST(request: NextRequest) {
  try {
    checkOrigin(request)
  } catch {
    return reply({ error: 'INVALID_ORIGIN' }, 403)
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return reply({ error: 'INVALID', field: 'message' }, 400)

  // Hidden field and fill time: answer like a success so bots learn nothing.
  const startedAt = typeof body.startedAt === 'number' ? body.startedAt : 0
  if ((typeof body.website === 'string' && body.website.trim()) || Date.now() - startedAt < MIN_FILL_MS) {
    return reply({ ok: true })
  }

  const parsed = parseContact(body)
  if (!parsed.ok) return reply({ error: 'INVALID', field: parsed.field }, 400)

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('Contact form: RESEND_API_KEY is not set')
    return reply({ error: 'NOT_CONFIGURED' }, 503)
  }

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  if (!(await allowRequest(admin, `contact:${clientIp(request)}`, MESSAGES_PER_IP, WINDOW_SECONDS))) {
    return reply({ error: 'TOO_MANY' }, 429)
  }

  const mail = {
    ...contactEmail(parsed.value, {
      from: process.env.CONTACT_EMAIL_FROM || '"გზად | Gzad" <website@gzadvertisement.ge>',
      to: process.env.CONTACT_EMAIL_TO || 'info@gzadvertisement.ge',
    }),
    html: contactNotificationHtml(parsed.value, process.env.APP_URL || 'https://gzadvertisement.ge'),
  }
  // A retried submit of the same form doesn't send twice.
  const id = typeof body.id === 'string' && UUID.test(body.id) ? body.id : crypto.randomUUID()

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `contact/${id}`,
      },
      body: JSON.stringify(mail),
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) {
      console.error(`Contact form: Resend HTTP ${response.status}`)
      return reply({ error: 'SEND_FAILED' }, 502)
    }
  } catch (error) {
    console.error('Contact form: Resend request failed', error instanceof Error ? error.message : error)
    return reply({ error: 'SEND_FAILED' }, 502)
  }

  return reply({ ok: true })
}
