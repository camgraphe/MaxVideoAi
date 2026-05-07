import Image from 'next/image';
import clsx from 'clsx';
import { getImageAlt } from '@/lib/image-alt';
import type { ShowdownSide } from '../_lib/compare-page-types';

export function renderShowdownMedia(
  side: ShowdownSide,
  fallbackLabel: string,
  placeholderLabel: string,
  noPreviewLabel: string,
  aspectRatio?: string,
  mediaAlt?: string
) {
  const label = side.label ?? fallbackLabel;
  const altText =
    mediaAlt ??
    getImageAlt({
      kind: 'renderThumb',
      engine: label,
      label,
      locale: 'en',
    });
  const emptyLabel = side.placeholder ? placeholderLabel : noPreviewLabel;
  const isPortrait = aspectRatio === '9:16';
  const mediaClass = isPortrait ? 'object-contain' : 'object-cover';
  return (
    <div className="stack-gap-sm">
      <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{label}</p>
      <div
        className={clsx(
          'relative aspect-video overflow-hidden rounded-card border border-hairline',
          isPortrait ? 'bg-black/10 dark:bg-black/40' : 'bg-placeholder'
        )}
      >
        {side.videoUrl ? (
          <video
            className={clsx('h-full w-full', mediaClass)}
            controls
            preload="none"
            poster={side.posterUrl}
            playsInline
            aria-label={altText}
          >
            <source src={side.videoUrl} />
          </video>
        ) : side.posterUrl ? (
          <Image
            src={side.posterUrl}
            alt={altText}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className={clsx('h-full w-full', mediaClass)}
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-text-muted">
            {emptyLabel}
          </div>
        )}
      </div>
    </div>
  );
}
