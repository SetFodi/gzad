'use client'

import { useState, type InputHTMLAttributes, type ReactNode } from 'react'
import Link from 'next/link'
import { AlertCircle, Check, Eye, EyeOff } from 'lucide-react'
import { useTranslations } from '@/lib/i18n'
import AuthScreen, { type AuthAd } from './AuthScreen'
import '@/app/portal/auth.css'

export type AuthAudience = 'advertiser' | 'fleet'

/** Split layout for sign-in and sign-up: the form on white, a night panel with a roof screen beside it. */
export default function AuthShell({ audience, children }: { audience: AuthAudience; children: ReactNode }) {
  const { t, lang, setLang } = useTranslations()
  const a = t.auth
  const panel = a.panel[audience]

  return (
    <div className="auth" lang={lang === 'ge' ? 'ka' : 'en'}>
      <div className="auth-main">
        <header className="auth-top">
          <Link href="/" className="auth-logo" aria-label={a.backToSite}>
            <span className="auth-logo-mark" aria-hidden />
            gzad
          </Link>
          <div className="auth-lang" role="group" aria-label={a.language}>
            <button type="button" lang="en" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>
              EN
            </button>
            <button type="button" lang="ka" aria-pressed={lang === 'ge'} onClick={() => setLang('ge')}>
              ქა
            </button>
          </div>
        </header>

        <main className="auth-body">
          <div className="auth-card">{children}</div>
        </main>

        <footer className="auth-foot">
          <span>© Gzad</span>
          <Link href="/terms">{a.terms}</Link>
          <Link href="/privacy">{a.privacy}</Link>
        </footer>
      </div>

      <aside className="auth-aside">
        <div className="auth-aside-screen">
          <AuthScreen ads={a.ads as AuthAd[]} />
          <p className="auth-sample">{a.panel.sample}</p>
        </div>
        <div className="auth-aside-copy">
          <h2 className="auth-aside-title">{panel.title}</h2>
          <ul className="auth-points">
            {panel.points.map((point) => (
              <li key={point}>
                <Check size={18} strokeWidth={2.4} aria-hidden />
                {point}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  )
}

export function AuthAlert({ children }: { children: ReactNode }) {
  return (
    <div className="auth-alert" role="alert">
      <AlertCircle size={18} aria-hidden />
      <span>{children}</span>
    </div>
  )
}

export function AuthSubmit({ busy, label, busyLabel }: { busy: boolean; label: string; busyLabel: string }) {
  return (
    <button type="submit" className="auth-btn" disabled={busy} aria-busy={busy}>
      {busy && <span className="auth-spinner" aria-hidden />}
      {busy ? busyLabel : label}
    </button>
  )
}

/** Password input with a show/hide toggle. */
export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const { t } = useTranslations()
  const [visible, setVisible] = useState(false)

  return (
    <div className="auth-input-wrap">
      <input {...props} type={visible ? 'text' : 'password'} className="auth-input" />
      <button
        type="button"
        className="auth-reveal"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t.auth.hidePassword : t.auth.showPassword}
        aria-pressed={visible}
      >
        {visible ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
      </button>
    </div>
  )
}
