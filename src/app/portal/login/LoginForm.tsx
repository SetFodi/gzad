'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from '@/lib/i18n'
import AuthShell, { AuthAlert, AuthSubmit, PasswordInput } from '@/components/auth/AuthShell'

const SUPPORT_EMAIL = 'gzadvertisment@gmail.com'

export default function LoginForm({ linkFailed, emailVerified }: { linkFailed: boolean; emailVerified: boolean }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { t } = useTranslations()
  const p = t.auth.login

  const message = error || (linkFailed ? p.linkFailed : '')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/signin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
      const result = await res.json()
      if (!res.ok) {
        const v = t.auth.verification
        setError(result.error === 'AUTH_SETUP_REQUIRED' ? v.setupRequired : result.error === 'EMAIL_DELIVERY_FAILED' ? v.deliveryFailed : res.status === 429 ? v.tooMany : result.error === 'INVALID_CREDENTIALS' ? p.invalidCredentials : v.unavailable)
        return
      }
      router.push(result.next)
      router.refresh()
    } catch { setError(t.auth.verification.unavailable) }
    finally { setLoading(false) }
  }

  return (
    <AuthShell audience="advertiser">
      <h1 className="auth-title">{p.title}</h1>
      <p className="auth-subtitle">{p.subtitle}</p>
      {emailVerified && <p className="auth-success" role="status">{t.auth.verification.signupComplete}</p>}

      <form onSubmit={handleLogin} className="auth-form">
        {message && <AuthAlert>{message}</AuthAlert>}

        <div className="auth-field">
          <label htmlFor="email" className="auth-label">{p.email}</label>
          <input
            id="email"
            type="email"
            className="auth-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={p.emailPlaceholder}
            autoComplete="email"
            inputMode="email"
            autoFocus
            required
            aria-invalid={error ? true : undefined}
          />
        </div>

        <div className="auth-field">
          <div className="auth-label-row">
            <label htmlFor="password" className="auth-label">{p.password}</label>
            <a
              className="auth-label-link"
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Password reset')}`}
            >
              {p.forgot}
            </a>
          </div>
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={p.passwordPlaceholder}
            autoComplete="current-password"
            required
            aria-invalid={error ? true : undefined}
          />
        </div>

        <AuthSubmit busy={loading} label={p.signIn} busyLabel={p.signingIn} />
      </form>

      <p className="auth-switch">
        {p.noAccount} <Link href="/portal/fleet-signup">{p.createAccount}</Link>
      </p>
      <p className="auth-help">
        {p.help} <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </AuthShell>
  )
}
