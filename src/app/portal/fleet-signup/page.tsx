'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useTranslations } from '@/lib/i18n'

export default function FleetSignupPage() {
  const [form, setForm] = useState({ email: '', password: '', contact_name: '', phone: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { t, lang, setLang } = useTranslations()
  const f = t.fleet.signup

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/fleet/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Signup failed')

      // Auto-login after signup
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      })

      if (loginError) {
        // Signup succeeded but login failed — send to login page
        router.push('/portal/login')
        return
      }

      router.push('/fleet')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="dark portal-login-page">
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
        <h1>{f.title}</h1>
        <p className="portal-login-subtitle">{f.subtitle}</p>

        <form onSubmit={handleSignup} className="portal-login-form">
          {error && <div className="portal-login-error">{error}</div>}
          <div className="portal-input-group">
            <label htmlFor="contact_name">{f.fullName}</label>
            <input
              id="contact_name"
              type="text"
              value={form.contact_name}
              onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
              placeholder={lang === 'en' ? 'Your full name' : 'სახელი და გვარი'}
              required
            />
          </div>
          <div className="portal-input-group">
            <label htmlFor="email">{f.email}</label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="your@email.com"
              required
            />
          </div>
          <div className="portal-input-group">
            <label htmlFor="phone">{f.phone}</label>
            <input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+995 5XX XXX XXX"
            />
          </div>
          <div className="portal-input-group">
            <label htmlFor="password">{f.password}</label>
            <input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={lang === 'en' ? 'Min. 6 characters' : 'მინ. 6 სიმბოლო'}
              required
              minLength={6}
            />
          </div>
          <button type="submit" disabled={loading} className="portal-login-btn">
            {loading ? f.signingUp : f.signUp}
          </button>
        </form>

        <p className="portal-login-footer">
          {f.alreadyHaveAccount}{' '}
          <a href="/portal/login" style={{ color: '#CCF381' }}>{f.signIn}</a>
        </p>
      </div>
    </div>
  )
}
