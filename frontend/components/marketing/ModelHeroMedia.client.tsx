'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';

import { usePublicVideoPlayback } from '@/components/media/usePublicVideoPlayback';
import { isCrawlerUserAgent } from '@/lib/crawler-user-agent';

type ModelHeroMediaProps = {
  posterSrc: string | null;
  videoSrc?: string | null;
  alt: string;
  sizes: string;
  autoPlayDelayMs?: number;
  waitForLcp?: boolean;
  showPlayButton?: boolean | 'when-autoplay-disabled';
  priority?: boolean;
  fetchPriority?: 'high' | 'low' | 'auto';
  quality?: number;
  className?: string;
  objectClassName?: string;
};

function shouldDisableAutoPlay(): boolean {
  if (typeof window === 'undefined') return true;
  if (isCrawlerUserAgent(navigator.userAgent)) return true;
  if (window.matchMedia?.('(max-width: 767px)')?.matches) return true;
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const idleIdRef = useRef<number | null>(null);
  const timerIdRef = useRef<number | null>(null);
  const lcpQuietTimerRef = useRef<number | null>(null);
  const lcpHardTimeoutRef = useRef<number | null>(null);
  const lcpReadyRef = useRef(false);
  const lcpObserverRef = useRef<PerformanceObserver | null>(null);
  const playerVisibleRef = useRef(true);
  const documentVisibleRef = useRef(true);
  const userPausedRef = useRef(false);
  const environmentPauseRef = useRef(false);
  const playIntendedRef = useRef(false);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [autoPlayDisabled, setAutoPlayDisabled] = useState(false);
  const {
    attempt, terminalError, begin, fail, setContext,
    measureNode, measurePlaying, measureWaiting, measurePause,
  } = usePublicVideoPlayback('model');
  const playbackAttempt = attempt?.rendition.originalSrc === videoSrc ? attempt : null;

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

  const requestPlayback = useCallback((trigger: 'user' | 'automatic', force = false) => {
    if (!videoSrc || (shouldLoadVideo && !force)) return;
    clearScheduledLoad();
    const load = () => {
      userPausedRef.current = false;
      playIntendedRef.current = true;
      setContext({ intended: true });
      begin(videoSrc, trigger, { force });
      setIsVideoReady(false);
      setShouldLoadVideo(true);
    };
    if (trigger === 'user') load();
    else if ('requestIdleCallback' in window) idleIdRef.current = window.requestIdleCallback(load, { timeout: 1000 });
    else load();
  }, [begin, clearScheduledLoad, setContext, shouldLoadVideo, videoSrc]);

  useEffect(() => {
    if (!videoSrc || !autoPlayDelayMs || autoPlayDelayMs <= 0 || shouldLoadVideo) return;
    const disabled = shouldDisableAutoPlay();
    setAutoPlayDisabled(disabled);
    if (disabled || timerIdRef.current != null) return;
    lcpReadyRef.current = false;

    const startDelayedLoad = () => {
      if (timerIdRef.current != null) return;
      timerIdRef.current = window.setTimeout(() => {
        timerIdRef.current = null;
        requestPlayback('automatic');
      }, autoPlayDelayMs);
    };
    if (!waitForLcp) {
      startDelayedLoad();
      return clearScheduledLoad;
    }
    const settleLcp = () => {
      if (lcpReadyRef.current) return;
      lcpReadyRef.current = true;
      if (lcpQuietTimerRef.current != null) window.clearTimeout(lcpQuietTimerRef.current);
      if (lcpHardTimeoutRef.current != null) window.clearTimeout(lcpHardTimeoutRef.current);
      lcpQuietTimerRef.current = null;
      lcpHardTimeoutRef.current = null;
      lcpObserverRef.current?.disconnect();
      lcpObserverRef.current = null;
      startDelayedLoad();
    };
    const resetQuietTimer = () => {
      if (lcpQuietTimerRef.current != null) window.clearTimeout(lcpQuietTimerRef.current);
      lcpQuietTimerRef.current = window.setTimeout(settleLcp, 900);
    };
    lcpHardTimeoutRef.current = window.setTimeout(settleLcp, 3500);
    resetQuietTimer();
    if ('PerformanceObserver' in window && PerformanceObserver.supportedEntryTypes?.includes('largest-contentful-paint')) {
      try {
        lcpObserverRef.current = new PerformanceObserver(resetQuietTimer);
        lcpObserverRef.current.observe({ type: 'largest-contentful-paint', buffered: true });
      } catch {
        // Timers remain the fallback when LCP observation is unavailable.
      }
    }
    return clearScheduledLoad;
  }, [autoPlayDelayMs, clearScheduledLoad, requestPlayback, shouldLoadVideo, videoSrc, waitForLcp]);

  const tryPlay = useCallback((node: HTMLVideoElement) => {
    if (
      videoRef.current !== node || userPausedRef.current || !playIntendedRef.current
      || !playerVisibleRef.current || !documentVisibleRef.current
    ) return;
    void node.play().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!shouldLoadVideo || !playbackAttempt) return;
    const node = videoRef.current;
    if (!node) return;
    measureNode(node);
    setIsVideoReady(false);
    if (node.readyState >= node.HAVE_CURRENT_DATA) {
      setIsVideoReady(true);
      tryPlay(node);
      return;
    }
    const handleLoadedData = () => tryPlay(node);
    node.addEventListener('loadeddata', handleLoadedData, { once: true });
    return () => node.removeEventListener('loadeddata', handleLoadedData);
  }, [measureNode, playbackAttempt, shouldLoadVideo, tryPlay]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    documentVisibleRef.current = document.visibilityState !== 'hidden';
    const syncVisible = () => setContext({ visible: playerVisibleRef.current && documentVisibleRef.current });
    const suspend = () => {
      const node = videoRef.current;
      if (!node) return;
      measurePause();
      if (node.paused) return;
      environmentPauseRef.current = true;
      node.pause();
    };
    const observer = typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver(([entry]) => {
          playerVisibleRef.current = Boolean(entry?.isIntersecting);
          syncVisible();
          if (!playerVisibleRef.current) suspend();
          else if (videoRef.current) tryPlay(videoRef.current);
        }, { threshold: 0.01 });
    observer?.observe(container);
    const handleVisibility = () => {
      documentVisibleRef.current = document.visibilityState !== 'hidden';
      syncVisible();
      if (!documentVisibleRef.current) suspend();
      else if (videoRef.current) tryPlay(videoRef.current);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [measurePause, setContext, tryPlay]);

  useEffect(() => clearScheduledLoad, [clearScheduledLoad]);

  const handleMediaError = (node: HTMLVideoElement, attemptId: number) => {
    if (videoRef.current !== node) return;
    setIsVideoReady(false);
    fail(attemptId, node.error?.code);
  };
  const mediaClassName = ['absolute inset-0 h-full w-full object-cover', objectClassName].filter(Boolean).join(' ');
  const normalizedVideoSrc = (playbackAttempt?.rendition.src ?? videoSrc ?? '').toLowerCase();
  const sourceType = normalizedVideoSrc.includes('.webm') ? 'video/webm' : 'video/mp4';
  const shouldShowPlayButton = Boolean(videoSrc) && (
    terminalError || (!shouldLoadVideo && (
      showPlayButton === true || (showPlayButton === 'when-autoplay-disabled' && autoPlayDisabled)
    ))
  );

  return (
    <div ref={containerRef} className={className}>
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
      {videoSrc && shouldLoadVideo && playbackAttempt ? (
        <video
          key={playbackAttempt.id}
          ref={videoRef}
          className={`${mediaClassName} ${isVideoReady && !terminalError ? 'opacity-100' : 'opacity-0'}`}
          muted
          loop
          playsInline
          preload="metadata"
          onLoadedData={(event) => {
            setIsVideoReady(true);
            tryPlay(event.currentTarget);
          }}
          onPlaying={(event) => measurePlaying(event.currentTarget)}
          onWaiting={measureWaiting}
          onPause={() => {
            measurePause();
            if (environmentPauseRef.current) {
              environmentPauseRef.current = false;
              return;
            }
            userPausedRef.current = true;
            playIntendedRef.current = false;
            setContext({ intended: false });
          }}
          onEmptied={() => setIsVideoReady(false)}
          onError={(event) => handleMediaError(event.currentTarget, playbackAttempt.id)}
          aria-label={alt}
        >
          <source
            src={playbackAttempt.rendition.src}
            type={sourceType}
            onError={(event) => {
              const node = event.currentTarget.parentElement;
              if (node && videoRef.current === node) handleMediaError(node as HTMLVideoElement, playbackAttempt.id);
            }}
          />
        </video>
      ) : null}
      {shouldShowPlayButton ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            type="button"
            onClick={() => requestPlayback('user', terminalError)}
            aria-label={terminalError ? 'Retry preview' : 'Play preview'}
            className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.24] bg-[rgba(7,17,31,0.82)] text-white shadow-[0_14px_36px_rgba(0,0,0,0.28)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-[rgba(7,17,31,0.92)]"
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
