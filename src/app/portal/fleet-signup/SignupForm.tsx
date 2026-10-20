'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Car, Megaphone } from 'lucide-react'
import { useTranslations } from '@/lib/i18n'
import AuthShell, { AuthAlert, AuthSubmit, PasswordInput } from '@/components/auth/AuthShell'

export type SignupRole = 'client' | 'fleet'

type Field = 'email' | 'password' | 'company_name'

export default function SignupForm({ initialRole, verificationReady }: { initialRole: SignupRole; verificationReady: boolean }) {
  const [role, setRole] = useState<SignupRole>(initialRole)
  const [form, setForm] = useState({ email: '', password: '', contact_name: '', phone: '', company_name: '' })
  const [error, setError] = useState<{ text: string; field?: Field } | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { t } = useTranslations()
  const f = t.auth.signup

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value })

  // The API answers in English; show the reader's language instead.
  const explain = (status: number, message: string): { text: string; field?: Field } => {
    const m = message.toLowerCase()
    if (status === 429) return { text: f.errors.tooMany }
    if (message === 'AUTH_SETUP_REQUIRED') return { text: t.auth.verification.setupRequired }
    if (message === 'EMAIL_DELIVERY_FAILED') return { text: t.auth.verification.deliveryFailed }
    if (m.includes('already') || m.includes('registered') || m.includes('exists')) return { text: f.errors.emailTaken, field: 'email' }
    if (m.includes('email')) return { text: f.errors.invalidEmail, field: 'email' }
    if (m.includes('password')) return { text: f.errors.passwordShort, field: 'password' }
    if (m.includes('company')) return { text: f.errors.companyRequired, field: 'company_name' }
    return { text: f.errors.generic }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/fleet/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, company_name: role === 'client' ? form.company_name : '', role }),
      })

      const result = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(explain(res.status, String(result.error ?? '')))
        return
      }

      router.push('/portal/verify')
    } catch {
      setError({ text: f.errors.generic })
    } finally {
      setLoading(false)
    }
  }

  const invalid = (field: Field) => (error?.field === field ? true : undefined)

  const roles = [
    { value: 'client' as const, title: f.advertiser, hint: f.advertiserHint, Icon: Megaphone },
    { value: 'fleet' as const, title: f.fleet, hint: f.fleetHint, Icon: Car },
  ]

  if (!verificationReady) {
    return (
      <AuthShell audience={role === 'fleet' ? 'fleet' : 'advertiser'}>
        <h1 className="auth-title">{f.title}</h1>
        <p className="auth-subtitle">{f.registrationPending}</p>
        <a className="auth-btn" href="mailto:gzadvertisment@gmail.com">{f.contactUs}</a>
        <p className="auth-switch">{f.alreadyHaveAccount} <Link href="/portal/login">{f.signIn}</Link></p>
      </AuthShell>
    )
  }

  return (
    <AuthShell audience={role === 'fleet' ? 'fleet' : 'advertiser'}>
      <h1 className="auth-title">{f.title}</h1>
      <p className="auth-subtitle">{f.subtitle}</p>

      <form onSubmit={handleSignup} className="auth-form">
        <fieldset className="auth-roles">
          <legend>{f.roleLabel}</legend>
          {roles.map(({ value, title, hint, Icon }) => (
            <label key={value} className="auth-role">
              <input
                type="radio"
                name="role"
                value={value}
                checked={role === value}
                onChange={() => { setRole(value); setError(null) }}
              />
              <span className="auth-role-icon" aria-hidden><Icon size={16} /></span>
              <span className="auth-role-title">{title}</span>
              <span className="auth-role-hint">{hint}</span>
            </label>
          ))}
        </fieldset>

        {error && <AuthAlert>{error.text}</AuthAlert>}

        <div className="auth-field">
          <label htmlFor="contact_name" className="auth-label">{f.fullName}</label>
          <input
            id="contact_name"
            type="text"
            className="auth-input"
            value={form.contact_name}
            onChange={set('contact_name')}
            placeholder={f.fullNamePlaceholder}
            autoComplete="name"
            required
          />
        </div>

        {role === 'client' && (
          <div className="auth-field">
            <label htmlFor="company_name" className="auth-label">{f.company}</label>
            <input
              id="company_name"
              type="text"
              className="auth-input"
              value={form.company_name}
              onChange={set('company_name')}
              placeholder={f.companyPlaceholder}
              autoComplete="organization"
              required
              aria-invalid={invalid('company_name')}
            />
          </div>
        )}

        <div className="auth-field">
          <label htmlFor="email" className="auth-label">{f.email}</label>
          <input
            id="email"
            type="email"
            className="auth-input"
            value={form.email}
            onChange={set('email')}
            placeholder={f.emailPlaceholder}
            autoComplete="email"
            inputMode="email"
            required
            aria-invalid={invalid('email')}
          />
        </div>

        <div className="auth-field">
          <label htmlFor="phone" className="auth-label">
            {f.phone}
            <span className="auth-optional">{f.optional}</span>
          </label>
          <input
            id="phone"
            type="tel"
            className="auth-input"
            value={form.phone}
            onChange={set('phone')}
            placeholder="+995 5XX XXX XXX"
            autoComplete="tel"
            inputMode="tel"
          />
        </div>

        <div className="auth-field">
          <label htmlFor="password" className="auth-label">{f.password}</label>
          <PasswordInput
            id="password"
            value={form.password}
            onChange={set('password')}
            autoComplete="new-password"
            minLength={8}
            required
            aria-invalid={invalid('password')}
            aria-describedby="password-hint"
          />
          <p id="password-hint" className="auth-hint">{f.passwordHint}</p>
        </div>

        <AuthSubmit busy={loading} label={f.signUp} busyLabel={f.signingUp} />

        <p className="auth-legal">
          {f.agree} <Link href="/terms">{t.auth.terms}</Link> {f.and} <Link href="/privacy">{t.auth.privacy}</Link>.
        </p>
      </form>

      <p className="auth-switch">
        {f.alreadyHaveAccount} <Link href="/portal/login">{f.signIn}</Link>
      </p>
    </AuthShell>
  )
}
