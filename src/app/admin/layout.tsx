import type { Metadata } from 'next'
import AdminSidebar from '@/components/admin/AdminSidebar'
import '../portal/portal.css'

export const metadata: Metadata = {
  title: 'Gzad Admin',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="portal-layout">
      <AdminSidebar />
      <main className="portal-main">
        {children}
      </main>
    </div>
  )
}
