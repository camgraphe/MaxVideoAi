'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { shouldDispatchRecentAnalyticsEvent } from '@/lib/analytics-client';
import { hasAnalyticsConsentInBrowser } from '@/lib/analytics/consent-client';
import { COMMERCIAL_ANALYTICS_RESOLVED_EVENT, isBrowserCommercialAnalyticsPending } from '@/lib/analytics/commercial-client';
import { prepareBrowserAnalyticsEvents } from '@/lib/analytics/journey-browser';
import { sendPreparedAnalyticsEvents } from '@/lib/analytics/ordered-events';
import { getVideoAnalyticsMarker, PUBLIC_VIDEO_WATCH_READY_EVENT } from '@/lib/analytics/public-video';
import {
  buildSafeAnalyticsLocation,
  getAnalyticsRouteContext,
  getSafeAnalyticsPath,
} from '@/lib/analytics-route';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function TrackerCore() {
  const pathname = usePathname();
  const lastViewRef = useRef<string | HTMLElement | null>(null);
  const [trackingRevision, setTrackingRevision] = useState(0);

  useEffect(() => {
    const refreshTracking = () => setTrackingRevision((value) => value + 1);

    window.addEventListener('consent:updated', refreshTracking);
    window.addEventListener(COMMERCIAL_ANALYTICS_RESOLVED_EVENT, refreshTracking);
    window.addEventListener(PUBLIC_VIDEO_WATCH_READY_EVENT, refreshTracking);
    return () => {
      window.removeEventListener('consent:updated', refreshTracking);
      window.removeEventListener(COMMERCIAL_ANALYTICS_RESOLVED_EVENT, refreshTracking);
      window.removeEventListener(PUBLIC_VIDEO_WATCH_READY_EVENT, refreshTracking);
    };
  }, []);

  useEffect(() => {
    if (!pathname) return;
    const routeContext = getAnalyticsRouteContext(pathname);
    if (routeContext.excludedFromGa4) return;
    if (!hasAnalyticsConsentInBrowser()) return;
    const isWatchRoute = routeContext.workspaceSection === 'video';
    const reader = isWatchRoute && window.location.pathname === pathname
      ? getVideoAnalyticsMarker(new URL(window.location.href))
      : null;
    if (isWatchRoute && !reader) return;
    // Public watch readers follow the marketing consent rules and keep a masked page URL.
    const routeFamily = reader ? 'marketing' : routeContext.family;
    const safePath = getSafeAnalyticsPath(pathname);
    const url = buildSafeAnalyticsLocation(window.location.origin, pathname);
    const view = reader ?? url;
    if (lastViewRef.current === view) return;
    let preparedRouteEvents: Array<{ event: string; payload: Record<string, unknown> }> | null = null;
    let unsentIndex = 0;

    const sendPageView = () => {
      if (!hasAnalyticsConsentInBrowser()) return true;
      if (reader && (!reader.isConnected || window.location.pathname !== pathname)) return true;
      if (['workspace', 'app_tools', 'billing'].includes(routeFamily) && isBrowserCommercialAnalyticsPending()) return false;
      const gtag = window.gtag;
      if (typeof gtag !== 'function') return false;
      if (!preparedRouteEvents) {
        if (!reader && !shouldDispatchRecentAnalyticsEvent(`page_view:${routeFamily}:${url}`)) {
          lastViewRef.current = view;
          return true;
        }

        preparedRouteEvents = prepareBrowserAnalyticsEvents('page_view', {
          page_location: url,
          page_path: safePath,
          page_title: document.title,
          route_family: routeFamily,
          tool_name: routeContext.toolName ?? undefined,
          tool_surface: routeContext.toolSurface ?? undefined,
          workspace_section: reader ? undefined : routeContext.workspaceSection ?? undefined,
        });
        if (preparedRouteEvents.length === 0) return true;

        if (routeContext.family === 'public_tools' || routeContext.family === 'app_tools') {
          const toolViewKey = `tool_view:${routeContext.family}:${url}`;
          if (shouldDispatchRecentAnalyticsEvent(toolViewKey)) {
            preparedRouteEvents.push(...prepareBrowserAnalyticsEvents('tool_view', {
              route_family: routeContext.family,
              tool_name: routeContext.toolName ?? 'tools_hub',
              tool_surface: routeContext.toolSurface ?? undefined,
              logged_in: routeContext.family === 'app_tools',
            }));
          }
        }

        if (routeFamily === 'workspace') {
          const appOpenKey = `app_open:${routeContext.family}:${url}`;
          if (shouldDispatchRecentAnalyticsEvent(appOpenKey)) {
            preparedRouteEvents.push(...prepareBrowserAnalyticsEvents('app_open', {
              route_family: routeContext.family,
              app_section: routeContext.workspaceSection ?? 'workspace',
            }));
          }
        }
      }

      unsentIndex = sendPreparedAnalyticsEvents(gtag, preparedRouteEvents, unsentIndex);
      if (unsentIndex < preparedRouteEvents.length) return false;

      lastViewRef.current = view;
      if (process.env.NODE_ENV !== 'production') {
        console.info('[ga4] page_view sent', { url });
      }
      return true;
    };

    if (sendPageView()) {
      return;
    }

    const startedAt = Date.now();
    const RETRY_INTERVAL_MS = 250;
    const RETRY_TIMEOUT_MS = 10000;
    const retryTimer = window.setInterval(() => {
      const timedOut = Date.now() - startedAt > RETRY_TIMEOUT_MS;
      if (sendPageView() || timedOut) {
        window.clearInterval(retryTimer);
      }
    }, RETRY_INTERVAL_MS);

    return () => {
      window.clearInterval(retryTimer);
    };
  }, [pathname, trackingRevision]);

  return null;
}

export function GA4RouteTracker() {
  return <TrackerCore />;
}

export default GA4RouteTracker;
