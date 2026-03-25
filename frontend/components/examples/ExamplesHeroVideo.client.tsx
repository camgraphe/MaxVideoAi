'use client';

import { useEffect, useRef } from 'react';

type ExamplesHeroVideoProps = {
  src: string;
  type: string;
  poster?: string | null;
  className?: string;
  ariaLabel: string;
};

function shouldDisableHeroAutoplay(): boolean {
  if (typeof window === 'undefined') return true;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return true;
  const connection = navigator as Navigator & {
    connection?: {
      saveData?: boolean;
    };
  };
  return Boolean(connection.connection?.saveData);
}

export function ExamplesHeroVideo({ src, type, poster, className, ariaLabel }: ExamplesHeroVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;

    let inView = true;
    let reduceMotion = shouldDisableHeroAutoplay();

    const syncPlayback = () => {
      if (!node) return;
      if (reduceMotion || !inView || document.visibilityState === 'hidden') {
        node.pause();
        return;
      }
      const playPromise = node.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        void playPromise.catch(() => undefined);
      }
    };

    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const handleMotionChange = () => {
      reduceMotion = shouldDisableHeroAutoplay();
      syncPlayback();
    };
    mediaQuery?.addEventListener?.('change', handleMotionChange);

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
    document.addEventListener('visibilitychange', handleVisibilityChange);

    syncPlayback();

    return () => {
      observer.disconnect();
      mediaQuery?.removeEventListener?.('change', handleMotionChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      node.pause();
    };
  }, []);

  return (
    <video
      ref={videoRef}
      className={className}
      muted
      loop
      controls
      preload="metadata"
      playsInline
      poster={poster ?? undefined}
      aria-label={ariaLabel}
    >
      <source src={src} type={type} />
    </video>
  );
}
