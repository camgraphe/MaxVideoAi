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

type VideoVisibilityPayload = {
  id: string;
  video: HTMLVideoElement | null;
  ratio: number;
  isVisible: boolean;
};

type RegistryEntry = {
  ref: HTMLVideoElement;
  ratio: number;
};

const BATCH_SIZE = 12;
const LANDSCAPE_SIZES = '(min-width: 1280px) 400px, 100vw';
const PORTRAIT_SIZES = '(min-width: 1280px) 300px, 100vw';
const VIDEO_PREPARE_THRESHOLD = 0.05;
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
  const [visibleVideos, setVisibleVideos] = useState<ExampleGalleryVideo[]>(initialVideos);
  const [pendingVideos, setPendingVideos] = useState<ExampleGalleryVideo[]>(remainingVideos);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const visibilityRegistryRef = useRef<Map<string, RegistryEntry>>(new Map());
  const activeVideoIdRef = useRef<string | null>(null);
  const frameHandleRef = useRef<number | null>(null);
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const resetVideoRef = useCallback((video: HTMLVideoElement) => {
    video.pause();
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        try {
          video.currentTime = 0;
        } catch {
          // ignore
        }
      }, 50);
    } else {
      try {
        video.currentTime = 0;
      } catch {
        // ignore
      }
    }
  }, []);

  const updatePlayback = useCallback(() => {
    frameHandleRef.current = null;
    const entries = Array.from(visibilityRegistryRef.current.entries());
    if (!entries.length) {
      if (activeVideoIdRef.current) {
        activeVideoIdRef.current = null;
      }
      return;
    }
    entries.sort((a, b) => b[1].ratio - a[1].ratio);
    const [nextId, nextEntry] = entries[0];
    if (!nextEntry?.ref || nextEntry.ratio <= 0) {
      entries.forEach(([, entry]) => {
        resetVideoRef(entry.ref);
      });
      activeVideoIdRef.current = null;
      return;
    }
    entries.forEach(([id, entry]) => {
      if (!entry.ref) return;
      if (id === nextId) {
        if (activeVideoIdRef.current !== id || entry.ref.paused) {
          const playPromise = entry.ref.play();
          if (typeof playPromise?.catch === 'function') {
            playPromise.catch(() => {});
          }
        }
      } else if (!entry.ref.paused) {
        resetVideoRef(entry.ref);
      }
    });
    activeVideoIdRef.current = nextId;
  }, [resetVideoRef]);

  const schedulePlaybackUpdate = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (frameHandleRef.current !== null) return;
    frameHandleRef.current = window.requestAnimationFrame(updatePlayback);
  }, [updatePlayback]);

  const handleVisibilityChange = useCallback(
    ({ id, video, ratio, isVisible }: VideoVisibilityPayload) => {
      if (!video || !isVisible || ratio <= 0) {
        const existing = visibilityRegistryRef.current.get(id);
        if (existing?.ref) {
          resetVideoRef(existing.ref);
        }
        visibilityRegistryRef.current.delete(id);
        schedulePlaybackUpdate();
        return;
      }
      visibilityRegistryRef.current.set(id, { ref: video, ratio });
      schedulePlaybackUpdate();
    },
    [resetVideoRef, schedulePlaybackUpdate]
  );

  useEffect(() => {
    return () => {
      if (frameHandleRef.current !== null) {
        window.cancelAnimationFrame(frameHandleRef.current);
        frameHandleRef.current = null;
      }
      visibilityRegistryRef.current.forEach((entry) => {
        resetVideoRef(entry.ref);
      });
      visibilityRegistryRef.current.clear();
      activeVideoIdRef.current = null;
    };
  }, [resetVideoRef]);

  useEffect(() => {
    setVisibleVideos(initialVideos);
    setPendingVideos(remainingVideos);
  }, [initialVideos, remainingVideos]);

  const appendBatch = useCallback(() => {
    setPendingVideos((current) => {
      if (!current.length) return current;
      setVisibleVideos((prev) => [...prev, ...current.slice(0, BATCH_SIZE)]);
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
    const updateLayout = () => {
      setIsMobileLayout(window.innerWidth < 768);
    };
    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, []);

  return (
    <>
      <div
        className={clsx('bg-white/60 p-[2px]', {
          'space-y-[2px]': isMobileLayout,
          'columns-1 gap-[2px] sm:columns-2 lg:columns-3 xl:columns-4': !isMobileLayout,
        })}
      >
        {visibleVideos.map((video, index) => (
          <ExampleCard
            key={video.id}
            video={video}
            isFirst={index === 0}
            onVisibilityChange={handleVisibilityChange}
            forceFullWidth={isMobileLayout}
          />
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
  onVisibilityChange,
  forceFullWidth,
}: {
  video: ExampleGalleryVideo;
  isFirst: boolean;
  onVisibilityChange?: (payload: VideoVisibilityPayload) => void;
  forceFullWidth: boolean;
}) {
  const rawAspect = useMemo(() => (video.aspectRatio ? parseAspectRatio(video.aspectRatio) : 16 / 9), [video.aspectRatio]);
  const aspectValue = useMemo(() => {
    const raw = rawAspect;
    const clamped = Math.min(Math.max(raw, 0.68), 1.35);
    return `${clamped} / 1`;
  }, [rawAspect]);
  const posterSrc = video.optimizedPosterUrl ?? video.rawPosterUrl ?? null;
  const isPortrait = rawAspect < 1;
  const posterSizes = isPortrait ? PORTRAIT_SIZES : LANDSCAPE_SIZES;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const videoPageHref = useMemo(() => `/video/${encodeURIComponent(video.id)}`, [video.id]);
  const shouldReportVisibility = Boolean(video.videoUrl);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const lastRatioRef = useRef(isFirst ? 1 : 0);
  const [shouldRenderVideo, setShouldRenderVideo] = useState(() => Boolean(isFirst && video.videoUrl));

  useEffect(() => {
    if (!video.videoUrl) {
      setShouldRenderVideo(false);
    }
  }, [video.videoUrl]);

  const emitVisibility = useCallback(
    (ratio: number, isIntersecting: boolean) => {
      lastRatioRef.current = ratio;
      if (!shouldReportVisibility || !onVisibilityChange) return;
      const meetsThreshold = isIntersecting && ratio >= VIDEO_PREPARE_THRESHOLD;
      const nextShouldRender = Boolean(video.videoUrl) && meetsThreshold;
      setShouldRenderVideo(nextShouldRender);
      onVisibilityChange({
        id: video.id,
        video: nextShouldRender ? videoElementRef.current : null,
        ratio: nextShouldRender ? ratio : 0,
        isVisible: nextShouldRender,
      });
    },
    [onVisibilityChange, shouldReportVisibility, video.id, video.videoUrl]
  );

  const handleVideoRef = useCallback(
    (node: HTMLVideoElement | null) => {
      videoElementRef.current = node;
      if (!shouldReportVisibility || !onVisibilityChange) return;
      if (!shouldRenderVideo) return;
      onVisibilityChange({
        id: video.id,
        video: node,
        ratio: lastRatioRef.current,
        isVisible: Boolean(node),
      });
    },
    [onVisibilityChange, shouldReportVisibility, shouldRenderVideo, video.id]
  );

  useEffect(() => {
    if (!shouldReportVisibility || !onVisibilityChange) return;
    const node = videoElementRef.current;
    onVisibilityChange({
      id: video.id,
      video: shouldRenderVideo ? node : null,
      ratio: shouldRenderVideo ? lastRatioRef.current : 0,
      isVisible: shouldRenderVideo && Boolean(node),
    });
  }, [onVisibilityChange, shouldRenderVideo, shouldReportVisibility, video.id]);

  useEffect(() => {
    if (!shouldReportVisibility) return undefined;
    if (typeof window === 'undefined') return undefined;
    const node = containerRef.current;
    if (!node) return undefined;
    const thresholds = Array.from({ length: 11 }, (_, index) => index / 10);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.target !== node) return;
          const ratio = entry.intersectionRatio;
          emitVisibility(ratio, entry.isIntersecting);
        });
      },
      { rootMargin: '0px 0px 0px 0px', threshold: Array.from(new Set([...thresholds, VIDEO_PREPARE_THRESHOLD])).sort((a, b) => a - b) }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [emitVisibility, shouldReportVisibility]);

  useEffect(() => {
    return () => {
      if (!onVisibilityChange || !shouldReportVisibility) return;
      onVisibilityChange({
        id: video.id,
        video: null,
        ratio: 0,
        isVisible: false,
      });
    };
  }, [onVisibilityChange, shouldReportVisibility, video.id]);

  const handleNavigate = useCallback(() => {
    router.push(videoPageHref);
  }, [router, videoPageHref]);

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
    <article className={clsx('relative mb-[2px]', { 'break-inside-avoid': !forceFullWidth })}>
      <div
        ref={containerRef}
        className="group relative block w-full cursor-pointer overflow-hidden bg-neutral-900/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        style={{ aspectRatio: aspectValue }}
        role="link"
        tabIndex={0}
        aria-label={`Open video ${video.engineLabel}`}
        onClick={handleNavigate}
        onKeyDown={handleKeyDown}
      >
        <MediaPreview
          videoUrl={video.videoUrl ?? null}
          posterUrl={posterSrc}
          prompt={video.prompt}
          isLcp={isFirst}
          sizes={posterSizes}
          onVideoRef={shouldReportVisibility ? handleVideoRef : undefined}
          shouldRenderVideo={shouldRenderVideo}
        />
        {video.hasAudio ? <AudioEqualizerBadge tone="light" size="sm" label="Audio available on playback" /> : null}
        <CardOverlay video={video} />
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
  isLcp,
  sizes,
  onVideoRef,
  shouldRenderVideo = true,
}: {
  videoUrl: string | null;
  posterUrl: string | null;
  prompt: string;
  isLcp: boolean;
  sizes: string;
  onVideoRef?: (video: HTMLVideoElement | null) => void;
  shouldRenderVideo?: boolean;
}) {
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    setHasLoaded(false);
  }, [videoUrl, shouldRenderVideo]);

  const handleVideoReady = useCallback(() => {
    setHasLoaded(true);
  }, []);

  const setVideoElement = useCallback(
    (node: HTMLVideoElement | null) => {
      onVideoRef?.(node);
    },
    [onVideoRef]
  );

  if (!videoUrl || !shouldRenderVideo) {
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
        alt={prompt}
        fill
        className="pointer-events-none object-cover"
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
          alt={prompt}
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
        autoPlay
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
