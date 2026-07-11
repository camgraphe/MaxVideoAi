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
