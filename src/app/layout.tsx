import type { Metadata } from 'next';
import './app.css';

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
    <html lang="en">
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
