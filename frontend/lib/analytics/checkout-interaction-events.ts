'use client';

import { authFetch } from '@/lib/authFetch';

export type CheckoutInteractionSource = 'billing' | 'workspace';
export type CheckoutInteractionMode = 'hosted' | 'express_checkout';

export type CheckoutInteractionEvent = {
  amountCents?: number | null;
  checkoutAttemptId?: number | null;
  eventName: string;
  metadata?: Record<string, unknown> | null;
  mode?: CheckoutInteractionMode | null;
  source?: CheckoutInteractionSource;
  stripeCheckoutSessionId?: string | null;
};

export function recordCheckoutInteractionEvent(event: CheckoutInteractionEvent): void {
  if (typeof window === 'undefined') return;
  const metadata = event.source
    ? { ...(event.metadata ?? {}), source: event.source, route_family: event.source }
    : event.metadata;
  const body = JSON.stringify({ ...event, metadata, source: undefined });
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const queued = navigator.sendBeacon(
      '/api/checkout-events',
      new Blob([body], { type: 'application/json' })
    );
    if (queued) return;
  }
  void authFetch('/api/checkout-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body,
  }).catch((error) => {
    console.warn('[checkout] interaction event failed', error);
  });
}
