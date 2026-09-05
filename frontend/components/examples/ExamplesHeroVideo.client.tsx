'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';

import { usePublicVideoPlayback } from '@/components/media/usePublicVideoPlayback';
import { isCrawlerUserAgent } from '@/lib/crawler-user-agent';

type ExamplesHeroVideoProps = {
  src: string;
  type: string;
  poster?: string | null;
  className?: string;
  ariaLabel: string;
  ariaHidden?: boolean;
  controls?: boolean;
  posterFit?: 'cover' | 'contain';
};

function shouldDisableHeroAutoplay(): boolean {
  if (typeof window === 'undefined') return true;
  if (isCrawlerUserAgent(navigator.userAgent)) return true;
  if (window.matchMedia?.('(max-width: 767px)')?.matches) return true;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return true;
  const connection = navigator as Navigator & { connection?: { saveData?: boolean } };
  return Boolean(connection.connection?.saveData);
}

export function ExamplesHeroVideo({
  src,
  type,
  poster,
  className,
  ariaLabel,
  ariaHidden = false,
  controls = true,
  posterFit = 'cover',
}: ExamplesHeroVideoProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const userPausedRef = useRef(false);
  const environmentPauseRef = useRef(false);
  const playIntendedRef = useRef(false);
  const manualPlayPendingRef = useRef(false);
  const manualPlaybackRef = useRef(false);
  const programmaticPlayRef = useRef(false);
  const playGenerationRef = useRef(0);
  const [showPosterOverlay, setShowPosterOverlay] = useState(Boolean(poster));
  const {
    attempt, terminalError, begin, fail, setContext,
    measureNode, measurePlaying, measureWaiting, measurePause, restartMeasurement,
  } = usePublicVideoPlayback('examples');
  const playbackAttempt = attempt?.rendition.originalSrc === src ? attempt : null;
  const posterStyle = useMemo(() => poster ? { objectFit: posterFit } : undefined, [poster, posterFit]);

  useEffect(() => {
    userPausedRef.current = false;
    playIntendedRef.current = false;
    manualPlayPendingRef.current = false;
    manualPlaybackRef.current = false;
    begin(src, 'automatic', { force: true });
  }, [begin, src]);

  useEffect(() => {
    const node = videoRef.current;
    const container = containerRef.current;
    if (!node || !container || !playbackAttempt) return;
    measureNode(node);

    let inView = true;
    const generation = ++playGenerationRef.current;
    let autoplayDisabled = shouldDisableHeroAutoplay();
    let loadingRequested = false;
    environmentPauseRef.current = false;
    setShowPosterOverlay(Boolean(poster));

    const visibleNow = () => inView && document.visibilityState !== 'hidden';
    const pauseForEnvironment = () => {
      setContext({ visible: false });
      measurePause();
      if (node.paused) return;
      environmentPauseRef.current = true;
      node.pause();
    };
    const tryPlay = () => {
      if (videoRef.current !== node || userPausedRef.current || !playIntendedRef.current || !visibleNow()) return;
      programmaticPlayRef.current = true;
      const playPromise = node.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        void playPromise.catch(() => {
          if (playGenerationRef.current === generation && videoRef.current === node) {
            programmaticPlayRef.current = false;
          }
        });
      }
    };
    const requestAutomaticLoad = () => {
      if (loadingRequested) return;
      loadingRequested = true;
      node.load();
    };
    const syncPlayback = () => {
      if ((autoplayDisabled && !manualPlaybackRef.current) || !visibleNow()) {
        pauseForEnvironment();
        return;
      }
      setContext({ visible: true });
      if (userPausedRef.current) return;
      if (!playIntendedRef.current) {
        playIntendedRef.current = true;
        restartMeasurement('automatic');
        setContext({ intended: true });
      }
      if (manualPlayPendingRef.current) {
        manualPlayPendingRef.current = false;
        playIntendedRef.current = true;
        setContext({ intended: true });
      }
      if (node.readyState < node.HAVE_CURRENT_DATA) {
        requestAutomaticLoad();
        return;
      }
      tryPlay();
    };

    if (manualPlayPendingRef.current && visibleNow()) {
      manualPlayPendingRef.current = false;
      loadingRequested = true;
      node.load();
      tryPlay();
    }

    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const mobileQuery = window.matchMedia?.('(max-width: 767px)');
    const handleAutoplayPreferenceChange = () => {
      autoplayDisabled = shouldDisableHeroAutoplay();
      syncPlayback();
    };
    motionQuery?.addEventListener?.('change', handleAutoplayPreferenceChange);
    mobileQuery?.addEventListener?.('change', handleAutoplayPreferenceChange);

    const observer = new IntersectionObserver((entries) => {
      inView = entries.some((entry) => entry.isIntersecting);
      syncPlayback();
    }, { threshold: 0.55 });
    observer.observe(container);
    const handleVisibilityChange = () => syncPlayback();
    const handleLoadedData = () => syncPlayback();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    node.addEventListener('loadeddata', handleLoadedData);
    syncPlayback();

    return () => {
      playGenerationRef.current += 1;
      programmaticPlayRef.current = false;
      observer.disconnect();
      motionQuery?.removeEventListener?.('change', handleAutoplayPreferenceChange);
      mobileQuery?.removeEventListener?.('change', handleAutoplayPreferenceChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      node.removeEventListener('loadeddata', handleLoadedData);
      measurePause();
      if (!node.paused) environmentPauseRef.current = true;
      node.pause();
    };
  }, [measureNode, measurePause, playbackAttempt, poster, restartMeasurement, setContext]);

  const handleMediaError = (node: HTMLVideoElement, attemptId: number) => {
    if (videoRef.current !== node) return;
    setShowPosterOverlay(Boolean(poster));
    fail(attemptId, node.error?.code);
  };

  const retry = () => {
    userPausedRef.current = false;
    playIntendedRef.current = true;
    manualPlayPendingRef.current = true;
    manualPlaybackRef.current = true;
    setContext({ intended: true });
    begin(src, 'user', { force: true });
  };

  return (
    <div ref={containerRef} className="relative flex h-full w-full items-center justify-center overflow-hidden bg-surface-on-media-dark-5">
      {poster && showPosterOverlay ? (
        <Image
          src={poster}
          alt=""
          fill
          priority
          sizes="(max-width: 768px) 100vw, 920px"
          aria-hidden="true"
          className={`${className ?? ''} pointer-events-none absolute inset-0 z-10 transition-opacity duration-300`}
          style={posterStyle}
        />
      ) : null}
      {playbackAttempt ? (
        <video
          key={playbackAttempt.id}
          ref={videoRef}
          className={`${className ?? ''} absolute inset-0 z-20 transition-opacity duration-300 ${
            controls ? '' : ' pointer-events-none'
          } ${showPosterOverlay || terminalError ? 'opacity-0' : 'opacity-100'} ${terminalError ? 'pointer-events-none' : ''}`}
          muted
          loop
          controls={controls}
          preload="none"
          playsInline
          aria-label={ariaLabel}
          aria-hidden={ariaHidden || undefined}
          onPlay={() => {
            if (programmaticPlayRef.current) return;
            userPausedRef.current = false;
            playIntendedRef.current = true;
            manualPlaybackRef.current = true;
            restartMeasurement('user');
            setContext({ intended: true });
          }}
          onPlaying={(event) => {
            programmaticPlayRef.current = false;
            setShowPosterOverlay(false);
            measurePlaying(event.currentTarget);
          }}
          onWaiting={measureWaiting}
          onPause={() => {
            measurePause();
            programmaticPlayRef.current = false;
            if (environmentPauseRef.current) {
              environmentPauseRef.current = false;
              return;
            }
            userPausedRef.current = true;
            playIntendedRef.current = false;
            setContext({ intended: false });
          }}
          onError={(event) => handleMediaError(event.currentTarget, playbackAttempt.id)}
        >
          <source
            src={playbackAttempt.rendition.src}
            type={type}
            onError={(event) => {
              const node = event.currentTarget.parentElement;
              if (node && videoRef.current === node) handleMediaError(node as HTMLVideoElement, playbackAttempt.id);
            }}
          />
        </video>
      ) : null}
      {terminalError ? (
        <button
          type="button"
          onClick={retry}
          aria-label="Retry preview"
          className="absolute z-30 rounded-full border border-white/30 bg-black/70 px-4 py-2 text-sm font-semibold text-white"
        >
          Retry preview
        </button>
      ) : null}
    </div>
  );
}
