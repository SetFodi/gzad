import type { Metadata } from 'next';
import './app.css';
import Preloader from '@/components/Preloader';

export const metadata: Metadata = {
  title: 'Gzad Georgia | Mobile Digital Advertising Network',
  description: 'Transform Tbilisi\'s taxi fleet into a powerful advertising network. GPS-targeted, real-time LED displays reaching thousands daily.',
};

const themeInit = `
(function(){try{var t=localStorage.getItem('gzad-theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body suppressHydrationWarning>
        <Preloader />
        {children}
      </body>
    </html>
  );
}
