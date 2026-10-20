'use client'

import { BarChart3, Car, LayoutDashboard } from 'lucide-react'
import { useTranslations } from '@/lib/i18n'
import AppSidebar from '@/components/app/AppSidebar'

export default function FleetSidebar() {
  const { t } = useTranslations()
  const s = t.fleet.sidebar

  return (
    <AppSidebar
      area="Fleet"
      sections={[
        {
          items: [
            { href: '/fleet', label: s.overview, icon: LayoutDashboard, exact: true },
            { href: '/fleet/vehicles', label: s.vehicles, icon: Car },
            { href: '/fleet/stats', label: s.stats, icon: BarChart3 },
          ],
        },
      ]}
      language
      signOutLabel={s.signOut}
    />
  )
}
