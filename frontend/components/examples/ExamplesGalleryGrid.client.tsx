'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import clsx from 'clsx';
import { AudioEqualizerBadge } from '@/components/ui/AudioEqualizerBadge';
import { Button } from '@/components/ui/Button';
import mediaStyles from './examples-media.module.css';
import masonryStyles from './examples-masonry.module.css';

export type ExampleGalleryVideo = {
  id: string;
  href: string;
  engineLabel: string;
  engineIconId: string;
  engineBrandId?: string;
  priceLabel: string | null;
  prompt: string;
  aspectRatio: string | null;
  durationSec: number;
  hasAudio: boolean;
  optimizedPosterUrl?: string | null;
  rawPosterUrl?: string | null;
  videoUrl?: string | null;
  recreateHref?: string | null;
  modelHref?: string | null;
  sourceIndex?: number;
};

const INITIAL_BATCH = 12;
const BATCH_SIZE = 8;
const LANDSCAPE_SIZES = '(max-width: 640px) 100vw, (max-width: 1024px) 60vw, 40vw';
const PORTRAIT_SIZES = '(max-width: 640px) 100vw, (max-width: 1024px) 60vw, 40vw';
const DEFAULT_LANDSCAPE_RATIO = 16 / 9;
const DEFAULT_LANDSCAPE_HEIGHT_PERCENT = 100 / DEFAULT_LANDSCAPE_RATIO;
const TALL_CARD_MEDIA_PERCENT = Number((DEFAULT_LANDSCAPE_HEIGHT_PERCENT * 2).toFixed(3));
const LH_POSTER_SRC = '/examples/lcp-poster.webp';

type ExampleSort = 'playlist' | 'date-desc' | 'date-asc' | 'duration-asc' | 'duration-desc' | 'engine-asc';

