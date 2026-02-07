'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Megaphone, Upload, Receipt, LogOut, Menu, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const navItems = [
  { href: '/portal/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/portal/dashboard/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/portal/dashboard/submit', label: 'Submit Ad', icon: Upload },
  { href: '/portal/dashboard/billing', label: 'Billing', icon: Receipt },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileOpen, setMobileOpen] = useState(false)

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
        {/* Logo */}
        <div className="sidebar-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="8" width="18" height="10" rx="2" fill="#0A0A0A" />
            <rect x="5" y="10" width="14" height="6" rx="1" fill="#CCF381" />
          </svg>
          <span className="sidebar-logo-text">Gzad</span>
        </div>

        {/* Nav Links */}
        <div className="sidebar-nav">
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/portal/dashboard' && pathname.startsWith(item.href))
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

        {/* Sign Out */}
        <button onClick={handleLogout} className="sidebar-logout">
          <LogOut size={20} />
          <span>Sign Out</span>
        </button>
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

