'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { loadCookiePolicyVersion } from '@/components/legal/cookie-policy-version.client';
import { syncOpenAIAttribution } from '@/lib/analytics/openai-browser';
import {
  COMMERCIAL_ANALYTICS_CONTEXT_CHANGED_EVENT,
  COMMERCIAL_ANALYTICS_RESOLVED_EVENT,
  isBrowserCommercialAnalyticsPending,
} from '@/lib/analytics/commercial-client';

export function OpenAIAttribution() {
  const pathname = usePathname();
  useEffect(() => {
    let active = true;
    let policyVersion: string | null = null;
    let attempted = false;
    let inFlight = false;
    let retries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const sync = () => {
      if (!active || !policyVersion) return;
      const click = syncOpenAIAttribution(policyVersion);
      if (!click || attempted || inFlight || isBrowserCommercialAnalyticsPending()) return;
      inFlight = true;
      // Identity, actual creation time, consent and admin status are verified by the server.
      void fetch('/api/analytics/openai-registration', {
        method: 'POST',
        credentials: 'same-origin',
        signal: controller.signal,
        keepalive: true,
      })
        .then((response) => {
          attempted = response.ok || response.status === 401;
        })
        .catch(() => undefined)
        .finally(() => {
          inFlight = false;
          if (active && !attempted && retries++ < 2) timer = setTimeout(sync, 5000);
        });
    };
    const reset = (event: Event) => {
      if ((event as CustomEvent<{ resetJourney?: boolean }>).detail?.resetJourney) attempted = false;
      sync();
    };
    void loadCookiePolicyVersion().then((version) => {
      policyVersion = version;
      sync();
    });
    window.addEventListener('consent:updated', sync);
    window.addEventListener(COMMERCIAL_ANALYTICS_RESOLVED_EVENT, sync);
    window.addEventListener(COMMERCIAL_ANALYTICS_CONTEXT_CHANGED_EVENT, reset);
    return () => {
      active = false;
      controller.abort();
      if (timer) clearTimeout(timer);
      window.removeEventListener('consent:updated', sync);
      window.removeEventListener(COMMERCIAL_ANALYTICS_RESOLVED_EVENT, sync);
      window.removeEventListener(COMMERCIAL_ANALYTICS_CONTEXT_CHANGED_EVENT, reset);
    };
  }, [pathname]);
  return null;
}
