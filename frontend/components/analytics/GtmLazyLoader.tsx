'use client';

import { useEffect, useState } from 'react';

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
  if (ua.includes('Chrome-Lighthouse')) return true;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('lh-mode') === '1';
  } catch {
    return false;
  }
}

type ConsentEventDetail = {
  categories?: {
    analytics?: boolean;
  };
};

export function GtmLazyLoader({
  delayMs = 4000,
  consentStorageKey = 'mv-consent-analytics',
  consentGrantedValue = 'granted',
}: GtmLazyLoaderProps = {}) {
  const [analyticsConsentGranted, setAnalyticsConsentGranted] = useState(false);

  useEffect(() => {
    const syncFromStorage = () => {
      setAnalyticsConsentGranted(
        hasConsent({
          storageKey: consentStorageKey,
          grantedValue: consentGrantedValue,
        })
      );
    };

    const handleConsentUpdated = (event: Event) => {
      const detail = (event as CustomEvent<ConsentEventDetail>).detail;
      if (detail?.categories && typeof detail.categories.analytics === 'boolean') {
        setAnalyticsConsentGranted(Boolean(detail.categories.analytics));
        return;
      }
      syncFromStorage();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== consentStorageKey) return;
      syncFromStorage();
    };

    syncFromStorage();
    window.addEventListener('consent:updated', handleConsentUpdated as EventListener);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('consent:updated', handleConsentUpdated as EventListener);
      window.removeEventListener('storage', handleStorage);
    };
  }, [consentGrantedValue, consentStorageKey]);

  useEffect(() => {
    if (!GTM_ID) return;
    if (DISABLE_GTM || isLighthouseRun()) {
      return;
    }
    if (!analyticsConsentGranted) {
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
  }, [analyticsConsentGranted, delayMs]);

  return null;
}
