'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { usePathname, useSearchParams, useRouter as useNextRouter } from 'next/navigation';
import type { LocalizedLinkHref } from '@/i18n/navigation';

export type ModelGalleryCard = {
  id: string;
  label: string;
  description: string;
  versionLabel?: string;
  priceNote?: string | null;
  priceNoteHref?: string | null;
  href: LocalizedLinkHref;
  backgroundColor?: string | null;
  textColor?: string | null;
  strengths?: string | null;
  capabilities?: string[];
  snapshot?: {
    priceFrom?: string | null;
    maxDuration?: string | null;
    maxResolution?: string | null;
    audio?: string | null;
  };
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
const FILTER_GROUPS = {
  modes: [
    { id: 't2v', label: 'T2V' },
    { id: 'i2v', label: 'I2V' },
    { id: 'v2v', label: 'V2V' },
    { id: 'firstLast', label: 'First/Last' },
    { id: 'extend', label: 'Extend' },
    { id: 'lipSync', label: 'Lip sync' },
  ],
  audio: [{ id: 'audio', label: 'Audio' }],
  resolution: [
    { id: '720', label: '720p+' },
    { id: '1080', label: '1080p+' },
    { id: '2160', label: '4K' },
  ],
  duration: [
    { id: '8', label: '≤8s' },
    { id: '10-15', label: '10–15s' },
    { id: '20', label: '20s+' },
  ],
  price: [
    { id: 'cheap', label: '$' },
    { id: 'mid', label: '$$' },
    { id: 'premium', label: '$$$' },
  ],
} as const;

function normalizeCtaLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed.length) {
    return `Explore model ${CTA_ARROW}`;
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
  const [modeFilters, setModeFilters] = useState<Set<string>>(new Set());
  const [audioFilters, setAudioFilters] = useState<Set<string>>(new Set());
  const [resolutionFilters, setResolutionFilters] = useState<Set<string>>(new Set());
  const [durationFilters, setDurationFilters] = useState<Set<string>>(new Set());
  const [priceFilters, setPriceFilters] = useState<Set<string>>(new Set());

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

  const toggleCompareMode = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (compareMode) {
      params.delete('compare');
    } else {
      params.set('compare', '1');
    }
    const query = params.toString();
    const target = query ? `${pathname}?${query}` : pathname;
    nextRouter.push(target, { scroll: false });
    setCompareMode(!compareMode);
  };

  const toggleFilterValue = (value: string, setState: Dispatch<SetStateAction<Set<string>>>) => {
    setState((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setModeFilters(new Set());
    setAudioFilters(new Set());
    setResolutionFilters(new Set());
    setDurationFilters(new Set());
    setPriceFilters(new Set());
  };

  const hasActiveFilters =
    modeFilters.size ||
    audioFilters.size ||
    resolutionFilters.size ||
    durationFilters.size ||
    priceFilters.size;

  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      const meta = card.filterMeta;
      if (!meta) return !hasActiveFilters;
      if (modeFilters.size) {
        for (const mode of modeFilters) {
          if (!meta[mode as keyof typeof meta]) return false;
        }
      }
      if (audioFilters.size) {
        if (!meta.audio) return false;
      }
      if (resolutionFilters.size) {
        if (!meta.maxResolution) return false;
        const passes = Array.from(resolutionFilters).some((value) => {
          const threshold = Number(value);
          return meta.maxResolution != null && meta.maxResolution >= threshold;
        });
        if (!passes) return false;
      }
      if (durationFilters.size) {
        if (!meta.maxDuration) return false;
        const passes = Array.from(durationFilters).some((value) => {
          if (value === '8') return meta.maxDuration <= 8;
          if (value === '10-15') return meta.maxDuration >= 10 && meta.maxDuration <= 15;
          if (value === '20') return meta.maxDuration >= 20;
          return false;
        });
        if (!passes) return false;
      }
      if (priceFilters.size) {
        if (meta.priceFrom == null) return false;
        const passes = Array.from(priceFilters).some((value) => {
          if (value === 'cheap') return meta.priceFrom <= 0.08;
          if (value === 'mid') return meta.priceFrom > 0.08 && meta.priceFrom <= 0.2;
          if (value === 'premium') return meta.priceFrom > 0.2;
          return false;
        });
        if (!passes) return false;
      }
      return true;
    });
  }, [cards, durationFilters, modeFilters, audioFilters, resolutionFilters, priceFilters, hasActiveFilters]);

  useEffect(() => {
    if (visibleCount >= filteredCards.length) return undefined;
    const node = observerRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          appendCards(filteredCards.length);
        }
      },
      { rootMargin: '300px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [appendCards, filteredCards.length, visibleCount]);

  useEffect(() => {
    setVisibleCount(Math.min(INITIAL_COUNT, filteredCards.length));
  }, [filteredCards.length]);

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
          <button
            type="button"
            onClick={toggleCompareMode}
            className={`
              inline-flex items-center gap-2 rounded-full border px-4 py-1 text-xs font-semibold uppercase tracking-micro transition
              ${compareMode ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600' : 'border-hairline bg-surface text-text-primary'}
            `}
          >
            Compare mode
          </button>
          <span className="text-xs text-text-muted">
            Select two engines to open a side-by-side comparison.
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

      <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-micro text-text-secondary">
        {FILTER_GROUPS.modes.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => toggleFilterValue(filter.id, setModeFilters)}
            className={`rounded-pill border px-3 py-1 transition ${
              modeFilters.has(filter.id)
                ? 'border-text-primary bg-text-primary text-bg'
                : 'border-hairline bg-surface text-text-secondary hover:border-text-muted'
            }`}
          >
            {filter.label}
          </button>
        ))}
        {FILTER_GROUPS.audio.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => toggleFilterValue(filter.id, setAudioFilters)}
            className={`rounded-pill border px-3 py-1 transition ${
              audioFilters.has(filter.id)
                ? 'border-text-primary bg-text-primary text-bg'
                : 'border-hairline bg-surface text-text-secondary hover:border-text-muted'
            }`}
          >
            {filter.label}
          </button>
        ))}
        {FILTER_GROUPS.resolution.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => toggleFilterValue(filter.id, setResolutionFilters)}
            className={`rounded-pill border px-3 py-1 transition ${
              resolutionFilters.has(filter.id)
                ? 'border-text-primary bg-text-primary text-bg'
                : 'border-hairline bg-surface text-text-secondary hover:border-text-muted'
            }`}
          >
            {filter.label}
          </button>
        ))}
        {FILTER_GROUPS.duration.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => toggleFilterValue(filter.id, setDurationFilters)}
            className={`rounded-pill border px-3 py-1 transition ${
              durationFilters.has(filter.id)
                ? 'border-text-primary bg-text-primary text-bg'
                : 'border-hairline bg-surface text-text-secondary hover:border-text-muted'
            }`}
          >
            {filter.label}
          </button>
        ))}
        {FILTER_GROUPS.price.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => toggleFilterValue(filter.id, setPriceFilters)}
            className={`rounded-pill border px-3 py-1 transition ${
              priceFilters.has(filter.id)
                ? 'border-text-primary bg-text-primary text-bg'
                : 'border-hairline bg-surface text-text-secondary hover:border-text-muted'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="mt-8 grid grid-gap sm:grid-cols-2 xl:grid-cols-3">
        {filteredCards.slice(0, visibleCount).map((card) => (
          <ModelCard
            key={card.id}
            card={card}
            ctaLabel={ctaLabel}
            compareMode={compareMode}
            selected={selectedIds.includes(card.id)}
            onToggle={() => handleToggleCard(card.id)}
          />
        ))}
      </div>
      {visibleCount < filteredCards.length ? (
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
}: {
  card: ModelGalleryCard;
  ctaLabel: string;
  compareMode: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  type RouterPushInput = Parameters<typeof router.push>[0];
  const background = card.backgroundColor ?? 'var(--surface-2)';
  const textColor = card.textColor ?? 'var(--text-primary)';
  const normalizedCtaLabel = normalizeCtaLabel(ctaLabel);
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
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-micro text-text-secondary">
        <span>{card.versionLabel}</span>
        <div className="flex items-center gap-2">
          {compareMode && !card.compareDisabled ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggle();
              }}
              className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] transition ${
                selected
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : 'border-surface-on-media-dark-10 bg-bg text-text-secondary'
              }`}
              aria-pressed={selected}
              aria-label={`Select ${card.label}`}
            >
              {selected ? '✓' : ''}
            </button>
          ) : null}
          <span className="rounded-full border border-surface-on-media-dark-10 px-2 py-1 text-[10px] font-semibold text-text-secondary">
            MaxVideoAI
          </span>
        </div>
      </div>
      <div className="mt-3">
        <h3 className="text-lg font-semibold leading-snug text-text-primary sm:text-xl">{card.label}</h3>
        <p className="mt-1 text-sm text-text-secondary">{card.description}</p>
        {card.snapshot ? (
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-text-secondary">
            {card.snapshot.priceFrom ? <span>From {card.snapshot.priceFrom}</span> : null}
            {card.snapshot.maxDuration ? <span>{card.snapshot.maxDuration} max</span> : null}
            {card.snapshot.maxResolution ? <span>{card.snapshot.maxResolution}</span> : null}
            {card.snapshot.audio ? <span>Audio {card.snapshot.audio}</span> : null}
          </div>
        ) : null}
        {card.capabilities?.length ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {card.capabilities.map((cap) => (
              <span
                key={cap}
                className="rounded-pill border border-surface-on-media-dark-10 bg-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-micro text-text-secondary"
              >
                {cap}
              </span>
            ))}
          </div>
        ) : null}
        {card.strengths ? (
          <p className="mt-2 text-xs text-text-secondary">Strengths: {card.strengths}</p>
        ) : null}
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
