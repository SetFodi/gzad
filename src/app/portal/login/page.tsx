'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useTranslations } from '@/lib/i18n'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { t, lang, setLang } = useTranslations()
  const p = t.portal.login

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(p.invalidCredentials)
      setLoading(false)
      return
    }

    router.push('/portal/dashboard')
  }

  return (
    <div className="portal-login-page">
      <div className="portal-login-container">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button
            onClick={() => setLang(lang === 'en' ? 'ge' : 'en')}
            style={{
              background: 'rgba(204,243,129,0.08)', border: '1px solid rgba(204,243,129,0.2)',
              borderRadius: 6, padding: '4px 10px', fontSize: 12, color: '#CCF381',
              cursor: 'pointer', fontWeight: 500,
            }}
          >
            {lang === 'en' ? 'ქართ' : 'ENG'}
          </button>
        </div>
        <div className="portal-login-logo">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="8" width="18" height="10" rx="2" fill="#0A0A0A" />
            <rect x="5" y="10" width="14" height="6" rx="1" fill="#CCF381" />
          </svg>
          <span>Gzad</span>
        </div>
        <h1>{p.title}</h1>
        <p className="portal-login-subtitle">{p.subtitle}</p>

        <form onSubmit={handleLogin} className="portal-login-form">
          {error && <div className="portal-login-error">{error}</div>}
          <div className="portal-input-group">
            <label htmlFor="email">{p.email}</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@company.com"
              required
            />
          </div>
          <div className="portal-input-group">
            <label htmlFor="password">{p.password}</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={lang === 'en' ? 'Enter your password' : 'შეიყვანეთ პაროლი'}
              required
            />
          </div>
          <button type="submit" disabled={loading} className="portal-login-btn">
            {loading ? p.signingIn : p.signIn}
          </button>
        </form>

        <p className="portal-login-footer">
          {p.contactForAccess} <a href="mailto:gzadvertisment@gmail.com">gzadvertisment@gmail.com</a> {p.contactForAccessSuffix}
        </p>
      </div>
    </div>
  )
}
