'use client';

import clsx from 'clsx';
import { Info } from 'lucide-react';

type AssetFieldTooltipProps = {
  tooltipId: string;
  details: string[];
  fullBleedSingleAsset: boolean;
};

export function AssetFieldTooltip({ tooltipId, details, fullBleedSingleAsset }: AssetFieldTooltipProps) {
  if (!details.length) return null;
  const accessibleLabel = details.join(' ');

  return (
    <span className="group/tooltip relative inline-flex">
      <button
        type="button"
        className={clsx(
          'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
          fullBleedSingleAsset
            ? 'border border-surface-on-media-25 bg-surface-on-media-dark-35 text-on-inverse backdrop-blur hover:bg-surface-on-media-dark-50'
            : 'border border-border/80 text-text-muted hover:border-text-muted hover:text-text-primary dark:border-white/10 dark:bg-white/[0.03] dark:text-white/55 dark:hover:border-white/16 dark:hover:bg-white/[0.06] dark:hover:text-white'
        )}
        aria-label={accessibleLabel}
        aria-describedby={tooltipId}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full z-50 mt-2 hidden w-[min(18rem,calc(100vw-2rem))] rounded-input border border-border bg-surface px-3 py-2 text-left text-[11px] leading-4 text-text-secondary shadow-lg group-hover/tooltip:block group-focus-within/tooltip:block sm:left-1/2 sm:right-auto sm:-translate-x-1/2 dark:border-white/12 dark:bg-[#111827] dark:text-white/78"
      >
        {details.map((line, index) => (
          <span key={`${tooltipId}-${index}`} className={index === 0 ? 'block' : 'mt-1 block'}>
            {line}
          </span>
        ))}
      </span>
    </span>
  );
}
