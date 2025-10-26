'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void;
  }
}

function loadClarity(id: string) {
  if (typeof window === 'undefined') return;
  if (window.clarity) return;

  (function (c, l, a, r, i, t, y) {
    c[a] =
      c[a] ||
      function (...args: unknown[]) {
        (c[a].q = c[a].q || []).push(args);
      };
    t = l.createElement(r);
    t.async = 1;
    t.src = `https://www.clarity.ms/tag/${i}`;
    y = l.getElementsByTagName(r)[0];
    y.parentNode?.insertBefore(t, y);
  })(window, document, 'clarity', 'script', id);
}

export function Clarity() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const clarityEnabled = process.env.NEXT_PUBLIC_ENABLE_CLARITY === 'true';
    const isProd = process.env.NODE_ENV === 'production';
    const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID;
    if (!clarityEnabled) return;
    if (!isProd) return;
    if (!clarityId) return;
    loadClarity(clarityId);
  }, []);

  useEffect(() => {
    const clarityEnabled = process.env.NEXT_PUBLIC_ENABLE_CLARITY === 'true';
    const isProd = process.env.NODE_ENV === 'production';
    if (!clarityEnabled) return;
    if (!isProd) return;
    if (typeof window === 'undefined' || !window.clarity) return;
    const qs = searchParams?.toString();
    const url = qs ? `${pathname}?${qs}` : pathname || '/';
    try {
      window.clarity('set', 'page', url);
    } catch {
      // ignore clarity errors
    }
  }, [pathname, searchParams]);

  return null;
}
