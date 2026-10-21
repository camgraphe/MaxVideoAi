'use client';

import { useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import type { AppLocale } from '@/i18n/locales';
import { getBenchmarkScoreReviewCopy } from '@/lib/benchmark-score-review';
import clsx from 'clsx';
import { Link } from '@/i18n/navigation';
import type { SelectOption } from '@/components/ui/SelectMenu';
import { buildCanonicalCompareSlug } from '@/lib/compare-hub/pairs';
import { CompareEngineFamilySelect } from './_components/CompareEngineFamilySelect.client';

type CompareNowWidgetProps = {
  options: SelectOption[];
  defaultLeft: string;
  defaultRight: string;
  engineMetaBySlug: Record<string, { overall: number | null; strengths: string | null; modes?: string[]; reviewStatus?: 'editorial-estimated' | null }>;
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

function modeChipLabel(mode: string, labels: CompareNowWidgetProps['labels']) {
  return labels.modeLabels[mode] ?? mode.toUpperCase();
}

function resolveSelectedLabel(value: string, options: SelectOption[]) {
  const option = options.find((entry) => String(entry.value) === String(value));
  return option ? resolveRawLabel(option) : value;
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
  const locale = useLocale() as AppLocale;
  const reviewCopy = getBenchmarkScoreReviewCopy(locale);
  const engineScoreReviews = Object.fromEntries(Object.entries(engineMetaBySlug).flatMap(([slug, meta]) => meta.reviewStatus ? [[slug, meta.reviewStatus] as const] : []));
  const [left, setLeft] = useState(defaultLeft);
  const [right, setRight] = useState(defaultRight);

  const engineScores = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(engineMetaBySlug)
          .map(([slug, meta]) => [slug, meta.overall] as const)
          .filter((entry): entry is readonly [string, number] => entry[1] != null)
      ),
    [engineMetaBySlug]
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

  const sides = [
    { key: 'left', value: left, other: right, label: leftLabel, side: labels.left, meta: leftMeta, set: setLeft },
    { key: 'right', value: right, other: left, label: rightLabel, side: labels.right, meta: rightMeta, set: setRight },
  ];
  return <div className={clsx('compare-pair-picker', !embedded && 'compare-pair-standalone', className)}>
    <div className="compare-pair-sides">{sides.map((side,index)=><div className="compare-pair-side" key={side.key}>
      <div className="compare-pair-side-label"><span>{side.side}</span><span aria-hidden>{String(index+1).padStart(2,'0')}</span></div>
      <h3>{side.label}</h3>
      <CompareEngineFamilySelect options={options} value={side.value} disabledValue={side.other}
        searchPlaceholder={labels.searchPlaceholder} noResultsLabel={labels.noResults} engineScores={engineScores} engineScoreReviews={engineScoreReviews}
        onChange={(next)=>{if(next && next!==side.other) side.set(next);}}
        buttonClassName="w-full min-w-0 min-h-[44px] rounded-[4px] bg-surface text-xs"/>
      <div className="compare-pair-score" aria-live="polite"><strong>{side.meta.reviewStatus && side.meta.overall != null ? '≈' : ''}{side.meta.overall == null ? '—' : side.meta.overall.toFixed(1)}</strong>{side.meta.overall != null ? <span>/10</span> : null}</div>
      {side.meta.reviewStatus ? <Link href={{ pathname: '/benchmarks', hash: `review-${side.value}` }} className="text-xs text-brand underline underline-offset-2">{reviewCopy.label}</Link> : null}
      <div className="compare-pair-modes">{side.meta.modes?.slice(0,3).map(mode=><span key={mode}>{modeChipLabel(mode,labels)}</span>)}</div>
    </div>)}</div>
    <Link href={href} prefetch={false} className="compare-pair-action">{labels.compare}<span aria-hidden>↗</span></Link>
  </div>;
}
