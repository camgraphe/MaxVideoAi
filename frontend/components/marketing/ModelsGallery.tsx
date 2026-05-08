'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { usePathname, useSearchParams, useRouter as useNextRouter } from 'next/navigation';
import type { LocalizedLinkHref } from '@/i18n/navigation';
import { SelectMenu, type SelectOption } from '@/components/ui/SelectMenu';
import { Search } from 'lucide-react';
import { ModelCard } from '@/components/marketing/ModelsGalleryCard';
import { formatTemplate } from '@/components/marketing/models-gallery-utils';

export type ModelGalleryCard = {
  id: string;
  label: string;
  provider?: string | null;
  engineId?: string | null;
  brandId?: string | null;
  description: string;
  versionLabel?: string;
  overallScore?: number | null;
  priceNote?: string | null;
  priceNoteHref?: string | null;
  href: LocalizedLinkHref;
  backgroundColor?: string | null;
  textColor?: string | null;
  strengths?: string[];
  capabilities?: string[];
  stats?: {
    priceFrom?: string | null;
    maxDuration?: string | null;
    maxResolution?: string | null;
  };
  statsLabels?: {
    duration?: string;
  };
  audioAvailable?: boolean;
  compareDisabled?: boolean;
  filterMeta?: {
    t2v?: boolean;
    i2v?: boolean;
    v2v?: boolean;
    firstLast?: boolean;
    extend?: boolean;
    lipSync?: boolean;
    audio?: boolean;
    maxResolution?: number | null;
    maxDuration?: number | null;
    priceFrom?: number | null;
    legacy?: boolean;
  };
};

type GalleryFilterKey = 'sort' | 'mode' | 'format' | 'duration' | 'price' | 'age';

const INITIAL_COUNT = 6;
const LOAD_COUNT = 6;

export type ModelsGalleryCopy = {
  compareLabel?: string;
  compareTooltip?: string;
  compareAria?: string;
  strengthsLabel?: string;
  stats?: {
    from?: string;
    maxDurShort?: string;
    maxDurLong?: string;
    maxResShort?: string;
    maxResLong?: string;
    typeShort?: string;
    typeLong?: string;
  };
  audioAvailableLabel?: string;
  filters?: {
    sort?: { label?: string; options?: Record<string, string> };
    mode?: { label?: string; options?: Record<string, string> };
    format?: { label?: string; options?: Record<string, string> };
    duration?: { label?: string; options?: Record<string, string> };
    price?: { label?: string; options?: Record<string, string> };
    age?: { label?: string; options?: Record<string, string> };
    searchPlaceholder?: string;
    clear?: string;
  };
  compareBar?: {
    selectedTemplate?: string;
    selectTwo?: string;
    clear?: string;
    compare?: string;
  };
  capabilityTooltips?: Record<string, string>;
};

const DEFAULT_COPY: Required<ModelsGalleryCopy> = {
  compareLabel: 'Compare',
  compareTooltip: 'Select to compare',
  compareAria: 'Select {engine} to compare',
  strengthsLabel: 'Strengths',
  stats: {
    from: 'From',
    maxDurShort: 'Max dur.',
    maxDurLong: 'Max duration',
    maxResShort: 'Max res.',
    maxResLong: 'Max resolution',
    typeShort: 'Type',
    typeLong: 'Type',
  },
  audioAvailableLabel: 'Audio available',
  filters: {
    sort: {
      label: 'Sort by',
      options: {
        featured: 'Featured',
        score: 'Score',
        price: 'Price',
        duration: 'Duration',
        resolution: 'Resolution',
        name: 'Name',
      },
    },
    mode: {
      label: 'Mode',
      options: {
        all: 'All',
        t2v: 'T2V',
        i2v: 'I2V',
        v2v: 'V2V',
        firstLast: 'First/Last',
        extend: 'Extend',
        lipSync: 'Lip sync',
        audio: 'Audio',
      },
    },
    format: {
      label: 'Format',
      options: {
        all: 'All',
        720: '720p+',
        1080: '1080p+',
        2160: '4K',
      },
    },
    duration: {
      label: 'Duration',
      options: {
        all: 'All',
        8: '≤8s',
        '10-15': '10–15s',
        20: '20s+',
      },
    },
    price: {
      label: 'Price',
      options: {
        all: 'All',
        cheap: '$',
        mid: '$$',
        premium: '$$$',
      },
    },
    age: {
      label: 'Models',
      options: {
        latest: 'Latest',
        legacy: 'Legacy',
        all: 'All',
      },
    },
    searchPlaceholder: 'Search models...',
    clear: 'Clear filters',
  },
  compareBar: {
    selectedTemplate: 'Selected: {left} + {right}',
    selectTwo: 'Select two engines to compare',
    clear: 'Clear',
    compare: 'Compare',
  },
  capabilityTooltips: {
    T2V: 'Text-to-video',
    I2V: 'Image-to-video',
    V2V: 'Video-to-video',
    'First/Last': 'First frame / last frame',
    Extend: 'Extend / continue',
  },
};

