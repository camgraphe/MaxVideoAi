'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import clsx from 'clsx';
import { Link } from '@/i18n/navigation';
import { SelectMenu, type SelectOption } from '@/components/ui/SelectMenu';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { buildCanonicalCompareSlug } from '@/lib/compare-hub/data';
import engineCatalog from '@/config/engine-catalog.json';

type CompareNowWidgetProps = {
  options: SelectOption[];
  defaultLeft: string;
  defaultRight: string;
  engineMetaBySlug: Record<string, { overall: number | null; strengths: string | null; modes?: string[] }>;
  labels: {
    left: string;
    right: string;
    compare: string;
    searchPlaceholder: string;
    noResults: string;
    strengthsLabel: string;
    strengthsFallback: string;
    modeLabels: Record<string, string>;
  };
  className?: string;
  embedded?: boolean;
};

function resolveRawLabel(option: SelectOption): string {
  return typeof option.label === 'string' ? option.label : String(option.value);
}

function renderOptionLabel(option: SelectOption): ReactNode {
  const label = resolveRawLabel(option);
  const catalog = engineCatalog as Array<{ modelSlug: string; brandId?: string | null }>;
  const brandId = catalog.find((entry) => entry.modelSlug === String(option.value))?.brandId ?? null;

  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <EngineIcon engine={{ id: String(option.value), label, brandId: brandId ?? undefined }} size={18} className="shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
}

function modeChipLabel(mode: string, labels: CompareNowWidgetProps['labels']) {
  return labels.modeLabels[mode] ?? mode.toUpperCase();
}

function resolveSelectedLabel(value: string, options: SelectOption[]) {
  const option = options.find((entry) => String(entry.value) === String(value));
  return option ? resolveRawLabel(option) : value;
}

function ScoreCircle({ value }: { value: number | null }) {
  const percentage = value == null ? 0 : Math.max(0, Math.min(100, value * 10));

  return (
    <div
      className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full p-[2px] shadow-[0_12px_30px_rgba(59,130,246,0.13)] sm:h-[84px] sm:w-[84px]"
      style={{
        background: `conic-gradient(#bfdbfe ${percentage}%, #eef5ff 0)`,
      }}
    >
      <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-surface text-center shadow-inner">
        <span className="text-[20px] font-semibold leading-none text-text-primary sm:text-[24px]">
          {value != null ? value.toFixed(1) : '-'}
          {value != null ? <span className="ml-0.5 align-super text-[8px] font-semibold text-text-muted sm:text-[9px]">/10</span> : null}
        </span>
        <span className="mt-1 text-[6px] font-semibold uppercase tracking-[0.22em] text-text-muted sm:text-[7px]">Score</span>
      </div>
    </div>
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
  const leftLabel = resolveSelectedLabel(left, options);
  const rightLabel = resolveSelectedLabel(right, options);

  return (
    <div
      className={clsx(
        embedded ? 'p-0' : 'rounded-2xl border border-hairline bg-surface p-4 shadow-card sm:p-5',
        className
      )}
    >
      <div className="relative">
        <div className="relative">
          <div className="grid gap-3.5 lg:grid-cols-2 lg:gap-6">
            <article className="relative rounded-[14px] border border-hairline bg-surface/95 p-3.5 shadow-sm sm:p-5">
              <div className="flex flex-col items-center gap-3.5 text-center lg:flex-row lg:justify-between">
                <div className="order-2 w-full max-w-[290px] lg:order-1">
                  <h3 className="text-lg font-semibold leading-tight text-text-primary sm:text-xl">{leftLabel}</h3>
                  <div className="mx-auto mt-3 max-w-[260px]">
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
                      menuPlacement="auto"
                      menuClassName="min-w-[min(320px,calc(100vw-2rem))]"
                      onChange={(value) => {
                        const next = String(value);
                        if (!next || next === right) return;
                        setLeft(next);
                      }}
                      buttonClassName="min-h-[38px] rounded-[10px] bg-surface text-xs shadow-sm"
                    />
                  </div>
                  <p className="mx-auto mt-3 min-h-8 max-w-[250px] text-[11px] leading-4 text-text-secondary">
                    <span className="font-semibold text-text-primary">{labels.strengthsLabel}:</span>{' '}
                    {leftMeta.strengths ?? labels.strengthsFallback}
                  </p>
                  {leftMeta.modes?.length ? (
                    <div className="mt-2.5 flex flex-wrap justify-center gap-1">
                      {leftMeta.modes.slice(0, 3).map((mode) => (
                        <span
                          key={`${left}-${mode}`}
                          className="rounded-full bg-surface-2 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-micro text-brand"
                        >
                          {modeChipLabel(mode, labels)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="order-1 lg:order-2">
                  <ScoreCircle value={leftMeta.overall} />
                </div>
              </div>
            </article>

            <div className="flex justify-center lg:hidden" aria-hidden>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand text-[10px] font-semibold uppercase tracking-micro text-on-brand shadow">
                VS
              </span>
            </div>

            <article className="relative rounded-[14px] border border-hairline bg-surface/95 p-3.5 shadow-sm sm:p-5">
              <div className="flex flex-col items-center gap-3.5 text-center lg:flex-row lg:justify-between">
                <div className="order-1">
                  <ScoreCircle value={rightMeta.overall} />
                </div>
                <div className="order-2 w-full max-w-[290px]">
                  <h3 className="text-lg font-semibold leading-tight text-text-primary sm:text-xl">{rightLabel}</h3>
                  <div className="mx-auto mt-3 max-w-[260px]">
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
                      menuPlacement="auto"
                      menuClassName="min-w-[min(320px,calc(100vw-2rem))]"
                      onChange={(value) => {
                        const next = String(value);
                        if (!next || next === left) return;
                        setRight(next);
                      }}
                      buttonClassName="min-h-[38px] rounded-[10px] bg-surface text-xs shadow-sm"
                    />
                  </div>
                  <p className="mx-auto mt-3 min-h-8 max-w-[250px] text-[11px] leading-4 text-text-secondary">
                    <span className="font-semibold text-text-primary">{labels.strengthsLabel}:</span>{' '}
                    {rightMeta.strengths ?? labels.strengthsFallback}
                  </p>
                  {rightMeta.modes?.length ? (
                    <div className="mt-2.5 flex flex-wrap justify-center gap-1">
                      {rightMeta.modes.slice(0, 3).map((mode) => (
                        <span
                          key={`${right}-${mode}`}
                          className="rounded-full bg-surface-2 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-micro text-brand"
                        >
                          {modeChipLabel(mode, labels)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
          </div>

          <div
            className="pointer-events-none absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 lg:flex"
            aria-hidden
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border-4 border-surface bg-brand text-[10px] font-semibold uppercase tracking-micro text-on-brand shadow-[0_14px_30px_rgba(46,99,216,0.24)]">
              VS
            </span>
          </div>
        </div>

        <div className="mt-3.5 flex justify-center">
          <Link
            href={href}
            prefetch={false}
            className="inline-flex min-h-[38px] items-center justify-center gap-2 rounded-input bg-brand px-5 py-2 text-sm font-semibold text-on-brand transition hover:bg-brandHover"
          >
            {labels.compare} <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
