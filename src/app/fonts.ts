import type { CSSProperties } from 'react'
import { Inter, Noto_Sans_Georgian } from 'next/font/google'

// Self-hosted at build time, so the fonts satisfy the CSP's font-src 'self'.
const inter = Inter({ subsets: ['latin'], axes: ['opsz'], display: 'swap' })
const georgian = Noto_Sans_Georgian({ subsets: ['georgian'], display: 'swap' })

// next/font's family strings carry an Arial-based fallback face with no
// unicode-range, and Noto Sans Georgian also ships Latin glyphs. Stacking just
// the two real faces, Inter first, gives Latin to Inter and Georgian to Noto.
const face = (family: string) => family.split(',')[0].trim()

/** CSS variables for the app's font stack; set on the root of each app area. */
export const appFonts = {
  '--ui-face-latin': face(inter.style.fontFamily),
  '--ui-face-georgian': face(georgian.style.fontFamily),
} as CSSProperties
