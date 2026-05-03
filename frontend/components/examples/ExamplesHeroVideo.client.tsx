'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';

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
  const connection = navigator as Navigator & {
    connection?: {
      saveData?: boolean;
    };
  };
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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [showPosterOverlay, setShowPosterOverlay] = useState(Boolean(poster));
  const posterStyle = useMemo(
    () =>
      poster
        ? {
            objectFit: posterFit,
          }
        : undefined,
    [poster, posterFit]
  );

  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;

    let inView = true;
    let reduceMotion = shouldDisableHeroAutoplay();
    let loadingRequested = false;
    setShowPosterOverlay(Boolean(poster));

    const syncPlayback = () => {
      if (!node) return;
      if (reduceMotion || !inView || document.visibilityState === 'hidden') {
        node.pause();
        return;
      }
      if (node.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        if (!loadingRequested) {
          loadingRequested = true;
          node.load();
        }
        return;
      }
      const playPromise = node.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        void playPromise.catch(() => undefined);
      }
    };

    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const mobileQuery = window.matchMedia?.('(max-width: 767px)');
    const handleAutoplayPreferenceChange = () => {
      reduceMotion = shouldDisableHeroAutoplay();
      syncPlayback();
    };
    motionQuery?.addEventListener?.('change', handleAutoplayPreferenceChange);
    mobileQuery?.addEventListener?.('change', handleAutoplayPreferenceChange);

    const observer = new IntersectionObserver(
      (entries) => {
        inView = entries.some((entry) => entry.isIntersecting);
        syncPlayback();
      },
      { threshold: 0.55 }
    );
    observer.observe(node);

    const handleVisibilityChange = () => {
      syncPlayback();
    };
    const handleLoadedData = () => {
      syncPlayback();
    };
    const handlePlaying = () => {
      setShowPosterOverlay(false);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    node.addEventListener('loadeddata', handleLoadedData);
    node.addEventListener('playing', handlePlaying);

    syncPlayback();

    return () => {
      observer.disconnect();
      motionQuery?.removeEventListener?.('change', handleAutoplayPreferenceChange);
      mobileQuery?.removeEventListener?.('change', handleAutoplayPreferenceChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      node.removeEventListener('loadeddata', handleLoadedData);
      node.removeEventListener('playing', handlePlaying);
      node.pause();
    };
  }, [poster]);

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-surface-on-media-dark-5">
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
      <video
        ref={videoRef}
        className={`${className ?? ''} absolute inset-0 z-20 transition-opacity duration-300 ${
          controls ? '' : ' pointer-events-none'
        } ${
          showPosterOverlay ? 'opacity-0' : 'opacity-100'
        }`}
        muted
        loop
        controls={controls}
        preload="none"
        playsInline
        poster={poster ?? undefined}
        aria-label={ariaLabel}
        aria-hidden={ariaHidden || undefined}
      >
        <source src={src} type={type} />
      </video>
    </div>
  );
}
