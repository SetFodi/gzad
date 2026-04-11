import FleetSidebar from '@/components/fleet/FleetSidebar'
import { LanguageProvider } from '@/lib/i18n'
import '../portal/portal.css'

export default function FleetLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <div className="dark portal-layout">
        <FleetSidebar />
        <main className="portal-main">
          {children}
        </main>
      </div>
    </LanguageProvider>
  )
}
