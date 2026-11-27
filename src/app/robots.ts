import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

// Public pages are open to every crawler, AI assistants' included (they follow
// the * rules). Signed-in areas and the API are not pages to index; the portal's
// sign-in pages stay crawlable but carry noindex (see portal/layout.tsx).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/fleet', '/portal/dashboard', '/api/', '/dev'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
