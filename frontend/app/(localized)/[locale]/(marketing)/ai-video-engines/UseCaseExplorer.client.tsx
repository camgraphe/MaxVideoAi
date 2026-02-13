'use client';

import { useMemo, useState } from 'react';
import { Link } from '@/i18n/navigation';
import type { HubPair } from '@/lib/compare-hub/data';

type UseCaseBucketView = {
  id: string;
  label: string;
  pairs: HubPair[];
};

type UseCaseExplorerProps = {
  buckets: UseCaseBucketView[];
  compareLabel: string;
};

export function UseCaseExplorer({ buckets, compareLabel }: UseCaseExplorerProps) {
  const [activeId, setActiveId] = useState(buckets[0]?.id ?? '');

  const activeBucket = useMemo(
    () => buckets.find((bucket) => bucket.id === activeId) ?? buckets[0],
    [activeId, buckets]
  );

  if (!activeBucket) {
    return null;
  }

  return (
    <div className="space-y-4 rounded-2xl border border-hairline bg-surface p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap gap-2">
        {buckets.map((bucket) => {
          const active = bucket.id === activeBucket.id;
          return (
            <button
              key={bucket.id}
              type="button"
              onClick={() => setActiveId(bucket.id)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-micro transition ${
                active
                  ? 'border-brand bg-brand/10 text-brand'
                  : 'border-hairline text-text-secondary hover:border-text-muted hover:text-text-primary'
              }`}
            >
              {bucket.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {activeBucket.pairs.map((pair) => (
          <article key={`${activeBucket.id}-${pair.slug}`} className="rounded-xl border border-hairline bg-bg p-4">
            <h3 className="text-sm font-semibold text-text-primary">{pair.label}</h3>
            <Link
              href={{ pathname: '/ai-video-engines/[slug]', params: { slug: pair.slug } }}
              prefetch={false}
              className="mt-3 inline-flex text-sm font-semibold text-brand hover:text-brandHover"
            >
              {compareLabel}
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
