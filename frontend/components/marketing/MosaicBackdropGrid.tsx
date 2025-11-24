'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

export type MosaicBackdropMedia = {
  posterUrl: string;
  videoUrl?: string | null;
  alt?: string | null;
};

type MosaicBackdropGridProps = {
  media: MosaicBackdropMedia[];
};

export function MosaicBackdropGrid({ media }: MosaicBackdropGridProps) {
  if (!media.length) return null;

  return (
    <div
      className="grid h-full min-h-full w-full grid-cols-3 gap-[2px] auto-rows-[minmax(160px,1fr)] will-change-transform sm:grid-cols-4 lg:grid-cols-6"
      style={{ animation: 'mosaicDrift 36s ease-in-out infinite alternate', opacity: 0.12 }}
      aria-hidden
    >
      {media.map((item, index) => (
        <MosaicTile key={`${index}-${item.posterUrl}`} media={item} />
      ))}
    </div>
  );
}

function MosaicTile({ media }: { media: MosaicBackdropMedia }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;

    if (!('IntersectionObserver' in window)) {
      setIsVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            obs.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '240px' }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden rounded-sm bg-white/5">
      {isVisible ? (
        <Image
          src={media.posterUrl}
          alt={media.alt ?? 'AI video preview tile'}
          fill
          sizes="(min-width: 1280px) 180px, (min-width: 768px) 160px, 120px"
          className="object-cover"
          loading="lazy"
          quality={60}
        />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-white/10 to-transparent" aria-hidden />
      )}
    </div>
  );
}
