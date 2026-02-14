'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import clsx from 'clsx';
import { Link } from '@/i18n/navigation';
import { SelectMenu, type SelectOption } from '@/components/ui/SelectMenu';
import { buildCanonicalCompareSlug } from '@/lib/compare-hub/data';

type CompareNowWidgetProps = {
  options: SelectOption[];
  defaultLeft: string;
  defaultRight: string;
  engineMetaBySlug: Record<string, { overall: number | null; strengths: string | null }>;
  labels: {
    left: string;
    right: string;
    compare: string;
    searchPlaceholder: string;
    noResults: string;
    strengthsLabel: string;
    strengthsFallback: string;
  };
  className?: string;
  embedded?: boolean;
};

function resolveRawLabel(option: SelectOption): string {
  return typeof option.label === 'string' ? option.label : String(option.value);
}

function renderOptionLabel(option: SelectOption): ReactNode {
  const label = resolveRawLabel(option);
  const short = label
    .split(' ')
    .filter(Boolean)
    .slice(1, 2)
    .join('')
    .replace(/[^a-zA-Z]/g, '')
    .slice(0, 2) || label.replace(/[^a-zA-Z]/g, '').slice(0, 2);

  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface text-[10px] font-semibold text-text-primary shadow-inner">
        {short || label.slice(0, 2)}
      </span>
      <span className="truncate">{label}</span>
    </span>
  );
}

export function CompareNowWidget({
  options,
  defaultLeft,
  defaultRight,
  engineMetaBySlug,
  labels,
  className,
  embedded = false,
}: CompareNowWidgetProps) {
  const [left, setLeft] = useState(defaultLeft);
  const [right, setRight] = useState(defaultRight);

  const leftOptions = useMemo(
    () =>
      options.map((option) => ({
        ...option,
        label: renderOptionLabel(option),
        disabled: String(option.value) === String(right),
      })),
    [options, right]
  );

  const rightOptions = useMemo(
    () =>
      options.map((option) => ({
        ...option,
        label: renderOptionLabel(option),
        disabled: String(option.value) === String(left),
      })),
    [left, options]
  );

  const slug = useMemo(() => buildCanonicalCompareSlug(left, right), [left, right]);
  const href = useMemo(
    () => ({
      pathname: '/ai-video-engines/[slug]' as const,
      params: { slug },
    }),
    [slug]
  );
  const leftMeta = engineMetaBySlug[left] ?? { overall: null, strengths: null };
  const rightMeta = engineMetaBySlug[right] ?? { overall: null, strengths: null };
  const overallTone =
    typeof leftMeta.overall === 'number' && typeof rightMeta.overall === 'number'
      ? leftMeta.overall === rightMeta.overall
        ? 'tie'
        : leftMeta.overall > rightMeta.overall
          ? 'left'
          : 'right'
      : 'none';
  const leftOverallClass =
    overallTone === 'left'
      ? 'bg-emerald-500 text-white'
      : overallTone === 'right'
        ? 'bg-orange-500 text-white'
        : 'bg-surface-2 text-text-primary';
  const rightOverallClass =
    overallTone === 'right'
      ? 'bg-emerald-500 text-white'
      : overallTone === 'left'
        ? 'bg-orange-500 text-white'
        : 'bg-surface-2 text-text-primary';

  return (
    <div
      className={clsx(
        embedded ? 'p-0' : 'rounded-2xl border border-hairline bg-surface p-4 shadow-card sm:p-5',
        className
      )}
    >
      <div className="relative">
        <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
          <article className="rounded-[28px] border border-hairline bg-surface/90 p-4 sm:p-5 shadow-sm">
            <div className="stack-gap-sm">
              <div className="flex justify-center">
                <div
                  className={clsx(
                    'flex h-10 w-10 items-center justify-center rounded-full text-base font-semibold shadow-inner sm:h-14 sm:w-14 sm:text-xl',
                    leftOverallClass
                  )}
                >
                  {leftMeta.overall != null ? leftMeta.overall.toFixed(1) : '-'}
                </div>
              </div>
              <label className="text-xs font-semibold uppercase tracking-micro text-text-muted">{labels.left}</label>
              <SelectMenu
                options={leftOptions}
                value={left}
                searchable
                searchPlaceholder={labels.searchPlaceholder}
                filterText={(option) => {
                  const raw = options.find((entry) => String(entry.value) === String(option.value));
                  return raw ? resolveRawLabel(raw) : String(option.value);
                }}
                noResultsLabel={labels.noResults}
                onChange={(value) => {
                  const next = String(value);
                  if (!next || next === right) return;
                  setLeft(next);
                }}
              />
              <p className="text-center text-sm text-text-secondary">
                {labels.strengthsLabel}: {leftMeta.strengths ?? labels.strengthsFallback}
              </p>
            </div>
          </article>

          <article className="rounded-[28px] border border-hairline bg-surface/90 p-4 sm:p-5 shadow-sm">
            <div className="stack-gap-sm">
              <div className="flex justify-center">
                <div
                  className={clsx(
                    'flex h-10 w-10 items-center justify-center rounded-full text-base font-semibold shadow-inner sm:h-14 sm:w-14 sm:text-xl',
                    rightOverallClass
                  )}
                >
                  {rightMeta.overall != null ? rightMeta.overall.toFixed(1) : '-'}
                </div>
              </div>
              <label className="text-xs font-semibold uppercase tracking-micro text-text-muted">{labels.right}</label>
              <SelectMenu
                options={rightOptions}
                value={right}
                searchable
                searchPlaceholder={labels.searchPlaceholder}
                filterText={(option) => {
                  const raw = options.find((entry) => String(entry.value) === String(option.value));
                  return raw ? resolveRawLabel(raw) : String(option.value);
                }}
                noResultsLabel={labels.noResults}
                onChange={(value) => {
                  const next = String(value);
                  if (!next || next === left) return;
                  setRight(next);
                }}
              />
              <p className="text-center text-sm text-text-secondary">
                {labels.strengthsLabel}: {rightMeta.strengths ?? labels.strengthsFallback}
              </p>
            </div>
          </article>
        </div>

        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 lg:flex" aria-hidden>
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand text-lg font-semibold uppercase tracking-micro text-on-brand shadow-lg">
            VS
          </span>
        </div>

        <div className="mt-3 flex justify-center lg:hidden">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand text-xs font-semibold uppercase tracking-micro text-on-brand shadow">
            VS
          </span>
        </div>

        <div className="mt-5 flex justify-center">
          <Link
            href={href}
            prefetch={false}
            className="inline-flex min-h-[42px] items-center justify-center rounded-input bg-brand px-7 py-2 text-sm font-semibold text-on-brand transition hover:bg-brandHover"
          >
            {labels.compare}
          </Link>
        </div>
      </div>
    </div>
  );
}
