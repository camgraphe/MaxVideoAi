'use client';

import { useEffect, useState } from 'react';
import { PublicVideoQualitySelect } from './PublicVideoQualitySelect.client';
import { usePublicVideoControls } from './usePublicVideoControls';

const labels = {
  en: { error: 'Video unavailable.', retry: 'Retry' },
  fr: { error: 'Vidéo indisponible.', retry: 'Réessayer' },
  es: { error: 'Vídeo no disponible.', retry: 'Reintentar' },
};

/** Native comparison player: original fidelity remains the default. */
export function PublicVideoPlayer({ src, poster, title, className, locale = 'en', deferPoster = false }: {
  src: string;
  poster?: string | null;
  title: string;
  className?: string;
  locale?: string;
  deferPoster?: boolean;
}) {
  const { videoRef, events, quality, changeQuality, hasQualityChoice, terminalError, togglePlayback } =
    usePublicVideoControls(src, 'comparison', 'original');
  const copy = labels[locale as keyof typeof labels] ?? labels.en;
  const deferred = deferPoster && Boolean(poster);
  const posterIdentity = JSON.stringify([src, poster]);
  const [visiblePoster, setVisiblePoster] = useState<string | null>(null);
  useEffect(() => {
    if (!deferred) return;
    const node = videoRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisiblePoster(posterIdentity);
      return;
    }
    let active = true;
    const observer = new IntersectionObserver(entries => {
      if (active && videoRef.current === node && entries.some(entry => entry.target === node && entry.isIntersecting)) {
        setVisiblePoster(posterIdentity);
        observer.disconnect();
      }
    }, { rootMargin: '200px' });
    observer.observe(node);
    return () => { active = false; observer.disconnect(); };
  }, [deferred, posterIdentity, videoRef]);
  return (
    <>
      <video key={src} ref={videoRef} src={src} data-deferred-poster={deferred ? '' : undefined}
        poster={!deferred || visiblePoster === posterIdentity ? poster ?? undefined : undefined} controls preload="none"
        playsInline aria-label={title} className={className} {...events} />
      {deferred ? <noscript>
        <style>{'[data-deferred-poster] { display: none; }'}</style>
        <video src={src} poster={poster ?? undefined} controls preload="none" playsInline aria-label={title} className={className} />
      </noscript> : null}
      {hasQualityChoice ? (
        <div className="absolute right-2 top-2 z-10">
          <PublicVideoQualitySelect value={quality} onChange={changeQuality} title={title} locale={locale} />
        </div>
      ) : null}
      {terminalError ? (
        <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 p-4 text-sm text-white">
          <p>{copy.error}</p>
          <button type="button" aria-label={copy.retry} onClick={togglePlayback}
            className="min-h-11 rounded-lg border border-white/50 px-4 focus-visible:ring-2 focus-visible:ring-ring">
            {copy.retry}
          </button>
        </div>
      ) : null}
    </>
  );
}
