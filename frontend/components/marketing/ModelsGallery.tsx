'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useSearchParams, useRouter as useNextRouter } from 'next/navigation';
import { ModelCard } from '@/components/marketing/ModelsGalleryCard';
import { ModelsGalleryCompareBar } from '@/components/marketing/models-gallery/ModelsGalleryCompareBar';
import { ModelsGalleryFilters } from '@/components/marketing/models-gallery/ModelsGalleryFilters';
import { resolveModelsGalleryCopy } from '@/components/marketing/models-gallery/models-gallery-copy';
import {
  filterModelGalleryCards,
  hasActiveModelsGalleryFilters,
  sortModelGalleryCards,
  type ModelsGalleryFilterState,
} from '@/components/marketing/models-gallery/models-gallery-filtering';
import type {
  GalleryFilterKey,
  ModelGalleryCard,
  ModelsGalleryCompareHref,
  ModelsGalleryCopy,
  ModelsGalleryEngineType,
} from '@/components/marketing/models-gallery/models-gallery-types';

export type {
  GalleryFilterKey,
  ModelGalleryCard,
  ModelsGalleryCompareHref,
  ModelsGalleryCopy,
  ModelsGalleryEngineType,
} from '@/components/marketing/models-gallery/models-gallery-types';

const INITIAL_COUNT = 6;
const LOAD_COUNT = 6;

export function ModelsGallery({
  cards,
  ctaLabel,
  copy,
  visibleFilters = ['sort', 'mode', 'format', 'duration', 'price', 'age'],
  allowCompare = true,
  showEngineTypeTabs = false,
  initialEngineType = 'all',
}: {
  cards: ModelGalleryCard[];
  ctaLabel: string;
  copy?: ModelsGalleryCopy;
  visibleFilters?: GalleryFilterKey[];
  allowCompare?: boolean;
  showEngineTypeTabs?: boolean;
  initialEngineType?: ModelsGalleryEngineType;
}) {
  const resolvedCopy = useMemo(() => resolveModelsGalleryCopy(copy), [copy]);
  const visibleFilterSet = useMemo(() => new Set<GalleryFilterKey>(visibleFilters), [visibleFilters]);
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
  const [selectedEngineType, setSelectedEngineType] = useState<ModelsGalleryEngineType>(
    showEngineTypeTabs ? initialEngineType : 'all'
  );
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setSelectedEngineType(showEngineTypeTabs ? initialEngineType : 'all');
  }, [initialEngineType, showEngineTypeTabs]);

  const filterState: ModelsGalleryFilterState = useMemo(
    () => ({
      selectedEngineType: showEngineTypeTabs ? selectedEngineType : 'all',
      searchQuery,
      selectedAge,
      selectedDuration,
      selectedFormat,
      selectedMode,
      selectedPrice,
    }),
    [searchQuery, selectedAge, selectedDuration, selectedEngineType, selectedFormat, selectedMode, selectedPrice, showEngineTypeTabs]
  );

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
  const selectedCards = selectedIds
    .map((id) => cardById.get(id))
    .filter((card): card is ModelGalleryCard => Boolean(card));

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

  const hasActiveFilters = hasActiveModelsGalleryFilters(filterState);

  const filteredCards = useMemo(
    () => filterModelGalleryCards(cards, filterState, hasActiveFilters),
    [cards, filterState, hasActiveFilters]
  );

  const sortedCards = useMemo(() => sortModelGalleryCards(filteredCards, selectedSort), [filteredCards, selectedSort]);

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

  const compareHref = useMemo<ModelsGalleryCompareHref | null>(() => {
    if (selectedIds.length !== 2) return null;
    const [leftId, rightId] = selectedIds;
    const sorted = [leftId, rightId].sort();
    const slug = `${sorted[0]}-vs-${sorted[1]}`;
    const query = leftId === sorted[0] ? undefined : { order: leftId };
    return { pathname: '/ai-video-engines/[slug]', params: { slug }, query };
  }, [selectedIds]);

  return (
    <>
      <ModelsGalleryFilters
        copy={resolvedCopy}
        hasActiveFilters={hasActiveFilters}
        searchQuery={searchQuery}
        selectedAge={selectedAge}
        selectedDuration={selectedDuration}
        selectedEngineType={selectedEngineType}
        selectedFormat={selectedFormat}
        selectedMode={selectedMode}
        selectedPrice={selectedPrice}
        selectedSort={selectedSort}
        showEngineTypeTabs={showEngineTypeTabs}
        visibleFilterSet={visibleFilterSet}
        onAgeChange={setSelectedAge}
        onClearFilters={clearFilters}
        onDurationChange={setSelectedDuration}
        onEngineTypeChange={setSelectedEngineType}
        onFormatChange={setSelectedFormat}
        onModeChange={setSelectedMode}
        onPriceChange={setSelectedPrice}
        onSearchChange={setSearchQuery}
        onSortChange={setSelectedSort}
      />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
        {sortedCards.slice(0, visibleCount).map((card) => (
          <ModelCard
            key={card.id}
            card={card}
            ctaLabel={ctaLabel}
            cardActions={resolvedCopy.cardActions}
            compareMode={compareMode}
            compareLabel={resolvedCopy.compareLabel}
            compareTooltip={resolvedCopy.compareTooltip}
            compareAria={resolvedCopy.compareAria}
            strengthsLabel={resolvedCopy.strengthsLabel}
            statsLabels={resolvedCopy.statsLabels}
            capabilityTooltips={resolvedCopy.capabilityTooltips}
            audioAvailableLabel={resolvedCopy.audioAvailableLabel}
            compareEnabled={allowCompare}
            selected={selectedIds.includes(card.id)}
            onToggle={() => handleToggleCard(card.id)}
            onActivateCompare={enableCompareMode}
          />
        ))}
      </div>
      {!sortedCards.length ? (
        <div className="mt-8 rounded-[18px] border border-dashed border-hairline bg-surface/80 px-5 py-8 text-center text-sm font-medium text-text-secondary">
          {resolvedCopy.filterClearLabel}
        </div>
      ) : null}
      {visibleCount < sortedCards.length ? (
        <div ref={observerRef} className="h-4 w-full" aria-hidden />
      ) : null}

      {allowCompare && compareMode ? (
        <ModelsGalleryCompareBar
          compareBar={resolvedCopy.compareBar}
          compareHref={compareHref}
          selectedCards={selectedCards}
          onClear={handleClear}
        />
      ) : null}
    </>
  );
}
