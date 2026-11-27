import type { Metadata } from 'next'
import Landing from '@/components/landing/Landing'
import { jsonLd, landingMetadata, landingStructuredData } from '@/lib/seo'
import { landingFonts } from './landing-fonts'
import './landing.css'

// The Georgian landing page, the site's default. English lives at /en.
export const metadata: Metadata = landingMetadata('ge')

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(landingStructuredData('ge')) }} />
      <Landing style={landingFonts} lang="ge" />
    </>
  )
}
