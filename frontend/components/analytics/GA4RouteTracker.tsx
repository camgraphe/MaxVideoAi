'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { shouldDispatchRecentAnalyticsEvent } from '@/lib/analytics-client';
import { hasAnalyticsConsentInBrowser } from '@/lib/analytics/consent-client';
import { prepareBrowserAnalyticsEvents } from '@/lib/analytics/journey-browser';
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
  const prevUrlRef = useRef<string>('');
  const [consentRevision, setConsentRevision] = useState(0);

  useEffect(() => {
    const handleConsentUpdated = () => {
      setConsentRevision((value) => value + 1);
    };

    window.addEventListener('consent:updated', handleConsentUpdated);
    return () => {
      window.removeEventListener('consent:updated', handleConsentUpdated);
    };
  }, []);

  useEffect(() => {
    if (!pathname) return;
    const routeContext = getAnalyticsRouteContext(pathname);
    if (routeContext.excludedFromGa4) return;
    if (!hasAnalyticsConsentInBrowser()) return;
    const safePath = getSafeAnalyticsPath(pathname);
    const url = buildSafeAnalyticsLocation(window.location.origin, pathname);
    if (prevUrlRef.current === url) return;

    const sendPageView = () => {
      if (!hasAnalyticsConsentInBrowser()) return true;
      const gtag = window.gtag;
      if (typeof gtag !== 'function') return false;
      const pageViewKey = `page_view:${routeContext.family}:${url}`;
      if (!shouldDispatchRecentAnalyticsEvent(pageViewKey)) {
        prevUrlRef.current = url;
        return true;
      }

      const pageViewEvents = prepareBrowserAnalyticsEvents('page_view', {
        page_location: url,
        page_path: safePath,
        page_title: document.title,
        route_family: routeContext.family,
        tool_name: routeContext.toolName ?? undefined,
        tool_surface: routeContext.toolSurface ?? undefined,
        workspace_section: routeContext.workspaceSection ?? undefined,
      });
      if (pageViewEvents.length === 0) return true;
      for (const prepared of pageViewEvents) {
        gtag('event', prepared.event, prepared.payload);
      }

      if (routeContext.family === 'public_tools' || routeContext.family === 'app_tools') {
        const toolViewKey = `tool_view:${routeContext.family}:${url}`;
        if (shouldDispatchRecentAnalyticsEvent(toolViewKey)) {
          const toolViewEvents = prepareBrowserAnalyticsEvents('tool_view', {
            route_family: routeContext.family,
            tool_name: routeContext.toolName ?? 'tools_hub',
            tool_surface: routeContext.toolSurface ?? undefined,
            logged_in: routeContext.family === 'app_tools',
          });
          for (const prepared of toolViewEvents) {
            gtag('event', prepared.event, prepared.payload);
          }
        }
      }

      if (routeContext.family === 'workspace') {
        const appOpenKey = `app_open:${routeContext.family}:${url}`;
        if (shouldDispatchRecentAnalyticsEvent(appOpenKey)) {
          const appOpenEvents = prepareBrowserAnalyticsEvents('app_open', {
            route_family: routeContext.family,
            app_section: routeContext.workspaceSection ?? 'workspace',
          });
          for (const prepared of appOpenEvents) {
            gtag('event', prepared.event, prepared.payload);
          }
        }
      }

      prevUrlRef.current = url;
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
  }, [pathname, consentRevision]);

  return null;
}

export function GA4RouteTracker() {
  return <TrackerCore />;
}

export default GA4RouteTracker;
