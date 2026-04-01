'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { usePathname, useSearchParams, useRouter as useNextRouter } from 'next/navigation';
import type { LocalizedLinkHref } from '@/i18n/navigation';
import { SelectMenu, type SelectOption } from '@/components/ui/SelectMenu';

export type ModelGalleryCard = {
  id: string;
  label: string;
  provider?: string | null;
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
const CTA_ARROW = '→';

type ModelsGalleryCopy = {
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
      label: 'Sort',
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

function formatTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
}

function normalizeCtaLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed.length || trimmed.toLowerCase().startsWith('explore')) {
    return `Full details ${CTA_ARROW}`;
  }
  return trimmed.endsWith(CTA_ARROW) ? trimmed : `${trimmed} ${CTA_ARROW}`;
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
  const visibleFilterSet = useMemo(() => new Set<GalleryFilterKey>(visibleFilters), [visibleFilters]);

  const MODE_OPTIONS: SelectOption[] = [
    { value: 'all', label: `${modeCopy.label}: ${modeCopy.options.all}` },
    { value: 't2v', label: `${modeCopy.label}: ${modeCopy.options.t2v}` },
    { value: 'i2v', label: `${modeCopy.label}: ${modeCopy.options.i2v}` },
    { value: 'v2v', label: `${modeCopy.label}: ${modeCopy.options.v2v}` },
    { value: 'firstLast', label: `${modeCopy.label}: ${modeCopy.options.firstLast}` },
    { value: 'extend', label: `${modeCopy.label}: ${modeCopy.options.extend}` },
    { value: 'lipSync', label: `${modeCopy.label}: ${modeCopy.options.lipSync}` },
    { value: 'audio', label: `${modeCopy.label}: ${modeCopy.options.audio}` },
  ];

  const FORMAT_OPTIONS: SelectOption[] = [
    { value: 'all', label: `${formatCopy.label}: ${formatCopy.options.all}` },
    { value: '720', label: `${formatCopy.label}: ${formatCopy.options[720]}` },
    { value: '1080', label: `${formatCopy.label}: ${formatCopy.options[1080]}` },
    { value: '2160', label: `${formatCopy.label}: ${formatCopy.options[2160]}` },
  ];

  const DURATION_OPTIONS: SelectOption[] = [
    { value: 'all', label: `${durationCopy.label}: ${durationCopy.options.all}` },
    { value: '8', label: `${durationCopy.label}: ${durationCopy.options[8]}` },
    { value: '10-15', label: `${durationCopy.label}: ${durationCopy.options['10-15']}` },
    { value: '20', label: `${durationCopy.label}: ${durationCopy.options[20]}` },
  ];

  const PRICE_OPTIONS: SelectOption[] = [
    { value: 'all', label: `${priceCopy.label}: ${priceCopy.options.all}` },
    { value: 'cheap', label: `${priceCopy.label}: ${priceCopy.options.cheap}` },
    { value: 'mid', label: `${priceCopy.label}: ${priceCopy.options.mid}` },
    { value: 'premium', label: `${priceCopy.label}: ${priceCopy.options.premium}` },
  ];

  const AGE_OPTIONS: SelectOption[] = [
    { value: 'latest', label: `${ageCopy.label}: ${ageCopy.options.latest}` },
    { value: 'legacy', label: `${ageCopy.label}: ${ageCopy.options.legacy}` },
    { value: 'all', label: `${ageCopy.label}: ${ageCopy.options.all}` },
  ];

  const SORT_OPTIONS: SelectOption[] = [
    { value: 'featured', label: `${sortCopy.label}: ${sortCopy.options.featured}` },
    { value: 'score', label: `${sortCopy.label}: ${sortCopy.options.score}` },
    { value: 'price', label: `${sortCopy.label}: ${sortCopy.options.price}` },
    { value: 'duration', label: `${sortCopy.label}: ${sortCopy.options.duration}` },
    { value: 'resolution', label: `${sortCopy.label}: ${sortCopy.options.resolution}` },
    { value: 'name', label: `${sortCopy.label}: ${sortCopy.options.name}` },
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
  };

  const hasActiveFilters =
    selectedMode !== 'all' ||
    selectedFormat !== 'all' ||
    selectedDuration !== 'all' ||
    selectedPrice !== 'all' ||
    selectedAge !== 'latest';

  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      const meta = card.filterMeta;
      if (!meta) return !hasActiveFilters;
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
  }, [cards, hasActiveFilters, selectedMode, selectedFormat, selectedDuration, selectedPrice, selectedAge]);

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
      <div className="mt-8 flex flex-wrap gap-2" id="models-compare-toggle">
        {visibleFilterSet.has('sort') ? (
          <SelectMenu
            options={SORT_OPTIONS}
            value={selectedSort}
            onChange={(value) => setSelectedSort(String(value))}
            buttonClassName="rounded-full border-hairline bg-surface-glass-80 px-3 py-1 text-xs font-medium text-text-secondary hover:border-text-muted hover:bg-surface-2 hover:text-text-primary"
          />
        ) : null}
        {visibleFilterSet.has('mode') ? (
          <SelectMenu
            options={MODE_OPTIONS}
            value={selectedMode}
            onChange={(value) => setSelectedMode(String(value))}
            buttonClassName="rounded-full border-hairline bg-surface-glass-80 px-3 py-1 text-xs font-medium text-text-secondary hover:border-text-muted hover:bg-surface-2 hover:text-text-primary"
          />
        ) : null}
        {visibleFilterSet.has('format') ? (
          <SelectMenu
            options={FORMAT_OPTIONS}
            value={selectedFormat}
            onChange={(value) => setSelectedFormat(String(value))}
            buttonClassName="rounded-full border-hairline bg-surface-glass-80 px-3 py-1 text-xs font-medium text-text-secondary hover:border-text-muted hover:bg-surface-2 hover:text-text-primary"
          />
        ) : null}
        {visibleFilterSet.has('duration') ? (
          <SelectMenu
            options={DURATION_OPTIONS}
            value={selectedDuration}
            onChange={(value) => setSelectedDuration(String(value))}
            buttonClassName="rounded-full border-hairline bg-surface-glass-80 px-3 py-1 text-xs font-medium text-text-secondary hover:border-text-muted hover:bg-surface-2 hover:text-text-primary"
          />
        ) : null}
        {visibleFilterSet.has('price') ? (
          <SelectMenu
            options={PRICE_OPTIONS}
            value={selectedPrice}
            onChange={(value) => setSelectedPrice(String(value))}
            buttonClassName="rounded-full border-hairline bg-surface-glass-80 px-3 py-1 text-xs font-medium text-text-secondary hover:border-text-muted hover:bg-surface-2 hover:text-text-primary"
          />
        ) : null}
        {visibleFilterSet.has('age') ? (
          <SelectMenu
            options={AGE_OPTIONS}
            value={selectedAge}
            onChange={(value) => setSelectedAge(String(value))}
            buttonClassName="rounded-full border-hairline bg-surface-glass-80 px-3 py-1 text-xs font-medium text-text-secondary hover:border-text-muted hover:bg-surface-2 hover:text-text-primary"
          />
        ) : null}
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-full border border-hairline px-3 py-1 text-xs font-semibold text-text-secondary transition hover:border-text-muted hover:text-text-primary"
          >
            {filterClearLabel}
          </button>
        ) : null}
      </div>

      <div className="mt-8 grid grid-gap sm:grid-cols-2 xl:grid-cols-3">
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

