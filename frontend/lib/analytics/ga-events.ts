'use client';

import { hasAnalyticsConsentInBrowser } from './consent-client';
import { prepareBrowserAnalyticsEvents } from './journey-browser';

export type DispatchGaEventOptions = {
  maxAttempts?: number;
  retryDelayMs?: number;
};

export function dispatchGaEvent(
  eventName: string,
  payload: Record<string, unknown>,
  options?: DispatchGaEventOptions
): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  const preparedEvents = prepareBrowserAnalyticsEvents(eventName, payload);
  if (preparedEvents.length === 0) return Promise.resolve(false);
  const maxAttempts = Math.max(1, options?.maxAttempts ?? 120);
  const retryDelayMs = Math.max(100, options?.retryDelayMs ?? 500);

  return new Promise<boolean>((resolve) => {
    const send = (attempt: number) => {
      if (!hasAnalyticsConsentInBrowser()) {
        resolve(false);
        return;
      }
      const gtag = (window as typeof window & { gtag?: (...args: unknown[]) => void }).gtag;
      if (typeof gtag === 'function') {
        for (const prepared of preparedEvents) {
          gtag('event', prepared.event, prepared.payload);
        }
        resolve(true);
        return;
      }
      if (attempt >= maxAttempts) {
        resolve(false);
        return;
      }
      window.setTimeout(() => send(attempt + 1), retryDelayMs);
    };
    send(0);
  });
}
