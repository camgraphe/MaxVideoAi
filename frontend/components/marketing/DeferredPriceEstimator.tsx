'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import type { PriceEstimatorProps } from '@/components/marketing/PriceEstimator';

const PriceEstimator = dynamic(
  () => import('@/components/marketing/PriceEstimator').then((mod) => mod.PriceEstimator),
  { ssr: false }
);

function PriceEstimatorPlaceholder() {
  return (
    <div className="min-h-[720px] rounded-[28px] border border-hairline bg-surface p-5 shadow-card sm:min-h-[560px] sm:p-6">
      <div className="h-6 w-40 rounded-full bg-surface-2" aria-hidden />
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-hairline bg-bg p-4">
          <div className="h-4 w-20 rounded-full bg-surface-2" aria-hidden />
          <div className="h-11 rounded-xl bg-surface-2" aria-hidden />
          <div className="h-11 rounded-xl bg-surface-2" aria-hidden />
        </div>
        <div className="space-y-3 rounded-2xl border border-hairline bg-bg p-4">
          <div className="h-4 w-24 rounded-full bg-surface-2" aria-hidden />
          <div className="h-24 rounded-2xl bg-surface-2" aria-hidden />
          <div className="h-10 rounded-xl bg-surface-2" aria-hidden />
        </div>
      </div>
    </div>
  );
}

export function DeferredPriceEstimator(props: PriceEstimatorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [shouldMount, setShouldMount] = useState(false);

  useEffect(() => {
    if (shouldMount || typeof window === 'undefined') return;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;

    const load = () => {
      if ('requestIdleCallback' in window) {
        idleId = window.requestIdleCallback(() => setShouldMount(true), { timeout: 1200 });
        return;
      }
      timeoutId = globalThis.setTimeout(() => setShouldMount(true), 160);
    };

    const node = containerRef.current;
    if (!node) {
      load();
      return () => {
        if (idleId != null && 'cancelIdleCallback' in window) {
          window.cancelIdleCallback(idleId);
        }
        if (timeoutId != null) {
          window.clearTimeout(timeoutId);
        }
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          load();
        }
      },
      { rootMargin: '320px' }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
      if (idleId != null && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId != null) {
        globalThis.clearTimeout(timeoutId);
      }
    };
  }, [shouldMount]);

  return <div ref={containerRef}>{shouldMount ? <PriceEstimator {...props} /> : <PriceEstimatorPlaceholder />}</div>;
}
