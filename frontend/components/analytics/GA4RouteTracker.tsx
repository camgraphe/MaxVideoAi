'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function TrackerCore() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
    const query = searchParams?.toString();
    const url = `${window.location.origin}${pathname}${query ? `?${query}` : ''}`;
    if (prevUrlRef.current === url) return;

    const sendPageView = () => {
      if (typeof window.gtag !== 'function') return false;
      window.gtag('event', 'page_view', {
        page_location: url,
        page_path: pathname,
        page_title: document.title,
      });
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
  }, [pathname, searchParams, consentRevision]);

  return null;
}

export function GA4RouteTracker() {
  return <TrackerCore />;
}

export default GA4RouteTracker;
