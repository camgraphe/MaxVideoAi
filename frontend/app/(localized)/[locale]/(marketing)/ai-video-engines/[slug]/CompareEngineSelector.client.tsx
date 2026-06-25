'use client';

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
};

export function CompareEngineSelector({ options, value, otherValue, side, engineScores }: CompareEngineSelectorProps) {
  const router = useRouter();
  const locale = useLocale();
  const searchPlaceholder =
    locale === 'fr' ? 'Rechercher un modèle...' : locale === 'es' ? 'Buscar modelo...' : 'Search engine...';
  const noResultsLabel = locale === 'fr' ? 'Aucun résultat' : locale === 'es' ? 'Sin resultados' : 'No results';

  return (
    <CompareEngineFamilySelect
      options={options}
      value={value}
      disabledValue={otherValue}
      searchPlaceholder={searchPlaceholder}
      noResultsLabel={noResultsLabel}
      engineScores={engineScores}
      buttonClassName="h-9 w-full max-w-[220px] min-w-0 rounded-[10px] border border-hairline bg-bg/80 px-3 py-2 text-[12px] font-semibold text-text-primary shadow-sm transition hover:border-[var(--brand-border)] hover:bg-surface-2 sm:max-w-none sm:min-w-[180px] md:min-w-[210px] [&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-70"
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
        router.push(href as never, { scroll: false });
      }}
    />
  );
}
