'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { SelectMenu, type SelectOption } from '@/components/ui/SelectMenu';
import { Button } from '@/components/ui/Button';
import { buildCanonicalCompareSlug } from '@/lib/compare-hub/data';

type CompareNowWidgetProps = {
  options: SelectOption[];
  defaultLeft: string;
  defaultRight: string;
  labels: {
    left: string;
    right: string;
    swap: string;
    compare: string;
    searchPlaceholder: string;
    noResults: string;
  };
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

export function CompareNowWidget({ options, defaultLeft, defaultRight, labels }: CompareNowWidgetProps) {
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

  return (
    <div className="rounded-2xl border border-hairline bg-surface p-4 shadow-card sm:p-5">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto] lg:items-end">
        <div className="space-y-1">
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
        </div>

        <div className="flex justify-start lg:justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setLeft(right);
              setRight(left);
            }}
            className="min-h-[38px] rounded-full px-3"
            aria-label={labels.swap}
            title={labels.swap}
          >
            ↔
          </Button>
        </div>

        <div className="space-y-1">
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
        </div>

        <div className="flex">
          <Link
            href={href}
            prefetch={false}
            className="inline-flex min-h-[42px] w-full items-center justify-center rounded-input bg-brand px-5 py-2 text-sm font-semibold text-on-brand transition hover:bg-brandHover lg:w-auto"
          >
            {labels.compare}
          </Link>
        </div>
      </div>
    </div>
  );
}
