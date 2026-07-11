import {
  CONSENT_COOKIE_NAME,
  serializeConsent,
  type ConsentCategory,
  type ConsentRecord,
} from '@/lib/consent';
import {
  ANALYTICS_CONSENT_GRANTED_VALUE,
  ANALYTICS_CONSENT_STORAGE_KEY,
} from '@/lib/analytics/consent-client';
import { clearBrowserAnalyticsState } from '@/lib/analytics/journey-browser';
import { setAnalyticsConsentCookie, setClarityConsent } from '@/lib/clarity-client';

export type BannerState =
  | { ready: false }
  | {
      ready: true;
      version: string;
      consent: ConsentRecord | null;
    };

export type FetchState = 'idle' | 'saving';

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 395; // ~13 months
const PUBLIC_GOOGLE_CONSENT_MODE = (process.env.NEXT_PUBLIC_GOOGLE_CONSENT_MODE ?? 'auto').toLowerCase();

export const DEFAULT_CHOICES: Record<ConsentCategory, boolean> = {
  analytics: false,
  ads: false,
};

export const OPEN_PREFERENCES_EVENT = 'consent:open-preferences';

export function readConsentCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie ? document.cookie.split(';') : [];
  for (const entry of cookies) {
    const [key, ...rest] = entry.trim().split('=');
    if (key === CONSENT_COOKIE_NAME) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

export function writeConsentCookie(record: ConsentRecord) {
  if (typeof document === 'undefined') return;
  const payload = encodeURIComponent(serializeConsent(record));
  document.cookie = `${CONSENT_COOKIE_NAME}=${payload}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function broadcastConsent(record: ConsentRecord) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('consent:updated', {
      detail: {
        version: record.version,
        categories: record.categories,
        timestamp: record.timestamp,
      },
    })
  );
}

export function applyStoredConsentEffects(record: ConsentRecord) {
  const analyticsGranted = Boolean(record.categories.analytics);
  broadcastConsent(record);
  setAnalyticsConsentCookie(analyticsGranted);
  setLocalAnalyticsFlag(analyticsGranted);
  if (!analyticsGranted) clearBrowserAnalyticsState();
  setClarityConsent(analyticsGranted);
  updateGoogleConsent(record.categories);
}

export function clearLocalAnalyticsFlag() {
  setLocalAnalyticsFlag(false);
  clearBrowserAnalyticsState();
}

export async function persistCookieConsent(categories: ConsentRecord['categories']) {
  try {
    await fetch('/api/legal/cookies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ categories }),
    });
  } catch (error) {
    console.warn('[cookie-consent] failed to persist to server', error);
  }
}

function setLocalAnalyticsFlag(granted: boolean) {
  if (typeof window === 'undefined') return;
  try {
    if (granted) {
      window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, ANALYTICS_CONSENT_GRANTED_VALUE);
    } else {
      window.localStorage.removeItem(ANALYTICS_CONSENT_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

function updateGoogleConsent(categories: ConsentRecord['categories']) {
  if (typeof window === 'undefined') return;
  if (PUBLIC_GOOGLE_CONSENT_MODE === 'false' || PUBLIC_GOOGLE_CONSENT_MODE === 'off') {
    return;
  }

  const consentUpdate = {
    ad_storage: categories.ads ? 'granted' : 'denied',
    ad_user_data: categories.ads ? 'granted' : 'denied',
    ad_personalization: categories.ads ? 'granted' : 'denied',
    analytics_storage: categories.analytics ? 'granted' : 'denied',
  };

  const helpers = window as typeof window & {
    gtag?: (...args: unknown[]) => void;
    gtagConsentUpdate?: (payload: Record<string, string>) => void;
    dataLayer?: Array<Record<string, unknown>>;
  };

  if (typeof helpers.gtagConsentUpdate === 'function') {
    helpers.gtagConsentUpdate(consentUpdate);
    return;
  }

  if (typeof helpers.gtag === 'function') {
    helpers.gtag('consent', 'update', consentUpdate);
    return;
  }

  if (Array.isArray(helpers.dataLayer)) {
    helpers.dataLayer.push({
      event: 'consent_update',
      ...consentUpdate,
    });
  }
}
