'use client';

import { useMemo } from 'react';
import { SelectMenu, type SelectOption } from '@/components/ui/SelectMenu';
import { useRouter } from '@/i18n/navigation';
import engineCatalog from '@/config/engine-catalog.json';

type CompareEngineSelectorProps = {
  options: SelectOption[];
  value: string;
  otherValue: string;
  side: 'left' | 'right';
};

export function CompareEngineSelector({ options, value, otherValue, side }: CompareEngineSelectorProps) {
  const router = useRouter();
  const brandBySlug = useMemo(() => {
    const catalog = engineCatalog as Array<{ modelSlug: string; brandId?: string | null; marketingName?: string }>;
    return new Map(catalog.map((entry) => [entry.modelSlug, entry.brandId ?? null]));
  }, []);
  const resolvedOptions = useMemo(
    () =>
      options.map((option) => {
        const labelText = typeof option.label === 'string' ? option.label : String(option.value);
        const shortLabel = labelText
          .split(' ')
          .filter(Boolean)
          .slice(1, 2)
          .join('')
          .replace(/[^a-zA-Z]/g, '')
          .slice(0, 2) || labelText.replace(/[^a-zA-Z]/g, '').slice(0, 2);
        const badgeText = shortLabel
          ? `${shortLabel[0]?.toUpperCase() ?? ''}${shortLabel[1]?.toLowerCase() ?? ''}`
          : labelText.slice(0, 2);

        const brandId = brandBySlug.get(String(option.value)) ?? null;
        const badgeStyle = brandId
          ? { backgroundColor: `var(--engine-${brandId}-bg)`, color: `var(--engine-${brandId}-ink)` }
          : undefined;

        return {
          ...option,
          disabled: String(option.value) === String(otherValue),
          label: (
            <span className="inline-flex min-w-0 items-center gap-2">
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full bg-surface text-[10px] font-semibold text-text-primary shadow-inner"
                style={badgeStyle}
              >
                {badgeText}
              </span>
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
      hideChevron
      buttonClassName="w-full max-w-[220px] min-w-0 rounded-full border border-hairline bg-surface-2 px-3 py-1 text-[12px] font-semibold text-text-primary shadow-none transition hover:bg-surface-2/80 sm:max-w-none sm:min-w-[280px] md:min-w-[320px]"
      onChange={(next) => {
        const nextValue = String(next);
        if (!nextValue || nextValue === value) return;
        if (nextValue === otherValue) return;
        const leftSlug = side === 'left' ? nextValue : otherValue;
        const rightSlug = side === 'left' ? otherValue : nextValue;
        const sorted = [leftSlug, rightSlug].sort();
        const slug = `${sorted[0]}-vs-${sorted[1]}`;
        const query = leftSlug === sorted[0] ? undefined : { order: leftSlug };
        router.push({ pathname: '/ai-video-engines/[slug]', params: { slug }, query }, { scroll: false });
      }}
    />
  );
}
