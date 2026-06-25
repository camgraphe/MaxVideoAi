'use client';

import clsx from 'clsx';
import { Check, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { EngineIcon } from '@/components/ui/EngineIcon';
import engineCatalog from '@/config/engine-catalog.json';
import { getModelFamilyDefinition } from '@/config/model-families';
import { getEngineSelectFamilyRank } from '@/lib/engine-family-priority';
import { formatEngineSelectScore, getCompactModeLabel } from '@/components/ui/engine-select/engine-select-helpers';
import type { SelectOption } from '@/components/ui/SelectMenu';
import type { Mode } from '@/types/engines';

type CompareEngineFamilySelectProps = {
  options: SelectOption[];
  value: string;
  disabledValue?: string;
  searchPlaceholder: string;
  noResultsLabel: string;
  engineScores?: Record<string, number | null | undefined>;
  buttonClassName?: string;
  onChange: (value: string) => void;
};

type CatalogMeta = {
  modelSlug: string;
  marketingName: string;
  provider?: string;
  brandId?: string | null;
  family?: string | null;
  versionLabel?: string | null;
  surfaces?: {
    app?: {
      discoveryRank?: number;
    };
  };
  modes?: Array<{ mode?: string }>;
};

type GroupedOption = {
  value: string;
  label: string;
  disabled: boolean;
  meta: CatalogMeta | null;
};

type OptionGroup = {
  id: string;
  label: string;
  brandId?: string;
  options: GroupedOption[];
  rank: number;
};

type DropdownPosition = {
  left: number;
  maxHeight: number;
  top: number;
  width: number;
};

const FAMILY_LABEL_OVERRIDES: Record<string, string> = {
  'luma-uni': 'Luma Uni',
};

function rawOptionLabel(option: SelectOption): string {
  return typeof option.label === 'string' ? option.label : String(option.value);
}

function titleCase(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function familyLabel(familyId: string) {
  return getModelFamilyDefinition(familyId)?.label ?? FAMILY_LABEL_OVERRIDES[familyId] ?? titleCase(familyId);
}

function familyBrandId(familyId: string, option: GroupedOption) {
  return getModelFamilyDefinition(familyId)?.brandId ?? option.meta?.brandId ?? undefined;
}

function optionMatchesQuery(option: GroupedOption, familyName: string, query: string) {
  if (!query) return true;
  return [
    option.value,
    option.label,
    option.meta?.marketingName,
    option.meta?.provider,
    option.meta?.family,
    familyName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(query);
}

function getOptionScore(option: GroupedOption, engineScores?: Record<string, number | null | undefined>) {
  const score = engineScores?.[option.value];
  return typeof score === 'number' && Number.isFinite(score) ? score : null;
}

function getDropdownPosition(trigger: HTMLButtonElement): DropdownPosition {
  const rect = trigger.getBoundingClientRect();
  const viewportPadding = 12;
  const width = Math.max(320, Math.min(window.innerWidth - viewportPadding * 2, 620));
  const centeredLeft = rect.left + rect.width / 2 - width / 2;
  const left = Math.max(viewportPadding, Math.min(centeredLeft, window.innerWidth - width - viewportPadding));
  const top = rect.bottom + 8;
  return {
    left,
    maxHeight: Math.max(280, window.innerHeight - top - viewportPadding),
    top,
    width,
  };
}

function ScoreBadge({ value }: { value: string }) {
  const numeric = Number(value);
  const progress = Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric <= 10 ? numeric * 10 : numeric)) : 0;
  const ringColor = progress < 83 ? '#f59e0b' : '#10b981';
  const textTone = progress < 83 ? 'text-amber-700' : 'text-text-primary';
  return (
    <span
      aria-label={`Score ${value}/10`}
      className="grid h-7 w-7 shrink-0 place-items-center rounded-full p-[2px]"
      style={{
        background: `conic-gradient(${ringColor} 0% ${progress}%, rgba(148,163,184,0.22) ${progress}% 100%)`,
      }}
    >
      <span className={clsx('grid h-full w-full place-items-center rounded-full bg-surface text-[9px] font-semibold leading-none', textTone)}>
        {value}
      </span>
    </span>
  );
}

function buildGroups(
  options: SelectOption[],
  disabledValue?: string,
  engineScores?: Record<string, number | null | undefined>
): OptionGroup[] {
  const catalog = engineCatalog as CatalogMeta[];
  const catalogBySlug = new Map(catalog.map((entry) => [entry.modelSlug, entry]));
  const groups = new Map<string, GroupedOption[]>();
  options.forEach((option) => {
    const value = String(option.value);
    const meta = catalogBySlug.get(value) ?? null;
    const familyId = (meta?.family ?? meta?.brandId ?? value.split('-')[0] ?? 'other').toLowerCase();
    const groupOptions = groups.get(familyId) ?? [];
    groupOptions.push({
      value,
      label: rawOptionLabel(option),
      disabled: Boolean(option.disabled) || value === disabledValue,
      meta,
    });
    groups.set(familyId, groupOptions);
  });

  return Array.from(groups.entries())
    .map(([familyId, groupOptions]) => {
      const firstOption = groupOptions[0];
      const rank = getEngineSelectFamilyRank({ family: familyId });
      const sortedOptions = groupOptions.sort((a, b) => {
        const scoreA = getOptionScore(a, engineScores);
        const scoreB = getOptionScore(b, engineScores);
        if (scoreA != null || scoreB != null) {
          if (scoreA == null) return 1;
          if (scoreB == null) return -1;
          if (scoreA !== scoreB) return scoreB - scoreA;
        }
        const rankA = a.meta?.surfaces?.app?.discoveryRank ?? Number.MAX_SAFE_INTEGER;
        const rankB = b.meta?.surfaces?.app?.discoveryRank ?? Number.MAX_SAFE_INTEGER;
        if (rankA !== rankB) return rankA - rankB;
        return a.label.localeCompare(b.label);
      });
      return {
        id: familyId,
        label: familyLabel(familyId),
        brandId: familyBrandId(familyId, firstOption),
        options: sortedOptions,
        rank,
      };
    })
    .sort((a, b) => {
      if (a.rank !== b.rank) {
        if (a.rank === Number.MAX_SAFE_INTEGER) return 1;
        if (b.rank === Number.MAX_SAFE_INTEGER) return -1;
        return a.rank - b.rank;
      }
      const discoveryA = a.options[0]?.meta?.surfaces?.app?.discoveryRank ?? Number.MAX_SAFE_INTEGER;
      const discoveryB = b.options[0]?.meta?.surfaces?.app?.discoveryRank ?? Number.MAX_SAFE_INTEGER;
      if (discoveryA !== discoveryB) return discoveryA - discoveryB;
      return a.label.localeCompare(b.label);
    });
}

export function CompareEngineFamilySelect({
  options,
  value,
  disabledValue,
  searchPlaceholder,
  noResultsLabel,
  engineScores,
  buttonClassName,
  onChange,
}: CompareEngineFamilySelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const groups = useMemo(() => buildGroups(options, disabledValue, engineScores), [disabledValue, engineScores, options]);
  const selectedOption = useMemo(
    () => groups.flatMap((group) => group.options).find((option) => option.value === value) ?? null,
    [groups, value]
  );
  const selectedFamilyId =
    groups.find((group) => group.options.some((option) => option.value === value))?.id ?? groups[0]?.id ?? '';
  const [activeFamilyId, setActiveFamilyId] = useState(selectedFamilyId);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    return groups
      .map((group) => {
        const familyMatches = group.label.toLowerCase().includes(normalizedQuery) || group.id.includes(normalizedQuery);
        const filteredOptions = normalizedQuery
          ? group.options.filter((option) => optionMatchesQuery(option, group.label, normalizedQuery))
          : group.options;
        return {
          ...group,
          options: familyMatches && normalizedQuery ? group.options : filteredOptions,
        };
      })
      .filter((group) => group.options.length > 0);
  }, [groups, normalizedQuery]);
  const activeFamily = filteredGroups.find((group) => group.id === activeFamilyId) ?? filteredGroups[0] ?? null;

  const updateDropdownPosition = useCallback(() => {
    if (!triggerRef.current) return;
    setDropdownPosition(getDropdownPosition(triggerRef.current));
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updateDropdownPosition();

    function handleViewportChange() {
      updateDropdownPosition();
    }

    window.addEventListener('resize', handleViewportChange, { passive: true });
    window.addEventListener('scroll', handleViewportChange, { passive: true, capture: true });
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [open, updateDropdownPosition]);

  useEffect(() => {
    if (!open) return;
    function handlePointer(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('touchstart', handlePointer, { passive: true });
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('touchstart', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  useEffect(() => {
    if (!filteredGroups.length) {
      setActiveFamilyId('');
      return;
    }
    if (!filteredGroups.some((group) => group.id === activeFamilyId)) {
      setActiveFamilyId(selectedFamilyId);
    }
  }, [activeFamilyId, filteredGroups, selectedFamilyId]);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (!open) updateDropdownPosition();
          setOpen((current) => !current);
        }}
        className={clsx(
          'flex h-9 w-full max-w-[220px] min-w-0 items-center justify-between gap-2 rounded-[10px] border border-hairline bg-bg/80 px-3 py-2 text-[12px] font-semibold text-text-primary shadow-sm transition hover:border-[var(--brand-border)] hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-none sm:min-w-[180px] md:min-w-[210px]',
          buttonClassName
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-2">
          <EngineIcon
            engine={{
              id: selectedOption?.value ?? value,
              label: selectedOption?.label ?? value,
              brandId: selectedOption?.meta?.brandId ?? undefined,
            }}
            size={20}
            className="shrink-0"
          />
          <span className="truncate">{selectedOption?.label ?? value}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <ChevronDown aria-hidden="true" className={clsx('h-3.5 w-3.5 text-text-muted transition', open && 'rotate-180')} />
        </span>
      </button>

      {open && dropdownPosition ? (
        <div
          className="fixed z-50 overflow-x-hidden overflow-y-auto rounded-card border border-hairline bg-surface text-left shadow-float"
          style={{
            left: dropdownPosition.left,
            maxHeight: dropdownPosition.maxHeight,
            top: dropdownPosition.top,
            width: dropdownPosition.width,
          }}
        >
          <div className="border-b border-hairline p-2.5">
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder={searchPlaceholder}
                className="h-8 w-full rounded-input border border-border bg-bg pl-8 pr-3 text-[12px] text-text-primary outline-none transition placeholder:text-text-muted focus:border-border-hover focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          {filteredGroups.length ? (
            <div className="grid min-h-[250px] min-w-0 sm:grid-cols-[170px_minmax(0,1fr)]">
              <div className="min-w-0 border-b border-hairline bg-surface-2/60 sm:border-b-0 sm:border-r">
                <div className="flex w-full min-w-0 max-w-full snap-x gap-2 overflow-x-auto overscroll-x-contain p-2 [scrollbar-width:thin] sm:block sm:max-h-[350px] sm:space-y-1 sm:overflow-y-auto">
                  {filteredGroups.map((group) => {
                    const active = group.id === activeFamily?.id;
                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => setActiveFamilyId(group.id)}
                        className={clsx(
                          'flex min-w-[116px] snap-start items-center gap-2 rounded-input border px-2.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-full sm:min-w-0',
                          active
                            ? 'border-brand/25 bg-surface text-text-primary shadow-sm'
                            : 'border-transparent text-text-secondary hover:bg-surface'
                        )}
                      >
                        <EngineIcon
                          engine={{ id: group.id, label: group.label, brandId: group.brandId }}
                          size={24}
                          className="shrink-0"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] font-semibold">{group.label}</span>
                          <span className="block text-[9px] text-text-muted">{group.options.length} models</span>
                        </span>
                        <ChevronRight aria-hidden="true" className={clsx('hidden h-3.5 w-3.5 sm:block', active ? 'text-brand' : 'text-text-muted')} />
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="min-w-0 p-2">
                <ul className="max-h-[min(36vh,300px)] overflow-y-auto overscroll-contain sm:max-h-[350px]" role="listbox">
                  {activeFamily?.options.map((option) => {
                    const active = option.value === value;
                    const score = formatEngineSelectScore(engineScores?.[option.value]);
                    const modes = option.meta?.modes
                      ?.map((entry) => entry.mode)
                      .filter((mode): mode is Mode => Boolean(mode))
                      .slice(0, 3);
                    return (
                      <li key={option.value}>
                        <button
                          type="button"
                          disabled={option.disabled}
                          onClick={() => {
                            if (option.disabled) return;
                            onChange(option.value);
                            setOpen(false);
                          }}
                          className={clsx(
                            'flex w-full items-center gap-2.5 rounded-input px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            option.disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-surface-2',
                            active && 'bg-surface-2'
                          )}
                          role="option"
                          aria-selected={active}
                          aria-disabled={option.disabled}
                        >
                          <EngineIcon
                            engine={{ id: option.value, label: option.label, brandId: option.meta?.brandId ?? undefined }}
                            size={28}
                            className="shrink-0"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold text-text-primary">{option.label}</span>
                            <span className="block truncate text-[10px] text-text-muted">
                              {option.meta?.provider ?? option.meta?.family ?? activeFamily.label}
                              {option.meta?.versionLabel ? ` - ${option.meta.versionLabel}` : ''}
                            </span>
                            {modes?.length ? (
                              <span className="mt-1 flex flex-wrap gap-1">
                                {modes.map((mode) => (
                                  <span
                                    key={`${option.value}-${mode}`}
                                    className="rounded-[6px] border border-hairline bg-surface px-1 py-0.5 text-[8px] font-semibold uppercase text-text-muted"
                                  >
                                    {getCompactModeLabel(mode)}
                                  </span>
                                ))}
                              </span>
                            ) : null}
                          </span>
                          {score ? <ScoreBadge value={score} /> : null}
                          {active ? <Check aria-hidden="true" className="h-4 w-4 text-brand" /> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-text-muted">{noResultsLabel}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
