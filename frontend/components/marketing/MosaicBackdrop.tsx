import clsx from 'clsx';
import Image from 'next/image';
import { PropsWithChildren } from 'react';

type MosaicMedia = {
  videoUrl?: string | null;
  posterUrl?: string | null;
};

type MosaicBackdropProps = PropsWithChildren<{
  media?: MosaicMedia[];
  className?: string;
}>;

export function MosaicBackdrop({ media = [], className, children }: MosaicBackdropProps) {
  const baseMedia = media.filter((item) => item.videoUrl || item.posterUrl);
  const minTiles = 18;
  const collageMedia =
    baseMedia.length === 0
      ? []
      : Array.from({ length: Math.max(baseMedia.length, minTiles) }, (_, index) => baseMedia[index % baseMedia.length]);

  return (
    <section className={clsx('relative isolate w-full overflow-hidden', className)}>
      {collageMedia.length > 0 ? (
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div
            className="grid h-full min-h-full w-full grid-cols-3 gap-[2px] auto-rows-[minmax(160px,1fr)] will-change-transform sm:grid-cols-4 lg:grid-cols-6"
            style={{ animation: 'mosaicDrift 36s ease-in-out infinite alternate', opacity: 0.08 }}
            aria-hidden
          >
            {collageMedia.map((item, index) => {
              const keyToken = item.videoUrl || item.posterUrl || `tile-${index}`;
              return (
                <div key={`${index}-${keyToken}`} className="relative h-full w-full overflow-hidden rounded-sm">
                  {item.videoUrl ? (
                    <video
                      className="h-full w-full object-cover"
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      poster={item.posterUrl ?? undefined}
                    >
                      <source src={item.videoUrl} type="video/mp4" />
                    </video>
                  ) : item.posterUrl ? (
                    <Image
                      src={item.posterUrl}
                      alt="AI video preview tile"
                      fill
                      sizes="(min-width: 1280px) 12vw, (min-width: 768px) 24vw, 32vw"
                      className="object-cover"
                      priority={index < baseMedia.length}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      <div className="relative">{children}</div>
    </section>
  );
}
