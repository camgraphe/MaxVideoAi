import type { Metadata } from 'next';
import './globals.css';
import { resolveLocale } from '@/lib/i18n/server';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/react';

export const metadata: Metadata = {
  title: 'MaxVideo AI',
  description: 'Professional AI video, price before you generate. One hub for every shot.',
  keywords: ['AI video', 'text-to-video', 'price calculator', 'pay-as-you-go', 'model-agnostic'],
  metadataBase: new URL('https://www.maxvideo.ai'),
  themeColor: '#4F5D75',
  manifest: '/site.webmanifest',
  alternates: {
    canonical: 'https://www.maxvideo.ai/',
    languages: {
      en: 'https://www.maxvideo.ai/',
      fr: 'https://www.maxvideo.ai/?lang=fr',
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
    shortcut: ['/favicon.ico'],
    other: [{ rel: 'mask-icon', url: '/favicon.svg', color: '#4F5D75' }],
  },
  appleWebApp: {
    capable: true,
    title: 'MaxVideo AI',
    statusBarStyle: 'default',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = resolveLocale();
  const orgSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'MaxVideo AI',
    url: 'https://www.maxvideo.ai/',
    logo: 'https://www.maxvideo.ai/apple-touch-icon.png',
  };

  return (
    <html lang={locale}>
      <body>
        {children}
        <SpeedInsights />
        <Analytics />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }} />
      </body>
    </html>
  );
}
