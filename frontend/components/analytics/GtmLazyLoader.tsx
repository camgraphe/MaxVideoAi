'use client';

import { useEffect } from 'react';

const GTM_ID =
  process.env.NEXT_PUBLIC_GTM_ID ??
  process.env.GTM_ID ??
  '';

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

type GtmLazyLoaderProps = {
  delayMs?: number;
};

export function GtmLazyLoader({ delayMs = 4000 }: GtmLazyLoaderProps = {}) {
  useEffect(() => {
    if (!GTM_ID) return;

    const timer = window.setTimeout(() => {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });

      const existing = document.querySelector<HTMLScriptElement>(`script[src*=\"googletagmanager.com/gtm.js?id=${GTM_ID}\"]`);
      if (existing) {
        return;
      }

      const gtmScript = document.createElement('script');
      gtmScript.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
      gtmScript.async = true;
      document.head.appendChild(gtmScript);
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [delayMs]);

  return null;
}
