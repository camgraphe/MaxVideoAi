'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { ConsentScriptGate } from '@/components/legal/ConsentScriptGate';

function TrackerCore() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prevUrlRef = useRef<string>('');

  useEffect(() => {
    if (!pathname) return;
    const query = searchParams?.toString();
    const url = `${window.location.origin}${pathname}${query ? `?${query}` : ''}`;
    if (prevUrlRef.current === url) return;
    prevUrlRef.current = url;
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', {
        page_location: url,
        page_path: pathname,
        page_title: document.title,
      });
      if (process.env.NODE_ENV !== 'production') {
        console.info('[ga4] page_view sent', { url });
      }
    }
  }, [pathname, searchParams]);

  return null;
}

export function GA4RouteTracker() {
  return (
    <ConsentScriptGate categories="analytics">
      <TrackerCore />
    </ConsentScriptGate>
  );
}

export default GA4RouteTracker;
