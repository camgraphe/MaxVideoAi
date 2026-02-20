'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';

type ModelHeroMediaProps = {
  posterSrc: string | null;
  videoSrc?: string | null;
  alt: string;
  sizes: string;
  autoPlayDelayMs?: number;
  waitForLcp?: boolean;
  showPlayButton?: boolean;
  priority?: boolean;
  fetchPriority?: 'high' | 'low' | 'auto';
  quality?: number;
  className?: string;
  objectClassName?: string;
};

function shouldDisableAutoPlay(): boolean {
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
  autoPlayDelayMs,
  waitForLcp = false,
  showPlayButton = true,
  priority = false,
  fetchPriority = 'auto',
  quality = 80,
  className,
  objectClassName,
}: ModelHeroMediaProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const idleIdRef = useRef<number | null>(null);
  const timerIdRef = useRef<number | null>(null);
  const lcpQuietTimerRef = useRef<number | null>(null);
  const lcpHardTimeoutRef = useRef<number | null>(null);
  const lcpReadyRef = useRef(false);
  const lcpObserverRef = useRef<PerformanceObserver | null>(null);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);

  const clearScheduledLoad = useCallback(() => {
    if (idleIdRef.current != null) {
      window.cancelIdleCallback?.(idleIdRef.current);
      idleIdRef.current = null;
    }
    if (timerIdRef.current != null) {
      window.clearTimeout(timerIdRef.current);
      timerIdRef.current = null;
    }
    if (lcpQuietTimerRef.current != null) {
      window.clearTimeout(lcpQuietTimerRef.current);
      lcpQuietTimerRef.current = null;
    }
    if (lcpHardTimeoutRef.current != null) {
      window.clearTimeout(lcpHardTimeoutRef.current);
      lcpHardTimeoutRef.current = null;
    }
    lcpObserverRef.current?.disconnect();
    lcpObserverRef.current = null;
    lcpReadyRef.current = false;
  }, []);

  const scheduleLoad = useCallback((immediate = false) => {
    if (!videoSrc) return;
    if (shouldLoadVideo) return;
    clearScheduledLoad();
    const load = () => setShouldLoadVideo(true);
    if (immediate) {
      load();
      return;
    }
    if ('requestIdleCallback' in window) {
      idleIdRef.current = window.requestIdleCallback(load, { timeout: 1000 });
    } else {
      load();
    }
  }, [clearScheduledLoad, shouldLoadVideo, videoSrc]);

  useEffect(() => {
    if (!videoSrc) return;
    if (!autoPlayDelayMs || autoPlayDelayMs <= 0) return;
    if (shouldLoadVideo) return;
    if (shouldDisableAutoPlay()) return;
    if (timerIdRef.current != null) return;
    lcpReadyRef.current = false;

    const startDelayedLoad = () => {
      if (timerIdRef.current != null) return;
      timerIdRef.current = window.setTimeout(() => {
        timerIdRef.current = null;
        scheduleLoad();
      }, autoPlayDelayMs);
    };

    if (!waitForLcp) {
      startDelayedLoad();
      return clearScheduledLoad;
    }

    const settleLcp = () => {
      if (lcpReadyRef.current) return;
      lcpReadyRef.current = true;
      if (lcpQuietTimerRef.current != null) {
        window.clearTimeout(lcpQuietTimerRef.current);
        lcpQuietTimerRef.current = null;
      }
      if (lcpHardTimeoutRef.current != null) {
        window.clearTimeout(lcpHardTimeoutRef.current);
        lcpHardTimeoutRef.current = null;
      }
      lcpObserverRef.current?.disconnect();
      lcpObserverRef.current = null;
      startDelayedLoad();
    };

    const resetQuietTimer = () => {
      if (lcpQuietTimerRef.current != null) {
        window.clearTimeout(lcpQuietTimerRef.current);
      }
      lcpQuietTimerRef.current = window.setTimeout(settleLcp, 900);
    };

    lcpHardTimeoutRef.current = window.setTimeout(settleLcp, 3500);
    resetQuietTimer();

    if ('PerformanceObserver' in window && PerformanceObserver.supportedEntryTypes?.includes('largest-contentful-paint')) {
      try {
        lcpObserverRef.current = new PerformanceObserver(() => {
          resetQuietTimer();
        });
        lcpObserverRef.current.observe({ type: 'largest-contentful-paint', buffered: true });
      } catch {
        // Ignore observer setup issues and rely on timers.
      }
    }

    return clearScheduledLoad;
  }, [autoPlayDelayMs, clearScheduledLoad, scheduleLoad, shouldLoadVideo, videoSrc, waitForLcp]);

  useEffect(() => {
    if (!shouldLoadVideo) return;
    const node = videoRef.current;
    if (!node) return;
    const tryPlay = () => {
      void node.play().catch(() => {});
    };
    if (node.readyState >= 2) {
      tryPlay();
      return;
    }
    node.addEventListener('loadeddata', tryPlay, { once: true });
    return () => node.removeEventListener('loadeddata', tryPlay);
  }, [shouldLoadVideo]);

  useEffect(() => {
    return clearScheduledLoad;
  }, [clearScheduledLoad]);

  const mediaClassName = ['absolute inset-0 h-full w-full object-cover', objectClassName].filter(Boolean).join(' ');
  const normalizedVideoSrc = (videoSrc ?? '').toLowerCase();
  const sourceType = normalizedVideoSrc.includes('.webm') ? 'video/webm' : 'video/mp4';

  return (
    <div className={className}>
      {posterSrc ? (
        <Image
          src={posterSrc}
          alt={alt}
          fill
          className={mediaClassName}
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
          ref={videoRef}
          className={mediaClassName}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={posterSrc ?? undefined}
          aria-label={alt}
        >
          <source src={videoSrc} type={sourceType} />
        </video>
      ) : null}
      {videoSrc && !shouldLoadVideo && showPlayButton ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            type="button"
            onClick={() => scheduleLoad(true)}
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
