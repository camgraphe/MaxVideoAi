'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';

type GenerateWaysItem = {
  title: string;
  body: string;
  imageSrc?: string;
  imageAlt?: string;
};

export function GenerateWaysMobileTabs({ items }: { items: readonly GenerateWaysItem[] }) {
  const safeItems = useMemo(() => items.filter((item) => item?.title && item?.body), [items]);
  const [activeIndex, setActiveIndex] = useState(0);

  if (!safeItems.length) return null;

  const boundedIndex = Math.min(activeIndex, safeItems.length - 1);
  const activeItem = safeItems[boundedIndex];

  return (
    <div className="sm:hidden">
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${safeItems.length}, minmax(0, 1fr))` }}
        role="tablist"
        aria-label="Generate ways"
      >
        {safeItems.map((item, index) => {
          const isActive = index === boundedIndex;
          return (
            <button
              key={item.title}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveIndex(index)}
              className={clsx(
                'rounded-pill border px-2 py-1 text-[11px] font-semibold leading-tight',
                'truncate transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive
                  ? 'border-brand/40 bg-brand/10 text-brand'
                  : 'border-hairline bg-transparent text-text-secondary'
              )}
              title={item.title}
            >
              {item.title}
            </button>
          );
        })}
      </div>
      <div className="mt-2 rounded-xl border border-hairline bg-transparent p-3" role="tabpanel">
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
