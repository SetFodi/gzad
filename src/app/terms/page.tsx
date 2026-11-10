import type { Metadata } from 'next'
import LegalPage from '@/components/LegalPage'

export const metadata: Metadata = {
  title: 'Terms of Service · მომსახურების პირობები | Gzad',
  description: 'Terms for Gzad advertiser accounts, campaign delivery, prepaid balances, billing questions and fleet partnerships.',
}

export default function TermsPage() {
  return <LegalPage kind="terms" />
}
