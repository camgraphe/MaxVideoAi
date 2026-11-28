'use client';

import { useEffect, useRef, type MouseEvent } from 'react';
import type { AppLocale } from '@/i18n/locales';
import { dispatchGaEvent } from '@/lib/analytics/ga-events';
import type { McpIntegrationId } from '@/lib/mcp-integration-registry';

type McpConnectDestination = 'verified_deep_link' | 'setup_guide';
const NAVIGATION_WAIT_MS = 750;

function isPlainPrimaryClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  const target = event.currentTarget.getAttribute('target');
  return (
    event.button === 0 &&
    (!target || target === '_self') &&
    !event.currentTarget.hasAttribute('download') &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey
  );
}

export async function recordMcpAcquisition(client: McpIntegrationId, action: 'connect' | 'copy_endpoint') {
  try {
    return await fetch('/api/mcp/acquisition', {
      method: 'POST',
      cache: 'no-store',
      credentials: 'same-origin',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        source: 'mcp_landing',
        medium: 'owned',
        campaign: 'mcp_connect',
        client,
      }),
    });
  } catch {
    return null;
  }
}

export function useMcpConnectNavigation(
  locale: AppLocale,
  navigate: (href: string) => void = (href) => window.location.assign(href),
) {
  const mountedRef = useRef(true);
  const pendingNavigationRef = useRef<{
    href: string;
    navigated: boolean;
    timerId: number | null;
  } | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    // Back from the directory can restore the same mounted page from bfcache.
    const restoreNavigation = (event: PageTransitionEvent) => {
      if (event.persisted && pendingNavigationRef.current?.navigated) {
        pendingNavigationRef.current = null;
      }
    };
    window.addEventListener('pageshow', restoreNavigation);
    return () => {
      mountedRef.current = false;
      window.removeEventListener('pageshow', restoreNavigation);
      const pending = pendingNavigationRef.current;
      if (pending?.timerId !== null && pending?.timerId !== undefined) {
        window.clearTimeout(pending.timerId);
      }
      pendingNavigationRef.current = null;
    };
  }, []);

  function trackConnectAction(client: McpIntegrationId, destination: McpConnectDestination) {
    void dispatchGaEvent('mcp_landing_cta_clicked', {
      action: 'connect',
      client,
      destination,
      locale,
    });
    return recordMcpAcquisition(client, 'connect');
  }

  function handleActionClick(client: McpIntegrationId, destination: McpConnectDestination) {
    return (event: MouseEvent<HTMLAnchorElement>) => {
      if (!isPlainPrimaryClick(event)) {
        void trackConnectAction(client, destination);
        return;
      }

      event.preventDefault();
      if (pendingNavigationRef.current) return;

      const pending = {
        href: event.currentTarget.href,
        navigated: false,
        timerId: null as number | null,
      };
      pendingNavigationRef.current = pending;

      const navigateOnce = () => {
        if (!mountedRef.current || pending.navigated) return;
        pending.navigated = true;
        if (pending.timerId !== null) window.clearTimeout(pending.timerId);
        navigate(pending.href);
      };
      pending.timerId = window.setTimeout(navigateOnce, NAVIGATION_WAIT_MS);
      void trackConnectAction(client, destination).finally(navigateOnce);
    };
  }

  return handleActionClick;
}
