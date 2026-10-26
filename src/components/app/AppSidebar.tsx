'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut, Menu, X, type LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from '@/lib/i18n'
import ThemeSwitch from './ThemeSwitch'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** Only active on this exact path (for section roots like /admin). */
  exact?: boolean
}

export interface NavSection {
  title?: string
  items: NavItem[]
}

interface Account {
  name: string
  email: string
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)
  return letters.toUpperCase()
}

/**
 * The app's navigation, shared by the client portal, admin and fleet areas:
 * a fixed sidebar on desktop, a top bar with a slide-over drawer below 1024px.
 */
export default function AppSidebar({
  area,
  sections,
  primaryAction,
  links = [],
  language = false,
  signOutLabel,
}: {
  area?: string
  sections: NavSection[]
  primaryAction?: NavItem
  links?: NavItem[]
  language?: boolean
  signOutLabel: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { lang, setLang } = useTranslations()
  const [open, setOpen] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [account, setAccount] = useState<Account | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState(false)
  const drawerRef = useRef<HTMLElement>(null)
  const menuRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)')
    const update = () => {
      setMobile(media.matches)
      if (!media.matches) setOpen(false)
    }
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('clients')
        .select('company_name, contact_name, email')
        .eq('auth_user_id', user.id)
        .single()
      if (cancelled) return
      setAccount({
        name: data?.company_name || data?.contact_name || user.email || '',
        email: data?.email || user.email || '',
      })
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Keep keyboard and screen-reader focus inside the open phone drawer.
  useEffect(() => {
    if (!open || !mobile) return
    const drawer = drawerRef.current
    if (!drawer) return
    const opener = menuRef.current
    const previous = document.body.style.overflow
    const main = document.querySelector<HTMLElement>('.portal-main')
    const wasInert = main?.inert ?? false
    document.body.style.overflow = 'hidden'
    if (main) main.inert = true
    const focusFrame = requestAnimationFrame(() => {
      drawer.querySelector<HTMLButtonElement>('.app-sidebar-close')?.focus()
    })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
      }
      if (event.key !== 'Tab') return
      const controls = Array.from(drawer.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]',
      )).filter(element => element.getClientRects().length > 0)
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && (document.activeElement === first || !drawer.contains(document.activeElement))) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !drawer.contains(document.activeElement))) {
        event.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      cancelAnimationFrame(focusFrame)
      if (main) main.inert = wasInert
      document.removeEventListener('keydown', onKey)
      if (window.matchMedia('(max-width: 1023px)').matches) opener?.focus()
    }
  }, [open, mobile])

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/')

  const signOut = async () => {
    setSigningOut(true)
    setSignOutError(false)
    try {
      const response = await fetch('/api/auth/signout', { method: 'POST' })
      if (!response.ok) throw new Error('Sign-out failed')
      await createClient().auth.signOut({ scope: 'local' })
      router.push('/portal/login')
      router.refresh()
    } catch { setSignOutError(true) }
    finally { setSigningOut(false) }
  }

  const close = () => setOpen(false)

  const brand = (
    <Link href={sections[0]?.items[0]?.href ?? '/'} className="app-brand" onClick={close}>
      <span className="app-brand-mark" aria-hidden />
      <span className="app-brand-name">gzad</span>
      {area && <span className="app-brand-area">{area}</span>}
    </Link>
  )

  return (
    <>
      <header className="app-topbar">
        <button
          ref={menuRef}
          type="button"
          className="app-icon-btn"
          onClick={() => setOpen(true)}
          aria-label={lang === 'ge' ? 'მენიუს გახსნა' : 'Open menu'}
          aria-expanded={open}
          aria-controls="app-sidebar"
        >
          <Menu size={20} />
        </button>
        {brand}
        <span className="app-topbar-spacer" />
      </header>

      <aside
        ref={drawerRef}
        id="app-sidebar"
        className="app-sidebar"
        data-open={open || undefined}
        inert={mobile && !open}
        role={mobile && open ? 'dialog' : undefined}
        aria-modal={mobile && open ? true : undefined}
        aria-label={lang === 'ge' ? 'ნავიგაცია' : 'Navigation'}
      >
        <div className="app-sidebar-head">
          {brand}
          <button type="button" className="app-icon-btn app-sidebar-close" onClick={close} aria-label={lang === 'ge' ? 'მენიუს დახურვა' : 'Close menu'}>
            <X size={20} />
          </button>
        </div>

        {primaryAction && (
          <Link href={primaryAction.href} className="app-primary-action" onClick={close}>
            <primaryAction.icon size={16} aria-hidden />
            {primaryAction.label}
          </Link>
        )}

        <nav className="app-nav" aria-label="Main">
          {sections.map((section, i) => (
            <div key={section.title ?? i} className="app-nav-section">
              {section.title && <p className="app-nav-title">{section.title}</p>}
              {section.items.map((item) => {
                const active = isActive(item)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={close}
                    className="app-nav-item"
                    aria-current={active ? 'page' : undefined}
                  >
                    <item.icon size={18} aria-hidden />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="app-sidebar-foot">
          {links.map((item) => (
            <Link key={item.href} href={item.href} onClick={close} className="app-nav-item">
              <item.icon size={18} aria-hidden />
              <span>{item.label}</span>
            </Link>
          ))}

          <ThemeSwitch georgian={language && lang === 'ge'} />

          {language && (
            <div className="app-lang" role="group" aria-label="Language">
              <button type="button" lang="en" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>
                English
              </button>
              <button type="button" lang="ka" aria-pressed={lang === 'ge'} onClick={() => setLang('ge')}>
                ქართული
              </button>
            </div>
          )}

          <div className="app-account">
            <span className="app-avatar" aria-hidden>{account ? initials(account.name) : ''}</span>
            <span className="app-account-text">
              <span className="app-account-name">{account?.name ?? ' '}</span>
              <span className="app-account-email">{account?.email ?? ' '}</span>
            </span>
            <button type="button" className="app-icon-btn" onClick={signOut} disabled={signingOut} aria-busy={signingOut} aria-label={signOutLabel} title={signOutLabel}>
              <LogOut size={18} />
            </button>
          </div>
          {signOutError && <p className="app-sidebar-error" role="alert">{lang === 'ge' ? 'გასვლა ვერ მოხერხდა. სცადეთ თავიდან.' : 'Could not sign out. Please try again.'}</p>}
        </div>
      </aside>

      {open && <div className="app-scrim" onClick={close} aria-hidden />}
    </>
  )
}
