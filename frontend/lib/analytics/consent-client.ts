import { CONSENT_COOKIE_NAME, hasConsentFor, parseConsent } from '@/lib/consent';

export const ANALYTICS_CONSENT_STORAGE_KEY = 'mv-consent-analytics';
export const ANALYTICS_CONSENT_GRANTED_VALUE = 'granted';

export function hasAnalyticsConsentInBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY) === ANALYTICS_CONSENT_GRANTED_VALUE;
  } catch {
    return false;
  }
}

export function analyticsConsentFromUpdateEvent(event: Event): boolean {
  const detail = (event as CustomEvent<{ categories?: { analytics?: boolean } }>).detail;
  if (typeof detail?.categories?.analytics === 'boolean') {
    return detail.categories.analytics;
  }
  return hasAnalyticsConsentInBrowser();
}

export function hasAdsConsentInBrowser(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    for (const entry of document.cookie ? document.cookie.split(';') : []) {
      const [key, ...rest] = entry.trim().split('=');
      if (key === CONSENT_COOKIE_NAME) {
        return hasConsentFor(parseConsent(decodeURIComponent(rest.join('='))), 'ads');
      }
    }
  } catch {
    return false;
  }
  return false;
}
