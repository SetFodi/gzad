'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Users, Megaphone, Monitor, MapPin, Map, ScrollText, LogOut, Menu, X, FolderOpen, BarChart3 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const navItems = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/clients', label: 'Clients', icon: Users },
  { href: '/admin/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/admin/devices', label: 'Devices', icon: Monitor },
  { href: '/admin/groups', label: 'Groups', icon: FolderOpen },
  { href: '/admin/stats', label: 'Stats', icon: BarChart3 },
  { href: '/admin/logs', label: 'Logs', icon: ScrollText },
  { href: '/admin/fleet', label: 'Fleet Map', icon: Map },
  { href: '/admin/map', label: 'GPS Trails', icon: MapPin },
]

export default function AdminSidebar() {
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
            <rect x="3" y="8" width="18" height="10" rx="2" fill="var(--foreground)" />
            <rect x="5" y="10" width="14" height="6" rx="1" fill="var(--primary)" />
          </svg>
          <span className="sidebar-logo-text">Gzad Admin</span>
        </div>

        {/* Nav Links */}
        <div className="sidebar-nav">
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/admin' && pathname.startsWith(item.href))
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

        {/* Footer */}
        <div style={{ borderTop: '1px solid var(--border)', padding: '8px 12px', flexShrink: 0 }}>
          <Link
            href="/portal/dashboard"
            onClick={() => setMobileOpen(false)}
            className="nav-item"
          >
            <LayoutDashboard size={20} />
            <span>Client View</span>
          </Link>
          <button onClick={handleLogout} className="sidebar-logout">
            <LogOut size={20} />
            <span>Sign Out</span>
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
