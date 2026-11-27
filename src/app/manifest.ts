import type { MetadataRoute } from 'next'

// Names and icons for "add to home screen" and for crawlers that read the manifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Gzad · Taxi-top LED advertising in Tbilisi',
    short_name: 'Gzad',
    description: 'Double-sided LED screens on taxis across Tbilisi. Pay for airtime and track your campaign on the map.',
    start_url: '/',
    display: 'browser',
    background_color: '#ffffff',
    theme_color: '#0b4d3c',
    lang: 'ka',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
