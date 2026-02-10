'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';

type ModelHeroMediaProps = {
  posterSrc: string | null;
  videoSrc?: string | null;
  alt: string;
  sizes: string;
  priority?: boolean;
  fetchPriority?: 'high' | 'low' | 'auto';
  quality?: number;
  className?: string;
  objectClassName?: string;
};

function shouldDisableVideo(): boolean {
  if (typeof window === 'undefined') return true;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return true;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return Boolean(connection?.saveData);
}

export function ModelHeroMedia({
  posterSrc,
  videoSrc,
  alt,
  sizes,
  priority = false,
  fetchPriority = 'auto',
  quality = 80,
  className,
  objectClassName,
}: ModelHeroMediaProps) {
  const idleIdRef = useRef<number | null>(null);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);

  const scheduleLoad = useCallback(() => {
    if (!videoSrc) return;
    if (shouldLoadVideo) return;
    if (shouldDisableVideo()) return;
    const load = () => setShouldLoadVideo(true);
    if ('requestIdleCallback' in window) {
      idleIdRef.current = window.requestIdleCallback(load, { timeout: 1000 });
    } else {
      load();
    }
  }, [shouldLoadVideo, videoSrc]);

  useEffect(() => {
    return () => {
      if (idleIdRef.current != null) {
        window.cancelIdleCallback?.(idleIdRef.current);
      }
    };
  }, []);

  const isClickable = Boolean(videoSrc) && !shouldLoadVideo;
  const rootClassName = [className, isClickable ? 'cursor-pointer' : null].filter(Boolean).join(' ');

  return (
    <div className={rootClassName}>
      {posterSrc ? (
        <Image
          src={posterSrc}
          alt={alt}
          fill
          className={objectClassName ?? 'absolute inset-0 h-full w-full object-cover'}
          sizes={sizes}
          quality={quality}
          priority={priority}
          fetchPriority={fetchPriority}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-surface-2 text-sm font-semibold text-text-muted">
          {alt}
        </div>
      )}
      {videoSrc && shouldLoadVideo ? (
        <video
          className={objectClassName ?? 'absolute inset-0 h-full w-full object-cover'}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={posterSrc ?? undefined}
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      ) : null}
      {videoSrc && !shouldLoadVideo ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            type="button"
            onClick={scheduleLoad}
            aria-label="Play preview"
            className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-hairline bg-surface/90 text-text-primary shadow-card backdrop-blur-sm transition hover:-translate-y-0.5"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className="fill-current">
              <path d="M8 5.5v13l11-6.5-11-6.5z" />
            </svg>
          </button>
        </div>
      ) : null}
    </div>
  );
}
