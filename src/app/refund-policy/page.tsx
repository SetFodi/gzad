import type { Metadata } from 'next'
import LegalPage from '@/components/LegalPage'

export const metadata: Metadata = {
  title: 'Refund Policy · დაბრუნების პოლიტიკა | Gzad',
  description: 'How advertisers get unused balance back, refunds for rejected ads and billing errors, and how long a Gzad refund takes.',
  alternates: { canonical: '/refund-policy' },
}

export default function RefundPolicyPage() {
  return <LegalPage kind="refund" />
}
