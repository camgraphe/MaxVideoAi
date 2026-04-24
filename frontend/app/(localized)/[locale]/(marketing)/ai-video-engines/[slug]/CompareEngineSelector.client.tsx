'use client';

import { useMemo } from 'react';
import { useLocale } from 'next-intl';
import { SelectMenu, type SelectOption } from '@/components/ui/SelectMenu';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { getPathname, useRouter } from '@/i18n/navigation';
import engineCatalog from '@/config/engine-catalog.json';

type CompareEngineSelectorProps = {
  options: SelectOption[];
  value: string;
  otherValue: string;
  side: 'left' | 'right';
};

export function CompareEngineSelector({ options, value, otherValue, side }: CompareEngineSelectorProps) {
  const router = useRouter();
  const locale = useLocale();
  const searchPlaceholder =
    locale === 'fr' ? 'Rechercher un moteur...' : locale === 'es' ? 'Buscar motor...' : 'Search engine...';
  const noResultsLabel = locale === 'fr' ? 'Aucun résultat' : locale === 'es' ? 'Sin resultados' : 'No results';
  const brandBySlug = useMemo(() => {
    const catalog = engineCatalog as Array<{ modelSlug: string; brandId?: string | null; marketingName?: string }>;
    return new Map(catalog.map((entry) => [entry.modelSlug, entry.brandId ?? null]));
  }, []);
  const resolvedOptions = useMemo(
    () =>
      options.map((option) => {
        const labelText = typeof option.label === 'string' ? option.label : String(option.value);
        const brandId = brandBySlug.get(String(option.value)) ?? null;

        return {
          ...option,
          disabled: String(option.value) === String(otherValue),
          label: (
            <span className="flex min-w-0 max-w-full items-center gap-2">
              <EngineIcon
                engine={{ id: String(option.value), label: labelText, brandId: brandId ?? undefined }}
                size={20}
                className="shrink-0"
              />
              <span className="truncate">{labelText}</span>
            </span>
          ),
        };
      }),
    [options, otherValue, brandBySlug]
  );

  return (
    <SelectMenu
      options={resolvedOptions}
      value={value}
      searchable
      searchPlaceholder={searchPlaceholder}
      noResultsLabel={noResultsLabel}
      filterText={(option) => {
        const raw = options.find((entry) => String(entry.value) === String(option.value));
        if (!raw) return String(option.value);
        return typeof raw.label === 'string' ? raw.label : String(raw.value);
      }}
      menuPlacement="auto"
      menuClassName="min-w-[min(320px,calc(100vw-2rem))]"
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
