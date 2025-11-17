'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
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

  return (
    <>
      <div className="columns-1 gap-[2px] bg-white/60 p-[2px] sm:columns-2 lg:columns-3 xl:columns-4">
        {visibleVideos.map((video, index) => (
          <ExampleCard key={video.id} video={video} isFirst={index === 0} />
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

function ExampleCard({ video, isFirst }: { video: ExampleGalleryVideo; isFirst: boolean }) {
  const rawAspect = useMemo(() => (video.aspectRatio ? parseAspectRatio(video.aspectRatio) : 16 / 9), [video.aspectRatio]);
  const aspectValue = useMemo(() => {
    const raw = rawAspect;
    const clamped = Math.min(Math.max(raw, 0.68), 1.35);
    return `${clamped} / 1`;
  }, [rawAspect]);
  const posterSrc = video.optimizedPosterUrl ?? video.rawPosterUrl ?? null;
  const isPortrait = rawAspect < 1;
  const posterSizes = isPortrait ? PORTRAIT_SIZES : LANDSCAPE_SIZES;
  const videoDetailHref = `/video/${encodeURIComponent(video.id)}`;

  return (
    <article className="group relative mb-[2px] break-inside-avoid overflow-hidden bg-neutral-900/5">
      <div className="relative">
        <div className="relative w-full overflow-hidden" style={{ aspectRatio: aspectValue }}>
          <MediaPreview
            videoUrl={video.videoUrl ?? null}
            posterUrl={posterSrc}
            prompt={video.prompt}
            isLcp={isFirst}
            sizes={posterSizes}
          />
          {video.hasAudio ? <AudioEqualizerBadge tone="light" size="sm" label="Audio available on playback" /> : null}
          <CardOverlay video={video} />
          <Link
            href={videoDetailHref}
            locale={false}
            className="pointer-events-auto absolute right-3 top-3 inline-flex items-center rounded-full bg-black/60 px-3 py-1 text-xs font-semibold uppercase tracking-micro text-white transition hover:bg-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40"
            aria-label={`Open video detail for ${video.engineLabel}`}
          >
            Open
          </Link>
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
}: {
  videoUrl: string | null;
  posterUrl: string | null;
  prompt: string;
  isLcp: boolean;
  sizes: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(isLcp);
  const [isActive, setIsActive] = useState(isLcp);
  const [isPosterVisible, setIsPosterVisible] = useState(true);

  useEffect(() => {
    if (!videoUrl) return undefined;
    const node = videoRef.current;
    if (!node) return undefined;
    return runAfterIdle(() => {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting || entry.intersectionRatio > 0) {
              setShouldLoad(true);
            }
            setIsActive(entry.isIntersecting || entry.intersectionRatio > 0);
          });
        },
        { rootMargin: isLcp ? '0px' : '300px 0px', threshold: 0.1 }
      );
      observer.observe(node);
      return () => observer.disconnect();
    });
  }, [videoUrl, isLcp]);

  useEffect(() => {
    const node = videoRef.current;
    if (!node || !videoUrl) return;
    node.defaultMuted = true;
    node.muted = true;
    node.playsInline = true;
    node.autoplay = true;
    const loadVideo = () => {
      if (node.getAttribute('data-loaded-src') === videoUrl) {
        return Promise.resolve();
      }
      node.preload = 'auto';
      node.src = videoUrl;
      node.load();
      node.setAttribute('data-loaded-src', videoUrl);
      return new Promise<void>((resolve) => {
        const onLoaded = () => {
          node.removeEventListener('canplay', onLoaded);
          resolve();
        };
        node.addEventListener('canplay', onLoaded, { once: true });
      });
    };
    const playVideo = () => {
      const promise = node.play();
      if (promise && typeof promise.catch === 'function') {
        promise.catch(() => undefined);
      }
    };
    if (shouldLoad && isActive) {
      loadVideo().then(playVideo);
    }
  }, [shouldLoad, isActive, videoUrl]);

  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;
    const handlePlaying = () => setIsPosterVisible(false);
    const handlePause = () => {
      if (!shouldLoad) {
        setIsPosterVisible(true);
      }
    };
    node.addEventListener('playing', handlePlaying);
    node.addEventListener('pause', handlePause);
    return () => {
      node.removeEventListener('playing', handlePlaying);
      node.removeEventListener('pause', handlePause);
    };
  }, [shouldLoad]);

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
        alt={prompt}
        fill
        className="object-cover"
        priority={isLcp}
        fetchPriority={isLcp ? 'high' : undefined}
        loading={isLcp ? 'eager' : 'lazy'}
        decoding="async"
        quality={80}
        sizes={sizes}
      />
    );
  }

  return (
    <>
      {posterUrl ? (
        <Image
          src={posterUrl}
          alt={prompt}
          fill
          className={clsx(
            'pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-300',
            isPosterVisible ? 'opacity-100' : 'opacity-0'
          )}
          priority={isLcp}
          fetchPriority={isLcp ? 'high' : undefined}
          loading={isLcp ? 'eager' : 'lazy'}
          decoding="async"
          quality={80}
          sizes={sizes}
          aria-hidden
        />
      ) : null}
      <video
        ref={videoRef}
        className={clsx('pointer-events-none absolute inset-0 z-10 h-full w-full object-cover transition duration-300', {
          'opacity-100': shouldLoad,
          'opacity-0': !shouldLoad,
        })}
        playsInline
        autoPlay
        muted
        loop
        preload="none"
        poster={posterUrl ?? undefined}
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