function FilterControl({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="whitespace-nowrap text-xs font-semibold text-text-secondary">{label}</span>
      {children}
    </div>
  );
}

export function ModelsGallery({
  cards,
  ctaLabel,
  copy,
  visibleFilters = ['sort', 'mode', 'format', 'duration', 'price', 'age'],
  allowCompare = true,
}: {
  cards: ModelGalleryCard[];
  ctaLabel: string;
  copy?: ModelsGalleryCopy;
  visibleFilters?: GalleryFilterKey[];
  allowCompare?: boolean;
}) {
  const filtersCopy = copy?.filters ?? {};
  const sortBase = DEFAULT_COPY.filters.sort ?? { options: {} };
  const modeBase = DEFAULT_COPY.filters.mode ?? { options: {} };
  const formatBase = DEFAULT_COPY.filters.format ?? { options: {} };
  const durationBase = DEFAULT_COPY.filters.duration ?? { options: {} };
  const priceBase = DEFAULT_COPY.filters.price ?? { options: {} };
  const ageBase = DEFAULT_COPY.filters.age ?? { options: {} };
  const sortCopy = {
    ...sortBase,
    ...filtersCopy.sort,
    options: { ...(sortBase.options ?? {}), ...(filtersCopy.sort?.options ?? {}) },
  };
  const modeCopy = {
    ...modeBase,
    ...filtersCopy.mode,
    options: { ...(modeBase.options ?? {}), ...(filtersCopy.mode?.options ?? {}) },
  };
  const formatCopy = {
    ...formatBase,
    ...filtersCopy.format,
    options: { ...(formatBase.options ?? {}), ...(filtersCopy.format?.options ?? {}) },
  };
  const durationCopy = {
    ...durationBase,
    ...filtersCopy.duration,
    options: { ...(durationBase.options ?? {}), ...(filtersCopy.duration?.options ?? {}) },
  };
  const priceCopy = {
    ...priceBase,
    ...filtersCopy.price,
    options: { ...(priceBase.options ?? {}), ...(filtersCopy.price?.options ?? {}) },
  };
  const ageCopy = {
    ...ageBase,
    ...filtersCopy.age,
    options: { ...(ageBase.options ?? {}), ...(filtersCopy.age?.options ?? {}) },
  };
  const compareLabel = copy?.compareLabel ?? DEFAULT_COPY.compareLabel;
  const compareTooltip = copy?.compareTooltip ?? DEFAULT_COPY.compareTooltip;
  const compareAria = copy?.compareAria ?? DEFAULT_COPY.compareAria;
  const strengthsLabel = copy?.strengthsLabel ?? DEFAULT_COPY.strengthsLabel;
  const statsDefaults: Required<NonNullable<ModelsGalleryCopy['stats']>> = {
    from: 'From',
    maxDurShort: 'Max dur.',
    maxDurLong: 'Max duration',
    maxResShort: 'Max res.',
    maxResLong: 'Max resolution',
    typeShort: 'Type',
    typeLong: 'Type',
  };
  const statsOverride = copy?.stats ?? {};
  const statsLabels: Required<NonNullable<ModelsGalleryCopy['stats']>> = {
    from: statsOverride.from ?? statsDefaults.from,
    maxDurShort: statsOverride.maxDurShort ?? statsDefaults.maxDurShort,
    maxDurLong: statsOverride.maxDurLong ?? statsDefaults.maxDurLong,
    maxResShort: statsOverride.maxResShort ?? statsDefaults.maxResShort,
    maxResLong: statsOverride.maxResLong ?? statsDefaults.maxResLong,
    typeShort: statsOverride.typeShort ?? statsDefaults.typeShort,
    typeLong: statsOverride.typeLong ?? statsDefaults.typeLong,
  };
  const audioAvailableLabel = copy?.audioAvailableLabel ?? DEFAULT_COPY.audioAvailableLabel;
  const compareBarDefaults: Required<NonNullable<ModelsGalleryCopy['compareBar']>> = {
    selectedTemplate: 'Selected: {left} + {right}',
    selectTwo: 'Select two engines to compare',
    clear: 'Clear',
    compare: 'Compare',
  };
  const compareBarOverride = copy?.compareBar ?? {};
  const compareBar: Required<NonNullable<ModelsGalleryCopy['compareBar']>> = {
    selectedTemplate: compareBarOverride.selectedTemplate ?? compareBarDefaults.selectedTemplate,
    selectTwo: compareBarOverride.selectTwo ?? compareBarDefaults.selectTwo,
    clear: compareBarOverride.clear ?? compareBarDefaults.clear,
    compare: compareBarOverride.compare ?? compareBarDefaults.compare,
  };
  const capabilityTooltips = { ...DEFAULT_COPY.capabilityTooltips, ...(copy?.capabilityTooltips ?? {}) };
  const filterClearLabel = filtersCopy.clear ?? DEFAULT_COPY.filters.clear;
  const searchPlaceholder = filtersCopy.searchPlaceholder ?? DEFAULT_COPY.filters.searchPlaceholder;
  const filterSelectButtonClassName =
    'h-11 min-w-[136px] rounded-[8px] border-hairline bg-bg px-4 text-xs font-semibold text-text-primary shadow-sm hover:border-[var(--brand-border)] hover:bg-surface-2';
  const sortLabel = sortCopy.label ?? 'Sort by';
  const modeLabel = modeCopy.label ?? 'Mode';
  const formatLabel = formatCopy.label ?? 'Format';
  const durationLabel = durationCopy.label ?? 'Duration';
  const priceLabel = priceCopy.label ?? 'Price';
  const ageLabel = ageCopy.label ?? 'Models';
  const visibleFilterSet = useMemo(() => new Set<GalleryFilterKey>(visibleFilters), [visibleFilters]);

  const MODE_OPTIONS: SelectOption[] = [
    { value: 'all', label: modeCopy.options.all },
    { value: 't2v', label: modeCopy.options.t2v },
    { value: 'i2v', label: modeCopy.options.i2v },
    { value: 'v2v', label: modeCopy.options.v2v },
    { value: 'firstLast', label: modeCopy.options.firstLast },
    { value: 'extend', label: modeCopy.options.extend },
    { value: 'lipSync', label: modeCopy.options.lipSync },
    { value: 'audio', label: modeCopy.options.audio },
  ];

  const FORMAT_OPTIONS: SelectOption[] = [
    { value: 'all', label: formatCopy.options.all },
    { value: '720', label: formatCopy.options[720] },
    { value: '1080', label: formatCopy.options[1080] },
    { value: '2160', label: formatCopy.options[2160] },
  ];

  const DURATION_OPTIONS: SelectOption[] = [
    { value: 'all', label: durationCopy.options.all },
    { value: '8', label: durationCopy.options[8] },
    { value: '10-15', label: durationCopy.options['10-15'] },
    { value: '20', label: durationCopy.options[20] },
  ];

  const PRICE_OPTIONS: SelectOption[] = [
    { value: 'all', label: priceCopy.options.all },
    { value: 'cheap', label: priceCopy.options.cheap },
    { value: 'mid', label: priceCopy.options.mid },
    { value: 'premium', label: priceCopy.options.premium },
  ];

  const AGE_OPTIONS: SelectOption[] = [
    { value: 'latest', label: ageCopy.options.latest },
    { value: 'legacy', label: ageCopy.options.legacy },
    { value: 'all', label: ageCopy.options.all },
  ];

  const SORT_OPTIONS: SelectOption[] = [
    { value: 'featured', label: sortCopy.options.featured },
    { value: 'score', label: sortCopy.options.score },
    { value: 'price', label: sortCopy.options.price },
    { value: 'duration', label: sortCopy.options.duration },
    { value: 'resolution', label: sortCopy.options.resolution },
    { value: 'name', label: sortCopy.options.name },
  ];
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);
  const observerRef = useRef<HTMLDivElement | null>(null);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const nextRouter = useNextRouter();
  const [compareMode, setCompareMode] = useState(allowCompare && searchParams?.get('compare') === '1');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedMode, setSelectedMode] = useState('all');
  const [selectedFormat, setSelectedFormat] = useState('all');
  const [selectedDuration, setSelectedDuration] = useState('all');
  const [selectedPrice, setSelectedPrice] = useState('all');
  const [selectedSort, setSelectedSort] = useState('featured');
  const [selectedAge, setSelectedAge] = useState('latest');
  const [searchQuery, setSearchQuery] = useState('');

  const appendCards = useCallback(
    (maxCount: number) => {
      setVisibleCount((current) => {
        if (current >= maxCount) return current;
        return Math.min(maxCount, current + LOAD_COUNT);
      });
    },
    []
  );

  useEffect(() => {
    if (!compareMode) {
      setSelectedIds([]);
    }
  }, [compareMode]);

  useEffect(() => {
    setCompareMode(allowCompare && searchParams?.get('compare') === '1');
  }, [allowCompare, searchParams]);

  useEffect(() => {
    if (!allowCompare) return undefined;
    const handler = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const enabled = Boolean(event.detail?.enabled);
      setCompareMode(enabled);
      if (!enabled) {
        setSelectedIds([]);
      }
    };
    window.addEventListener('models-compare-mode', handler as EventListener);
    return () => window.removeEventListener('models-compare-mode', handler as EventListener);
  }, [allowCompare]);

  useEffect(() => {
    if (allowCompare || !compareMode) return;
    setCompareMode(false);
    setSelectedIds([]);
  }, [allowCompare, compareMode]);

  const cardById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const selectedCards = selectedIds.map((id) => cardById.get(id)).filter(Boolean);

  const enableCompareMode = useCallback(() => {
    if (!allowCompare) return;
    if (compareMode) return;
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('compare', '1');
    const query = params.toString();
    const currentPath = pathname ?? '/models';
    const target = query ? `${currentPath}?${query}` : currentPath;
    nextRouter.push(target, { scroll: false });
    setCompareMode(true);
  }, [allowCompare, compareMode, nextRouter, pathname, searchParams]);

  const disableCompareMode = useCallback(() => {
    if (!compareMode) return;
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.delete('compare');
    const query = params.toString();
    const currentPath = pathname ?? '/models';
    const target = query ? `${currentPath}?${query}` : currentPath;
    nextRouter.push(target, { scroll: false });
    setCompareMode(false);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('models-compare-mode', { detail: { enabled: false } }));
    }
  }, [compareMode, nextRouter, pathname, searchParams]);

  useEffect(() => {
    if (compareMode && selectedIds.length === 0) {
      disableCompareMode();
    }
  }, [compareMode, disableCompareMode, selectedIds.length]);

  const clearFilters = () => {
    setSelectedMode('all');
    setSelectedFormat('all');
    setSelectedDuration('all');
    setSelectedPrice('all');
    setSelectedAge('latest');
    setSearchQuery('');
  };

  const hasActiveFilters =
    selectedMode !== 'all' ||
    selectedFormat !== 'all' ||
    selectedDuration !== 'all' ||
    selectedPrice !== 'all' ||
    selectedAge !== 'latest' ||
    searchQuery.trim().length > 0;

  const filteredCards = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return cards.filter((card) => {
      const meta = card.filterMeta;
      if (!meta) return !hasActiveFilters;
      if (normalizedQuery) {
        const haystack = [
          card.label,
          card.provider,
          card.description,
          ...(card.strengths ?? []),
          ...(card.capabilities ?? []),
          card.stats?.priceFrom,
          card.stats?.maxDuration,
          card.stats?.maxResolution,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(normalizedQuery)) return false;
      }
      if (selectedMode !== 'all') {
        if (selectedMode === 'audio') {
          if (!meta.audio) return false;
        } else if (!meta[selectedMode as keyof typeof meta]) {
          return false;
        }
      }
      if (selectedFormat !== 'all') {
        if (!meta.maxResolution) return false;
        const threshold = Number(selectedFormat);
        if (meta.maxResolution == null || meta.maxResolution < threshold) return false;
      }
      if (selectedDuration !== 'all') {
        if (!meta.maxDuration) return false;
        if (selectedDuration === '8' && meta.maxDuration > 8) return false;
        if (selectedDuration === '10-15' && (meta.maxDuration < 10 || meta.maxDuration > 15)) return false;
        if (selectedDuration === '20' && meta.maxDuration < 20) return false;
      }
      if (selectedPrice !== 'all') {
        if (meta.priceFrom == null) return false;
        if (selectedPrice === 'cheap' && meta.priceFrom > 0.08) return false;
        if (selectedPrice === 'mid' && !(meta.priceFrom > 0.08 && meta.priceFrom <= 0.2)) return false;
        if (selectedPrice === 'premium' && meta.priceFrom <= 0.2) return false;
      }
      if (selectedAge !== 'all') {
        const isLegacy = Boolean(meta.legacy);
        if (selectedAge === 'latest' && isLegacy) return false;
        if (selectedAge === 'legacy' && !isLegacy) return false;
      }
      return true;
    });
  }, [cards, hasActiveFilters, searchQuery, selectedMode, selectedFormat, selectedDuration, selectedPrice, selectedAge]);

  const sortedCards = useMemo(() => {
    const sortable = [...filteredCards];
    const compareNumbers = (a?: number | null, b?: number | null, direction: 'asc' | 'desc' = 'desc') => {
      const aVal =
        typeof a === 'number' ? a : direction === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
      const bVal =
        typeof b === 'number' ? b : direction === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
      return direction === 'asc' ? aVal - bVal : bVal - aVal;
    };
    switch (selectedSort) {
      case 'score':
        sortable.sort((a, b) => compareNumbers(a.overallScore ?? null, b.overallScore ?? null, 'desc'));
        break;
      case 'price':
        sortable.sort((a, b) => compareNumbers(a.filterMeta?.priceFrom ?? null, b.filterMeta?.priceFrom ?? null, 'asc'));
        break;
      case 'duration':
        sortable.sort((a, b) => compareNumbers(a.filterMeta?.maxDuration ?? null, b.filterMeta?.maxDuration ?? null, 'desc'));
        break;
      case 'resolution':
        sortable.sort((a, b) => compareNumbers(a.filterMeta?.maxResolution ?? null, b.filterMeta?.maxResolution ?? null, 'desc'));
        break;
      case 'name':
        sortable.sort((a, b) => a.label.localeCompare(b.label));
        break;
      default:
        break;
    }
    return sortable;
  }, [filteredCards, selectedSort]);

  useEffect(() => {
    if (visibleCount >= sortedCards.length) return undefined;
    const node = observerRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          appendCards(sortedCards.length);
        }
      },
      { rootMargin: '300px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [appendCards, sortedCards.length, visibleCount]);

  useEffect(() => {
    setVisibleCount(Math.min(INITIAL_COUNT, sortedCards.length));
  }, [sortedCards.length]);

  const handleToggleCard = (id: string) => {
    const card = cardById.get(id);
    if (card?.compareDisabled) return;
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.filter((entry) => entry !== id);
      }
      if (current.length < 2) {
        return [...current, id];
      }
      return [current[1], id];
    });
  };

  const handleClear = () => {
    setSelectedIds([]);
    disableCompareMode();
  };

  const compareHref = useMemo(() => {
    if (selectedIds.length !== 2) return null;
    const [leftId, rightId] = selectedIds;
    const sorted = [leftId, rightId].sort();
    const slug = `${sorted[0]}-vs-${sorted[1]}`;
    const query = leftId === sorted[0] ? undefined : { order: leftId };
    return { pathname: '/ai-video-engines/[slug]', params: { slug }, query };
  }, [selectedIds]);

  return (
    <>
      <div
        className="mt-0 flex flex-col gap-4 rounded-[8px] border border-hairline bg-surface-glass-95 px-5 py-5 shadow-[0_18px_44px_rgba(15,23,42,0.07),0_4px_14px_rgba(15,23,42,0.035)] backdrop-blur md:flex-row md:items-center md:justify-between dark:bg-surface-glass-80 sm:px-8"
        id="models-compare-toggle"
      >
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          {visibleFilterSet.has('sort') ? (
            <FilterControl label={sortLabel}>
              <SelectMenu
                options={SORT_OPTIONS}
                value={selectedSort}
                onChange={(value) => setSelectedSort(String(value))}
                buttonClassName={filterSelectButtonClassName}
              />
            </FilterControl>
          ) : null}
          {visibleFilterSet.has('mode') ? (
            <FilterControl label={modeLabel}>
              <SelectMenu
                options={MODE_OPTIONS}
                value={selectedMode}
                onChange={(value) => setSelectedMode(String(value))}
                buttonClassName={filterSelectButtonClassName}
              />
            </FilterControl>
          ) : null}
          {visibleFilterSet.has('format') ? (
            <FilterControl label={formatLabel}>
              <SelectMenu
                options={FORMAT_OPTIONS}
                value={selectedFormat}
                onChange={(value) => setSelectedFormat(String(value))}
                buttonClassName={filterSelectButtonClassName}
              />
            </FilterControl>
          ) : null}
          {visibleFilterSet.has('duration') ? (
            <FilterControl label={durationLabel}>
              <SelectMenu
                options={DURATION_OPTIONS}
                value={selectedDuration}
                onChange={(value) => setSelectedDuration(String(value))}
                buttonClassName={filterSelectButtonClassName}
              />
            </FilterControl>
          ) : null}
          {visibleFilterSet.has('price') ? (
            <FilterControl label={priceLabel}>
              <SelectMenu
                options={PRICE_OPTIONS}
                value={selectedPrice}
                onChange={(value) => setSelectedPrice(String(value))}
                buttonClassName={filterSelectButtonClassName}
              />
            </FilterControl>
          ) : null}
          {visibleFilterSet.has('age') ? (
            <FilterControl label={ageLabel}>
              <SelectMenu
                options={AGE_OPTIONS}
                value={selectedAge}
                onChange={(value) => setSelectedAge(String(value))}
                buttonClassName={filterSelectButtonClassName}
              />
            </FilterControl>
          ) : null}
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="h-11 rounded-[8px] border border-hairline bg-bg px-3 text-xs font-semibold text-text-secondary transition hover:border-text-muted hover:text-text-primary"
            >
              {filterClearLabel}
            </button>
          ) : null}
        </div>
        <label className="relative min-w-0 md:w-[300px] lg:w-[340px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
          <span className="sr-only">{searchPlaceholder}</span>
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-11 w-full rounded-[8px] border border-hairline bg-bg pl-9 pr-3 text-sm font-medium text-text-primary shadow-sm outline-none transition placeholder:text-text-muted/75 hover:border-[var(--brand-border)] focus:border-[var(--brand-border)] focus:ring-2 focus:ring-[color:var(--brand-border)]"
          />
        </label>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
        {sortedCards.slice(0, visibleCount).map((card) => (
          <ModelCard
            key={card.id}
            card={card}
            ctaLabel={ctaLabel}
            compareMode={compareMode}
            compareLabel={compareLabel}
            compareTooltip={compareTooltip}
            compareAria={compareAria}
            strengthsLabel={strengthsLabel}
            statsLabels={statsLabels}
            capabilityTooltips={capabilityTooltips}
            audioAvailableLabel={audioAvailableLabel}
            compareEnabled={allowCompare}
            selected={selectedIds.includes(card.id)}
            onToggle={() => handleToggleCard(card.id)}
            onActivateCompare={enableCompareMode}
          />
        ))}
      </div>
      {!sortedCards.length ? (
        <div className="mt-8 rounded-[18px] border border-dashed border-hairline bg-surface/80 px-5 py-8 text-center text-sm font-medium text-text-secondary">
          {filterClearLabel}
        </div>
      ) : null}
      {visibleCount < sortedCards.length ? (
        <div ref={observerRef} className="h-4 w-full" aria-hidden />
      ) : null}

      {allowCompare && compareMode ? (
        <div className="fixed inset-x-4 bottom-6 z-40 mx-auto max-w-4xl rounded-2xl border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,255,255,0.78))] px-4 py-3 shadow-[0_18px_40px_rgba(15,23,42,0.22),0_6px_16px_rgba(15,23,42,0.16)] backdrop-blur dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,0.9))]">
          <span className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-[linear-gradient(180deg,rgba(255,255,255,0.7),transparent)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent)]" />
          <div className="relative flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="font-semibold text-text-primary">
              {selectedCards.length === 2
                ? formatTemplate(compareBar.selectedTemplate, {
                    left: selectedCards[0]?.label ?? '',
                    right: selectedCards[1]?.label ?? '',
                  })
                : compareBar.selectTwo}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleClear}
                className="rounded-full border border-hairline px-3 py-1 text-xs font-semibold text-text-secondary transition hover:border-text-muted hover:text-text-primary"
              >
                {compareBar.clear}
              </button>
              {compareHref ? (
                <Link
                  href={compareHref}
                  prefetch={false}
                  className="rounded-full bg-text-primary px-4 py-1 text-xs font-semibold text-bg transition hover:opacity-90"
                >
                  {compareBar.compare}
                </Link>
              ) : (
                <span className="rounded-full border border-hairline px-4 py-1 text-xs font-semibold text-text-muted">
                  {compareBar.compare}
                </span>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
