import type { Metadata } from 'next'
import './portal.css'
import { LanguageProvider } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'Gzad Portal',
  description: 'Client dashboard for Gzad advertising campaigns',
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <LanguageProvider>{children}</LanguageProvider>
}
