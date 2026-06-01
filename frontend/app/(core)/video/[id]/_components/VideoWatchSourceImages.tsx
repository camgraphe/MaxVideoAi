/* eslint-disable @next/next/no-img-element */
import { ImageIcon } from 'lucide-react';
import type { WatchPageSourceImage } from '@/server/watch-page-signals';
import { toAbsoluteUrl } from '../_lib/video-watch-page-utils';
import { VideoWatchCard } from './VideoWatchCard';

export function VideoWatchSourceImages({
  title,
  sourceImages,
}: {
  title: string;
  sourceImages: WatchPageSourceImage[];
}) {
  if (!sourceImages.length) return null;

  return (
    <VideoWatchCard className="p-5 sm:p-6">
      <div className="inline-flex items-center gap-2">
        <ImageIcon className="h-4 w-4 text-brand" aria-hidden />
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {sourceImages.map((sourceImage) => {
          const imageUrl = toAbsoluteUrl(sourceImage.url) ?? sourceImage.url;
          return (
            <figure key={sourceImage.key} className="overflow-hidden rounded-input border border-hairline bg-surface-2">
              <div className="aspect-square bg-bg">
                <img src={imageUrl} alt={sourceImage.alt} loading="lazy" className="h-full w-full object-cover" />
              </div>
              <figcaption className="px-3 py-2 text-xs font-semibold text-text-secondary">{sourceImage.label}</figcaption>
            </figure>
          );
        })}
      </div>
    </VideoWatchCard>
  );
}
