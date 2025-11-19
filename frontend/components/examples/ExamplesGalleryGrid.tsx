'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { AudioEqualizerBadge } from '@/components/ui/AudioEqualizerBadge';
import { EngineIcon } from '@/components/ui/EngineIcon';

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
};

const BATCH_SIZE = 12;
const LANDSCAPE_SIZES = '(min-width: 1280px) 400px, 100vw';
const PORTRAIT_SIZES = '(min-width: 1280px) 300px, 100vw';
const SCROLL_THROTTLE_MS = 120;
type ExtendedWindow = Window &
  typeof globalThis & {
    requestIdleCallback?: (callback: IdleRequestCallback) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

function runAfterIdle(work: () => (() => void) | void) {
  if (typeof window === 'undefined') {
    return work();
  }
  let cleanup: void | (() => void);
  const win = window as ExtendedWindow;
  if (typeof win.requestIdleCallback === 'function') {
    const idleId = win.requestIdleCallback(() => {
      cleanup = work();
    });
    return () => {
      win.cancelIdleCallback?.(idleId);
      if (typeof cleanup === 'function') {
        cleanup();
      }
    };
  }
  const timeout = window.setTimeout(() => {
    cleanup = work();
  }, 0);
  return () => {
    window.clearTimeout(timeout);
    if (typeof cleanup === 'function') {
      cleanup();
    }
  };
}

export function ExamplesGalleryGrid({
  initialVideos,
  remainingVideos,
  loadMoreLabel = 'Load more examples',
}: {
  initialVideos: ExampleGalleryVideo[];
  remainingVideos: ExampleGalleryVideo[];
  loadMoreLabel?: string;
}) {
  const [visibleVideos, setVisibleVideos] = useState<ExampleGalleryVideo[]>(dedupeVideos(initialVideos));
  const [pendingVideos, setPendingVideos] = useState<ExampleGalleryVideo[]>(dedupeVideos(remainingVideos));
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState<number>(0);
  const [isClient, setIsClient] = useState(false);
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);
  const [cardRowIndex, setCardRowIndex] = useState<Map<string, number>>(new Map());
  const cardRefs = useRef<Map<string, HTMLElement | null>>(new Map());
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    setVisibleVideos(dedupeVideos(initialVideos));
    setPendingVideos(dedupeVideos(remainingVideos));
  }, [initialVideos, remainingVideos]);

  const appendBatch = useCallback(() => {
    setPendingVideos((current) => {
      if (!current.length) return current;
      setVisibleVideos((prev) => dedupeVideos([...prev, ...current.slice(0, BATCH_SIZE)]));
      return current.slice(BATCH_SIZE);
    });
  }, []);

  useEffect(() => {
    if (!pendingVideos.length) return undefined;
    const node = sentinelRef.current;
    if (!node) return undefined;
    return runAfterIdle(() => {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            appendBatch();
          }
        },
        { rootMargin: '600px 0px 0px 0px' }
      );
      observer.observe(node);
      return () => observer.disconnect();
    });
  }, [appendBatch, pendingVideos.length]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsClient(true);
  }, []);

  const columnCount = useMemo(() => {
    if (viewportWidth <= 0) return 1;
    if (viewportWidth < 768) return 1;
    if (viewportWidth < 1280) return 2;
    if (viewportWidth < 1536) return 3;
    return 4;
  }, [viewportWidth]);

  const masonryColumns = useMemo(() => {
    const count = Math.max(1, columnCount);
    const columns = Array.from({ length: count }, () => ({
      height: 0,
      items: [] as ExampleGalleryVideo[],
    }));
    visibleVideos.forEach((video) => {
      const aspect = video.aspectRatio ? parseAspectRatio(video.aspectRatio) : 16 / 9;
      const displayAspect = getDisplayAspect(aspect);
      const estimatedHeight = displayAspect > 0 ? 1 / displayAspect : 1;
      let targetColumn = columns[0];
      for (const column of columns) {
        if (column.height < targetColumn.height) {
          targetColumn = column;
        }
      }
      targetColumn.items.push(video);
      targetColumn.height += estimatedHeight;
    });
    return columns;
  }, [columnCount, visibleVideos]);

  const registerCard = useCallback((id: string) => {
    return (node: HTMLElement | null) => {
      cardRefs.current.set(id, node);
    };
  }, []);

  const computeRowsAndActive = useCallback(() => {
    if (typeof window === 'undefined') return;
    const entries = Array.from(cardRefs.current.entries()).filter((entry): entry is [string, HTMLElement] => {
      return Boolean(entry[1]);
    });
    if (!entries.length) return;

    const tolerance = 5;
    const rows: { top: number; bottom: number; items: string[] }[] = [];
    entries.forEach(([id, node]) => {
      const rect = node.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const bottom = top + rect.height;
      let target = rows.find((row) => Math.abs(row.top - top) <= tolerance);
      if (!target) {
        target = { top, bottom, items: [] };
        rows.push(target);
      } else {
        if (top < target.top) target.top = top;
        if (bottom > target.bottom) target.bottom = bottom;
      }
      target.items.push(id);
    });

    if (!rows.length) return;
    rows.sort((a, b) => a.top - b.top);

    const lineY = window.scrollY + window.innerHeight / 2;
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    rows.forEach((row, index) => {
      const { top, bottom } = row;
      let distance = 0;
      if (lineY < top) {
        distance = top - lineY;
      } else if (lineY > bottom) {
        distance = lineY - bottom;
      } else {
        distance = 0;
      }
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    const nextMap = new Map<string, number>();
    rows.forEach((row, index) => {
      row.items.forEach((id) => {
        nextMap.set(id, index);
      });
    });

    setCardRowIndex(nextMap);
    setActiveRowIndex(bestIndex);
  }, []);

  const throttledScrollHandler = useMemo(() => {
    if (typeof window === 'undefined') return null;
    let timeoutId: number | null = null;
    const handler = () => {
      const currentY = window.scrollY;
      lastScrollYRef.current = currentY;
      if (timeoutId !== null) return;
      timeoutId = window.setTimeout(() => {
        timeoutId = null;
        computeRowsAndActive();
      }, SCROLL_THROTTLE_MS);
    };
    return handler;
  }, [computeRowsAndActive]);

  useEffect(() => {
    if (typeof window === 'undefined' || !throttledScrollHandler) return undefined;
    computeRowsAndActive();
    window.addEventListener('scroll', throttledScrollHandler, { passive: true });
    window.addEventListener('resize', throttledScrollHandler);
    return () => {
      window.removeEventListener('scroll', throttledScrollHandler);
      window.removeEventListener('resize', throttledScrollHandler);
    };
  }, [computeRowsAndActive, throttledScrollHandler]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleLoad = () => {
      computeRowsAndActive();
    };
    window.addEventListener('load', handleLoad);
    return () => {
      window.removeEventListener('load', handleLoad);
    };
  }, [computeRowsAndActive]);

  if (!isClient) {
    return (
      <>
        <div className="grid gap-[2px] grid-cols-1">
          {visibleVideos.map((video, index) => (
            <ExampleCard key={video.id} video={video} isFirst={index === 0} isActiveRow={index === 0} />
          ))}
        </div>
        <div ref={sentinelRef} className="h-8 w-full" aria-hidden />
        {pendingVideos.length ? (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              className="rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-text-primary shadow-card transition hover:border-accent hover:text-accent"
              onClick={appendBatch}
            >
              {loadMoreLabel}
            </button>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <>
      <div className="flex gap-[2px]" style={{ minHeight: 0 }}>
        {masonryColumns.map((column, columnIndex) => (
          <div
            key={`masonry-column-${columnIndex}`}
            className="flex min-w-0 flex-1 flex-col gap-[2px]"
            style={{ width: `${100 / columnCount}%` }}
          >
            {column.items.map((video, index) => {
              const rowIndex = cardRowIndex.get(video.id) ?? null;
              const isActive =
                rowIndex !== null && activeRowIndex !== null
                  ? rowIndex === activeRowIndex
                  : columnIndex === 0 && index === 0;
              return (
                <ExampleCard
                  key={video.id}
                  video={video}
                  isFirst={columnIndex === 0 && index === 0}
                  isActiveRow={isActive}
                  cardRef={registerCard(video.id)}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div ref={sentinelRef} className="h-8 w-full" aria-hidden />
      {pendingVideos.length ? (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            className="rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-text-primary shadow-card transition hover:border-accent hover:text-accent"
            onClick={appendBatch}
          >
            {loadMoreLabel}
          </button>
        </div>
      ) : null}
    </>
  );
}

function ExampleCard({
  video,
  isFirst,
  isActiveRow,
  cardRef,
}: {
  video: ExampleGalleryVideo;
  isFirst: boolean;
  isActiveRow: boolean;
  cardRef?: (node: HTMLElement | null) => void;
}) {
  const rawAspect = useMemo(() => (video.aspectRatio ? parseAspectRatio(video.aspectRatio) : 16 / 9), [video.aspectRatio]);
  const displayAspect = useMemo(() => getDisplayAspect(rawAspect), [rawAspect]);
  const posterSrc = video.optimizedPosterUrl ?? video.rawPosterUrl ?? null;
  const isPortrait = rawAspect < 1;
  const posterSizes = isPortrait ? PORTRAIT_SIZES : LANDSCAPE_SIZES;
  const router = useRouter();
  const videoPageHref = useMemo(() => `/video/${encodeURIComponent(video.id)}`, [video.id]);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const [allowOverlay, setAllowOverlay] = useState(false);
  const [canAutoplay, setCanAutoplay] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  const handleNavigate = useCallback(() => {
    router.push(videoPageHref);
  }, [router, videoPageHref]);

  const handlePlaybackStart = useCallback(() => {
    setAllowOverlay(true);
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleNavigate();
      }
    },
    [handleNavigate]
  );

  return (
    <article
      className={clsx(
        'relative mb-[2px] flex-1',
        isActiveRow ? 'brightness-105' : 'brightness-100'
      )}
      ref={cardRef}
    >
      <div
        className="group block w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        role="link"
        tabIndex={0}
        aria-label={`Open video ${video.engineLabel}`}
        onClick={handleNavigate}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="relative w-full overflow-hidden bg-neutral-900/5">
          <div
            className="relative w-full"
            style={{ paddingBottom: `${100 / displayAspect}%` }}
          >
            <MediaPreview
              videoUrl={video.videoUrl ?? null}
              posterUrl={posterSrc}
              prompt={video.prompt}
              altText={`${video.engineLabel} AI video example – ${video.prompt}`}
              isLcp={isFirst}
              sizes={posterSizes}
              onVideoRef={(node) => {
                videoElementRef.current = node;
              }}
              onPlaybackStart={handlePlaybackStart}
              shouldPlay={Boolean((isActiveRow || isHovered) && video.videoUrl && canAutoplay)}
              onAutoplayError={() => setCanAutoplay(false)}
            />
          </div>
          {video.hasAudio ? <AudioEqualizerBadge tone="light" size="sm" label="Audio available on playback" /> : null}
          {allowOverlay ? <CardOverlay video={video} /> : null}
        </div>
      </div>
    </article>
  );
}

function CardOverlay({ video }: { video: ExampleGalleryVideo }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between bg-gradient-to-b from-black/20 via-black/60 to-black/85 opacity-0 transition duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
      <div className="space-y-2.5 p-5 text-white">
        <div className="flex items-center gap-2 text-white">
          <EngineIcon
            engine={{
              id: video.engineIconId,
              label: video.engineLabel,
              brandId: video.engineBrandId,
            }}
            size={24}
            rounded="full"
          />
          <h2 className="text-base font-semibold leading-tight sm:text-lg">{video.engineLabel}</h2>
          {video.priceLabel ? (
            <span className="ml-auto text-[11px] font-medium text-white/70 sm:text-xs">{video.priceLabel}</span>
          ) : null}
        </div>
        <p className="text-[10px] font-medium leading-snug text-white/75 sm:text-[11px]">{video.prompt}</p>
      </div>
      <div className="flex items-center justify-between gap-3 p-5 text-[10px] text-white/70 sm:text-xs">
        <Link
          href={video.href}
          className="pointer-events-auto rounded-full bg-white/20 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-micro text-white transition hover:bg-white/40 sm:text-[10px]"
          aria-label={`Generate like render ${video.id}`}
          onClick={(event) => event.stopPropagation()}
        >
          Generate like this
        </Link>
        <span className="text-white/60">{video.aspectRatio ?? 'Auto'} · {video.durationSec}s</span>
      </div>
    </div>
  );
}

function MediaPreview({
  videoUrl,
  posterUrl,
  prompt,
  altText,
  isLcp,
  sizes,
  onVideoRef,
  onPlaybackStart,
  shouldPlay,
  onAutoplayError,
}: {
  videoUrl: string | null;
  posterUrl: string | null;
  prompt: string;
  altText?: string;
  isLcp: boolean;
  sizes: string;
  onVideoRef?: (video: HTMLVideoElement | null) => void;
  onPlaybackStart?: () => void;
  shouldPlay: boolean;
  onAutoplayError?: () => void;
}) {
  const [hasLoaded, setHasLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setHasLoaded(false);
  }, [videoUrl]);

  const handleVideoReady = useCallback(() => {
    setHasLoaded(true);
    onPlaybackStart?.();
  }, [onPlaybackStart]);

  const setVideoElement = useCallback(
    (node: HTMLVideoElement | null) => {
      videoRef.current = node;
      onVideoRef?.(node);
    },
    [onVideoRef]
  );

  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;
    if (!shouldPlay) {
      node.pause();
      return;
    }
    const tryPlay = async () => {
      try {
        await node.play();
      } catch {
        const handleLoadedData = () => {
          node
            .play()
            .catch(() => {
              onAutoplayError?.();
            })
            .finally(() => {
              node.removeEventListener('loadeddata', handleLoadedData);
            });
        };
        node.addEventListener('loadeddata', handleLoadedData, { once: true });
      }
    };
    void tryPlay();
  }, [shouldPlay, onAutoplayError]);

  if (!videoUrl) {
    if (!posterUrl) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-200 text-xs font-semibold uppercase tracking-micro text-text-muted">
          Preview unavailable
        </div>
      );
    }
    return (
      <Image
        src={posterUrl}
        alt={altText || prompt}
        fill
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        priority={isLcp}
        fetchPriority={isLcp ? 'high' : undefined}
        loading={isLcp ? 'eager' : 'lazy'}
        decoding="async"
        quality={80}
        sizes={sizes}
      />
    );
  }

  const shouldHidePoster = hasLoaded;

  return (
    <>
      {posterUrl ? (
        <Image
          src={posterUrl}
          alt={altText || prompt}
          fill
          className={clsx('absolute inset-0 h-full w-full object-cover transition-opacity duration-300', {
            'opacity-0': shouldHidePoster,
            'opacity-100': !shouldHidePoster,
          })}
          priority={isLcp}
          fetchPriority={isLcp ? 'high' : undefined}
          loading={isLcp ? 'eager' : 'lazy'}
          decoding="async"
          quality={80}
          sizes={sizes}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-200 text-xs font-semibold uppercase tracking-micro text-text-muted">
          Preview unavailable
        </div>
      )}
      <video
        ref={setVideoElement}
        className="absolute inset-0 z-10 h-full w-full object-cover"
        src={videoUrl ?? undefined}
        muted
        loop
        playsInline
        preload="metadata"
        poster={posterUrl ?? undefined}
        onLoadedData={handleVideoReady}
        onPlaying={handleVideoReady}
      >
        <track kind="captions" srcLang="en" label="auto-generated" default />
      </video>
    </>
  );
}

function parseAspectRatio(value: string): number {
  if (!value) return 16 / 9;
  if (value.includes(':')) {
    const [w, h] = value.split(':').map(Number);
    if (Number.isFinite(w) && Number.isFinite(h) && h !== 0) {
      return w / h;
    }
  }
  return Number.parseFloat(value) || 16 / 9;
}

function getDisplayAspect(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 16 / 9;
  const minVertical = 0.8;
  const maxHorizontal = 1.35;
  if (raw < 1) {
    return Math.max(raw, minVertical);
  }
  return Math.min(raw, maxHorizontal);
}

function dedupeVideos(videos: ExampleGalleryVideo[]): ExampleGalleryVideo[] {
  const seen = new Set<string>();
  return videos.filter((video) => {
    if (seen.has(video.id)) return false;
    seen.add(video.id);
    return true;
  });
}
