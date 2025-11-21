import type { ReactNode } from 'react';
import Script from 'next/script';
import './globals.css';
import { GtmLazyLoader } from '@/components/analytics/GtmLazyLoader';

type RootLayoutProps = {
  children: ReactNode;
};

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID ?? process.env.GTM_ID ?? '';

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://maxvideoai.com" />
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
        {GTM_ID ? <GtmLazyLoader consentStorageKey="mv-consent-analytics" consentGrantedValue="granted" /> : null}
        {children}
      </body>
    </html>
  );
}
