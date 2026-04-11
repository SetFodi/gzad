'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useTranslations } from '@/lib/i18n'
import { Megaphone, Car } from 'lucide-react'

type Role = 'client' | 'fleet' | null

export default function SignupPage() {
  const [role, setRole] = useState<Role>(null)
  const [form, setForm] = useState({ email: '', password: '', contact_name: '', phone: '', company_name: '' })
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
        body: JSON.stringify({ ...form, role }),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Signup failed')

      // Auto-login after signup
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      })

      if (loginError) {
        router.push('/portal/login')
        return
      }

      router.push(role === 'fleet' ? '/fleet' : '/portal/dashboard')
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

        {/* Role Selection */}
        {!role && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
            <button
              onClick={() => setRole('client')}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '18px 20px', borderRadius: 12,
                background: 'rgba(255,255,255,0.04)', border: '1px solid #27272a',
                color: '#e4e4e7', cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(204,243,129,0.4)'
                e.currentTarget.style.background = 'rgba(204,243,129,0.06)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#27272a'
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Megaphone size={20} style={{ color: '#60A5FA' }} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>
                  {lang === 'en' ? 'Advertiser' : 'რეკლამის განმთავსებელი'}
                </div>
                <div style={{ fontSize: 13, color: '#71717a' }}>
                  {lang === 'en' ? 'I want to advertise on taxi LEDs' : 'მინდა რეკლამა ტაქსის LED-ებზე'}
                </div>
              </div>
            </button>

            <button
              onClick={() => setRole('fleet')}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '18px 20px', borderRadius: 12,
                background: 'rgba(255,255,255,0.04)', border: '1px solid #27272a',
                color: '#e4e4e7', cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(204,243,129,0.4)'
                e.currentTarget.style.background = 'rgba(204,243,129,0.06)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#27272a'
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: 'rgba(204,243,129,0.1)', border: '1px solid rgba(204,243,129,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Car size={20} style={{ color: '#CCF381' }} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>
                  {lang === 'en' ? 'Fleet Driver' : 'ფლოტის მძღოლი'}
                </div>
                <div style={{ fontSize: 13, color: '#71717a' }}>
                  {lang === 'en' ? 'I have a vehicle and want an LED display' : 'მაქვს მანქანა და მინდა LED ეკრანი'}
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Registration Form */}
        {role && (
          <>
            <button
              onClick={() => { setRole(null); setError('') }}
              style={{
                background: 'none', border: 'none', color: '#71717a',
                fontSize: 13, cursor: 'pointer', marginTop: 16, marginBottom: 4,
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              &larr; {lang === 'en' ? 'Choose different type' : 'აირჩიეთ სხვა ტიპი'}
            </button>

            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 12px', borderRadius: 8, marginBottom: 16,
              background: role === 'fleet' ? 'rgba(204,243,129,0.08)' : 'rgba(96,165,250,0.08)',
              border: `1px solid ${role === 'fleet' ? 'rgba(204,243,129,0.2)' : 'rgba(96,165,250,0.2)'}`,
              fontSize: 13, fontWeight: 500,
              color: role === 'fleet' ? '#CCF381' : '#60A5FA',
            }}>
              {role === 'fleet' ? <Car size={14} /> : <Megaphone size={14} />}
              {role === 'fleet'
                ? (lang === 'en' ? 'Fleet Driver' : 'ფლოტის მძღოლი')
                : (lang === 'en' ? 'Advertiser' : 'რეკლამის განმთავსებელი')
              }
            </div>

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
              {role === 'client' && (
                <div className="portal-input-group">
                  <label htmlFor="company_name">
                    {lang === 'en' ? 'Company Name' : 'კომპანიის სახელი'}
                  </label>
                  <input
                    id="company_name"
                    type="text"
                    value={form.company_name}
                    onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                    placeholder={lang === 'en' ? 'Your company name' : 'კომპანიის სახელი'}
                    required
                  />
                </div>
              )}
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
          </>
        )}

        <p className="portal-login-footer" style={{ marginTop: 20 }}>
          {f.alreadyHaveAccount}{' '}
          <a href="/portal/login" style={{ color: '#CCF381' }}>{f.signIn}</a>
        </p>
      </div>
    </div>
  )
}
