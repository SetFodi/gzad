// What search engines and AI assistants are told about the public site.
//
// The landing page exists in two languages at two addresses: Georgian at "/"
// (the default, and what most visitors search in) and English at "/en". Each
// page carries its own title and description, points at the other as its
// alternate language, and embeds structured data (schema.org JSON-LD) built
// from the same copy the page shows, so nothing here can drift from the site.

import type { Metadata } from 'next'
import { CONTACT, copy, type Lang } from '@/components/landing/copy'

export const SITE_URL = 'https://gzadvertisement.ge'
export const BRAND = 'Gzad'
export const LEGAL_NAME = 'Gzadvertisement LLC'
export const LEGAL_NAME_KA = 'შპს „გზადვერთაისმენთ“'

export const LANDING: Record<Lang, { path: string; title: string; description: string; ogImage: string; ogLocale: string; htmlLang: string }> = {
  ge: {
    path: '/',
    title: 'LED რეკლამა ტაქსებზე თბილისში | Gzad',
    description: 'ორმხრივი LED ეკრანები თბილისის ტაქსებზე. თქვენი რეკლამა ტაქსებთან ერთად მოძრაობს. გადაიხადეთ ეთერისთვის და თვალი ადევნეთ კამპანიას რუკაზე.',
    ogImage: '/og/og-ka.png',
    ogLocale: 'ka_GE',
    htmlLang: 'ka',
  },
  en: {
    path: '/en',
    title: 'Taxi-top LED advertising in Tbilisi | Gzad',
    description: 'Double-sided LED screens on taxis across Tbilisi. Your ad travels with the taxis. Pay for airtime and track your campaign on the map.',
    ogImage: '/og/og-en.png',
    ogLocale: 'en_US',
    htmlLang: 'en',
  },
}

/** hreflang alternates shared by both landing pages. */
export const LANDING_LANGUAGES = { ka: '/', en: '/en', 'x-default': '/' }

export function landingMetadata(lang: Lang): Metadata {
  const page = LANDING[lang]
  const other = LANDING[lang === 'ge' ? 'en' : 'ge']
  return {
    title: { absolute: page.title },
    description: page.description,
    alternates: { canonical: page.path, languages: LANDING_LANGUAGES },
    openGraph: {
      type: 'website',
      url: page.path,
      siteName: BRAND,
      title: page.title,
      description: page.description,
      locale: page.ogLocale,
      alternateLocale: [other.ogLocale],
      images: [{ url: page.ogImage, width: 1200, height: 630, alt: page.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: page.title,
      description: page.description,
      images: [page.ogImage],
    },
  }
}

/** Copy can carry **bold** markers for the page; structured data wants plain text. */
export const plain = (s: string) => s.replace(/\*\*/g, '').trim()

/** schema.org graph for a landing page: who we are, the site, this page, the service, the FAQ. */
export function landingStructuredData(lang: Lang) {
  const t = copy[lang]
  const page = LANDING[lang]
  const pageUrl = `${SITE_URL}${page.path === '/' ? '/' : page.path}`
  const org = `${SITE_URL}/#organization`
  const inLanguage = page.htmlLang

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': org,
        name: BRAND,
        legalName: LEGAL_NAME,
        alternateName: [LEGAL_NAME_KA, 'Gzadvertisement', 'გზად'],
        url: SITE_URL,
        logo: { '@type': 'ImageObject', url: `${SITE_URL}/brand/gzad-logo.png`, width: 1200, height: 643 },
        image: `${SITE_URL}${LANDING.en.ogImage}`,
        email: CONTACT.email,
        telephone: CONTACT.phone,
        address: { '@type': 'PostalAddress', addressLocality: 'Tbilisi', addressCountry: 'GE' },
        areaServed: { '@type': 'City', name: 'Tbilisi' },
        contactPoint: [{
          '@type': 'ContactPoint',
          contactType: 'sales',
          email: CONTACT.email,
          telephone: CONTACT.phone,
          availableLanguage: ['ka', 'en'],
          areaServed: 'GE',
          hoursAvailable: {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
            opens: '10:00',
            closes: '19:00',
          },
        }],
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: BRAND,
        inLanguage: ['ka', 'en'],
        publisher: { '@id': org },
      },
      {
        '@type': 'WebPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: page.title,
        description: page.description,
        inLanguage,
        isPartOf: { '@id': `${SITE_URL}/#website` },
        about: { '@id': org },
        primaryImageOfPage: { '@type': 'ImageObject', url: `${SITE_URL}${page.ogImage}`, width: 1200, height: 630 },
      },
      {
        '@type': 'Service',
        '@id': `${pageUrl}#service`,
        name: plain(t.hero.eyebrow),
        serviceType: lang === 'en' ? 'Taxi-top digital out-of-home (DOOH) advertising' : 'ციფრული გარე რეკლამა ტაქსებზე',
        description: plain(t.hero.lede),
        provider: { '@id': org },
        areaServed: { '@type': 'City', name: lang === 'en' ? 'Tbilisi' : 'თბილისი' },
        url: pageUrl,
      },
      {
        '@type': 'FAQPage',
        '@id': `${pageUrl}#faq`,
        inLanguage,
        mainEntity: t.faq.items.map((item) => ({
          '@type': 'Question',
          name: plain(item.q),
          acceptedAnswer: { '@type': 'Answer', text: plain(item.a) },
        })),
      },
    ],
  }
}

/** Safe to drop into a <script type="application/ld+json">: no "</script>" can close it early. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
