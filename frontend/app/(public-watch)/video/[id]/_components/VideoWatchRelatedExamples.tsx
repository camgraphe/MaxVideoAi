import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { WatchPageData } from '../_lib/video-watch-page-utils';
import { VideoWatchCard } from './VideoWatchCard';

type VideoWatchRelatedExamplesProps = {
  related: WatchPageData['related'];
};

export function VideoWatchRelatedExamples({ related }: VideoWatchRelatedExamplesProps) {
  if (!related.length) return null;

  return (
    <VideoWatchCard className="p-5 sm:p-6 [content-visibility:auto] [contain-intrinsic-size:360px]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-text-primary">Related examples</h2>
        <Link href="/examples" prefetch={false} className="inline-flex items-center gap-2 text-sm font-semibold text-text-primary hover:text-brand">
          View all examples
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {related.map((item) => (
          <article key={item.id} className="overflow-hidden rounded-input border border-hairline bg-surface-2 transition hover:-translate-y-0.5 hover:shadow-card">
            <Link href={item.href} prefetch={false} className="block">
              <div className="relative aspect-video bg-surface-on-media-dark-5">
                {item.thumbUrl ? (
                  <Image
                    src={item.thumbUrl}
                    alt={item.title}
                    fill
                    className="object-cover"
                    sizes="(min-width: 1280px) 190px, (min-width: 640px) 45vw, 100vw"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase tracking-micro text-text-secondary">
                    No preview
                  </div>
                )}
                <span className="absolute left-2 top-2 rounded-pill bg-surface-on-media-dark-70 px-2 py-1 text-[10px] font-semibold text-on-inverse">
                  {item.engineLabel}
                </span>
              </div>
              <div className="space-y-1 px-3 py-3">
                <h3 className="line-clamp-1 text-sm font-semibold text-text-primary">{item.title}</h3>
                <p className="line-clamp-2 text-xs leading-5 text-text-secondary">{item.subtitle}</p>
              </div>
            </Link>
          </article>
        ))}
      </div>
    </VideoWatchCard>
  );
}
