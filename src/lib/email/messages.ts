import { CONTACT_TOPIC_NAMES, type ContactMessage } from '@/lib/contact'
import { COMPANY_FOOTER, button, code, divider, eyebrow, facts, heading, inLanguage, paragraph, quote, renderEmail, stat } from './layout'

// Every email Gzad sends, in Georgian first and English second. Supabase sends
// the code emails from templates rendered here (see auth-templates.test.ts).

export interface RenderedEmail {
  subject: string
  text: string
  html: string
}

// ── One-time codes (Supabase Auth templates) ─────────────────────────────────

export type AuthEmailKind = 'signin' | 'signup' | 'recovery'

const AUTH_COPY: Record<AuthEmailKind, { subject: string; ka: [string, string, string]; en: [string, string, string]; eyebrow: string }> = {
  signin: {
    subject: 'Gzad: შესვლის კოდი / Your sign-in code',
    eyebrow: 'შესვლა · Sign in',
    ka: [
      'თქვენი შესვლის კოდი',
      'Gzad-ში შესასვლელად შეიყვანეთ ეს კოდი. ის მოქმედებს 10 წუთის განმავლობაში.',
      'თუ შესვლა არ გიცდიათ, შესაძლოა ვინმემ თქვენი პაროლი იცოდეს. კოდი არავის გაუზიაროთ და დაგვიკავშირდით, რომ ანგარიში დავიცვათ.',
    ],
    en: [
      'Your sign-in code',
      'Enter the code above to sign in to Gzad. It works for 10 minutes.',
      'If you didn’t try to sign in, someone may know your password. Don’t share the code, and contact us so we can secure your account.',
    ],
  },
  signup: {
    subject: 'Gzad: დაადასტურეთ ელ-ფოსტა / Confirm your email',
    eyebrow: 'რეგისტრაცია · Sign up',
    ka: [
      'დაადასტურეთ ელ-ფოსტა',
      'Gzad-ის ანგარიშის შექმნის დასასრულებლად შეიყვანეთ ეს კოდი. ის მოქმედებს 10 წუთის განმავლობაში.',
      'თუ ანგარიში არ შეგიქმნიათ, ეს წერილი უგულებელყავით. კოდი არავის გაუზიაროთ.',
    ],
    en: [
      'Confirm your email',
      'Enter the code above to finish creating your Gzad account. It works for 10 minutes.',
      'If you didn’t create an account, ignore this email. Don’t share the code.',
    ],
  },
  recovery: {
    subject: 'Gzad: პაროლის აღდგენა / Reset your password',
    eyebrow: 'პაროლი · Password',
    ka: [
      'პაროლის აღდგენა',
      'ახალი პაროლის დასაყენებლად შეიყვანეთ ეს კოდი.',
      'თუ პაროლის აღდგენა არ მოგითხოვიათ, ეს წერილი უგულებელყავით — პაროლი არ შეიცვლება. კოდი არავის გაუზიაროთ.',
    ],
    en: [
      'Reset your password',
      'Enter the code above to set a new password.',
      'If you didn’t ask to reset your password, ignore this email and your password stays the same. Don’t share the code.',
    ],
  },
}

/** The subject to set in the Supabase dashboard for each template. */
export const AUTH_SUBJECTS: Record<AuthEmailKind, string> = {
  signin: AUTH_COPY.signin.subject,
  signup: AUTH_COPY.signup.subject,
  recovery: AUTH_COPY.recovery.subject,
}

/** HTML for a Supabase Auth template; {{ .Token }} and {{ .SiteURL }} are filled by Supabase. */
export function authTemplate(kind: AuthEmailKind): string {
  const c = AUTH_COPY[kind]
  return renderEmail({
    lang: 'ka',
    title: c.subject,
    preheader: `${c.ka[0]} · ${c.en[0]}`,
    siteUrl: '{{ .SiteURL }}',
    body: [
      inLanguage('ka', [eyebrow(c.eyebrow), heading(c.ka[0]), paragraph(c.ka[1])]),
      code('{{ .Token }}', { trusted: true }),
      inLanguage('ka', [paragraph(c.ka[2], 'muted')]),
      divider(),
      inLanguage('en', [heading(c.en[0], 'small'), paragraph(c.en[1]), paragraph(c.en[2], 'muted')]),
    ],
    footer: [COMPANY_FOOTER, 'ეს წერილი ავტომატურად გაიგზავნა. · This email was sent automatically.'],
  })
}

