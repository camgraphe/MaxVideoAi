'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { suppressLoadedAnalyticsForExcludedRoute } from '@/lib/analytics-client';
import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  hasAnalyticsConsentInBrowser,
  hasAnalyticsConsentForPolicyVersion,
} from '@/lib/analytics/consent-client';
import { loadCookiePolicyVersion } from '@/components/legal/cookie-policy-version.client';
import { readConsentCookie, updateGoogleConsent } from '@/components/legal/cookie-banner-client';
import { parseConsent } from '@/lib/consent';
import { getAnalyticsRouteContext } from '@/lib/analytics-route';
import {
  COMMERCIAL_ANALYTICS_CONTEXT_CHANGED_EVENT,
  COMMERCIAL_ANALYTICS_RESOLVED_EVENT,
  isBrowserCommercialAnalyticsExcluded,
} from '@/lib/analytics/commercial-client';

const GA_ID =
  process.env.NEXT_PUBLIC_GA_ID ??
  process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID ??
  process.env.NEXT_PUBLIC_GA4_ID ??
  '';

const DISABLE_GA =
  process.env.NEXT_PUBLIC_DISABLE_GA === '1' ||
  process.env.NODE_ENV === 'test';

type ConsentEventDetail = {
  version?: string;
  categories?: {
    analytics?: boolean;
  };
};

export default function ConsentModeBootstrap() {
  const pathname = usePathname();
  const [analyticsConsentGranted, setAnalyticsConsentGranted] = useState(false);
  const [externalScriptReady, setExternalScriptReady] = useState(false);
  const [policyVersion, setPolicyVersion] = useState<string | null>(null);
  const routeContext = getAnalyticsRouteContext(pathname);

  useEffect(() => {
    if (!routeContext.excludedFromGa4) return;
    suppressLoadedAnalyticsForExcludedRoute({ gaId: GA_ID });
  }, [routeContext.excludedFromGa4]);

  useEffect(() => {
    let active = true;
    let currentVersion: string | null = null;
    const syncConsent = (granted: boolean) => {
      const excluded = isBrowserCommercialAnalyticsExcluded();
      if (GA_ID) (window as unknown as Record<string, unknown>)[`ga-disable-${GA_ID}`] =
        excluded || getAnalyticsRouteContext(window.location.pathname).excludedFromGa4;
      setAnalyticsConsentGranted(granted && hasAnalyticsConsentForPolicyVersion(currentVersion) && !excluded);
    };
    const syncFromStorage = () => syncConsent(hasAnalyticsConsentInBrowser());

    const handleConsentUpdated = (event: Event) => {
      const detail = (event as CustomEvent<ConsentEventDetail>).detail;
      if (typeof detail?.version === 'string') {
        currentVersion = detail.version;
        setPolicyVersion(currentVersion);
      }
      if (detail?.categories && typeof detail.categories.analytics === 'boolean') {
        syncConsent(Boolean(detail.categories.analytics));
        return;
      }
      syncFromStorage();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== ANALYTICS_CONSENT_STORAGE_KEY) return;
      syncFromStorage();
    };

    void loadCookiePolicyVersion().then(version => {
      if (!active) return;
      currentVersion = version;
      setPolicyVersion(version);
      syncFromStorage();
    });
    window.addEventListener('consent:updated', handleConsentUpdated as EventListener);
    window.addEventListener('storage', handleStorage);
    window.addEventListener(COMMERCIAL_ANALYTICS_RESOLVED_EVENT, syncFromStorage);
    window.addEventListener(COMMERCIAL_ANALYTICS_CONTEXT_CHANGED_EVENT, syncFromStorage);
    return () => {
      active = false;
      window.removeEventListener('consent:updated', handleConsentUpdated as EventListener);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(COMMERCIAL_ANALYTICS_RESOLVED_EVENT, syncFromStorage);
      window.removeEventListener(COMMERCIAL_ANALYTICS_CONTEXT_CHANGED_EVENT, syncFromStorage);
    };
  }, []);

  useEffect(() => {
    if (!GA_ID || DISABLE_GA || externalScriptReady || !analyticsConsentGranted || routeContext.excludedFromGa4) {
      return;
    }

    // Delay Next's preload as well as script insertion, with cancellable consent/route checks.
    let cancelled = false;
    let idleId: number | undefined;
    let timerId: number | undefined;
    const mountScript = () => {
      if (cancelled || !hasAnalyticsConsentInBrowser() || !hasAnalyticsConsentForPolicyVersion(policyVersion) || isBrowserCommercialAnalyticsExcluded()) return;
      if (getAnalyticsRouteContext(window.location.pathname).excludedFromGa4) return;
      setExternalScriptReady(true);
    };
    const scheduleScript = () => {
      if (cancelled) return;
      if (typeof window.requestIdleCallback === 'function') {
        idleId = window.requestIdleCallback(mountScript);
      } else {
        timerId = window.setTimeout(mountScript, 1);
      }
    };

    if (document.readyState === 'complete') scheduleScript();
    else window.addEventListener('load', scheduleScript, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener('load', scheduleScript);
      if (idleId !== undefined) window.cancelIdleCallback?.(idleId);
      if (timerId !== undefined) window.clearTimeout(timerId);
    };
  }, [analyticsConsentGranted, externalScriptReady, policyVersion, routeContext.excludedFromGa4]);

  if (!GA_ID) return null;
  if (DISABLE_GA) return null;
  if (routeContext.excludedFromGa4) return null;
  if (!analyticsConsentGranted) return null;

  return (
    <>
      <Script id="gcm-default" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}

          gtag('consent', 'default', {
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            ad_storage: 'denied',
            analytics_storage: 'denied',
            functionality_storage: 'granted',
            security_storage: 'granted'
          });

          gtag('set', 'url_passthrough', true);
        `}
      </Script>
      {externalScriptReady ? (
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      ) : null}
      <Script id="ga-init" strategy="afterInteractive" onReady={() => {
        const consent = parseConsent(readConsentCookie());
        if (consent?.version === policyVersion) updateGoogleConsent(consent.categories);
      }}>
        {`
          window.dataLayer = window.dataLayer || [];
          window.gtag = window.gtag || function(){dataLayer.push(arguments);};
          gtag('js', new Date());
          gtag('config', '${GA_ID}', {
            anonymize_ip: true,
            allow_google_signals: false,
            send_page_view: false${process.env.NODE_ENV !== 'production' ? `,
            debug_mode: true` : ''}
          });
        `}
      </Script>
    </>
  );
}
