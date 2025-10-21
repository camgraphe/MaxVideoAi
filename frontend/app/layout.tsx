import type { Metadata, Viewport } from 'next';
import { resolveLocale } from '@/lib/i18n/server';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/react';
import { JsonLd } from '@/components/SeoJsonLd';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://maxvideoai.com'),
  title: {
    default: 'MaxVideoAI — AI Video Generator Hub',
    template: '%s — MaxVideoAI',
  },
  description: 'Generate cinematic AI videos via Sora 2, Veo 3, Pika & more. Pay-as-you-go, no watermarks.',
  keywords: ['AI video', 'text-to-video', 'price calculator', 'pay-as-you-go', 'model-agnostic'],
  manifest: '/site.webmanifest',
  alternates: {
    canonical: 'https://maxvideoai.com',
    languages: {
      en: 'https://maxvideoai.com',
      fr: 'https://maxvideoai.com/?lang=fr',
    },
  },
  openGraph: {
    type: 'website',
    url: 'https://maxvideoai.com',
    siteName: 'MaxVideoAI',
    title: 'MaxVideoAI — AI Video Generator Hub',
    description: 'Generate cinematic AI videos via Sora 2, Veo 3, Pika & more. Pay-as-you-go, no watermarks.',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@MaxVideoAI',
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

export const viewport: Viewport = {
  themeColor: '#4F5D75',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = resolveLocale();
  const orgSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'MaxVideoAI',
    url: 'https://maxvideoai.com/',
    logo: 'https://maxvideoai.com/favicon-512.png',
    sameAs: [
      'https://x.com/MaxVideoAI',
      'https://www.linkedin.com/company/maxvideoai/',
      'https://github.com/camgraphe/maxvideoai',
      'https://www.producthunt.com/products/maxvideoai',
    ],
  };

  const enableSearchSchema = process.env.NEXT_PUBLIC_ENABLE_SEARCH_SCHEMA === 'true';
  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    url: 'https://maxvideoai.com/',
    name: 'MaxVideoAI',
    ...(enableSearchSchema
      ? {
          potentialAction: {
            '@type': 'SearchAction',
            target: 'https://maxvideoai.com/search?q={query}',
            'query-input': 'required name=query',
          },
        }
      : {}),
  };

  return (
    <html lang={locale}>
      <head>
        {process.env.NEXT_PUBLIC_BING_VERIFY ? (
          <meta name="msvalidate.01" content={process.env.NEXT_PUBLIC_BING_VERIFY} />
        ) : null}
      </head>
      <body>
        {children}
        <SpeedInsights />
        <Analytics />
        <JsonLd json={orgSchema} />
        <JsonLd json={websiteSchema} />
      </body>
    </html>
  );
}
