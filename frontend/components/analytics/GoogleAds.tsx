'use client';

import { useEffect } from 'react';

const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? 'AW-992154028';
const GOOGLE_ANALYTICS_ID =
  process.env.NEXT_PUBLIC_GA_ID ??
  process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID ??
  process.env.NEXT_PUBLIC_GA4_ID ??
  '';
const GOOGLE_TAG_IDS = Array.from(new Set([GOOGLE_ADS_ID, GOOGLE_ANALYTICS_ID].filter(Boolean)));

export function GoogleAds() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const helpers = window as typeof window & {
      gtag?: (...args: unknown[]) => void;
      gtagConsentUpdate?: (payload: Record<string, string>) => void;
    };
    const gtag = helpers.gtag;

    if (!gtag) return;

    GOOGLE_TAG_IDS.forEach((id) => {
      gtag('config', id, { allow_enhanced_conversions: false });
    });

    if (typeof helpers.gtagConsentUpdate !== 'function') {
      helpers.gtagConsentUpdate = (payload: Record<string, string>) => {
        if (typeof helpers.gtag === 'function') {
          helpers.gtag('consent', 'update', payload);
        }
      };
    }
  }, []);

  return null;
}
