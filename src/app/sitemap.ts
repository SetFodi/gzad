import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

// The public pages. The two landing pages list each other as language versions.
export default function sitemap(): MetadataRoute.Sitemap {
  const languages = { ka: `${SITE_URL}/`, en: `${SITE_URL}/en` }
  const now = new Date()
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'weekly', priority: 1, alternates: { languages } },
    { url: `${SITE_URL}/en`, lastModified: now, changeFrequency: 'weekly', priority: 0.9, alternates: { languages } },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/refund-policy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
