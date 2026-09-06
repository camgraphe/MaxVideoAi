'use client';

import { PublicVideoQualitySelect } from './PublicVideoQualitySelect';
import { usePublicVideoControls } from './usePublicVideoControls';

const labels = {
  en: { error: 'Video unavailable.', retry: 'Retry' },
  fr: { error: 'Vidéo indisponible.', retry: 'Réessayer' },
  es: { error: 'Vídeo no disponible.', retry: 'Reintentar' },
};

/** Native comparison player: original fidelity remains the default. */
export function PublicVideoPlayer({ src, poster, title, className, locale = 'en' }: {
  src: string;
  poster?: string | null;
  title: string;
  className?: string;
  locale?: string;
}) {
  const { videoRef, events, quality, changeQuality, hasQualityChoice, terminalError, togglePlayback } =
    usePublicVideoControls(src, 'comparison', 'original');
  const copy = labels[locale as keyof typeof labels] ?? labels.en;
  return (
    <>
      <video key={src} ref={videoRef} src={src} poster={poster ?? undefined} controls preload="none"
        playsInline aria-label={title} className={className} {...events} />
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
