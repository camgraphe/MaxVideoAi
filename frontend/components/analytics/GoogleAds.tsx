'use client';

import { useEffect } from 'react';

const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? 'AW-992154028';

export function GoogleAds() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const helpers = window as typeof window & {
      gtag?: (...args: unknown[]) => void;
      gtagConsentUpdate?: (payload: Record<string, string>) => void;
      __mvaiGoogleAdsConfiguredIds?: Record<string, boolean>;
    };
    const gtag = helpers.gtag;

    if (!gtag) return;

    if (GOOGLE_ADS_ID) {
      const configuredIds = (helpers.__mvaiGoogleAdsConfiguredIds ??= {});
      if (!configuredIds[GOOGLE_ADS_ID]) {
        gtag('config', GOOGLE_ADS_ID, { allow_enhanced_conversions: false });
        configuredIds[GOOGLE_ADS_ID] = true;
      }
    }

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
