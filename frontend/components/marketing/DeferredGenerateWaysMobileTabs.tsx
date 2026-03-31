'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import type { GenerateWaysItem } from '@/components/marketing/GenerateWaysMobileTabs';

const GenerateWaysMobileTabs = dynamic(
  () => import('@/components/marketing/GenerateWaysMobileTabs').then((mod) => mod.GenerateWaysMobileTabs)
);

function StaticMobileTabsFallback({ items }: { items: readonly GenerateWaysItem[] }) {
  const activeItem = items[0];
  if (!activeItem) return null;

  return (
    <div className="sm:hidden">
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
        role="tablist"
        aria-label="Generate ways"
      >
        {items.map((item, index) => (
          <span
            key={item.title}
            className={clsx(
              'rounded-pill border px-2 py-1 text-center text-[11px] font-semibold leading-tight',
              index === 0 ? 'border-brand/40 bg-brand/10 text-brand' : 'border-hairline bg-transparent text-text-secondary'
            )}
          >
            {item.title}
          </span>
        ))}
      </div>
      <div className="mt-2 rounded-xl border border-hairline bg-transparent p-3">
        {activeItem.imageSrc ? (
          <div className="relative mb-3 overflow-hidden rounded-[14px] border border-hairline bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={activeItem.imageSrc} alt={activeItem.imageAlt ?? activeItem.title} className="aspect-[16/10] w-full object-cover" />
          </div>
        ) : null}
        <p className="text-xs leading-relaxed text-text-secondary">{activeItem.body}</p>
      </div>
    </div>
  );
}

export function DeferredGenerateWaysMobileTabs({ items }: { items: readonly GenerateWaysItem[] }) {
  const safeItems = useMemo(() => items.filter((item) => item?.title && item?.body), [items]);
  const [shouldMount, setShouldMount] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;
    const mediaQuery = window.matchMedia('(max-width: 639px)');

    const scheduleMount = () => {
      if (!mediaQuery.matches) {
        setShouldMount(false);
        return;
      }
      if ('requestIdleCallback' in window) {
        idleId = window.requestIdleCallback(() => setShouldMount(true), { timeout: 1000 });
        return;
      }
      timeoutId = globalThis.setTimeout(() => setShouldMount(true), 120);
    };

    scheduleMount();
    mediaQuery.addEventListener('change', scheduleMount);

    return () => {
      mediaQuery.removeEventListener('change', scheduleMount);
      if (idleId != null && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId != null) {
        globalThis.clearTimeout(timeoutId);
      }
    };
  }, []);

  if (!safeItems.length) return null;
  if (!shouldMount) return <StaticMobileTabsFallback items={safeItems} />;
  return <GenerateWaysMobileTabs items={safeItems} />;
}
