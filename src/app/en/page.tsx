import type { Metadata } from 'next'
import Landing from '@/components/landing/Landing'
import { jsonLd, landingMetadata, landingStructuredData } from '@/lib/seo'
import { landingFonts } from '../landing-fonts'
import '../landing.css'

// The English landing page, served as English from the first byte so search
// engines index it in English. Georgian lives at /.
export const metadata: Metadata = landingMetadata('en')

export default function EnglishHome() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(landingStructuredData('en')) }} />
      <Landing style={landingFonts} lang="en" />
    </>
  )
}
