'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getClarityPageTags } from '@/lib/analytics/clarity-context';
import { hasAdsConsentInBrowser, hasAnalyticsConsentCookieInBrowser } from '@/lib/analytics/consent-client';
import { COMMERCIAL_ANALYTICS_RESOLVED_EVENT } from '@/lib/analytics/commercial-client';
import {
  dumpClarity,
  ensureClarityVisitorId,
  getCachedVisitorId,
  getClarityDebugState,
  hasAnalyticsConsentCookie,
  injectClarityScript,
  isClarityDebugEnabled,
  isClarityEnabledForRuntime,
  onClarityReady,
  queueClarityCommand,
  setAnalyticsConsentCookie,
  setClarityConsent,
} from '@/lib/clarity-client';

let identifiedVisitorId: string | null = null;

function logDebug(message: string) {
  if (!isClarityDebugEnabled()) return;
  const state = getClarityDebugState();
  console.info(`[clarity] ${message}`, state);
}

export function Clarity() {
  const pathname = usePathname();

  useEffect(() => {
    const initialize = () => {
      const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID;
      const tags = getClarityPageTags(pathname || '/');
      if (!clarityId || !tags || !isClarityEnabledForRuntime() || !hasAnalyticsConsentCookieInBrowser()) return;
      setAnalyticsConsentCookie(true);
      setClarityConsent(true, hasAdsConsentInBrowser());
      injectClarityScript(clarityId);
      const visitorId = ensureClarityVisitorId();
      if (visitorId && identifiedVisitorId !== visitorId) {
        identifiedVisitorId = visitorId;
        queueClarityCommand('identify', visitorId);
      }
      if (hasAnalyticsConsentCookie()) {
        Object.entries(tags).forEach(([key, value]) => queueClarityCommand('set', key, value));
      }
      logDebug('loader and page context initialized');
    };
    initialize();
    window.addEventListener(COMMERCIAL_ANALYTICS_RESOLVED_EVENT, initialize);
    window.addEventListener('consent:updated', initialize);
    return () => {
      window.removeEventListener(COMMERCIAL_ANALYTICS_RESOLVED_EVENT, initialize);
      window.removeEventListener('consent:updated', initialize);
    };
  }, [pathname]);

  useEffect(() => {
    if (!isClarityDebugEnabled()) return;
    return onClarityReady(() => {
      const visitorId = getCachedVisitorId();
      logDebug(`script ready (visitor=${visitorId ?? 'unknown'})`);
      dumpClarity();
    });
  }, []);

  return null;
}
