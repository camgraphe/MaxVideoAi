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
  initialCount = 40,
  step = 20,
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
    <div className="space-y-4 rounded-2xl border border-hairline bg-surface p-4 shadow-card sm:p-5">
      <Input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setVisibleCount(initialCount);
        }}
        placeholder={labels.searchPlaceholder}
        className="max-w-md"
      />

      {visible.length ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((entry) => (
            <Link
              key={entry.slug}
              href={{ pathname: '/ai-video-engines/[slug]', params: { slug: entry.slug } }}
              prefetch={false}
              className="rounded-lg border border-hairline bg-bg px-3 py-2 text-sm text-text-secondary transition hover:border-text-muted hover:text-text-primary"
            >
              <span className="font-semibold text-text-primary">{entry.label}</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-text-secondary">{labels.empty}</p>
      )}

      {canLoadMore ? (
        <button
          type="button"
          onClick={() => setVisibleCount((current) => current + step)}
          className="rounded-full border border-hairline px-3 py-1 text-sm font-semibold text-text-secondary transition hover:border-text-muted hover:text-text-primary"
        >
          {labels.loadMore}
        </button>
      ) : null}
    </div>
  );
}
