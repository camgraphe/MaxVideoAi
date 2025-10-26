'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  flushPendingClarityCommands,
  getClarityDebugState,
  isClarityDebugEnabled,
  isClarityEnabledForRuntime,
  markClarityReady,
  onClarityReady,
  queueClarityCommand,
  ensureClarityVisitorId,
  getCachedVisitorId,
} from '@/lib/clarity-client';

let scriptAppended = false;
let identifiedVisitorId: string | null = null;

function loadClarity(id: string) {
  if (typeof document === 'undefined') return;
  if (scriptAppended) return;
  scriptAppended = true;

  flushPendingClarityCommands();

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${id}`;
  script.dataset.analytics = 'clarity';
  script.addEventListener('load', () => {
    markClarityReady();
  });
  script.addEventListener('error', (error) => {
    scriptAppended = false;
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[clarity] failed to load script', error);
    }
  });

  const firstScript = document.getElementsByTagName('script')[0];
  if (firstScript?.parentNode) {
    firstScript.parentNode.insertBefore(script, firstScript);
  } else if (document.head) {
    document.head.appendChild(script);
  } else {
    document.documentElement.appendChild(script);
  }
}

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

    loadClarity(clarityId);
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
    });
  }, []);

  return null;
}
