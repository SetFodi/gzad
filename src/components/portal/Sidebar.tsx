'use client'

import { useEffect, useState } from 'react'
import { LayoutDashboard, Megaphone, Plus, Receipt, Shield } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from '@/lib/i18n'
import AppSidebar, { type NavItem } from '@/components/app/AppSidebar'

export default function Sidebar() {
  const [isAdmin, setIsAdmin] = useState(false)
  const { t } = useTranslations()
  const s = t.portal.sidebar

  useEffect(() => {
    async function checkAdmin() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('clients')
        .select('is_admin')
        .eq('auth_user_id', user.id)
        .single()
      if (data?.is_admin) setIsAdmin(true)
    }
    checkAdmin()
  }, [])

  const links: NavItem[] = isAdmin ? [{ href: '/admin', label: s.adminView, icon: Shield }] : []

  return (
    <AppSidebar
      sections={[
        {
          items: [
            { href: '/portal/dashboard', label: s.overview, icon: LayoutDashboard, exact: true },
            { href: '/portal/dashboard/campaigns', label: s.campaigns, icon: Megaphone },
            { href: '/portal/dashboard/billing', label: s.billing, icon: Receipt },
          ],
        },
      ]}
      primaryAction={{ href: '/portal/dashboard/submit', label: s.submitAd, icon: Plus }}
      links={links}
      language
      signOutLabel={s.signOut}
    />
  )
}
