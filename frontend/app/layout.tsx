import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Script from 'next/script';
import { unstable_noStore as noStore } from 'next/cache';
import './globals.css';
import { GtmLazyLoader } from '@/components/analytics/GtmLazyLoader';
import { SupabaseHashSessionHandler } from '@/components/auth/SupabaseHashSessionHandler';
import { resolveLocale } from '@/lib/i18n/server';
import { buildThemeTokensStyle } from '@/lib/theme-tokens';
import { getThemeTokensSettingCached } from '@/server/app-settings';

type RootLayoutProps = {
  children: ReactNode;
};

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID ?? process.env.GTM_ID ?? '';

export const metadata: Metadata = {
  applicationName: 'MaxVideoAI',
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', type: 'image/x-icon' },
      { url: '/favicon.png', type: 'image/png' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    shortcut: ['/favicon.ico'],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export default async function RootLayout({ children }: RootLayoutProps) {
  noStore();
  const locale = await resolveLocale();
  const themeTokens = await getThemeTokensSettingCached();
  const themeStyle = buildThemeTokensStyle(themeTokens);

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://maxvideoai.com" />
        <link rel="preconnect" href="https://media.maxvideoai.com" crossOrigin="anonymous" />
        {themeStyle ? <style id="theme-tokens" dangerouslySetInnerHTML={{ __html: themeStyle }} /> : null}
        {GTM_ID ? (
          <Script
            id="gtm-consent-bootstrap"
            strategy="lazyOnload"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                window.dataLayer.push({
                  'event': 'consent_initialised',
                  'ad_storage': 'denied',
                  'analytics_storage': 'denied'
                });
              `,
            }}
          />
        ) : null}
      </head>
      <body>
        <SupabaseHashSessionHandler />
        {GTM_ID ? <GtmLazyLoader consentStorageKey="mv-consent-analytics" consentGrantedValue="granted" /> : null}
        {children}
      </body>
    </html>
  );
}
