'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AuthShell, { AuthAlert, AuthSubmit, PasswordInput } from '@/components/auth/AuthShell'
import { useTranslations } from '@/lib/i18n'

// Forgotten password: enter the email, get a code by email, then enter the
// code with a new password (typed twice). Signing in again afterwards is normal.

export default function ResetPasswordForm() {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [mismatch, setMismatch] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [resent, setResent] = useState(false)
  const router = useRouter()
  const { t } = useTranslations()
  const r = t.auth.reset
  const v = t.auth.verification

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(() => setCooldown(c => Math.max(0, c - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  function explain(reason: string, status: number) {
    if (status === 429 || reason === 'TOO_MANY_ATTEMPTS') return v.tooMany
    if (reason === 'INVALID_EMAIL') return r.invalidEmail
    if (reason === 'INVALID_CODE') return v.invalidCode
    if (reason === 'PASSWORD_TOO_SHORT') return r.passwordShort
    if (reason === 'SAME_PASSWORD') return r.samePassword
    if (reason === 'EMAIL_DELIVERY_FAILED') return v.deliveryFailed
    return v.unavailable
  }

  async function sendCode(again = false) {
    setError(''); setLoading(true); setResent(false)
    try {
      const res = await fetch('/api/auth/forgot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(explain(String(data.error ?? ''), res.status)); return }
      setStep('code'); setCooldown(60)
      if (again) setResent(true)
    } catch { setError(v.unavailable) }
    finally { setLoading(false) }
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setMismatch(true); setError(r.mismatch); return }
    setError(''); setMismatch(false); setLoading(true)
    try {
      const res = await fetch('/api/auth/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, code, password }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(explain(String(data.error ?? ''), res.status)); return }
      router.replace(data.next || '/portal/login?reset=1')
    } catch { setError(v.unavailable) }
    finally { setLoading(false) }
  }

  return (
    <AuthShell audience="advertiser">
      <h1 className="auth-title">{r.title}</h1>
      <p className="auth-subtitle">{step === 'email' ? r.subtitle : v.sentTo.replace('{email}', email)}</p>

      {step === 'email' ? (
        <form onSubmit={(e) => { e.preventDefault(); void sendCode() }} className="auth-form">
          {error && <AuthAlert>{error}</AuthAlert>}
          <div className="auth-field">
            <label htmlFor="email" className="auth-label">{t.auth.login.email}</label>
            <input id="email" type="email" className="auth-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.auth.login.emailPlaceholder} autoComplete="email" inputMode="email" autoFocus required aria-invalid={error ? true : undefined} />
          </div>
          <AuthSubmit busy={loading} label={r.sendCode} busyLabel={v.sending} />
        </form>
      ) : (
        <form onSubmit={reset} className="auth-form">
          {error && !mismatch && <AuthAlert>{error}</AuthAlert>}
          <div className="auth-field">
            <label htmlFor="reset-code" className="auth-label">{v.code}</label>
            <input id="reset-code" className="auth-input auth-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" minLength={6} maxLength={10} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} autoFocus required />
            <p className="auth-hint">{r.codeHint}</p>
          </div>
          <div className="auth-field">
            <label htmlFor="new-password" className="auth-label">{r.newPassword}</label>
            <PasswordInput id="new-password" value={password} onChange={(e) => { setPassword(e.target.value); setMismatch(false) }} autoComplete="new-password" minLength={8} required aria-describedby="new-password-hint" />
            <p id="new-password-hint" className="auth-hint">{t.auth.signup.passwordHint}</p>
          </div>
          <div className="auth-field">
            <label htmlFor="confirm-password" className="auth-label">{t.auth.signup.confirmPassword}</label>
            <PasswordInput id="confirm-password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setMismatch(false) }} autoComplete="new-password" minLength={8} required aria-invalid={mismatch ? true : undefined} aria-describedby={mismatch ? 'confirm-error' : undefined} />
            {mismatch && <p id="confirm-error" className="auth-hint auth-hint-error" role="alert">{r.mismatch}</p>}
          </div>
          <AuthSubmit busy={loading} label={r.save} busyLabel={r.saving} />
          <button className="auth-resend" type="button" onClick={() => void sendCode(true)} disabled={loading || cooldown > 0}>
            {cooldown > 0 ? v.resendIn.replace('{seconds}', String(cooldown)) : v.resend}
          </button>
          {resent && <p className="auth-hint" role="status">{v.resent}</p>}
        </form>
      )}

      <p className="auth-switch"><Link href="/portal/login">{v.backToSignIn}</Link></p>
    </AuthShell>
  )
}
