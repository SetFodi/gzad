import type { Metadata } from 'next';
import './app.css';
import { appFonts } from './fonts';
import { themeInitScript } from '@/components/app/ThemeSwitch';
import { BRAND, LANDING, SITE_URL } from '@/lib/seo';

// Defaults every page starts from. Relative URLs in metadata (canonical,
// share images) resolve against the real domain, never a preview address.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: BRAND,
  title: LANDING.ge.title,
  description: LANDING.ge.description,
  openGraph: {
    type: 'website',
    siteName: BRAND,
    locale: LANDING.ge.ogLocale,
    images: [{ url: LANDING.ge.ogImage, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Georgian is the site's default language; English pages mark their own content as en.
    <html lang="ka" suppressHydrationWarning>
      <head>
        {/* Day/night theme for the app areas, applied before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body style={appFonts}>
        {children}
      </body>
    </html>
  );
}
