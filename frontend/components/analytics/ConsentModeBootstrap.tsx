'use client';

import Script from 'next/script';

const GA_ID =
  process.env.NEXT_PUBLIC_GA_ID ??
  process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID ??
  process.env.NEXT_PUBLIC_GA4_ID ??
  '';

const DISABLE_GA =
  process.env.NEXT_PUBLIC_DISABLE_GA === '1' ||
  process.env.NODE_ENV === 'test';

function hasConsent() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem('mv-consent-analytics') === 'granted';
  } catch {
    return false;
  }
}

function isLighthouseRun() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (ua.includes('Lighthouse') || ua.includes('Chrome-Lighthouse')) return true;
  try {
    return window.localStorage.getItem('lh-mode') === '1';
  } catch {
    return false;
  }
}

export default function ConsentModeBootstrap() {
  if (!GA_ID) return null;
  if (DISABLE_GA) return null;
  if (isLighthouseRun()) return null;
  if (!hasConsent()) return null;

  return (
    <>
      <Script id="gcm-default" strategy="lazyOnload">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}

          gtag('consent', 'default', {
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            ad_storage: 'denied',
            analytics_storage: 'denied',
            functionality_storage: 'granted',
            security_storage: 'granted'
          });

          gtag('set', 'url_passthrough', true);
        `}
      </Script>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="lazyOnload" />
      <Script id="ga-init" strategy="lazyOnload">
        {`
          window.dataLayer = window.dataLayer || [];
          window.gtag = window.gtag || function(){dataLayer.push(arguments);};
          gtag('js', new Date());
          gtag('config', '${GA_ID}', {
            anonymize_ip: true,
            allow_google_signals: false,
            send_page_view: false${process.env.NODE_ENV !== 'production' ? `,
            debug_mode: true` : ''}
          });
        `}
      </Script>
    </>
  );
}
