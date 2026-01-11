'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { buildOptimizedPosterUrl } from '@/lib/media-helpers';

type FeaturedMedia = {
  videoUrl: string | null;
  posterUrl: string | null;
  posterOptimizedUrl?: string | null;
  durationSec?: number | null;
  hasAudio?: boolean;
  prompt?: string | null;
  href?: string | null;
  aspectRatio?: string | null;
};

export function MediaPreview({
  media,
  label,
  priority = false,
}: {
  media: FeaturedMedia;
  label: string;
  priority?: boolean;
}) {
  const posterSrc = media.posterUrl ?? null;
  const videoPosterSrc =
    media.posterOptimizedUrl ??
    (posterSrc ? buildOptimizedPosterUrl(posterSrc, { width: 1200, quality: 70 }) : null);
  const aspect = media.aspectRatio ?? '16:9';
  const [w, h] = aspect.split(':').map(Number);
  const isValidAspect = Number.isFinite(w) && Number.isFinite(h) && h > 0 && w > 0;
  const paddingBottom = isValidAspect ? `${(h / w) * 100}%` : '56.25%';
  const isVertical = isValidAspect ? w < h : false;
  const figureClassName = [
    'group relative overflow-hidden rounded-[22px] border border-hairline bg-white shadow-card',
    isVertical ? 'mx-auto max-w-sm' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [posterLoaded, setPosterLoaded] = useState(false);
  const [inView, setInView] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    if (!posterSrc) {
      setPosterLoaded(true);
    }
  }, [posterSrc]);

  useEffect(() => {
    if (!media.videoUrl) return;
    const node = containerRef.current;
    if (!node) return;
    if (!('IntersectionObserver' in window)) {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [media.videoUrl]);

  const shouldLoadVideo = useMemo(() => Boolean(media.videoUrl) && inView && posterLoaded, [media.videoUrl, inView, posterLoaded]);

  return (
    <figure className={figureClassName} ref={containerRef}>
      <div className="relative w-full overflow-hidden rounded-t-[22px] bg-neutral-100">
        <div className="relative w-full" style={{ paddingBottom }}>
          <div className="absolute inset-0">
            {posterSrc ? (
              <Image
                src={posterSrc}
                alt={media.prompt ? `Sora 2 preview – ${media.prompt}` : label}
                fill
                className="h-full w-full object-cover"
                sizes="(max-width: 768px) 100vw, 720px"
                quality={80}
                priority={priority}
                fetchPriority={priority ? 'high' : undefined}
                loading={priority ? 'eager' : 'lazy'}
                onLoadingComplete={() => setPosterLoaded(true)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-neutral-50 text-sm font-semibold text-text-muted">
                Sora 2 preview
              </div>
            )}
            {shouldLoadVideo && media.videoUrl ? (
              <video
                className={[
                  'absolute inset-0 h-full w-full object-cover transition-opacity duration-500',
                  videoReady ? 'opacity-100' : 'opacity-0',
                ].join(' ')}
                autoPlay
                muted
                loop
                playsInline
                preload="none"
                poster={videoPosterSrc ?? undefined}
                onCanPlay={() => setVideoReady(true)}
              >
                <source src={media.videoUrl} type="video/mp4" />
              </video>
            ) : null}
            {media.hasAudio ? (
              <span className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-micro text-white">
                Audio on
              </span>
            ) : null}
            {media.durationSec ? (
              <span className="absolute right-3 top-3 rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-micro text-text-primary shadow-card">
                {media.durationSec}s
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <figcaption className="space-y-1 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{label}</p>
        {media.prompt ? <p className="text-sm font-semibold leading-snug text-text-primary">{media.prompt}</p> : null}
        {media.href ? (
          <Link
            href={media.href}
            className="inline-flex items-center text-xs font-semibold text-accent transition hover:text-accentSoft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            View render →
          </Link>
        ) : null}
      </figcaption>
    </figure>
  );
}
