import type { Metadata } from 'next'
import './portal.css'

export const metadata: Metadata = {
  title: 'Gzad Portal',
  description: 'Client dashboard for Gzad advertising campaigns',
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
