import type { Metadata } from 'next'
import AdminSidebar from '@/components/admin/AdminSidebar'
import { LanguageProvider } from '@/lib/i18n'
import { appFonts } from '../fonts'
import '../portal/portal.css'

export const metadata: Metadata = {
  title: 'Gzad Admin',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <div className="ui-root" style={appFonts}>
        <div className="portal-layout">
          <AdminSidebar />
          <main className="portal-main">
            {children}
          </main>
        </div>
      </div>
    </LanguageProvider>
  )
}
