import type { Metadata } from 'next'
import ContactPage from '@/components/contact/ContactPage'
import { isContactTopic } from '@/lib/contact'

export const metadata: Metadata = {
  title: 'Contact · კონტაქტი | Gzad',
  description: 'Write to the Gzad team about a campaign, billing and refunds, your account or a fleet partnership.',
}

export default async function ContactRoute({ searchParams }: { searchParams: Promise<{ topic?: string | string[] }> }) {
  const { topic } = await searchParams
  return <ContactPage initialTopic={isContactTopic(topic) ? topic : 'quote'} />
}
