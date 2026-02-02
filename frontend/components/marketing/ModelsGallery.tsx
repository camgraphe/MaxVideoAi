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

  useEffect(() => {
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
  }, []);

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

  const disableCompareMode = useCallback(() => {
    if (!compareMode) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete('compare');
    const query = params.toString();
    const target = query ? `${pathname}?${query}` : pathname;
    nextRouter.push(target, { scroll: false });
    setCompareMode(false);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('models-compare-mode', { detail: { enabled: false } }));
    }
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
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-full border border-hairline px-3 py-1 text-xs font-semibold text-text-secondary transition hover:border-text-muted hover:text-text-primary"
          >
            Clear filters
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
        <div className="fixed inset-x-4 bottom-6 z-40 mx-auto max-w-4xl rounded-2xl border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,255,255,0.78))] px-4 py-3 shadow-[0_18px_40px_rgba(15,23,42,0.22),0_6px_16px_rgba(15,23,42,0.16)] backdrop-blur dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,0.9))]">
          <span className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-[linear-gradient(180deg,rgba(255,255,255,0.7),transparent)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent)]" />
          <div className="relative flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="font-semibold text-text-primary">
              {selectedCards.length === 2
                ? `Selected: ${selectedCards[0]?.label} + ${selectedCards[1]?.label}`
                : 'Select two engines to compare'}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleClear}
                className="rounded-full border border-hairline px-3 py-1 text-xs font-semibold text-text-secondary transition hover:border-text-muted hover:text-text-primary"
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
  const gradientBackground = `linear-gradient(140deg, color-mix(in srgb, ${background} 96%, white 4%) 0%, color-mix(in srgb, ${background} 78%, white 22%) 48%, color-mix(in srgb, ${background} 55%, white 45%) 100%)`;
  const gradientBackgroundDark = `linear-gradient(140deg, color-mix(in srgb, ${background} 62%, #000 38%) 0%, color-mix(in srgb, ${background} 42%, #000 58%) 55%, #0b0f17 100%)`;
  const accentGlow = `radial-gradient(120% 90% at 10% 0%, color-mix(in srgb, ${background} 72%, white 28%) 0%, transparent 62%)`;
  const accentGlowDark = `radial-gradient(120% 90% at 10% 0%, color-mix(in srgb, ${background} 48%, #000 52%) 0%, transparent 60%)`;
  const separatorLine = `linear-gradient(90deg, transparent, color-mix(in srgb, ${background} 45%, white 55%), transparent)`;
  const separatorLineDark = `linear-gradient(90deg, transparent, color-mix(in srgb, ${background} 48%, #000 52%), transparent)`;
  const separatorGlow = `radial-gradient(circle at center, color-mix(in srgb, ${background} 38%, white 62%), transparent 70%)`;
  const separatorGlowDark = `radial-gradient(circle at center, rgba(0,0,0,0.7), transparent 70%)`;
  const cardSolid = `color-mix(in srgb, ${background} 96%, white 4%)`;
  const cardSolidDark = `color-mix(in srgb, ${background} 52%, #000 48%)`;
  const cardBg = `${accentGlow}, ${gradientBackground}`;
  const cardBgDark = `${accentGlowDark}, ${gradientBackgroundDark}`;
  const normalizedCtaLabel = normalizeCtaLabel(ctaLabel);
  const hideCompare = card.label.length > 14;
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
      className={`group relative isolate flex min-h-[11.5rem] cursor-pointer flex-col justify-between overflow-hidden rounded-[22px] border border-white/20 bg-[color:var(--card-solid)] bg-[image:var(--card-bg)] p-5 text-text-primary shadow-[0_12px_30px_rgba(15,23,42,0.12),0_2px_8px_rgba(15,23,42,0.08)] transition hover:shadow-[0_16px_40px_rgba(15,23,42,0.16),0_4px_12px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-[color:var(--card-solid-dark)] dark:bg-[image:var(--card-bg-dark)] ${
        selected ? 'ring-2 ring-emerald-500/40' : ''
      }`}
      style={
        {
          color: textColor,
          '--card-bg': cardBg,
          '--card-bg-dark': cardBgDark,
          '--card-sep-line': separatorLine,
          '--card-sep-line-dark': separatorLineDark,
          '--card-sep-glow': separatorGlow,
          '--card-sep-glow-dark': separatorGlowDark,
          '--card-solid': cardSolid,
          '--card-solid-dark': cardSolidDark,
        } as React.CSSProperties
      }
      aria-label={`${normalizedCtaLabel} ${card.label}`}
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.55),transparent_70%)] dark:bg-[radial-gradient(circle_at_top,rgba(0,0,0,0.95),transparent_70%)]" />
      <span className="pointer-events-none absolute inset-x-0 top-[84px] h-[1px] bg-white/40 dark:bg-white/15" />
      <span className="pointer-events-none absolute inset-x-0 bottom-16 h-10 bg-[radial-gradient(circle_at_bottom,rgba(255,255,255,0.2),transparent_70%)] dark:bg-[radial-gradient(circle_at_bottom,rgba(0,0,0,0.75),transparent_70%)]" />
      <div className="relative z-10 flex flex-wrap items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/40 bg-white/70 text-[17px] font-semibold text-text-primary shadow-sm dark:border-white/15 dark:bg-black/80 dark:text-white/90">
          {typeof card.overallScore === 'number' ? card.overallScore.toFixed(1) : '—'}
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
          <h3
            className={`truncate text-[18px] font-semibold leading-tight text-text-primary dark:text-white/90 sm:text-[20px] ${
              hideCompare ? 'pr-10' : ''
            }`}
          >
            {card.label}
          </h3>
          {card.provider ? (
            <span className="rounded-full border border-white/35 bg-white/70 px-1.5 py-[2px] text-[8px] font-semibold uppercase tracking-micro text-text-secondary dark:border-white/15 dark:bg-black/80 dark:text-white/70">
              {card.provider}
            </span>
          ) : null}
        </div>
        {!card.compareDisabled ? (
          <label
            className={`ml-auto flex items-center gap-2 px-0 py-0 text-[10px] font-semibold uppercase tracking-micro transition ${
              selected ? 'text-emerald-600 dark:text-emerald-400' : 'text-text-secondary dark:text-white/75'
            }`}
            title="Select to compare"
            onClick={(event) => event.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={selected}
              onChange={handleCompareToggle}
              onClick={(event) => event.stopPropagation()}
              className="h-4 w-4 rounded border border-text-muted/60 bg-transparent text-emerald-600 accent-emerald-500 dark:border-white/40"
              aria-label={`Select ${card.label} to compare`}
            />
            {!hideCompare ? <span>Compare</span> : null}
          </label>
        ) : null}
      </div>

      <div className="relative z-10 mt-3 pt-4">
        <span className="pointer-events-none absolute inset-x-4 top-0 h-[2px] bg-[image:var(--card-sep-line)] opacity-75 dark:bg-[image:var(--card-sep-line-dark)] dark:opacity-40" />
        <span className="pointer-events-none absolute inset-x-10 top-0 h-8 bg-[image:var(--card-sep-glow)] opacity-35 dark:bg-[image:var(--card-sep-glow-dark)] dark:opacity-20" />
        {card.strengths?.length ? (
          <p className="mt-1 flex items-center gap-2 text-xs text-text-secondary dark:text-white/75">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/75 text-[11px] text-text-primary dark:bg-black/80 dark:text-white/90">
              ★
            </span>
            <span>Strengths: {card.strengths.join(', ')}</span>
          </p>
        ) : null}
        {card.stats ? (
          <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-text-secondary sm:grid-cols-3">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-micro text-text-muted dark:text-white/85">From</dt>
              <dd className="text-[16px] font-semibold text-text-primary dark:text-white/95">{card.stats.priceFrom ?? '—'}</dd>
            </div>
            <div>
              <dt
                className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-micro text-text-muted dark:text-white/85"
                aria-label="Max duration"
              >
                Max dur.
              </dt>
              <dd className="text-[16px] font-semibold text-text-primary dark:text-white/95">{card.stats.maxDuration ?? '—'}</dd>
            </div>
            <div>
              <dt
                className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-micro text-text-muted dark:text-white/85"
                aria-label="Max resolution"
              >
                Max res.
              </dt>
              <dd className="text-[16px] font-semibold text-text-primary dark:text-white/95">{card.stats.maxResolution ?? '—'}</dd>
            </div>
          </dl>
        ) : null}
        {card.capabilities?.length || card.audioAvailable ? (
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {card.capabilities?.map((cap) => {
              const tooltip = CAPABILITY_TOOLTIPS[cap] ?? cap;
              return (
                <span key={cap} className="group/chip relative">
                  <span
                    aria-label={tooltip}
                    className="rounded-pill border border-surface-on-media-dark-10 bg-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-micro text-text-secondary dark:border-white/15 dark:bg-black/80 dark:text-white/90"
                  >
                    {cap}
                  </span>
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 -translate-x-1/2 whitespace-nowrap rounded-full border border-hairline bg-surface px-2 py-1 text-[10px] font-medium text-text-secondary opacity-0 shadow-card transition-opacity duration-150 group-hover/chip:opacity-100 dark:bg-surface-2 dark:text-white/65"
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
                className="ml-1 dark:!text-white/90"
                label="Audio available"
              />
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="relative z-10 mt-3 pt-4">
        <span className="pointer-events-none absolute inset-x-4 top-0 h-[2px] bg-[image:var(--card-sep-line)] opacity-70 dark:bg-[image:var(--card-sep-line-dark)] dark:opacity-35" />
        <span className="pointer-events-none absolute inset-x-10 top-0 h-8 bg-[image:var(--card-sep-glow)] opacity-30 dark:bg-[image:var(--card-sep-glow-dark)] dark:opacity-20" />
        <p className="text-[14px] text-text-primary/80 line-clamp-2 dark:text-white/75">{card.description}</p>
        {card.priceNote ? (
          card.priceNoteHref ? (
            <Link
              href={card.priceNoteHref}
              prefetch={false}
              className="mt-2 inline-flex text-xs font-semibold text-text-secondary hover:text-text-primary dark:text-white/65 dark:hover:text-white/80"
              onClick={(event) => event.stopPropagation()}
            >
              {card.priceNote}
            </Link>
          ) : (
            <span className="mt-2 inline-flex text-xs font-semibold text-text-secondary dark:text-white/65">
              {card.priceNote}
            </span>
          )
        ) : null}
        <div className="mt-3 flex items-center justify-end">
          <Link
            href={card.href}
            prefetch={false}
            className="inline-flex items-center gap-2 rounded-full border border-text-primary/40 bg-transparent px-4 py-2 text-xs font-semibold uppercase tracking-micro text-text-primary shadow-sm transition hover:border-text-primary/60 hover:text-text-primary dark:border-white/25 dark:bg-black/30 dark:text-white/80 dark:hover:border-white/40 dark:hover:bg-black/40"
            aria-label={`Explore ${card.label}`}
            onClick={(event) => event.stopPropagation()}
          >
            {normalizedCtaLabel.replace(/\s*→\s*$/, '')}
            <span className="sr-only"> — {card.label}</span>
            <span className="transition-transform duration-150 group-hover:translate-x-0.5">→</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
