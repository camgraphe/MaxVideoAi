'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import type { PriceEstimatorProps } from '@/components/marketing/PriceEstimator';

const DynamicPriceEstimator = dynamic(
  () => import('@/components/marketing/PriceEstimator').then((mod) => mod.PriceEstimator),
  {
    ssr: false,
    loading: () => <PriceEstimatorShell />,
  }
);

function PriceEstimatorShell() {
  return (
    <div
      aria-hidden="true"
      className="price-estimator-border min-h-[560px] rounded-[24px] border border-hairline bg-surface shadow-card sm:min-h-[520px] lg:min-h-[390px]"
    />
  );
}

export function LazyPriceEstimator(props: PriceEstimatorProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (shouldLoad) return;
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '180px 0px' }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [shouldLoad]);

  return <div ref={ref}>{shouldLoad ? <DynamicPriceEstimator {...props} /> : <PriceEstimatorShell />}</div>;
}
