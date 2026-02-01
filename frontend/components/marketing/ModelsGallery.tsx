'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { usePathname, useSearchParams, useRouter as useNextRouter } from 'next/navigation';
import type { LocalizedLinkHref } from '@/i18n/navigation';
import { SelectMenu, type SelectOption } from '@/components/ui/SelectMenu';
import { AudioEqualizerBadge } from '@/components/ui/AudioEqualizerBadge';

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
  };
};

const INITIAL_COUNT = 6;
const LOAD_COUNT = 6;
const CTA_ARROW = '→';
const MODE_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'Mode: All' },
  { value: 't2v', label: 'Mode: T2V' },
  { value: 'i2v', label: 'Mode: I2V' },
  { value: 'v2v', label: 'Mode: V2V' },
  { value: 'firstLast', label: 'Mode: First/Last' },
  { value: 'extend', label: 'Mode: Extend' },
  { value: 'lipSync', label: 'Mode: Lip sync' },
  { value: 'audio', label: 'Mode: Audio' },
];

const FORMAT_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'Format: All' },
  { value: '720', label: 'Format: 720p+' },
  { value: '1080', label: 'Format: 1080p+' },
  { value: '2160', label: 'Format: 4K' },
];

const DURATION_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'Duration: All' },
  { value: '8', label: 'Duration: ≤8s' },
  { value: '10-15', label: 'Duration: 10–15s' },
  { value: '20', label: 'Duration: 20s+' },
];

const PRICE_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'Price: All' },
  { value: 'cheap', label: 'Price: $' },
  { value: 'mid', label: 'Price: $$' },
  { value: 'premium', label: 'Price: $$$' },
];

const SORT_OPTIONS: SelectOption[] = [
  { value: 'featured', label: 'Sort: Featured' },
  { value: 'score', label: 'Sort: Score' },
  { value: 'price', label: 'Sort: Price' },
  { value: 'duration', label: 'Sort: Duration' },
  { value: 'resolution', label: 'Sort: Resolution' },
  { value: 'name', label: 'Sort: Name' },
];

