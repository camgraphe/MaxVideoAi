'use client';

import clsx from 'clsx';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EngineIcon } from '@/components/ui/EngineIcon';
import type { FalEngineEntry } from '@/config/falEngines';
import type { Mode } from '@/types/engines';
import { DEFAULT_ENGINE_GUIDE } from '@/lib/engine-guides';
import { getExamplesHref } from '@/lib/examples-links';

type CompareCopy = {
  title?: string;
  subtitle?: string;
  ariaPrev?: string;
  ariaNext?: string;
  viewModel?: string;
  viewExamples?: string;
};

type CompareEngineMeta = {
  maxDuration: string;
  audio: string;
  bestFor: string;
};

export type CompareEngineEntry = {
  engine: FalEngineEntry;
  meta?: CompareEngineMeta | null;
};

type CompareEnginesCarouselProps = {
  engines: CompareEngineEntry[];
  copy?: CompareCopy | null;
};

const MODE_LABELS: Record<Mode, string> = {
  t2v: 'Text -> Video',
  i2v: 'Image -> Video',
  r2v: 'Reference -> Video',
  t2i: 'Text -> Image',
  i2i: 'Image -> Image',
};

const ENGINE_MODE_LABEL_OVERRIDES: Record<string, Partial<Record<Mode, string>>> = {
  'veo-3-1-first-last': {
    i2v: 'Standard',
    i2i: 'Fast',
  },
  'kling-2-5-turbo': {
    t2v: 'Pro · Text',
    i2v: 'Pro · Image',
    i2i: 'Standard · Image',
  },
  'wan-2-5': {
    t2v: 'Text · Audio-ready',
    i2v: 'Image · Audio-ready',
  },
  'wan-2-6': {
    t2v: 'Text · Multi-shot',
    i2v: 'Image · Animate',
    r2v: 'Reference · Consistency',
  },
};

function getModeLabel(engineId: string | undefined, value: Mode): string {
  const override = engineId ? ENGINE_MODE_LABEL_OVERRIDES[engineId]?.[value] : undefined;
  return override ?? MODE_LABELS[value] ?? value.toUpperCase();
}

function getModeDisplayOrder(engineId: string | undefined, modes: Mode[]): Mode[] {
  if (engineId === 'veo-3-1-first-last') {
    const order: Mode[] = ['i2i', 'i2v'];
    return order.filter((mode) => modes.includes(mode));
  }
  return modes;
}

function formatAvgDuration(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  const seconds = value / 1000;
  const precision = seconds < 10 ? 1 : 0;
  return `${seconds.toFixed(precision)}s`;
}

