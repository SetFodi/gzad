import FleetSidebar from '@/components/fleet/FleetSidebar'
import { LanguageProvider } from '@/lib/i18n'
import { appFonts } from '../fonts'
import '../portal/portal.css'

export default function FleetLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <div className="ui-root" style={appFonts}>
        <div className="portal-layout">
          <FleetSidebar />
          <main className="portal-main">
            {children}
          </main>
        </div>
      </div>
    </LanguageProvider>
  )
}
