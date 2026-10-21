import React from 'react';
import type { AppLocale } from '@/i18n/locales';
import { getBenchmarkScoreReviewCopy } from '@/lib/benchmark-score-review';
import type { EngineScoreReviewStatus } from '@/types/engines';

export function EngineScoreLabel({ scoreLabel, label, locale, reviewStatus }: {
  scoreLabel: string;
  label: string;
  locale: AppLocale;
  reviewStatus?: EngineScoreReviewStatus;
}) {
  const review = reviewStatus === 'editorial-estimated' ? getBenchmarkScoreReviewCopy(locale) : null;
  return (
    <p>
      {label}: {scoreLabel}/10
      {review ? <span className="ml-1.5 rounded-full border border-hairline px-1.5 py-0.5 text-xs" title={review.fallback} aria-label={review.label}>{review.short}</span> : null}
    </p>
  );
}
