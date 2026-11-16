// Website contact form: validation and the email our team receives. Pure, so
// the API route stays thin and the rules are tested without sending anything.

export const CONTACT_TOPICS = ['quote', 'billing', 'account', 'fleet', 'other'] as const
export type ContactTopic = typeof CONTACT_TOPICS[number]

export const CONTACT_LIMITS = { name: 100, email: 254, company: 120, phone: 40, message: 4000 } as const

export interface ContactMessage {
  name: string
  email: string
  company: string
  phone: string
  topic: ContactTopic
  message: string
  lang: 'en' | 'ge'
}

export type ContactField = 'name' | 'email' | 'company' | 'phone' | 'topic' | 'message'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isContactTopic(value: unknown): value is ContactTopic {
  return typeof value === 'string' && (CONTACT_TOPICS as readonly string[]).includes(value)
}

/** One line of text: trimmed, inner whitespace (including newlines) collapsed. */
const line = (value: unknown) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '')

export function parseContact(raw: unknown): { ok: true; value: ContactMessage } | { ok: false; field: ContactField } {
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const name = line(body.name)
  const email = line(body.email).toLowerCase()
  const company = line(body.company)
  const phone = line(body.phone)
  const message = typeof body.message === 'string' ? body.message.replace(/\r\n?/g, '\n').trim() : ''

  if (!name || name.length > CONTACT_LIMITS.name) return { ok: false, field: 'name' }
  if (!EMAIL_PATTERN.test(email) || email.length > CONTACT_LIMITS.email) return { ok: false, field: 'email' }
  if (company.length > CONTACT_LIMITS.company) return { ok: false, field: 'company' }
  if (phone.length > CONTACT_LIMITS.phone || (phone && !/^[0-9+()\-.\s]+$/.test(phone))) return { ok: false, field: 'phone' }
  if (!isContactTopic(body.topic)) return { ok: false, field: 'topic' }
  if (message.length < 2 || message.length > CONTACT_LIMITS.message) return { ok: false, field: 'message' }

  return { ok: true, value: { name, email, company, phone, topic: body.topic, message, lang: body.lang === 'en' ? 'en' : 'ge' } }
}

export const CONTACT_TOPIC_NAMES: Record<ContactTopic, string> = {
  quote: 'Campaign enquiry',
  billing: 'Billing or refund',
  account: 'Account or sign-in',
  fleet: 'Fleet partnership',
  other: 'Message',
}

export interface ContactEmail {
  from: string
  to: string[]
  reply_to: string
  subject: string
  text: string
}

/** The email for our inbox. Replying answers the visitor directly. */
export function contactEmail(m: ContactMessage, route: { from: string; to: string }): ContactEmail {
  const who = m.company ? `${m.name} (${m.company})` : m.name
  const topic = CONTACT_TOPIC_NAMES[m.topic]
  return {
    from: route.from,
    to: [route.to],
    reply_to: m.email,
    subject: `${topic}: ${who}`.slice(0, 150),
    text: [
      'New message from the gzad.ge contact form.',
      '',
      `Topic: ${topic}`,
      `Name: ${m.name}`,
      `Email: ${m.email}`,
      `Company: ${m.company || '—'}`,
      `Phone: ${m.phone || '—'}`,
      `Language: ${m.lang === 'ge' ? 'Georgian' : 'English'}`,
      '',
      'Message:',
      m.message,
      '',
      `Reply to this email to answer ${m.name} directly.`,
    ].join('\n'),
  }
}
