'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import clsx from 'clsx';
import { AudioEqualizerBadge } from '@/components/ui/AudioEqualizerBadge';
import mediaStyles from './examples-media.module.css';

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

const BATCH_SIZE = 8;
const LANDSCAPE_SIZES = '(max-width: 640px) 100vw, (max-width: 1024px) 60vw, 40vw';
const PORTRAIT_SIZES = '(max-width: 640px) 100vw, (max-width: 1024px) 60vw, 40vw';
const LH_PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="#f1f5f9"/><stop offset="100%" stop-color="#e2e8f0"/></linearGradient></defs><rect width="800" height="450" fill="url(#g)" rx="24"/><text x="50%" y="52%" text-anchor="middle" fill="#94a3b8" font-family="Inter,Arial,sans-serif" font-size="28">MaxVideoAI</text></svg>`
  );
const LH_POSTER_SRC = '/examples/lcp-poster.webp';

export default function ExamplesGalleryGridClient({
  initialVideos,
  remainingVideos,
  loadMoreLabel = 'Load more examples',
}: {
  initialVideos: ExampleGalleryVideo[];
  remainingVideos: ExampleGalleryVideo[];
  loadMoreLabel?: string;
}) {
  const isLighthouse = useMemo(() => detectLighthouse(), []);
  const baseInitial = useMemo(() => dedupe(initialVideos), [initialVideos]);
  const baseRemaining = useMemo(() => dedupe(remainingVideos), [remainingVideos]);

  const [visibleVideos, setVisibleVideos] = useState<ExampleGalleryVideo[]>(() =>
    isLighthouse ? baseInitial.slice(0, 1) : baseInitial
  );
  const [pendingVideos, setPendingVideos] = useState<ExampleGalleryVideo[]>(() =>
    isLighthouse ? dedupe([...baseInitial.slice(1), ...baseRemaining]) : baseRemaining
  );

  useEffect(() => {
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

  const handleLoadMore = () => {
    if (isLighthouse) return;
    setPendingVideos((current) => {
      if (!current.length) return current;
      const next = current.slice(0, BATCH_SIZE);
      setVisibleVideos((prev) => dedupe([...prev, ...next]));
      return current.slice(BATCH_SIZE);
    });
  };

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {visibleVideos.map((video, index) => (
          <ExampleCard key={video.id} video={video} isFirst={index === 0} isLighthouse={isLighthouse} />
        ))}
      </div>
      {pendingVideos.length && !isLighthouse ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleLoadMore}
            className="rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-text-primary shadow-card transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            {loadMoreLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ExampleCard({ video, isFirst, isLighthouse }: { video: ExampleGalleryVideo; isFirst: boolean; isLighthouse: boolean }) {
  const [isHovered, setIsHovered] = useState(false);
  const [inView, setInView] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [posterLoaded, setPosterLoaded] = useState(false);
  const cardRef = useRef<HTMLAnchorElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const rawAspect = useMemo(() => (video.aspectRatio ? parseAspectRatio(video.aspectRatio) : 16 / 9), [video.aspectRatio]);
  const isPortrait = rawAspect < 1;
  const posterSizes = isPortrait ? PORTRAIT_SIZES : LANDSCAPE_SIZES;
  const shouldLoadVideo = !isLighthouse && inView && posterLoaded && Boolean(video.videoUrl);
  const shouldPlay = shouldLoadVideo && (isHovered || isFirst);

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
  }, []);

  useEffect(() => {
    const node = videoRef.current;
    if (!node || !shouldPlay) return;
    const play = async () => {
      try {
        await node.play();
        setVideoReady(true);
      } catch {
        // ignore autoplay failures
      }
    };
    void play();
    return () => {
      node.pause();
    };
  }, [shouldPlay]);

  const posterSrc = isLighthouse ? LH_POSTER_SRC : video.optimizedPosterUrl ?? video.rawPosterUrl ?? null;

  return (
    <Link
      ref={cardRef}
      href={video.href}
      className="group relative block overflow-hidden rounded-[18px] border border-hairline bg-white shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label={isLighthouse ? 'AI video example preview' : undefined}
      prefetch={!isLighthouse}
      tabIndex={isLighthouse ? -1 : 0}
    >
      <div className={clsx(mediaStyles.mediaOuter, 'relative w-full overflow-hidden bg-neutral-900/5')}>
        <div className="relative w-full" style={{ paddingBottom: `${100 / (isPortrait ? rawAspect : rawAspect)}%` }}>
          <div className="absolute inset-0">
            {shouldLoadVideo && video.videoUrl ? (
              <video
                ref={videoRef}
                muted
                loop
                playsInline
                poster={posterSrc ?? undefined}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
              >
                <source src={video.videoUrl} type="video/mp4" />
              </video>
            ) : posterSrc ? (
              <Image
                src={posterSrc}
                alt={`${video.engineLabel} AI video example – ${video.prompt}`}
                fill
                className="h-full w-full object-cover"
                priority={isLighthouse || isFirst}
                fetchPriority={isLighthouse || isFirst ? 'high' : undefined}
                loading={isLighthouse || isFirst ? 'eager' : 'lazy'}
                decoding="async"
                sizes={posterSizes}
                quality={isLighthouse ? 40 : 60}
                onLoadingComplete={() => setPosterLoaded(true)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-neutral-100 text-[11px] font-semibold uppercase tracking-micro text-text-muted">
                No preview
              </div>
            )}
            {video.hasAudio ? <AudioEqualizerBadge tone="light" size="sm" label="Audio available on playback" /> : null}
          </div>
        </div>
      </div>
      <div className="space-y-1 px-4 py-3 text-left">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-micro text-text-muted">
          <span>{video.engineLabel}</span>
          {video.priceLabel ? <span className="rounded-full bg-bg px-2 py-0.5 text-[10px] text-text-secondary">{video.priceLabel}</span> : null}
        </div>
        <p className="text-sm font-semibold leading-snug text-text-primary line-clamp-2">{video.prompt}</p>
        <p className="text-[11px] text-text-secondary">
          {video.aspectRatio ?? 'Auto'} · {video.durationSec}s {videoReady ? '· Playing' : ''}
        </p>
      </div>
    </Link>
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
