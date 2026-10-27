'use client'

import {
  Activity, BarChart3, Car, DollarSign, FolderOpen, LayoutDashboard, LayoutGrid, Map, MapPin,
  Megaphone, Monitor, MonitorPlay, ScrollText, Users, Eye,
} from 'lucide-react'
import AppSidebar from '@/components/app/AppSidebar'
import { useAdminText } from '@/lib/admin-i18n'

export default function AdminSidebar() {
  const { t } = useAdminText()
  return (
    <AppSidebar
      area={t('Admin')}
      sections={[
        {
          items: [{ href: '/admin', label: t('Overview'), icon: LayoutDashboard, exact: true }],
        },
        {
          title: t('Business'),
          items: [
            { href: '/admin/campaigns', label: t('Campaigns'), icon: Megaphone },
            { href: '/admin/clients', label: t('Clients'), icon: Users },
            { href: '/admin/pricing', label: t('Pricing'), icon: DollarSign },
          ],
        },
        {
          title: t('Screens'),
          items: [
            { href: '/admin/devices', label: t('Devices'), icon: Monitor },
            { href: '/admin/monitor', label: t('Live view'), icon: MonitorPlay },
            { href: '/admin/slots', label: t('Slots'), icon: LayoutGrid },
            { href: '/admin/groups', label: t('Groups'), icon: FolderOpen },
          ],
        },
        {
          title: t('Fleet'),
          items: [
            { href: '/admin/fleet-users', label: t('Fleets'), icon: Car },
            { href: '/admin/fleet', label: t('Fleet map'), icon: Map },
            { href: '/admin/map', label: t('GPS trails'), icon: MapPin },
          ],
        },
        {
          title: t('Insights'),
          items: [
            { href: '/admin/activity', label: t('Activity'), icon: Activity },
            { href: '/admin/stats', label: t('Stats'), icon: BarChart3 },
            { href: '/admin/logs', label: t('Logs'), icon: ScrollText },
          ],
        },
      ]}
      links={[{ href: '/portal/dashboard', label: t('Client view'), icon: Eye }]}
      signOutLabel={t('Sign out')}
      language
    />
  )
}
