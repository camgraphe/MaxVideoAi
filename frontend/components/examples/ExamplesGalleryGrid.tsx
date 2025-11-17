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
  const aspectValue = useMemo(() => {
    const raw = video.aspectRatio ? parseAspectRatio(video.aspectRatio) : 16 / 9;
    const clamped = Math.min(Math.max(raw, 0.68), 1.35);
    return `${clamped} / 1`;
  }, [video.aspectRatio]);
  const posterSrc = video.optimizedPosterUrl ?? video.rawPosterUrl ?? null;

  return (
    <article className="group relative mb-[2px] break-inside-avoid overflow-hidden bg-neutral-900/5">
      <div className="relative">
        <div className="relative w-full overflow-hidden" style={{ aspectRatio: aspectValue }}>
          <MediaPreview
            videoUrl={video.videoUrl ?? null}
            posterUrl={posterSrc}
            prompt={video.prompt}
            isLcp={isFirst}
          />
          {video.hasAudio ? <AudioEqualizerBadge tone="light" size="sm" label="Audio available on playback" /> : null}
          <CardOverlay video={video} />
        </div>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Link
            href={`/video/${encodeURIComponent(video.id)}`}
            locale={false}
            className="pointer-events-auto inline-flex h-16 w-16 items-center justify-center text-white/30 transition hover:text-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
            aria-label="View this video"
          >
            <svg width="32" height="36" viewBox="0 0 18 20" fill="currentColor" aria-hidden>
              <path d="M16.5 9.134c1 0.577 1 2.155 0 2.732L2.5 20.014C1.5 20.59 0 19.812 0 18.548V2.452C0 1.188 1.5 0.41 2.5 0.986l14 8.148z" />
            </svg>
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
}: {
  videoUrl: string | null;
  posterUrl: string | null;
  prompt: string;
  isLcp: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(isLcp);
  const [isActive, setIsActive] = useState(isLcp);

  useEffect(() => {
    if (!videoUrl) return undefined;
    const node = videoRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldLoad(true);
          }
          setIsActive(entry.isIntersecting);
        });
      },
      { rootMargin: isLcp ? '0px' : '300px 0px', threshold: 0.35 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [videoUrl, isLcp]);

  useEffect(() => {
    const node = videoRef.current;
    if (!node || !videoUrl) return;
    if (shouldLoad && !node.src) {
      node.src = videoUrl;
      node.load();
    }
    if (!shouldLoad) return;
    if (isActive) {
      const playPromise = node.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => undefined);
      }
    } else {
      node.pause();
    }
  }, [shouldLoad, isActive, videoUrl]);

  const sizes = '(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 320px';

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
          className="absolute inset-0 h-full w-full object-cover"
          priority={isLcp}
          fetchPriority={isLcp ? 'high' : undefined}
          loading={isLcp ? 'eager' : 'lazy'}
          quality={80}
          sizes={sizes}
        />
      ) : null}
      <video
        ref={videoRef}
        className={clsx('absolute inset-0 z-10 h-full w-full object-cover transition duration-300', {
          'opacity-100': shouldLoad,
          'opacity-0': !shouldLoad,
        })}
        playsInline
        muted
        loop
        preload="none"
        poster={posterUrl ?? undefined}
      />
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
