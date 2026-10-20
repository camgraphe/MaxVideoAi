'use client';

import { trackComparison } from './_lib/compare-analytics';
import { useLocale } from 'next-intl';
import type { SelectOption } from '@/components/ui/SelectMenu';
import { getPathname, useRouter } from '@/i18n/navigation';
import { CompareEngineFamilySelect } from '../_components/CompareEngineFamilySelect.client';

type CompareEngineSelectorProps = {
  options: SelectOption[];
  value: string;
  otherValue: string;
  side: 'left' | 'right';
  engineScores?: Record<string, number | null | undefined>;
  engineScoreReviews?: Record<string, 'editorial-estimated'>;
};

export function CompareEngineSelector({ options, value, otherValue, side, engineScores, engineScoreReviews }: CompareEngineSelectorProps) {
  const router = useRouter();
  const locale = useLocale();
  const searchPlaceholder =
    locale === 'fr' ? 'Rechercher un modèle...' : locale === 'es' ? 'Buscar modelo...' : 'Search engine...';
  const noResultsLabel = locale === 'fr' ? 'Aucun résultat' : locale === 'es' ? 'Sin resultados' : 'No results';
  const changeLabel = locale === 'fr' ? 'Changer' : locale === 'es' ? 'Cambiar' : 'Change';

  return (
    <CompareEngineFamilySelect
      options={options}
      value={value}
      disabledValue={otherValue}
      searchPlaceholder={searchPlaceholder}
      noResultsLabel={noResultsLabel}
      engineScores={engineScores}
      engineScoreReviews={engineScoreReviews}
      triggerActionLabel={changeLabel}
      buttonClassName="compare-engine-trigger"
      onChange={(next) => {
        const nextValue = String(next);
        if (!nextValue || nextValue === value) return;
        if (nextValue === otherValue) return;
        const leftSlug = side === 'left' ? nextValue : otherValue;
        const rightSlug = side === 'left' ? otherValue : nextValue;
        const sorted = [leftSlug, rightSlug].sort();
        const slug = `${sorted[0]}-vs-${sorted[1]}`;
        const basePath = getPathname({
          href: { pathname: '/ai-video-engines/[slug]', params: { slug } },
          locale,
        });
        const order = sorted[0] === leftSlug ? null : leftSlug;
        const href = order ? `${basePath}?order=${encodeURIComponent(order)}` : basePath;
        trackComparison({ action: 'model_change', engine: nextValue, section: side, locale });
        router.push(href as never, { scroll: false });
      }}
    />
  );
}
