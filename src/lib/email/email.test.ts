import { readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { button } from './layout'
import { authTemplate, billingAlertEmail, contactNotificationHtml, type AuthEmailKind } from './messages'

// Supabase sends the code emails from the files in supabase/templates. They are
// rendered from messages.ts; regenerate with UPDATE_EMAIL_TEMPLATES=1 npx vitest run.
const TEMPLATE_FILES: Record<AuthEmailKind, string> = {
  signin: 'supabase/templates/magic_link.html',
  signup: 'supabase/templates/confirmation.html',
  recovery: 'supabase/templates/recovery.html',
}

describe('emails', () => {
  it.each(Object.entries(TEMPLATE_FILES) as [AuthEmailKind, string][])('keeps the %s template in sync', (kind, file) => {
    const html = authTemplate(kind)
    expect(html.match(/\{\{ \.Token \}\}/g)).toHaveLength(1)
    expect(html).toContain('{{ .SiteURL }}/privacy')
    if (process.env.UPDATE_EMAIL_TEMPLATES) writeFileSync(file, html)
    expect(readFileSync(file, 'utf8')).toBe(html)
  })

  it('escapes what visitors type into the contact form', () => {
    const html = contactNotificationHtml({
      name: '<img src=x onerror=alert(1)>', email: 'a@b.ge', company: '', phone: '',
      topic: 'other', message: '<script>alert(1)</script>\nsecond line', lang: 'en',
    }, 'https://gzadvertisement.ge')
    expect(html).not.toContain('<script>alert')
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;\nsecond line')
    expect(html).toContain('href="mailto:a@b.ge?subject=Re%3A%20Message"')
  })

  it('refuses links that aren’t web or email addresses', () => {
    expect(() => button('javascript:alert(1)', 'Click')).toThrow('Unsafe email link')
  })

  it('shows the balance and links to billing in both languages', () => {
    const mail = billingAlertEmail({ kind: 'depleted', balance: 0, billingUrl: 'https://gzadvertisement.ge/portal/dashboard/billing', siteUrl: 'https://gzadvertisement.ge' })
    expect(mail.subject).toBe('Gzad: ბალანსი ამოიწურა / Your balance has run out')
    expect(mail.html).toContain('₾0.00')
    expect(mail.html).toContain('href="https://gzadvertisement.ge/portal/dashboard/billing"')
    expect(mail.html).toContain('lang="en"')
    expect(mail.text).toContain('Balance left: ₾0.00')
  })
})
