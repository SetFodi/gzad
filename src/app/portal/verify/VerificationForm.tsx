'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AuthShell, { AuthAlert, AuthSubmit } from '@/components/auth/AuthShell'
import { useTranslations } from '@/lib/i18n'

export default function VerificationForm() {
  const [challenge, setChallenge] = useState<{ email: string; purpose: 'signup' | 'signin' } | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [expired, setExpired] = useState(false)
  const [loading, setLoading] = useState(true)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [resent, setResent] = useState(false)
  const { t } = useTranslations()
  const v = t.auth.verification
  const router = useRouter()

  useEffect(() => {
    let active = true
    fetch('/api/auth/challenge').then(async res => {
      const data = await res.json()
      if (!active) return
      if (!res.ok) {
        setExpired(true)
        setError(data.error === 'AUTH_SETUP_REQUIRED' ? v.setupRequired : v.expired)
      } else { setChallenge(data); setCooldown(data.resendAfter) }
    }).catch(() => { if (active) setError(v.unavailable) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [v.expired, v.setupRequired, v.unavailable])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(() => setCooldown(c => Math.max(0, c - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  function explain(reason: string) {
    if (reason === 'CHALLENGE_EXPIRED') { setExpired(true); return v.expired }
    if (reason === 'AUTH_SETUP_REQUIRED') return v.setupRequired
    if (reason === 'TOO_MANY_ATTEMPTS' || reason === 'WAIT_TO_RESEND') return v.tooMany
    if (reason === 'EMAIL_DELIVERY_FAILED') return v.deliveryFailed
    if (reason === 'INVALID_CODE') return v.invalidCode
    return v.unavailable
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res = await fetch('/api/auth/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) })
      const data = await res.json()
      if (!res.ok) { setError(explain(data.error)); return }
      router.replace(data.next)
      router.refresh()
    } catch { setError(v.unavailable) }
    finally { setLoading(false) }
  }

  async function resend() {
    setError(''); setResending(true); setResent(false)
    try {
      const res = await fetch('/api/auth/resend', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(explain(data.error)); return }
      setCooldown(60); setResent(true)
    } catch { setError(v.unavailable) }
    finally { setResending(false) }
  }

  return (
    <AuthShell audience="advertiser">
      <h1 className="auth-title">{challenge?.purpose === 'signin' ? v.signinTitle : v.signupTitle}</h1>
      <p className="auth-subtitle">{challenge ? v.sentTo.replace('{email}', challenge.email) : loading ? v.loading : v.startAgainHint}</p>
      {error && <AuthAlert>{error}</AuthAlert>}
      {challenge && !expired && (
        <form onSubmit={verify} className="auth-form">
          <div className="auth-field">
            <label htmlFor="verification-code" className="auth-label">{v.code}</label>
            <input id="verification-code" className="auth-input auth-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" minLength={6} maxLength={10} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} autoFocus required aria-invalid={error ? true : undefined} aria-describedby="verification-hint" />
            <p id="verification-hint" className="auth-hint">{challenge.purpose === 'signin' ? v.trustHint : v.signupHint}</p>
          </div>
          <AuthSubmit busy={loading} label={v.verify} busyLabel={v.verifying} />
          <button className="auth-resend" type="button" onClick={resend} disabled={resending || cooldown > 0 || loading}>
            {resending ? v.sending : cooldown > 0 ? v.resendIn.replace('{seconds}', String(cooldown)) : v.resend}
          </button>
          {resent && <p className="auth-hint" role="status">{v.resent}</p>}
        </form>
      )}
      <p className="auth-switch"><Link href="/portal/login">{v.backToSignIn}</Link></p>
    </AuthShell>
  )
}
