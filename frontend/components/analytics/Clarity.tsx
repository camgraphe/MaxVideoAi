'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

type ClarityFunction = ((...args: unknown[]) => void) & { q?: unknown[][] };

function loadClarity(id: string) {
  if (typeof window === 'undefined') return;
  const clarityWindow = window as typeof window & { clarity?: ClarityFunction };
  if (clarityWindow.clarity) return;

  const clarityFn: ClarityFunction = (...args: unknown[]) => {
    (clarityFn.q = clarityFn.q || []).push(args);
  };
  clarityFn.q = clarityFn.q || [];

  clarityWindow.clarity = clarityFn;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${id}`;
  const firstScript = document.getElementsByTagName('script')[0];
  if (firstScript?.parentNode) {
    firstScript.parentNode.insertBefore(script, firstScript);
  } else {
    document.head?.appendChild(script);
  }
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
    if (typeof window === 'undefined') return;
    const clarityWindow = window as typeof window & { clarity?: ClarityFunction };
    const clarityFn = clarityWindow.clarity;
    if (!clarityFn) return;
    const qs = searchParams?.toString();
    const url = qs ? `${pathname}?${qs}` : pathname || '/';
    try {
      clarityFn('set', 'page', url);
    } catch {
      // ignore clarity errors
    }
  }, [pathname, searchParams]);

  return null;
}
