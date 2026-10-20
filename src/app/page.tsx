import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import { Inter, Noto_Sans_Georgian } from 'next/font/google'
import Landing from '@/components/landing/Landing'
import './landing.css'

// Self-hosted at build time, so the fonts satisfy the CSP's font-src 'self'.
const inter = Inter({ subsets: ['latin'], axes: ['opsz'], display: 'swap' })
const georgian = Noto_Sans_Georgian({ subsets: ['georgian'], display: 'swap' })

// next/font's family strings carry an Arial-based fallback face with no
// unicode-range, and Noto Sans Georgian also ships Latin glyphs. Stacking just
// the two real faces, Inter first, gives Latin to Inter and Georgian to Noto.
const face = (family: string) => family.split(',')[0].trim()
const fonts = {
  '--lp-face-latin': face(inter.style.fontFamily),
  '--lp-face-georgian': face(georgian.style.fontFamily),
} as CSSProperties

export const metadata: Metadata = {
  title: 'Gzad · Taxi-top LED advertising in Tbilisi',
  description:
    'Double-sided LED screens on taxis across Tbilisi. Target districts, pay only for hours on air, and see every play on a map.',
}

export default function Home() {
  return <Landing style={fonts} />
}