export function CompareEnginesCarousel({ engines, copy }: CompareEnginesCarouselProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragPointerId = useRef<number | null>(null);
  const [thumbWidth, setThumbWidth] = useState(32);
  const [thumbOffset, setThumbOffset] = useState(0);
  const [showScrollbar, setShowScrollbar] = useState(false);
  const title = copy?.title ?? 'Compare engines at a glance';
  const subtitle = copy?.subtitle ?? 'Max duration · Audio · Best for';
  const ariaPrev = copy?.ariaPrev ?? 'Scroll to previous engine card';
  const ariaNext = copy?.ariaNext ?? 'Scroll to next engine card';
  const viewModelLabel = copy?.viewModel ?? 'View model page';
  const viewExamplesLabel = copy?.viewExamples ?? 'View examples';

  const scrollByCard = (direction: number) => {
    const el = containerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('[data-card]');
    const width = card ? card.offsetWidth + 16 : 320;
    const target = el.scrollLeft + direction * width;
    el.scrollTo({ left: target, behavior: 'smooth' });
  };

  const updateScrollbar = useCallback(() => {
    const track = trackRef.current;
    const container = containerRef.current;
    if (!track || !container) return;
    const trackWidth = track.clientWidth;
    const { scrollWidth, clientWidth, scrollLeft } = container;
    const scrollable = scrollWidth - clientWidth;
    if (scrollable <= 1 || trackWidth <= 0) {
      setShowScrollbar(false);
      setThumbWidth(trackWidth);
      setThumbOffset(0);
      return;
    }
    const minThumb = 24;
    const maxThumb = 96;
    const baseWidth = trackWidth * (clientWidth / scrollWidth);
    const width = Math.max(minThumb, Math.min(maxThumb, baseWidth));
    const maxOffset = Math.max(0, trackWidth - width);
    const offset = (scrollLeft / scrollable) * maxOffset;
    setShowScrollbar(true);
    setThumbWidth(width);
    setThumbOffset(offset);
  }, []);

  useEffect(() => {
    updateScrollbar();
    const container = containerRef.current;
    if (!container) return;
    const handleScroll = () => updateScrollbar();
    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', updateScrollbar);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updateScrollbar);
    };
  }, [updateScrollbar, engines.length]);

  const updateScrollFromPointer = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      const container = containerRef.current;
      if (!track || !container) return;
      const rect = track.getBoundingClientRect();
      const trackWidth = track.clientWidth;
      const scrollable = container.scrollWidth - container.clientWidth;
      if (scrollable <= 0 || trackWidth <= 0) return;
      const maxOffset = Math.max(0, trackWidth - thumbWidth);
      const offset = Math.min(Math.max(clientX - rect.left - thumbWidth / 2, 0), maxOffset);
      const nextScroll = (offset / maxOffset) * scrollable;
      container.scrollLeft = nextScroll;
    },
    [thumbWidth]
  );

  const handleTrackPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (dragPointerId.current !== null) return;
      dragPointerId.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      updateScrollFromPointer(event.clientX);
    },
    [updateScrollFromPointer]
  );

  const handleTrackPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (dragPointerId.current !== event.pointerId) return;
      updateScrollFromPointer(event.clientX);
    },
    [updateScrollFromPointer]
  );

  const handleTrackPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragPointerId.current !== event.pointerId) return;
    dragPointerId.current = null;
  }, []);

  return (
    <section aria-labelledby="compare-engines" className="w-full">
      <div className="container-page max-w-6xl">
        <div className="relative flex flex-col gap-4">
          <div className="text-center">
            <h2 id="compare-engines" className="text-2xl font-semibold text-text-primary sm:text-3xl">
              {title}
            </h2>
            <p className="text-sm text-text-secondary sm:text-base">{subtitle}</p>
          </div>
          <div className="hidden gap-2 sm:flex sm:absolute sm:right-0 sm:top-1/2 sm:-translate-y-1/2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => scrollByCard(-1)}
              className="h-9 w-9 min-h-0 rounded-full border-hairline text-sm font-medium text-text-secondary hover:text-text-primary"
              aria-label={ariaPrev}
            >
              ‹
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => scrollByCard(1)}
              className="h-9 w-9 min-h-0 rounded-full border-hairline text-sm font-medium text-text-secondary hover:text-text-primary"
              aria-label={ariaNext}
            >
              ›
            </Button>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="compare-engines-scroll mt-4 flex gap-4 overflow-x-auto pl-4 pr-4 sm:pl-6 sm:pr-6 lg:pl-8 lg:pr-8"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {engines.map((entry, index) => {
          const engine = entry.engine;
          const guide = DEFAULT_ENGINE_GUIDE[engine.id];
          const name = engine.cardTitle ?? engine.marketingName ?? engine.engine.label;
          const versionLabel = engine.versionLabel ?? engine.engine.version ?? '-';
          const description = guide?.description ?? entry.meta?.bestFor ?? engine.seo.description ?? '';
          const avgDurationLabel = formatAvgDuration(engine.engine.avgDurationMs);
          const badges = guide?.badges ?? [];
          const labsBadgeNeeded = engine.engine.isLab && !badges.some((badge) => badge === 'Labs');
          const combinedBadges = labsBadgeNeeded ? [...badges, 'Labs'] : badges;
          const modes = getModeDisplayOrder(engine.id, engine.engine.modes)
            .map((mode) => getModeLabel(engine.id, mode))
            .join(' / ');
          const modelHref = { pathname: '/models/[slug]', params: { slug: engine.modelSlug } };
          const allowExamples = engine.category !== 'image' && engine.type !== 'image';
          const examplesHref = allowExamples ? getExamplesHref(engine.modelSlug) : null;
          const modelRoute = modelHref as unknown as Parameters<typeof router.push>[0];
          const handleClick = () => router.push(modelRoute);
          const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              router.push(modelRoute);
            }
          };

          return (
            <Card
              key={`${engine.id}-${index}`}
              data-card
              tabIndex={0}
              onClick={handleClick}
              onKeyDown={handleKeyDown}
              className="flex w-[320px] shrink-0 cursor-pointer flex-col gap-4 overflow-hidden p-5 transition hover:border-text-muted hover:bg-surface-2 hover:shadow-float sm:w-[360px]"
            >
              <div className="flex items-start gap-4">
                <EngineIcon engine={engine.engine} size={44} className="shrink-0" />
                <div className="flex flex-1 items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-text-primary">{name}</h3>
                    <p className="text-xs uppercase tracking-micro text-text-muted">
                      {engine.provider} - {versionLabel}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-[11px] text-text-muted">
                    {avgDurationLabel && (
                      <span className="rounded-input border border-border px-2 py-0.5">
                        Avg {avgDurationLabel}
                      </span>
                    )}
                    {engine.engine.status && (
                      <span className="rounded-input border border-border px-2 py-0.5 uppercase tracking-micro">
                        {engine.engine.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-4">
                <p className="text-sm leading-6 text-text-secondary">{description}</p>
                <div className="flex flex-wrap gap-2">
                  {combinedBadges.map((badge) => (
                    <span
                      key={badge}
                      className="inline-flex items-center rounded-full bg-bg px-3 py-1 text-[12px] font-medium text-text-secondary"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs text-text-muted">
                  <span>Modes: {modes}</span>
                  <span>
                    Max {engine.engine.maxDurationSec}s / Res {engine.engine.resolutions.join(' / ')}
                  </span>
                </div>
              </div>
              <div className="mt-auto -mx-5 -mb-5 border-t border-hairline">
                <div className="flex text-xs font-semibold">
                  <Link
                    href={modelHref}
                    className={clsx(
                      'flex-1 bg-surface px-4 py-2 text-center text-text-secondary transition hover:bg-surface-2 hover:text-text-primary',
                      examplesHref ? 'border-r border-hairline' : null
                    )}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {viewModelLabel}
                  </Link>
                  {examplesHref ? (
                    <Link
                      href={examplesHref}
                      className="flex-1 bg-surface px-4 py-2 text-center text-text-secondary transition hover:bg-surface-2 hover:text-text-primary"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {viewExamplesLabel}
                    </Link>
                  ) : null}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <div className="mt-3 flex justify-center px-4 sm:px-6 lg:px-8">
        <div
          ref={trackRef}
          className={clsx(
            'relative h-1 w-full max-w-[440px] rounded-full bg-brand/25 transition-opacity',
            showScrollbar ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
          onPointerDown={handleTrackPointerDown}
          onPointerMove={handleTrackPointerMove}
          onPointerUp={handleTrackPointerUp}
          onPointerCancel={handleTrackPointerUp}
          style={{ touchAction: 'none' }}
        >
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-brand"
            style={{ width: `${thumbWidth}px`, transform: `translateX(${thumbOffset}px)` }}
          />
        </div>
      </div>
      <style jsx>{`
        .compare-engines-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </section>
  );
}