// ── Billing alerts ───────────────────────────────────────────────────────────

export type BillingAlertKind = 'low_20pct' | 'runway_1d' | 'depleted'

export function billingAlertEmail(alert: { kind: BillingAlertKind; balance: number; pct?: number; billingUrl: string; siteUrl: string }): RenderedEmail {
  const balance = `₾${alert.balance.toFixed(2)}`
  const copy = alert.kind === 'depleted'
    ? {
      subject: 'Gzad: ბალანსი ამოიწურა / Your balance has run out',
      ka: ['ბალანსი ამოიწურა', 'თქვენი აქტიური კამპანიები შეჩერებულია. რეკლამის გასაგრძელებლად შეავსეთ ბალანსი.'],
      en: ['Your balance has run out', 'Your active campaigns are paused. Top up your balance to keep your ads running.'],
    }
    : alert.kind === 'runway_1d'
      ? {
        subject: 'Gzad: ბალანსი დაახლოებით ერთი დღით დარჩა / About a day of ads left',
        ka: ['ბალანსი დაახლოებით ერთი დღით დარჩა', 'ბოლო დღეების ხარჯის მიხედვით, ბალანსი დაახლოებით ერთი დღის რეკლამას ეყოფა. კამპანიის შეუფერხებლად გასაგრძელებლად შეავსეთ ბალანსი.'],
        en: ['About a day of ads left', 'Based on recent spending, your balance covers about one more day of ads. Top up to keep your campaign running without a break.'],
      }
      : {
        subject: 'Gzad: ბალანსი იწურება / Your balance is running low',
        ka: ['ბალანსი იწურება', `ბალანსი ბოლო შევსების შემდეგ არსებული თანხის ${alert.pct}%-მდე შემცირდა. კამპანიის შეუფერხებლად გასაგრძელებლად შეავსეთ ბალანსი.`],
        en: ['Your balance is running low', `Your balance has dropped to ${alert.pct}% of what you had after your last top-up. Top up to keep your campaign running without a break.`],
      }

  const html = renderEmail({
    lang: 'ka',
    title: copy.subject,
    preheader: `${copy.ka[0]}: ${balance}`,
    siteUrl: alert.siteUrl,
    body: [
      inLanguage('ka', [eyebrow('ბალანსი · Balance'), heading(copy.ka[0]), paragraph(copy.ka[1])]),
      stat('დარჩენილი ბალანსი · Balance left', balance, alert.kind === 'depleted' ? 'warning' : 'accent'),
      button(alert.billingUrl, 'ბალანსის შევსება · Top up'),
      divider(),
      inLanguage('en', [heading(copy.en[0], 'small'), paragraph(copy.en[1])]),
    ],
    footer: [COMPANY_FOOTER, 'ამ შეტყობინებებს იღებთ, რადგან Gzad-ზე აქტიური სარეკლამო ანგარიში გაქვთ. · You get these alerts because you have an active Gzad advertising account.'],
  })

  const text = [
    copy.ka[0], copy.ka[1], '', `დარჩენილი ბალანსი: ${balance}`, '',
    copy.en[0], copy.en[1], '', `Balance left: ${balance}`, '',
    `ბალანსი და ხარჯები / Balance and spending: ${alert.billingUrl}`,
  ].join('\n')

  return { subject: copy.subject, text, html }
}

// ── Contact form (to our inbox) ──────────────────────────────────────────────

export function contactNotificationHtml(m: ContactMessage, siteUrl: string): string {
  const topic = CONTACT_TOPIC_NAMES[m.topic]
  const replyHref = `mailto:${m.email}?subject=${encodeURIComponent(`Re: ${topic}`)}`
  return renderEmail({
    lang: 'en',
    title: `${topic}: ${m.name}`,
    preheader: m.message.slice(0, 120),
    siteUrl,
    body: [
      eyebrow(`Website contact form · ${topic}`),
      heading(m.company ? `${m.name} (${m.company})` : m.name),
      facts([
        ['Email', m.email],
        ['Phone', m.phone || '—'],
        ['Company', m.company || '—'],
        ['Language', m.lang === 'ge' ? 'Georgian' : 'English'],
      ]),
      quote(m.message),
      button(replyHref, `Reply to ${m.name.split(' ')[0]}`),
      paragraph(`Replying to this email also goes straight to ${m.email}.`, 'muted'),
    ],
    footer: [COMPANY_FOOTER, 'Sent from the contact form on gzad.ge.'],
  })
}