const CAPABILITY_TOOLTIPS: Record<string, string> = {
  T2V: 'Text-to-video',
  I2V: 'Image-to-video',
  V2V: 'Video-to-video',
  'First/Last': 'First frame / last frame',
  Extend: 'Extend / continue',
};

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
}: {
  cards: ModelGalleryCard[];
  ctaLabel: string;
}) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);
  const observerRef = useRef<HTMLDivElement | null>(null);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const nextRouter = useNextRouter();
  const [compareMode, setCompareMode] = useState(searchParams.get('compare') === '1');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedMode, setSelectedMode] = useState('all');
  const [selectedFormat, setSelectedFormat] = useState('all');
  const [selectedDuration, setSelectedDuration] = useState('all');
  const [selectedPrice, setSelectedPrice] = useState('all');
  const [selectedSort, setSelectedSort] = useState('featured');

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
    setCompareMode(searchParams.get('compare') === '1');
  }, [searchParams]);

  const cardById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const selectedCards = selectedIds.map((id) => cardById.get(id)).filter(Boolean);

  const enableCompareMode = useCallback(() => {
    if (compareMode) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('compare', '1');
    const query = params.toString();
    const target = query ? `${pathname}?${query}` : pathname;
    nextRouter.push(target, { scroll: false });
    setCompareMode(true);
  }, [compareMode, nextRouter, pathname, searchParams]);

  const clearFilters = () => {
    setSelectedMode('all');
    setSelectedFormat('all');
    setSelectedDuration('all');
    setSelectedPrice('all');
  };

  const hasActiveFilters =
    selectedMode !== 'all' ||
    selectedFormat !== 'all' ||
    selectedDuration !== 'all' ||
    selectedPrice !== 'all';

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
      return true;
    });
  }, [cards, hasActiveFilters, selectedMode, selectedFormat, selectedDuration, selectedPrice]);

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

  const handleSwap = () => {
    setSelectedIds((current) => (current.length === 2 ? [current[1], current[0]] : current));
  };

  const handleClear = () => setSelectedIds([]);

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
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface/80 px-4 py-3 text-sm text-text-secondary shadow-card">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-micro text-text-muted" id="models-compare-toggle">
            Filters
          </span>
        </div>
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs font-semibold text-text-secondary underline decoration-transparent underline-offset-4 transition hover:text-text-primary hover:decoration-current"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <SelectMenu
          options={SORT_OPTIONS}
          value={selectedSort}
          onChange={(value) => setSelectedSort(String(value))}
          buttonClassName="rounded-full border-hairline bg-surface-glass-80 px-3 py-1 text-xs font-medium text-text-secondary hover:border-text-muted hover:bg-surface-2 hover:text-text-primary"
        />
        <SelectMenu
          options={MODE_OPTIONS}
          value={selectedMode}
          onChange={(value) => setSelectedMode(String(value))}
          buttonClassName="rounded-full border-hairline bg-surface-glass-80 px-3 py-1 text-xs font-medium text-text-secondary hover:border-text-muted hover:bg-surface-2 hover:text-text-primary"
        />
        <SelectMenu
          options={FORMAT_OPTIONS}
          value={selectedFormat}
          onChange={(value) => setSelectedFormat(String(value))}
          buttonClassName="rounded-full border-hairline bg-surface-glass-80 px-3 py-1 text-xs font-medium text-text-secondary hover:border-text-muted hover:bg-surface-2 hover:text-text-primary"
        />
        <SelectMenu
          options={DURATION_OPTIONS}
          value={selectedDuration}
          onChange={(value) => setSelectedDuration(String(value))}
          buttonClassName="rounded-full border-hairline bg-surface-glass-80 px-3 py-1 text-xs font-medium text-text-secondary hover:border-text-muted hover:bg-surface-2 hover:text-text-primary"
        />
        <SelectMenu
          options={PRICE_OPTIONS}
          value={selectedPrice}
          onChange={(value) => setSelectedPrice(String(value))}
          buttonClassName="rounded-full border-hairline bg-surface-glass-80 px-3 py-1 text-xs font-medium text-text-secondary hover:border-text-muted hover:bg-surface-2 hover:text-text-primary"
        />
      </div>

      <div className="mt-8 grid grid-gap sm:grid-cols-2 xl:grid-cols-3">
        {sortedCards.slice(0, visibleCount).map((card) => (
          <ModelCard
            key={card.id}
            card={card}
            ctaLabel={ctaLabel}
            compareMode={compareMode}
            selected={selectedIds.includes(card.id)}
            onToggle={() => handleToggleCard(card.id)}
            onActivateCompare={enableCompareMode}
          />
        ))}
      </div>
      {visibleCount < sortedCards.length ? (
        <div ref={observerRef} className="h-4 w-full" aria-hidden />
      ) : null}

      {compareMode ? (
        <div className="fixed inset-x-4 bottom-6 z-40 mx-auto max-w-4xl rounded-2xl border border-hairline bg-surface/95 px-4 py-3 shadow-2xl backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="font-semibold text-text-primary">
              {selectedCards.length === 2
                ? `Selected: ${selectedCards[0]?.label} + ${selectedCards[1]?.label}`
                : 'Select two engines to compare'}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSwap}
                className="rounded-full border border-hairline px-3 py-1 text-xs font-semibold text-text-secondary transition hover:border-text-muted hover:text-text-primary"
                disabled={selectedCards.length !== 2}
              >
                Swap
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="rounded-full border border-hairline px-3 py-1 text-xs font-semibold text-text-secondary transition hover:border-text-muted hover:text-text-primary"
                disabled={selectedCards.length === 0}
              >
                Clear
              </button>
              {compareHref ? (
                <Link
                  href={compareHref}
                  prefetch={false}
                  className="rounded-full bg-text-primary px-4 py-1 text-xs font-semibold text-bg transition hover:opacity-90"
                >
                  Compare
                </Link>
              ) : (
                <span className="rounded-full border border-hairline px-4 py-1 text-xs font-semibold text-text-muted">
                  Compare
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
  selected,
  onToggle,
  onActivateCompare,
}: {
  card: ModelGalleryCard;
  ctaLabel: string;
  compareMode: boolean;
  selected: boolean;
  onToggle: () => void;
  onActivateCompare: () => void;
}) {
  const router = useRouter();
  type RouterPushInput = Parameters<typeof router.push>[0];
  const background = card.backgroundColor ?? 'var(--surface-2)';
  const textColor = card.textColor ?? 'var(--text-primary)';
  const normalizedCtaLabel = normalizeCtaLabel(ctaLabel);
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
      className={`flex min-h-[11rem] cursor-pointer flex-col justify-between rounded-2xl border border-surface-on-media-dark-5 p-4 text-text-primary shadow-lg transition hover:border-surface-on-media-dark-10 hover:shadow-xl ${
        selected ? 'ring-2 ring-emerald-500/40' : ''
      }`}
      style={{ backgroundColor: background, color: textColor }}
      aria-label={`${normalizedCtaLabel} ${card.label}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-surface-2 text-sm font-semibold text-text-primary">
            {typeof card.overallScore === 'number' ? card.overallScore.toFixed(1) : '—'}
          </div>
          <h3 className="text-lg font-semibold leading-snug text-text-primary sm:text-xl">{card.label}</h3>
          {card.provider ? (
            <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">· {card.provider}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <label
            className={`mt-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-micro ${
              card.compareDisabled ? 'cursor-not-allowed text-text-muted/60' : 'text-text-muted'
            }`}
            title={card.compareDisabled ? 'Compare not available for this engine' : 'Select to compare'}
            onClick={(event) => event.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={selected}
              onChange={handleCompareToggle}
              onClick={(event) => event.stopPropagation()}
              disabled={card.compareDisabled}
              className="h-4 w-4 rounded border border-surface-on-media-dark-10 text-emerald-600 accent-emerald-500"
              aria-label={`Select ${card.label} to compare`}
            />
            Compare
          </label>
        </div>
      </div>

      <div className="mt-3">
        {card.strengths?.length ? (
          <p className="mt-1 text-xs text-text-secondary">
            Strengths: {card.strengths.join(', ')}
          </p>
        ) : null}
        {card.stats ? (
          <dl className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-text-secondary sm:grid-cols-3">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-micro text-text-muted">From</dt>
              <dd className="font-semibold text-text-primary">{card.stats.priceFrom ?? '—'}</dd>
            </div>
            <div>
              <dt
                className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-micro text-text-muted"
                aria-label="Max duration"
              >
                Max dur.
              </dt>
              <dd className="font-semibold text-text-primary">{card.stats.maxDuration ?? '—'}</dd>
            </div>
            <div>
              <dt
                className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-micro text-text-muted"
                aria-label="Max resolution"
              >
                Max res.
              </dt>
              <dd className="font-semibold text-text-primary">{card.stats.maxResolution ?? '—'}</dd>
            </div>
          </dl>
        ) : null}
        {card.capabilities?.length || card.audioAvailable ? (
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {card.capabilities?.map((cap) => {
              const tooltip = CAPABILITY_TOOLTIPS[cap] ?? cap;
              return (
                <span key={cap} className="relative group">
                  <span
                    aria-label={tooltip}
                    className="rounded-pill border border-surface-on-media-dark-10 bg-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-micro text-text-secondary"
                  >
                    {cap}
                  </span>
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 -translate-x-1/2 whitespace-nowrap rounded-full border border-hairline bg-surface px-2 py-1 text-[10px] font-medium text-text-secondary opacity-0 shadow-card transition-opacity duration-150 group-hover:opacity-100"
                  >
                    {tooltip}
                  </span>
                </span>
              );
            })}
            {card.audioAvailable ? (
              <AudioEqualizerBadge
                inline
                tone="muted"
                size="sm"
                className="ml-1"
                label="Audio available"
              />
            ) : null}
          </div>
        ) : null}
        <p className="mt-2 text-xs text-text-secondary">{card.description}</p>
        {card.priceNote ? (
          card.priceNoteHref ? (
            <Link
              href={card.priceNoteHref}
              prefetch={false}
              className="mt-2 inline-flex text-xs font-semibold text-text-secondary hover:text-text-primary"
              onClick={(event) => event.stopPropagation()}
            >
              {card.priceNote}
            </Link>
          ) : (
            <span className="mt-2 inline-flex text-xs font-semibold text-text-secondary">{card.priceNote}</span>
          )
        ) : null}
      </div>
      <Link
        href={card.href}
        prefetch={false}
        className="mt-3 inline-flex items-center rounded-full px-2 py-1 text-sm font-semibold text-text-primary/80 underline decoration-transparent underline-offset-4 transition hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        aria-label={`Explore ${card.label}`}
        onClick={(event) => event.stopPropagation()}
      >
        {normalizedCtaLabel}
      </Link>
    </article>
  );
}
