'use client';

import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  hasAdsConsentInBrowser,
  hasAnalyticsConsentInBrowser,
} from './consent-client';
import { prepareBrowserAnalyticsEvents } from './journey-browser';
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

    const cleanup = () => {
      if (timer !== null) window.clearTimeout(timer);
      window.removeEventListener('consent:updated', handleConsentUpdated as EventListener);
      window.removeEventListener('storage', handleStorage);
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
    const send = (attempt: number) => {
      if (settled) return;
      timer = null;
      if (!hasConsent()) {
        settle(false);
        return;
      }
      const gtag = (window as typeof window & { gtag?: (...args: unknown[]) => void }).gtag;
      if (typeof gtag === 'function') {
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
      timer = window.setTimeout(() => send(attempt + 1), retryDelayMs);
    };

    window.addEventListener('consent:updated', handleConsentUpdated as EventListener);
    window.addEventListener('storage', handleStorage);
    send(0);
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
  return dispatchPreparedEvents(
    [{ event: 'conversion', payload }],
    hasAdsConsentInBrowser,
    'ads',
    options,
  );
}