function ModelCard({
  card,
  ctaLabel,
  compareMode,
  compareLabel,
  compareTooltip,
  compareAria,
  strengthsLabel,
  statsLabels,
  capabilityTooltips,
  audioAvailableLabel,
  compareEnabled,
  selected,
  onToggle,
  onActivateCompare,
}: {
  card: ModelGalleryCard;
  ctaLabel: string;
  compareMode: boolean;
  compareLabel: string;
  compareTooltip: string;
  compareAria: string;
  strengthsLabel: string;
  statsLabels: Required<NonNullable<ModelsGalleryCopy['stats']>>;
  capabilityTooltips: Record<string, string>;
  audioAvailableLabel: string;
  compareEnabled: boolean;
  selected: boolean;
  onToggle: () => void;
  onActivateCompare: () => void;
}) {
  const router = useRouter();
  type RouterPushInput = Parameters<typeof router.push>[0];
  const accent = card.backgroundColor ?? '#6366f1';
  const normalizedCtaLabel = normalizeCtaLabel(ctaLabel);
  const ctaText = normalizedCtaLabel.replace(/\s*→\s*$/, '');
  const scoreValue = typeof card.overallScore === 'number' ? card.overallScore.toFixed(1) : null;
  const scoreSweep = `${Math.max(0, Math.min(360, (card.overallScore ?? 0) * 36))}deg`;
  const providerBadgeBg = `color-mix(in srgb, ${accent} 4%, white 96%)`;
  const providerBadgeBorder = `color-mix(in srgb, ${accent} 11%, #d6deea 89%)`;
  const providerBadgeText = `color-mix(in srgb, ${accent} 20%, #475569 80%)`;
  const providerBadgeBgDark = `color-mix(in srgb, ${accent} 10%, #0f172a 90%)`;
  const providerBadgeBorderDark = `color-mix(in srgb, ${accent} 18%, #334155 82%)`;
  const providerBadgeTextDark = `color-mix(in srgb, ${accent} 20%, #f8fafc 80%)`;
  const accentTopBorder = `linear-gradient(90deg, color-mix(in srgb, ${accent} 82%, white 18%) 0%, color-mix(in srgb, ${accent} 42%, white 58%) 58%, transparent 100%)`;
  const accentGlow = `radial-gradient(circle at top right, color-mix(in srgb, ${accent} 11%, white 89%) 0%, transparent 70%)`;
  const accentGlowDark = `radial-gradient(circle at top right, color-mix(in srgb, ${accent} 16%, #020617 84%) 0%, transparent 70%)`;
  const cardSurface = `linear-gradient(180deg, rgba(255,255,255,0.985) 0%, color-mix(in srgb, ${accent} 2%, #f8fafc 98%) 100%)`;
  const cardSurfaceDark = `linear-gradient(180deg, color-mix(in srgb, ${accent} 8%, #101827 92%) 0%, #0a1220 100%)`;
  const specPanelBg = `linear-gradient(180deg, rgba(255,255,255,0.9) 0%, color-mix(in srgb, ${accent} 3%, #f8fafc 97%) 100%)`;
  const specPanelBgDark = 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.025) 100%)';
  const specPanelBorder = `color-mix(in srgb, ${accent} 9%, #dbe4ee 91%)`;
  const specPanelBorderDark = `color-mix(in srgb, ${accent} 15%, #334155 85%)`;
  const specDivider = `color-mix(in srgb, ${accent} 8%, #d7dee8 92%)`;
  const specDividerDark = `color-mix(in srgb, ${accent} 16%, #334155 84%)`;
  const chipBg = `color-mix(in srgb, ${accent} 3%, white 97%)`;
  const chipBorder = `color-mix(in srgb, ${accent} 9%, #d8dfeb 91%)`;
  const chipText = `color-mix(in srgb, ${accent} 21%, #475569 79%)`;
  const chipBgDark = `color-mix(in srgb, ${accent} 8%, #0f172a 92%)`;
  const chipBorderDark = `color-mix(in srgb, ${accent} 15%, #334155 85%)`;
  const chipTextDark = `color-mix(in srgb, ${accent} 18%, #f8fafc 82%)`;
  const scoreRingBackground = scoreValue
    ? `conic-gradient(from 220deg, color-mix(in srgb, ${accent} 70%, white 30%) 0deg ${scoreSweep}, rgba(148,163,184,0.1) ${scoreSweep} 360deg)`
    : `linear-gradient(135deg, color-mix(in srgb, ${accent} 72%, white 28%), color-mix(in srgb, ${accent} 42%, white 58%))`;
  const ctaBackground = `linear-gradient(180deg, color-mix(in srgb, ${accent} 8%, #111827 92%) 0%, #0f172a 100%)`;
  const ctaBackgroundHover = `linear-gradient(180deg, color-mix(in srgb, ${accent} 12%, #0b1220 88%) 0%, #020617 100%)`;
  const priceNoteBg = `color-mix(in srgb, ${accent} 8%, #f8fafc 92%)`;
  const priceNoteBorder = `color-mix(in srgb, ${accent} 14%, #d2dbe7 86%)`;
  const priceNoteBgDark = `color-mix(in srgb, ${accent} 8%, #111827 92%)`;
  const priceNoteBorderDark = `color-mix(in srgb, ${accent} 16%, #334155 84%)`;
  const ctaBorder = 'rgba(255,255,255,0.12)';
  const ctaBorderDark = `color-mix(in srgb, ${accent} 20%, rgba(255,255,255,0.14) 80%)`;
  const compareLabelExceptions = new Set(['kling-2-5-turbo']);
  const hideCompare = card.label.length > 14 && !compareLabelExceptions.has(card.id);
  const secondarySpecValueClass =
    'mt-1 min-h-[2.3rem] tabular-nums font-semibold leading-tight tracking-[-0.03em] text-slate-950 dark:text-white';
  const maxResolutionValueClass =
    (card.stats?.maxResolution?.length ?? 0) > 7 ? 'text-[14px] sm:text-[15px]' : 'text-[17px] sm:text-[18px]';
  const capabilityItems = [...(card.capabilities ?? [])];
  if (card.filterMeta?.lipSync && !capabilityItems.includes('Lip sync')) {
    capabilityItems.push('Lip sync');
  }
  if (card.audioAvailable && !capabilityItems.includes('Audio')) {
    capabilityItems.push('Audio');
  }
  const visibleCapabilities = capabilityItems.slice(0, 6);
  const handleCompareToggle = (event: React.MouseEvent | React.ChangeEvent) => {
    event.stopPropagation();
    if (card.compareDisabled) return;
    if (!compareMode) {
      onActivateCompare();
    }
    onToggle();
  };
  const handleClick = () => {
    if (compareMode) {
      onToggle();
      return;
    }
    router.push(card.href as RouterPushInput);
  };
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (compareMode) {
        onToggle();
        return;
      }
      router.push(card.href as RouterPushInput);
    }
  };
  return (
    <article
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`group relative isolate flex min-h-[22rem] cursor-pointer flex-col overflow-hidden rounded-[24px] border border-slate-200/70 bg-white bg-[image:var(--card-surface)] p-5 text-slate-950 shadow-[0_18px_38px_rgba(15,23,42,0.06),0_4px_10px_rgba(15,23,42,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[color:var(--card-border-hover)] hover:shadow-[0_24px_56px_rgba(15,23,42,0.09),0_10px_24px_rgba(15,23,42,0.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--card-focus-ring)] dark:border-white/10 dark:bg-[image:var(--card-surface-dark)] dark:text-white dark:hover:border-[color:var(--card-border-hover-dark)] dark:focus-visible:ring-[color:var(--card-focus-ring-dark)] ${
        selected ? 'ring-2 ring-emerald-500/35 border-emerald-400/60' : ''
      }`}
      style={
        {
          '--card-surface': cardSurface,
          '--card-border-hover': providerBadgeBorder,
          '--card-focus-ring': providerBadgeBorder,
          '--card-surface-dark': cardSurfaceDark,
          '--card-border-hover-dark': providerBadgeBorderDark,
          '--card-focus-ring-dark': providerBadgeBorderDark,
          '--spec-panel-bg': specPanelBg,
          '--spec-panel-bg-dark': specPanelBgDark,
          '--spec-panel-border': specPanelBorder,
          '--spec-panel-border-dark': specPanelBorderDark,
          '--spec-divider': specDivider,
          '--spec-divider-dark': specDividerDark,
          '--provider-badge-bg': providerBadgeBg,
          '--provider-badge-bg-dark': providerBadgeBgDark,
          '--provider-badge-border': providerBadgeBorder,
          '--provider-badge-border-dark': providerBadgeBorderDark,
          '--provider-badge-text': providerBadgeText,
          '--provider-badge-text-dark': providerBadgeTextDark,
          '--chip-bg': chipBg,
          '--chip-bg-dark': chipBgDark,
          '--chip-border': chipBorder,
          '--chip-border-dark': chipBorderDark,
          '--chip-text': chipText,
          '--chip-text-dark': chipTextDark,
          '--price-note-bg': priceNoteBg,
          '--price-note-bg-dark': priceNoteBgDark,
          '--price-note-border': priceNoteBorder,
          '--price-note-border-dark': priceNoteBorderDark,
          '--cta-border': ctaBorder,
          '--cta-border-dark': ctaBorderDark,
        } as React.CSSProperties
      }
      aria-label={`${normalizedCtaLabel} ${card.label}`}
    >
      <span className="pointer-events-none absolute inset-px rounded-[23px] border border-white/70 opacity-80 dark:border-white/[0.04]" aria-hidden />
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
        style={{ backgroundImage: accentTopBorder }}
        aria-hidden
      />
      <span
        className="pointer-events-none absolute right-0 top-0 h-40 w-40 opacity-80 blur-3xl dark:opacity-60"
        style={{ backgroundImage: accentGlow }}
        aria-hidden
      />
      <span
        className="pointer-events-none absolute right-0 top-0 hidden h-40 w-40 opacity-60 blur-3xl dark:block"
        style={{ backgroundImage: accentGlowDark }}
        aria-hidden
      />
      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 min-h-[2.2em] text-balance text-[24px] font-semibold leading-[1.02] tracking-[-0.035em] text-slate-950 dark:text-white sm:text-[26px]">
              {card.label}
            </h3>
            {card.provider ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--provider-badge-border)] bg-[color:var(--provider-badge-bg)] px-3 py-[0.4rem] text-[10px] font-medium tracking-[0.03em] text-[color:var(--provider-badge-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-sm dark:border-[color:var(--provider-badge-border-dark)] dark:bg-[color:var(--provider-badge-bg-dark)] dark:text-[color:var(--provider-badge-text-dark)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} aria-hidden />
                  {card.provider}
                </span>
              </div>
            ) : null}
          </div>
          {scoreValue ? (
            <div className="shrink-0">
              <div
                className="relative grid h-[74px] w-[74px] place-items-center rounded-full p-[3px] shadow-[0_10px_18px_rgba(15,23,42,0.06)]"
                style={{ background: scoreRingBackground }}
              >
                <span className="absolute inset-[3px] rounded-full border border-slate-200/70 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.92)] dark:border-white/10 dark:bg-[#08101d]" />
                <div className="relative flex flex-col items-center justify-center leading-none">
                  <div className="flex items-end gap-0.5">
                    <span className="tabular-nums text-[25px] font-semibold tracking-[-0.07em] text-slate-950 dark:text-white">
                      {scoreValue}
                    </span>
                    <span className="mb-[3px] text-[8px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-white/58">
                      /10
                    </span>
                  </div>
                  <span className="mt-1 text-[7px] font-semibold uppercase tracking-[0.26em] text-slate-400 dark:text-white/56">
                    Score
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {card.strengths?.length ? (
          <p className="mt-4 flex items-center gap-2 text-[13px] leading-5 text-slate-700 dark:text-white/90">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} aria-hidden />
            <span className="min-w-0 truncate">
              <span className="font-semibold text-slate-900 dark:text-white">{strengthsLabel}:</span>{' '}
              {card.strengths.join(' · ')}
            </span>
          </p>
        ) : null}

        {card.stats ? (
          <dl
            className="mt-5 grid grid-cols-3 overflow-hidden rounded-[18px] border border-[color:var(--spec-panel-border)] bg-[image:var(--spec-panel-bg)] text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_10px_20px_rgba(15,23,42,0.03)] dark:border-[color:var(--spec-panel-border-dark)] dark:bg-[image:var(--spec-panel-bg-dark)] dark:text-white/84 dark:shadow-none"
          >
            <div className="min-w-0 border-r border-r-[color:var(--spec-divider)] px-4 py-3 dark:border-r-[color:var(--spec-divider-dark)]">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-white/60">
                {statsLabels.from}
              </dt>
              <dd className={`${secondarySpecValueClass} text-[17px] sm:text-[18px]`}>
                {card.stats.priceFrom ?? '—'}
              </dd>
            </div>
            <div className="min-w-0 border-r border-r-[color:var(--spec-divider)] px-4 py-3 dark:border-r-[color:var(--spec-divider-dark)]">
              <dt
                className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-white/60"
                aria-label={card.statsLabels?.duration ? statsLabels.typeLong : statsLabels.maxDurLong}
              >
                {card.statsLabels?.duration ? statsLabels.typeShort : statsLabels.maxDurShort}
              </dt>
              <dd className={`${secondarySpecValueClass} text-[17px] sm:text-[18px]`}>
                {card.stats.maxDuration ?? '—'}
              </dd>
            </div>
            <div className="min-w-0 px-4 py-3">
              <dt
                className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-white/60"
                aria-label={statsLabels.maxResLong}
              >
                {statsLabels.maxResShort}
              </dt>
              <dd className={`${secondarySpecValueClass} ${maxResolutionValueClass}`}>
                {card.stats.maxResolution ?? '—'}
              </dd>
            </div>
          </dl>
        ) : null}

        {visibleCapabilities.length ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {visibleCapabilities.map((cap) => {
              const tooltip = cap === 'Audio' ? audioAvailableLabel : capabilityTooltips[cap] ?? cap;
              return (
                <span
                  key={cap}
                  title={tooltip}
                  aria-label={tooltip}
                  className="inline-flex min-h-7 items-center rounded-full border border-[color:var(--chip-border)] bg-[color:var(--chip-bg)] px-3 py-[0.38rem] text-[9px] font-semibold uppercase tracking-[0.22em] text-[color:var(--chip-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(15,23,42,0.03)] transition group-hover:border-[color:var(--card-border-hover)] dark:border-[color:var(--chip-border-dark)] dark:bg-[color:var(--chip-bg-dark)] dark:text-[color:var(--chip-text-dark)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] dark:group-hover:border-[color:var(--card-border-hover-dark)]"
                >
                  {cap}
                </span>
              );
            })}
          </div>
        ) : null}

        <div className="mt-4 min-h-[5.5rem]">
          <p className="line-clamp-4 text-[14px] font-medium leading-[1.55] text-slate-900 dark:text-white/[0.97]">
            {card.description}
          </p>
        </div>
        {card.priceNote ? (
          card.priceNoteHref ? (
            <Link
              href={card.priceNoteHref}
              prefetch={false}
              className="mt-3 inline-flex items-center rounded-full border border-[color:var(--price-note-border)] bg-[color:var(--price-note-bg)] px-3 py-1.5 text-[11px] font-medium tracking-[0.02em] text-slate-600 transition hover:text-slate-950 dark:border-[color:var(--price-note-border-dark)] dark:bg-[color:var(--price-note-bg-dark)] dark:text-white/82 dark:hover:text-white"
              onClick={(event) => event.stopPropagation()}
            >
              {card.priceNote}
            </Link>
          ) : (
            <span
              className="mt-3 inline-flex items-center rounded-full border border-[color:var(--price-note-border)] bg-[color:var(--price-note-bg)] px-3 py-1.5 text-[11px] font-medium tracking-[0.02em] text-slate-600 dark:border-[color:var(--price-note-border-dark)] dark:bg-[color:var(--price-note-bg-dark)] dark:text-white/82"
            >
              {card.priceNote}
            </span>
          )
        ) : null}
        <div className="mt-auto pt-6">
          <div className="flex flex-wrap items-center gap-3 border-t border-slate-200/65 pt-4 dark:border-white/10">
            {compareEnabled && !card.compareDisabled ? (
              <label
                className={`inline-flex items-center gap-3 text-sm font-medium transition ${
                  selected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-white/84'
                }`}
                title={compareTooltip}
                onClick={(event) => event.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={handleCompareToggle}
                  onClick={(event) => event.stopPropagation()}
                  className="peer sr-only"
                  aria-label={formatTemplate(compareAria, { engine: card.label })}
                />
                <span className="grid h-5 w-5 place-items-center rounded-[6px] border border-slate-300/90 bg-white text-[12px] text-transparent shadow-[inset_0_1px_0_rgba(255,255,255,0.88)] transition peer-checked:border-emerald-500 peer-checked:bg-emerald-500 peer-checked:text-white dark:border-white/18 dark:bg-white/[0.02] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  ✓
                </span>
                {!hideCompare ? <span>{compareLabel}</span> : null}
              </label>
            ) : (
              <span className="text-sm text-slate-400 dark:text-white/35" />
            )}
            <Link
              href={card.href}
              prefetch={false}
              className="ml-auto inline-flex items-center gap-2 rounded-full border px-4 py-[0.58rem] text-[13px] font-semibold tracking-[0.01em] text-white shadow-[0_8px_16px_rgba(15,23,42,0.1)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_22px_rgba(15,23,42,0.12)] dark:border-[color:var(--cta-border-dark)] dark:text-white"
              style={{
                background: ctaBackground,
                borderColor: ctaBorder,
              }}
              aria-label={`${ctaText} — ${card.label}`}
              onClick={(event) => event.stopPropagation()}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = ctaBackgroundHover;
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = ctaBackground;
              }}
            >
              {ctaText}
              <span className="sr-only"> — {card.label}</span>
              <span className="transition-transform duration-150 group-hover:translate-x-0.5">→</span>
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
