'use client';

import { useMemo, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { Input } from '@/components/ui/Input';

type ComparisonEntry = {
  slug: string;
  label: string;
};

type ComparisonsDirectoryProps = {
  entries: ComparisonEntry[];
  labels: {
    searchPlaceholder: string;
    loadMore: string;
    empty: string;
  };
  initialCount?: number;
  step?: number;
};

export function ComparisonsDirectory({
  entries,
  labels,
  initialCount = 24,
  step = 24,
}: ComparisonsDirectoryProps) {
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(initialCount);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return entries;
    return entries.filter((entry) => entry.label.toLowerCase().includes(normalized));
  }, [entries, query]);

  const visible = filtered.slice(0, visibleCount);
  const canLoadMore = visibleCount < filtered.length;

  return (
    <div className="rounded-[16px] border border-hairline bg-surface p-4 shadow-card sm:p-5">
      <div className="flex flex-col gap-3 border-b border-hairline pb-4 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setVisibleCount(initialCount);
          }}
          placeholder={labels.searchPlaceholder}
          className="h-11 w-full max-w-xl rounded-[12px] bg-bg text-sm"
        />
        <span className="shrink-0 text-xs font-semibold uppercase tracking-micro text-text-muted">
          {visible.length}/{filtered.length}
        </span>
      </div>

      {visible.length ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((entry) => (
            <Link
              key={entry.slug}
              href={{ pathname: '/ai-video-engines/[slug]', params: { slug: entry.slug } }}
              prefetch={false}
              className="group flex min-h-[54px] items-center justify-between gap-3 rounded-[12px] border border-hairline bg-bg px-3 py-2 text-sm text-text-secondary transition hover:border-brand/40 hover:bg-surface-2 hover:text-text-primary"
            >
              <span className="min-w-0 font-semibold leading-snug text-text-primary">{entry.label}</span>
              <span
                aria-hidden
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface text-text-muted transition group-hover:bg-brand group-hover:text-on-brand"
              >
                →
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-text-secondary">{labels.empty}</p>
      )}

      {canLoadMore ? (
        <button
          type="button"
          onClick={() => setVisibleCount((current) => current + step)}
          className="mt-4 inline-flex min-h-[40px] items-center justify-center rounded-full border border-hairline bg-surface px-5 text-sm font-semibold text-text-secondary transition hover:border-text-muted hover:text-text-primary"
        >
          {labels.loadMore}
        </button>
      ) : null}
    </div>
  );
}
