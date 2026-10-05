'use client';

import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  hasAdsConsentInBrowser,
  hasAnalyticsConsentInBrowser,
} from './consent-client';
import { prepareBrowserAnalyticsEvents } from './journey-browser';
import {
  COMMERCIAL_ANALYTICS_CONTEXT_CHANGED_EVENT,
  COMMERCIAL_ANALYTICS_RESOLVED_EVENT,
  isBrowserCommercialAnalyticsExcluded,
  isBrowserCommercialAnalyticsPending,
} from './commercial-client';
import {
  sendPreparedAnalyticsEvents,
  type PreparedAnalyticsTransportEvent,
} from './ordered-events';

export { sendPreparedAnalyticsEvents } from './ordered-events';

export type DispatchGaEventOptions = {
  maxAttempts?: number;
  retryDelayMs?: number;
};

function dispatchPreparedEvents(
  preparedEvents: PreparedAnalyticsTransportEvent[],
  hasConsent: () => boolean,
  consentCategory: 'analytics' | 'ads',
  options?: DispatchGaEventOptions,
  requiresCommercialEligibility = false,
): Promise<boolean> {
  if (typeof window === 'undefined' || preparedEvents.length === 0 || !hasConsent()) {
    return Promise.resolve(false);
  }
  const maxAttempts = Math.max(1, options?.maxAttempts ?? 120);
  const retryDelayMs = Math.max(100, options?.retryDelayMs ?? 500);

  return new Promise<boolean>((resolve) => {
    let settled = false;
    let timer: number | null = null;
    let unsentIndex = 0;
    let nextAttempt = 0;

    const cleanup = () => {
      if (timer !== null) window.clearTimeout(timer);
      window.removeEventListener('consent:updated', handleConsentUpdated as EventListener);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(COMMERCIAL_ANALYTICS_RESOLVED_EVENT, handleRoleResolved);
      window.removeEventListener(COMMERCIAL_ANALYTICS_CONTEXT_CHANGED_EVENT, handleContextChanged);
    };
    const settle = (value: boolean) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const handleConsentUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{
        categories?: { analytics?: boolean; ads?: boolean };
      }>).detail;
      const eventConsent = detail?.categories?.[consentCategory];
      if (typeof eventConsent === 'boolean') {
        if (!eventConsent) settle(false);
        return;
      }
      if (!hasConsent()) settle(false);
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== ANALYTICS_CONSENT_STORAGE_KEY) return;
      if (!hasConsent()) settle(false);
    };
    const handleRoleResolved = () => {
      if (isBrowserCommercialAnalyticsExcluded()) { settle(false); return; }
      if (isBrowserCommercialAnalyticsPending()) return;
      if (timer !== null) window.clearTimeout(timer);
      send();
    };
    const handleContextChanged = (event: Event) => {
      if ((event as CustomEvent<{ resetJourney?: boolean }>).detail?.resetJourney) settle(false);
    };
    const send = () => {
      if (settled) return;
      const attempt = nextAttempt++;
      timer = null;
      if (!hasConsent() || (requiresCommercialEligibility && isBrowserCommercialAnalyticsExcluded())) {
        settle(false);
        return;
      }
      const gtag = (window as typeof window & { gtag?: (...args: unknown[]) => void }).gtag;
      if (typeof gtag === 'function' && !(requiresCommercialEligibility && isBrowserCommercialAnalyticsPending())) {
        unsentIndex = sendPreparedAnalyticsEvents(gtag, preparedEvents, unsentIndex);
        if (unsentIndex >= preparedEvents.length) {
          settle(true);
          return;
        }
      }
      if (attempt >= maxAttempts) {
        settle(false);
        return;
      }
      timer = window.setTimeout(send, retryDelayMs);
    };

    window.addEventListener('consent:updated', handleConsentUpdated as EventListener);
    window.addEventListener('storage', handleStorage);
    if (requiresCommercialEligibility) {
      window.addEventListener(COMMERCIAL_ANALYTICS_RESOLVED_EVENT, handleRoleResolved);
      window.addEventListener(COMMERCIAL_ANALYTICS_CONTEXT_CHANGED_EVENT, handleContextChanged);
    }
    send();
  });
}

export function dispatchGaEvent(
  eventName: string,
  payload: Record<string, unknown>,
  options?: DispatchGaEventOptions
): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  const preparedEvents = prepareBrowserAnalyticsEvents(eventName, payload);
  return dispatchPreparedEvents(preparedEvents, hasAnalyticsConsentInBrowser, 'analytics', options);
}

export function dispatchGoogleAdsConversion(
  payload: Record<string, unknown>,
  options?: DispatchGaEventOptions,
): Promise<boolean> {
  if (isBrowserCommercialAnalyticsExcluded()) return Promise.resolve(false);
  return dispatchPreparedEvents(
    [{ event: 'conversion', payload: { ...payload } }],
    hasAdsConsentInBrowser,
    'ads',
    options,
    true,
  );
}
