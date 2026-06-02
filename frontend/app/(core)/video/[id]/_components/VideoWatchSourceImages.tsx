import { ImageIcon } from 'lucide-react';
import type { WatchPageSourceImage } from '@/server/watch-page-signals';
import { toAbsoluteUrl } from '../_lib/video-watch-page-utils';
import { VideoWatchCard } from './VideoWatchCard';
import { VideoWatchSourceImagesClient, type WatchSourceImageItem } from './VideoWatchSourceImages.client';

export function VideoWatchSourceImages({
  title,
  sourceImages,
}: {
  title: string;
  sourceImages: WatchPageSourceImage[];
}) {
  if (!sourceImages.length) return null;
  const images: WatchSourceImageItem[] = sourceImages.map((sourceImage) => ({
    ...sourceImage,
    imageUrl: toAbsoluteUrl(sourceImage.url) ?? sourceImage.url,
  }));

  return (
    <VideoWatchCard className="p-5 sm:p-6">
      <div className="inline-flex items-center gap-2">
        <ImageIcon className="h-4 w-4 text-brand" aria-hidden />
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
      </div>
      <VideoWatchSourceImagesClient images={images} />
    </VideoWatchCard>
  );
}
