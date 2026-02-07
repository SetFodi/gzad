'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Invalid email or password')
      setLoading(false)
      return
    }

    router.push('/portal/dashboard')
  }

  return (
    <div className="portal-login-page">
      <div className="portal-login-container">
        <div className="portal-login-logo">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="8" width="18" height="10" rx="2" fill="#0A0A0A" />
            <rect x="5" y="10" width="14" height="6" rx="1" fill="#CCF381" />
          </svg>
          <span>Gzad</span>
        </div>
        <h1>Client Portal</h1>
        <p className="portal-login-subtitle">Sign in to view your campaigns and analytics</p>

        <form onSubmit={handleLogin} className="portal-login-form">
          {error && <div className="portal-login-error">{error}</div>}
          <div className="portal-input-group">
            <label htmlFor="email">Email</label>
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
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>
          <button type="submit" disabled={loading} className="portal-login-btn">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="portal-login-footer">
          Contact <a href="mailto:gzadvertisment@gmail.com">gzadvertisment@gmail.com</a> for access
        </p>
      </div>
    </div>
  )
}
