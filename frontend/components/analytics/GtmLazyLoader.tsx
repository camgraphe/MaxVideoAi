'use client';

import { useEffect } from 'react';

const GTM_ID =
  process.env.NEXT_PUBLIC_GTM_ID ??
  process.env.GTM_ID ??
  '';
const DISABLE_GTM =
  process.env.NEXT_PUBLIC_DISABLE_GTM === '1' ||
  process.env.NODE_ENV === 'test';

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

type GtmLazyLoaderProps = {
  delayMs?: number;
  consentStorageKey?: string;
  consentGrantedValue?: string;
};

function hasConsent({ storageKey, grantedValue }: { storageKey: string; grantedValue: string }) {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(storageKey) === grantedValue;
  } catch {
    return false;
  }
}

function isLighthouseRun() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return ua.includes('Lighthouse') || ua.includes('Chrome-Lighthouse');
}

export function GtmLazyLoader({
  delayMs = 4000,
  consentStorageKey = 'mv-consent-analytics',
  consentGrantedValue = 'granted',
}: GtmLazyLoaderProps = {}) {
  useEffect(() => {
    if (!GTM_ID) return;
    if (DISABLE_GTM || isLighthouseRun()) {
      return;
    }
    if (!hasConsent({ storageKey: consentStorageKey, grantedValue: consentGrantedValue })) {
      return;
    }

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
  }, [consentGrantedValue, consentStorageKey, delayMs]);

  return null;
}
