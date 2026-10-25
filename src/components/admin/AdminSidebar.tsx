'use client'

import {
  Activity, BarChart3, Car, DollarSign, FolderOpen, LayoutDashboard, LayoutGrid, Map, MapPin,
  Megaphone, Monitor, ScrollText, Users, Eye,
} from 'lucide-react'
import AppSidebar from '@/components/app/AppSidebar'

export default function AdminSidebar() {
  return (
    <AppSidebar
      area="Admin"
      sections={[
        {
          items: [{ href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true }],
        },
        {
          title: 'Business',
          items: [
            { href: '/admin/campaigns', label: 'Campaigns', icon: Megaphone },
            { href: '/admin/clients', label: 'Clients', icon: Users },
            { href: '/admin/pricing', label: 'Pricing', icon: DollarSign },
          ],
        },
        {
          title: 'Screens',
          items: [
            { href: '/admin/devices', label: 'Devices', icon: Monitor },
            { href: '/admin/slots', label: 'Slots', icon: LayoutGrid },
            { href: '/admin/groups', label: 'Groups', icon: FolderOpen },
          ],
        },
        {
          title: 'Fleet',
          items: [
            { href: '/admin/fleet-users', label: 'Fleet users', icon: Car },
            { href: '/admin/fleet', label: 'Fleet map', icon: Map },
            { href: '/admin/map', label: 'GPS trails', icon: MapPin },
          ],
        },
        {
          title: 'Insights',
          items: [
            { href: '/admin/activity', label: 'Activity', icon: Activity },
            { href: '/admin/stats', label: 'Stats', icon: BarChart3 },
            { href: '/admin/logs', label: 'Logs', icon: ScrollText },
          ],
        },
      ]}
      links={[{ href: '/portal/dashboard', label: 'Client view', icon: Eye }]}
      signOutLabel="Sign out"
    />
  )
}
