'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
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
  const searchParams = useSearchParams();

  useEffect(() => {
    const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID;
    if (!clarityId) return;
    if (!isClarityEnabledForRuntime()) return;

    setAnalyticsConsentCookie(true);
    setClarityConsent(true);
    injectClarityScript(clarityId);
    logDebug('loader initialized');

    const visitorId = ensureClarityVisitorId();
    if (visitorId && identifiedVisitorId !== visitorId) {
      identifiedVisitorId = visitorId;
      queueClarityCommand('identify', visitorId);
      logDebug(`identify → ${visitorId}`);
    }
  }, []);

  useEffect(() => {
    if (!isClarityEnabledForRuntime()) return;
    if (!hasAnalyticsConsentCookie()) return;
    const qs = searchParams?.toString();
    const url = qs ? `${pathname}?${qs}` : pathname || '/';
    queueClarityCommand('set', 'page', url);
    logDebug(`page set → ${url}`);
  }, [pathname, searchParams]);

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
