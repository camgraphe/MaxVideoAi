'use client';
import { useEffect } from 'react';
import { trackComparison } from '../_lib/compare-analytics';
import type { AppLocale } from '@/i18n/locales';

export function CompareInteractionTracking({ locale }: { locale: AppLocale }) {
  useEffect(() => {
    const root = document.getElementById('comparison-detail');
    if (!root) return;
    const onToggle = (event: Event) => {
      if (!(event.target instanceof HTMLDetailsElement) || !event.target.open) return;
      const section = event.target.dataset.comparisonSection;
      if (section) trackComparison({ action: 'details_open', section, locale });
    };
    root.addEventListener('toggle', onToggle, true);
    return () => root.removeEventListener('toggle', onToggle, true);
  }, [locale]);
  return null;
}
