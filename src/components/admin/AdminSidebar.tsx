'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Users, Megaphone, BarChart3, LogOut, Menu, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const navItems = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/clients', label: 'Clients', icon: Users },
  { href: '/admin/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/admin/stats', label: 'Stats Upload', icon: BarChart3 },
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

  const linkStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '11px 14px',
    borderRadius: 10,
    color: isActive ? '#CCF381' : '#525252',
    background: isActive ? 'rgba(204, 243, 129, 0.06)' : 'transparent',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 500,
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
  })

  return (
    <>
      <button
        className="sidebar-mobile-toggle"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <aside
        className={mobileOpen ? 'open' : ''}
        style={{
          width: 260,
          minWidth: 260,
          maxWidth: 260,
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          background: '#0A0A0A',
          borderRight: '1px solid #141414',
          zIndex: 40,
          boxSizing: 'border-box',
          overflowY: 'auto',
          overflowX: 'hidden',
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '28px 24px 20px',
            flexShrink: 0,
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="8" width="18" height="10" rx="2" fill="#0A0A0A" />
            <rect x="5" y="10" width="14" height="6" rx="1" fill="#CCF381" />
          </svg>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#60A5FA', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}>
            Gzad Admin
          </span>
        </div>

        {/* Nav Links */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 12px', flex: '1 1 0%' }}>
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/admin' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                style={linkStyle(isActive)}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Footer Links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '12px 12px 8px', borderTop: '1px solid #141414', flexShrink: 0 }}>
          <Link
            href="/portal/dashboard"
            onClick={() => setMobileOpen(false)}
            style={linkStyle(false)}
          >
            <LayoutDashboard size={20} />
            <span>Client View</span>
          </Link>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '11px 14px',
              borderRadius: 10,
              color: '#3f3f3f',
              background: 'none',
              border: 'none',
              fontSize: 14,
              fontFamily: "'Inter', sans-serif",
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
              boxSizing: 'border-box',
              marginBottom: 8,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#EF4444'
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.06)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#3f3f3f'
              e.currentTarget.style.background = 'none'
            }}
          >
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            zIndex: 35,
            backdropFilter: 'blur(4px)',
          }}
        />
      )}
    </>
  )
}
