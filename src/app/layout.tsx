import type { Metadata } from 'next';
import './app.css';
import { appFonts } from './fonts';
import { themeInitScript } from '@/components/app/ThemeSwitch';

export const metadata: Metadata = {
  title: 'Gzad Georgia | Mobile Digital Advertising Network',
  description: 'Taxi-top LED advertising in Tbilisi. Double-sided screens, airtime pricing and GPS-backed campaign reports.',
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
