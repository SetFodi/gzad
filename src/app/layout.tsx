import type { Metadata } from 'next';
import './app.css';
import { appFonts } from './fonts';
import { themeInitScript } from '@/components/app/ThemeSwitch';

export const metadata: Metadata = {
  title: 'Gzad Georgia | Mobile Digital Advertising Network',
  description: 'Transform Tbilisi\'s taxi fleet into a powerful advertising network. GPS-targeted, real-time LED displays reaching thousands daily.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
