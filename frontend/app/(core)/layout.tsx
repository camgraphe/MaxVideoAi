import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Analytics as VercelAnalytics } from '@vercel/analytics/react';
import { AnalyticsScripts } from '@/components/analytics/AnalyticsScripts';
import ConsentModeBootstrap from '@/components/analytics/ConsentModeBootstrap';
import { AuthCallbackHandler } from '@/components/AuthCallbackHandler';
import { CookieBanner } from '@/components/legal/CookieBanner';
import { JsonLd } from '@/components/SeoJsonLd';
import { I18nProvider } from '@/lib/i18n/I18nProvider';
import { resolveDictionary } from '@/lib/i18n/server';
import '@/app/globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://maxvideoai.com'),
  title: {
    default: 'MaxVideoAI — AI Video Generator Hub',
    template: '%s — MaxVideoAI',
  },
  description: 'Generate cinematic AI videos via Sora 2, Veo 3, Pika & more. Pay-as-you-go, no watermarks.',
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
};

export const viewport: Viewport = {
  themeColor: '#4F5D75',
};

export default async function CoreLayout({ children }: { children: ReactNode }) {
  const { locale, dictionary, fallback } = await resolveDictionary();

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
    <html lang={locale} data-show-wavel-badge>
      <head>
        {process.env.NEXT_PUBLIC_BING_VERIFY ? (
          <meta name="msvalidate.01" content={process.env.NEXT_PUBLIC_BING_VERIFY} />
        ) : null}
      </head>
      <body>
        <ConsentModeBootstrap />
        <AuthCallbackHandler />
        <I18nProvider locale={locale} dictionary={dictionary} fallback={fallback}>
          {children}
        </I18nProvider>
        {process.env.NODE_ENV === 'production' ? <VercelAnalytics /> : null}
        <AnalyticsScripts />
        <CookieBanner />
        <JsonLd json={orgSchema} />
        <JsonLd json={websiteSchema} />
      </body>
    </html>
  );
}
