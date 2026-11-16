'use client'

import { LanguageProvider, useTranslations } from '@/lib/i18n'
import { LegalShell } from '@/components/LegalPage'
import { CONTACT } from '@/components/landing/copy'
import type { ContactTopic } from '@/lib/contact'
import ContactForm from './ContactForm'

const PAGE = {
  en: {
    eyebrow: 'Contact',
    title: 'Write to us',
    lede: 'Tell us what you need and we’ll reply by email. We work Monday to Saturday, 10:00 – 19:00.',
    call: 'Prefer to talk? Call',
  },
  ge: {
    eyebrow: 'კონტაქტი',
    title: 'მოგვწერეთ',
    lede: 'მოგვწერეთ, რა გჭირდებათ, და ელ-ფოსტით გიპასუხებთ. ვმუშაობთ ორშაბათიდან შაბათის ჩათვლით, 10:00 – 19:00.',
    call: 'გირჩევნიათ დარეკვა? დაგვირეკეთ:',
  },
}

function Contact({ initialTopic }: { initialTopic: ContactTopic }) {
  const { lang } = useTranslations()
  const p = PAGE[lang]
  return (
    <LegalShell current="contact">
      <div className="legal-title-block contact-title">
        <p className="legal-eyebrow">{p.eyebrow}</p>
        <h1>{p.title}</h1>
        <p>{p.lede} {p.call} <a href={CONTACT.phoneHref}>{CONTACT.phone}</a></p>
      </div>
      <div className="contact-body">
        <ContactForm lang={lang} initialTopic={initialTopic} />
      </div>
    </LegalShell>
  )
}

export default function ContactPage({ initialTopic }: { initialTopic: ContactTopic }) {
  return <LanguageProvider><Contact initialTopic={initialTopic} /></LanguageProvider>
}
