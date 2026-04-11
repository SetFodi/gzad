'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Car, LogOut, Menu, X, Globe } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useTranslations } from '@/lib/i18n'

export default function FleetSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { lang, setLang, t } = useTranslations()

  const navItems = [
    { href: '/fleet', label: t.fleet.sidebar.overview, icon: LayoutDashboard },
    { href: '/fleet/vehicles', label: t.fleet.sidebar.vehicles, icon: Car },
  ]

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/portal/login')
  }

  return (
    <>
      <button
        className="sidebar-mobile-toggle"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <aside className={`portal-sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="8" width="18" height="10" rx="2" fill="#0A0A0A" />
            <rect x="5" y="10" width="14" height="6" rx="1" fill="#CCF381" />
          </svg>
          <span className="sidebar-logo-text">Gzad Fleet</span>
        </div>

        <div className="sidebar-nav">
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/fleet' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`nav-item ${isActive ? 'active' : ''}`}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>

        <div style={{ borderTop: '1px solid #141414', padding: '8px 12px', flexShrink: 0 }}>
          <button
            onClick={() => setLang(lang === 'en' ? 'ge' : 'en')}
            className="nav-item"
            style={{ width: '100%', border: 'none', cursor: 'pointer', background: 'none', textAlign: 'left' }}
          >
            <Globe size={20} />
            <span>{lang === 'en' ? 'ქართული' : 'English'}</span>
          </button>
          <button onClick={handleLogout} className="sidebar-logout">
            <LogOut size={20} />
            <span>{t.fleet.sidebar.signOut}</span>
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="sidebar-overlay"
        />
      )}
    </>
  )
}
