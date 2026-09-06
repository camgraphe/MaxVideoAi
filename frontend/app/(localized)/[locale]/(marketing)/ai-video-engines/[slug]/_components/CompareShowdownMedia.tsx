import Image from 'next/image';
import clsx from 'clsx';
import { getImageAlt } from '@/lib/image-alt';
import { buildPublicVideoPosterUrl } from '@/lib/media-helpers';
import { PublicVideoPlayer } from '@/components/media/PublicVideoPlayer.client';
import type { ShowdownSide } from '../_lib/compare-page-types';

export function renderShowdownMedia(
  side: ShowdownSide,
  fallbackLabel: string,
  placeholderLabel: string,
  noPreviewLabel: string,
  aspectRatio?: string,
  mediaAlt?: string,
  locale = 'en'
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
          <PublicVideoPlayer
            className={clsx('h-full w-full', mediaClass)}
            src={side.videoUrl}
            poster={buildPublicVideoPosterUrl(side.posterUrl)}
            title={altText}
            locale={locale}
          />
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
