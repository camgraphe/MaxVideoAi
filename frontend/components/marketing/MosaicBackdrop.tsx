import clsx from 'clsx';
import { PropsWithChildren } from 'react';
import { MosaicBackdropGrid, type MosaicBackdropMedia } from './MosaicBackdropGrid';

type MosaicBackdropProps = PropsWithChildren<{
  media?: MosaicBackdropMedia[];
  className?: string;
}>;

const MIN_TILE_COUNT = 36;

export function MosaicBackdrop({ media = [], className, children }: MosaicBackdropProps) {
  const sanitizedMedia = Array.isArray(media) ? media : [];
  const collageMedia =
    sanitizedMedia.length === 0
      ? []
      : Array.from(
          { length: Math.max(sanitizedMedia.length, MIN_TILE_COUNT) },
          (_, index) => sanitizedMedia[index % sanitizedMedia.length]
        );

  return (
    <section className={clsx('relative isolate w-full overflow-hidden', className)}>
      {collageMedia.length > 0 ? (
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <MosaicBackdropGrid media={collageMedia} />
        </div>
      ) : null}
      <div className="relative">{children}</div>
    </section>
  );
}

export type { MosaicBackdropMedia } from './MosaicBackdropGrid';
