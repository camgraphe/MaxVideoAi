'use client';

import { useEffect, useMemo, useState } from 'react';
import { CONSENT_COOKIE_NAME, hasConsentFor, parseConsent, type ConsentCategory, type ConsentRecord } from '@/lib/consent';

type Props = {
  categories: ConsentCategory | ConsentCategory[];
  children: React.ReactNode;
};

type ConsentEventDetail = {
  version: string;
  categories: ConsentRecord['categories'];
  timestamp: number;
};

function readCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie ? document.cookie.split(';') : [];
  for (const entry of cookies) {
    const [key, ...rest] = entry.trim().split('=');
    if (key === CONSENT_COOKIE_NAME) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

export function ConsentScriptGate({ categories, children }: Props) {
  const required = useMemo(() => (Array.isArray(categories) ? categories : [categories]), [categories]);
  const [allowed, setAllowed] = useState(() => hasConsentFor(parseConsent(readCookie()), required));

  useEffect(() => {
    setAllowed(hasConsentFor(parseConsent(readCookie()), required));
  }, [required]);

  useEffect(() => {
    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<ConsentEventDetail>).detail;
      if (!detail) return;
      const record: ConsentRecord = {
        version: detail.version,
        timestamp: detail.timestamp,
        categories: detail.categories,
        source: 'banner',
      };
      setAllowed(hasConsentFor(record, required));
    };
    window.addEventListener('consent:updated', handleUpdate as EventListener);
    return () => window.removeEventListener('consent:updated', handleUpdate as EventListener);
  }, [required]);

  if (!allowed) {
    return null;
  }

  return <>{children}</>;
}
