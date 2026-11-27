import type { Metadata } from 'next'
import LegalPage from '@/components/LegalPage'

export const metadata: Metadata = {
  title: 'Privacy Policy · კონფიდენციალურობის პოლიტიკა | Gzad',
  description: 'How Gzadvertisement LLC handles account, campaign, vehicle location and billing information, and how to exercise your privacy rights.',
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPolicyPage() {
  return <LegalPage kind="privacy" />
}
