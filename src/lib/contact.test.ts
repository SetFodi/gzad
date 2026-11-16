import { describe, expect, it } from 'vitest'
import { contactEmail, parseContact } from './contact'

const valid = {
  name: '  Nino   Beridze ',
  email: ' Nino@Example.GE ',
  company: 'Puri House',
  phone: '+995 555 12 34 56',
  topic: 'billing',
  message: 'Hello,\r\nI want a refund.',
  lang: 'ge',
}

describe('contact form', () => {
  it('cleans up a valid message', () => {
    const parsed = parseContact(valid)
    expect(parsed).toEqual({
      ok: true,
      value: {
        name: 'Nino Beridze',
        email: 'nino@example.ge',
        company: 'Puri House',
        phone: '+995 555 12 34 56',
        topic: 'billing',
        message: 'Hello,\nI want a refund.',
        lang: 'ge',
      },
    })
  })

  it('names the first field that is wrong', () => {
    expect(parseContact({ ...valid, name: ' ' })).toEqual({ ok: false, field: 'name' })
    expect(parseContact({ ...valid, email: 'nino@' })).toEqual({ ok: false, field: 'email' })
    expect(parseContact({ ...valid, phone: 'call me' })).toEqual({ ok: false, field: 'phone' })
    expect(parseContact({ ...valid, topic: 'spam' })).toEqual({ ok: false, field: 'topic' })
    expect(parseContact({ ...valid, message: 'x' })).toEqual({ ok: false, field: 'message' })
    expect(parseContact({ ...valid, message: 'x'.repeat(4001) })).toEqual({ ok: false, field: 'message' })
    expect(parseContact(null)).toEqual({ ok: false, field: 'name' })
  })

  it('keeps optional fields optional', () => {
    const parsed = parseContact({ ...valid, company: undefined, phone: '' })
    expect(parsed.ok && parsed.value.company).toBe('')
  })

  it('cannot smuggle extra lines into the subject', () => {
    const parsed = parseContact({ ...valid, name: 'Nino\r\nBcc: victim@example.com' })
    if (!parsed.ok) throw new Error('expected valid')
    const mail = contactEmail(parsed.value, { from: 'Gzad <website@gzadvertisement.ge>', to: 'info@gzadvertisement.ge' })
    expect(mail.subject).toBe('Billing or refund: Nino Bcc: victim@example.com (Puri House)')
    expect(mail.subject).not.toMatch(/[\r\n]/)
  })

  it('sends to our inbox and replies to the visitor', () => {
    const parsed = parseContact(valid)
    if (!parsed.ok) throw new Error('expected valid')
    const mail = contactEmail(parsed.value, { from: 'Gzad <website@gzadvertisement.ge>', to: 'info@gzadvertisement.ge' })
    expect(mail.to).toEqual(['info@gzadvertisement.ge'])
    expect(mail.reply_to).toBe('nino@example.ge')
    expect(mail.text).toContain('Language: Georgian')
    expect(mail.text).toContain('Hello,\nI want a refund.')
  })
})
