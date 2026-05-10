'use client';

import { authFetch } from '@/lib/authFetch';

type CheckoutInteractionMode = 'hosted' | 'express_checkout';

type CheckoutInteractionEvent = {
  amountCents?: number | null;
  checkoutAttemptId?: number | null;
  eventName: string;
  metadata?: Record<string, unknown> | null;
  mode?: CheckoutInteractionMode | null;
  stripeCheckoutSessionId?: string | null;
};

export function recordCheckoutInteractionEvent(event: CheckoutInteractionEvent): void {
  if (typeof window === 'undefined') return;
  const body = JSON.stringify(event);
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const queued = navigator.sendBeacon('/api/checkout-events', new Blob([body], { type: 'application/json' }));
    if (queued) return;
  }
  void authFetch('/api/checkout-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body,
  }).catch((error) => {
    console.warn('[billing] checkout interaction event failed', error);
  });
}
