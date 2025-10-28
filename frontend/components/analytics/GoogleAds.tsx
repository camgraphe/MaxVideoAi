'use client';

import Script from 'next/script';

const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? 'AW-992154028';
const GOOGLE_ANALYTICS_ID = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID ?? '';
const GOOGLE_TAG_IDS = Array.from(new Set([GOOGLE_ADS_ID, GOOGLE_ANALYTICS_ID].filter(Boolean)));
const PRIMARY_TAG_ID = GOOGLE_TAG_IDS[0] ?? null;

export function GoogleAds() {
  if (!PRIMARY_TAG_ID) {
    return null;
  }

  const configCalls = GOOGLE_TAG_IDS.map((id) => `gtag('config', '${id}');`).join('\n');

  return (
    <>
      <Script
        id="google-ads-loader"
        async
        src={`https://www.googletagmanager.com/gtag/js?id=${PRIMARY_TAG_ID}`}
        strategy="afterInteractive"
      />
      <Script
        id="google-ads-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('consent', 'default', {
              ad_storage: 'denied',
              ad_user_data: 'denied',
              ad_personalization: 'denied',
              analytics_storage: 'denied'
            });
            gtag('js', new Date());
            ${configCalls}
            if (typeof window.gtagConsentUpdate !== 'function') {
              window.gtagConsentUpdate = (payload) => gtag('consent', 'update', payload);
            }
          `,
        }}
      />
    </>
  );
}
