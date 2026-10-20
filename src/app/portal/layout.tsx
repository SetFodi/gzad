import type { Metadata } from 'next'
import './portal.css'
import { LanguageProvider } from '@/lib/i18n'
import { appFonts } from '../fonts'
import { PortalCapabilitiesProvider } from '@/components/portal/Capabilities'

export const metadata: Metadata = {
  title: 'Gzad Portal',
  description: 'Client dashboard for Gzad advertising campaigns',
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <PortalCapabilitiesProvider clientDailyLimits={process.env.AUTH_DEVICE_VERIFICATION === 'on'}>
        <div className="ui-root" style={appFonts}>{children}</div>
      </PortalCapabilitiesProvider>
    </LanguageProvider>
  )
}
