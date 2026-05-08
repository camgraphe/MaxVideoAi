import { Search } from 'lucide-react';
import { SelectMenu } from '@/components/ui/SelectMenu';
import type { ReactNode } from 'react';
import type { GalleryFilterKey } from './models-gallery-types';
import type { ResolvedModelsGalleryCopy } from './models-gallery-copy';

type ModelsGalleryFiltersProps = {
  copy: Pick<ResolvedModelsGalleryCopy, 'filterClearLabel' | 'filterLabels' | 'filterOptions' | 'searchPlaceholder'>;
  hasActiveFilters: boolean;
  searchQuery: string;
  selectedAge: string;
  selectedDuration: string;
  selectedFormat: string;
  selectedMode: string;
  selectedPrice: string;
  selectedSort: string;
  visibleFilterSet: Set<GalleryFilterKey>;
  onAgeChange: (value: string) => void;
  onClearFilters: () => void;
  onDurationChange: (value: string) => void;
  onFormatChange: (value: string) => void;
  onModeChange: (value: string) => void;
  onPriceChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (value: string) => void;
};

function FilterControl({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="whitespace-nowrap text-xs font-semibold text-text-secondary">{label}</span>
      {children}
    </div>
  );
}

export function ModelsGalleryFilters({
  copy,
  hasActiveFilters,
  searchQuery,
  selectedAge,
  selectedDuration,
  selectedFormat,
  selectedMode,
  selectedPrice,
  selectedSort,
  visibleFilterSet,
  onAgeChange,
  onClearFilters,
  onDurationChange,
  onFormatChange,
  onModeChange,
  onPriceChange,
  onSearchChange,
  onSortChange,
}: ModelsGalleryFiltersProps) {
  const filterSelectButtonClassName =
    'h-11 min-w-[136px] rounded-[8px] border-hairline bg-bg px-4 text-xs font-semibold text-text-primary shadow-sm hover:border-[var(--brand-border)] hover:bg-surface-2';
  const controls = [
    { key: 'sort', label: copy.filterLabels.sort, options: copy.filterOptions.sort, value: selectedSort, onChange: onSortChange },
    { key: 'mode', label: copy.filterLabels.mode, options: copy.filterOptions.mode, value: selectedMode, onChange: onModeChange },
    { key: 'format', label: copy.filterLabels.format, options: copy.filterOptions.format, value: selectedFormat, onChange: onFormatChange },
    {
      key: 'duration',
      label: copy.filterLabels.duration,
      options: copy.filterOptions.duration,
      value: selectedDuration,
      onChange: onDurationChange,
    },
    { key: 'price', label: copy.filterLabels.price, options: copy.filterOptions.price, value: selectedPrice, onChange: onPriceChange },
    { key: 'age', label: copy.filterLabels.age, options: copy.filterOptions.age, value: selectedAge, onChange: onAgeChange },
  ] as const;

  return (
    <div
      className="mt-0 flex flex-col gap-4 rounded-[8px] border border-hairline bg-surface-glass-95 px-5 py-5 shadow-[0_18px_44px_rgba(15,23,42,0.07),0_4px_14px_rgba(15,23,42,0.035)] backdrop-blur md:flex-row md:items-center md:justify-between dark:bg-surface-glass-80 sm:px-8"
      id="models-compare-toggle"
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        {controls.map((control) =>
          visibleFilterSet.has(control.key) ? (
            <FilterControl key={control.key} label={control.label}>
              <SelectMenu
                options={control.options}
                value={control.value}
                onChange={(value) => control.onChange(String(value))}
                buttonClassName={filterSelectButtonClassName}
              />
            </FilterControl>
          ) : null
        )}
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="h-11 rounded-[8px] border border-hairline bg-bg px-3 text-xs font-semibold text-text-secondary transition hover:border-text-muted hover:text-text-primary"
          >
            {copy.filterClearLabel}
          </button>
        ) : null}
      </div>
      <label className="relative min-w-0 md:w-[300px] lg:w-[340px]">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          aria-hidden="true"
        />
        <span className="sr-only">{copy.searchPlaceholder}</span>
        <input
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={copy.searchPlaceholder}
          className="h-11 w-full rounded-[8px] border border-hairline bg-bg pl-9 pr-3 text-sm font-medium text-text-primary shadow-sm outline-none transition placeholder:text-text-muted/75 hover:border-[var(--brand-border)] focus:border-[var(--brand-border)] focus:ring-2 focus:ring-[color:var(--brand-border)]"
        />
      </label>
    </div>
  );
}