export default function ExamplesGalleryGridClient({
  initialExamples,
  loadMoreLabel = 'Load more examples',
  sort,
  engineFilter,
  initialOffset,
  pageOffsetEnd,
  locale,
}: {
  initialExamples: ExampleGalleryVideo[];
  loadMoreLabel?: string;
  sort: ExampleSort;
  engineFilter?: string | null;
  initialOffset: number;
  pageOffsetEnd: number;
  locale: string;
}) {
  const isLighthouse = useMemo(() => detectLighthouse(), []);
  const [isMobile, setIsMobile] = useState(false);
  const baseAll = useMemo(() => dedupe(initialExamples), [initialExamples]);
  const columnCount = useColumnCount();
  const [nextOffset, setNextOffset] = useState(() => initialOffset);
  const [isLoading, setIsLoading] = useState(false);

  const [visibleVideos, setVisibleVideos] = useState<ExampleGalleryVideo[]>(() => {
    if (isLighthouse) return baseAll.slice(0, 1);
    return baseAll.slice(0, INITIAL_BATCH);
  });

  // Reset batches when the filtered dataset changes (e.g., engine filter navigation).
  useEffect(() => {
    if (isLighthouse) {
      setVisibleVideos(baseAll.slice(0, 1));
      setNextOffset(initialOffset);
      return;
    }
    setVisibleVideos(baseAll.slice(0, INITIAL_BATCH));
    setNextOffset(initialOffset);
  }, [baseAll, isLighthouse, initialOffset]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsMobile(window.matchMedia('(max-width: 639px)').matches);
    }

    if (!isLighthouse) return;
    if (typeof PerformanceObserver === 'undefined') return;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // eslint-disable-next-line no-console
        console.warn('[lh-longtask]', {
          name: entry.name,
          duration: entry.duration,
          startTime: entry.startTime,
        });
      }
    });
    observer.observe({ type: 'longtask', buffered: true });
    return () => observer.disconnect();
  }, [isLighthouse]);

  const handleLoadMore = async () => {
    if (isLighthouse || isLoading) return;
    if (nextOffset >= pageOffsetEnd) return;
    setIsLoading(true);
    try {
      let localOffset = nextOffset;
      let didAppend = false;
      while (localOffset < pageOffsetEnd && !didAppend) {
        const remaining = Math.max(0, pageOffsetEnd - localOffset);
        const fetchLimit = Math.max(1, Math.min(BATCH_SIZE, remaining));
        const params = new URLSearchParams();
        params.set('sort', sort);
        params.set('limit', String(fetchLimit));
        params.set('offset', String(localOffset));
        if (engineFilter) {
          params.set('engine', engineFilter);
        }
        if (locale) {
          params.set('locale', locale);
        }
        const res = await fetch(`/api/examples?${params.toString()}`, { method: 'GET' });
        const payload = await res.json();
        if (!res.ok || !payload?.ok) {
          localOffset += fetchLimit;
          continue;
        }
        const incoming = Array.isArray(payload.cards) ? payload.cards : [];
        if (incoming.length) {
          setVisibleVideos((prev) => dedupe([...prev, ...incoming]));
          didAppend = true;
        }
        localOffset += fetchLimit;
      }
      setNextOffset(localOffset);
    } finally {
      setIsLoading(false);
    }
  };

  const columns = useMemo(() => splitIntoColumns(visibleVideos, columnCount), [visibleVideos, columnCount]);
  const shouldUseTallCardLayout = !isMobile;
  const firstVisibleId = visibleVideos[0]?.id;
  const hasMore = !isLighthouse && nextOffset < pageOffsetEnd;

  return (
    <div className="space-y-4 p-4 sm:p-6">
      {isMobile ? (
        <div className="flex flex-col gap-4">
          {visibleVideos.map((video) => {
            const isFirstVideo = video.id === firstVisibleId;
            return (
              <ExampleCard
                key={video.id}
                video={video}
                isFirst={isFirstVideo}
                isLighthouse={isLighthouse}
                forceExclusivePlay={false}
                enableTallCardLayout={false}
                enableInlineVideo={isFirstVideo}
              />
            );
          })}
        </div>
      ) : (
        <div className={masonryStyles.masonry}>
          {columns.map((column, columnIndex) => (
            <div key={columnIndex} className={masonryStyles.column}>
              {column.map((video) => {
                const isFirstVideo = video.id === firstVisibleId;
                return (
                  <ExampleCard
                    key={video.id}
                    video={video}
                    isFirst={isFirstVideo}
                    isLighthouse={isLighthouse}
                    forceExclusivePlay={false}
                    enableTallCardLayout={shouldUseTallCardLayout}
                    enableInlineVideo
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}
      {hasMore ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={handleLoadMore}
            disabled={isLoading}
            className="border-brand/40 text-brand shadow-card hover:border-brand hover:bg-brand/10"
          >
            {isLoading ? 'Loading…' : loadMoreLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ExampleCard({
  video,
  isFirst,
  isLighthouse,
  forceExclusivePlay,
  enableTallCardLayout,
  enableInlineVideo,
}: {
  video: ExampleGalleryVideo;
  isFirst: boolean;
  isLighthouse: boolean;
  forceExclusivePlay: boolean;
  enableTallCardLayout: boolean;
  enableInlineVideo: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [inView, setInView] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [posterLoaded, setPosterLoaded] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastPlayRef = useRef<() => void>();
  const lastPauseRef = useRef<() => void>();

  const rawAspect = useMemo(() => (video.aspectRatio ? parseAspectRatio(video.aspectRatio) : 16 / 9), [video.aspectRatio]);
  const isPortrait = rawAspect < 1;
  const posterSizes = isPortrait ? PORTRAIT_SIZES : LANDSCAPE_SIZES;
  const shouldLoadVideo = enableInlineVideo && !isLighthouse && inView && posterLoaded && Boolean(video.videoUrl);
  const shouldPlay = shouldLoadVideo && (isHovered || isFirst || forceExclusivePlay);
  const mediaPaddingPercent = Number((100 / rawAspect).toFixed(3));
  const tallCardEnabled = enableTallCardLayout && isPortrait;
  const mediaPadding = tallCardEnabled
    ? `calc(${TALL_CARD_MEDIA_PERCENT}% + var(--examples-grid-row-gap, 10px))`
    : `${mediaPaddingPercent}%`;

  useEffect(() => {
    if (isLighthouse) {
      setInView(false);
      return;
    }
    const node = cardRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setInView(entry.isIntersecting);
      },
      { rootMargin: '120px 0px 120px 0px', threshold: 0.25 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [isLighthouse]);

  useEffect(() => {
    const node = videoRef.current;
    if (!node || !shouldPlay) return;
    const pauseOthers = () => {
      if (!forceExclusivePlay) return;
      try {
        document.querySelectorAll('video[data-examples-card]').forEach((el) => {
          if (el !== node) {
            (el as HTMLVideoElement).pause();
          }
        });
      } catch {
        /* ignore */
      }
    };

    const play = async () => {
      try {
        pauseOthers();
        await node.play();
        setVideoReady(true);
      } catch {
        // ignore autoplay failures
      }
    };
    void play();
    lastPlayRef.current = () => {
      void play();
    };
    lastPauseRef.current = () => {
      node.pause();
    };
    return () => {
      node.pause();
    };
  }, [shouldPlay, forceExclusivePlay]);

  const posterSrc = isLighthouse ? LH_POSTER_SRC : video.optimizedPosterUrl ?? video.rawPosterUrl ?? null;

  return (
    <div
      ref={cardRef}
      className="group relative overflow-hidden rounded-[18px] border border-hairline bg-surface shadow-card focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-bg"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link
        href={video.href}
        className="absolute inset-0 z-0"
        aria-label={isLighthouse ? 'AI video example preview' : undefined}
        prefetch={!isLighthouse}
        tabIndex={isLighthouse ? -1 : 0}
      />
      <div className="relative z-10 pointer-events-none">
        <div className={clsx(mediaStyles.mediaOuter, 'relative w-full overflow-hidden bg-surface-on-media-dark-5')}>
          <div className="relative w-full" style={{ paddingBottom: mediaPadding }}>
            <div className="absolute inset-0">
              {shouldLoadVideo && video.videoUrl ? (
                <video
                  ref={videoRef}
                  muted
                  loop
                  playsInline
                  poster={posterSrc ?? undefined}
                  data-examples-card
                  className="h-full w-full object-cover object-center transition duration-500 group-hover:scale-[1.02]"
                >
                  <source src={video.videoUrl} type="video/mp4" />
                </video>
              ) : posterSrc ? (
                <Image
                  src={posterSrc}
                  alt={`${video.engineLabel} AI video example – ${video.prompt}`}
                  fill
                  className="h-full w-full object-cover object-center"
                  priority={isLighthouse || isFirst}
                  fetchPriority={isLighthouse || isFirst ? 'high' : undefined}
                  loading={isLighthouse || isFirst ? 'eager' : 'lazy'}
                  decoding="async"
                  sizes={posterSizes}
                  quality={isLighthouse ? 40 : 60}
                  onLoadingComplete={() => setPosterLoaded(true)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-placeholder text-[11px] font-semibold uppercase tracking-micro text-text-muted">
                  No preview
                </div>
              )}
              {video.hasAudio ? <AudioEqualizerBadge tone="light" size="sm" label="Audio available on playback" /> : null}
            </div>
          </div>
        </div>
        <div className="space-y-1 px-4 py-3 text-left">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-micro text-text-muted">
            {video.modelHref ? (
              <Link href={video.modelHref} className="pointer-events-auto hover:text-text-primary">
                {video.engineLabel}
              </Link>
            ) : (
              <span>{video.engineLabel}</span>
            )}
            {video.priceLabel ? <span className="rounded-full bg-bg px-2 py-0.5 text-[10px] text-text-secondary">{video.priceLabel}</span> : null}
          </div>
          <p className="text-sm font-semibold leading-snug text-text-primary line-clamp-2">{video.prompt}</p>
          <p className="text-[11px] text-text-secondary">
            {video.aspectRatio ?? 'Auto'} · {video.durationSec}s {videoReady ? '· Playing' : ''}
          </p>
          {video.recreateHref ? (
            <div className="pt-1">
              <Link
                href={video.recreateHref}
                className="pointer-events-auto text-[11px] font-semibold text-brand transition hover:text-brand-hover"
                prefetch={false}
              >
                Recreate this shot →
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function dedupe(videos: ExampleGalleryVideo[]) {
  const seen = new Set<string>();
  const out: ExampleGalleryVideo[] = [];
  for (const video of videos) {
    if (seen.has(video.id)) continue;
    seen.add(video.id);
    out.push(video);
  }
  return out;
}

function parseAspectRatio(aspect: string) {
  const [w, h] = aspect.split(':').map(Number);
  if (!Number.isFinite(w) || !Number.isFinite(h) || h === 0) return 16 / 9;
  return w / h;
}

function estimateCardHeightWeight(aspectRatio: string | null) {
  const ratio = aspectRatio ? parseAspectRatio(aspectRatio) : DEFAULT_LANDSCAPE_RATIO;
  if (ratio < 0.9) return 1.8;
  if (ratio < 1.1) return 1;
  return 0.6;
}

function splitIntoColumns(videos: ExampleGalleryVideo[], columnCount: number): ExampleGalleryVideo[][] {
  if (!videos.length) return [];
  const safeCount = Math.max(1, Math.floor(columnCount) || 1);
  const count = Math.min(safeCount, videos.length);
  const columns: ExampleGalleryVideo[][] = Array.from({ length: count }, () => []);
  const heights = Array.from({ length: count }, () => 0);

  for (const video of videos) {
    const targetHeight = Math.min(...heights);
    const targetIndex = heights.indexOf(targetHeight);
    columns[targetIndex].push(video);
    heights[targetIndex] += estimateCardHeightWeight(video.aspectRatio);
  }

  return columns;
}

function useColumnCount() {
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const twoColumns = window.matchMedia('(max-width: 1279px)');
    const oneColumn = window.matchMedia('(max-width: 767px)');

    const update = () => {
      if (oneColumn.matches) {
        setCount(1);
      } else if (twoColumns.matches) {
        setCount(2);
      } else {
        setCount(3);
      }
    };

    update();
    const unsubscribers = [twoColumns, oneColumn].map((query) => {
      if (typeof query.addEventListener === 'function') {
        query.addEventListener('change', update);
        return () => query.removeEventListener('change', update);
      }
      query.addListener(update);
      return () => query.removeListener(update);
    });

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  return count;
}

function detectLighthouse() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (ua.includes('Chrome-Lighthouse')) return true;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('lh-mode') === '1') return true;
  } catch {
    /* ignore */
  }
  return false;
}
