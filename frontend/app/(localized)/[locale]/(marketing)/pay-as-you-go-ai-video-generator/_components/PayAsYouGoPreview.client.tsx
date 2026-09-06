'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useExampleCardPlayback } from '@/components/examples/useExampleCardPlayback';
import { isOptimizablePublicMediaUrl } from '@/lib/media-helpers';

/** Incidental desktop previews; mobile visitors open the existing watch link. */
export function PayAsYouGoPreview({
  src, poster, label, placeholder,
}: {
  src?: string;
  poster?: string;
  label: string;
  placeholder: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const { videoRef, playbackAttempt, events, videoReady } = useExampleCardPlayback(src ?? null, visible && desktop, false);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const media = window.matchMedia('(min-width: 768px)');
    const sync = () => setDesktop(media.matches);
    sync();
    media.addEventListener('change', sync);
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting && entry.intersectionRatio >= 0.25);
    }, { threshold: [0, 0.25] });
    observer.observe(frame);
    return () => { observer.disconnect(); media.removeEventListener('change', sync); };
  }, []);

  return (
    <div ref={frameRef} className="relative h-full w-full" data-payg-preview>
      {poster ? (
        <Image
          src={poster}
          alt={label}
          fill
          sizes="(max-width: 639px) 210px, 230px"
          unoptimized={!isOptimizablePublicMediaUrl(poster)}
          className="object-cover transition duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <div role="img" aria-label={label} className="flex h-full w-full items-center justify-center bg-surface-3 text-xs font-semibold uppercase tracking-micro text-text-muted">
          {placeholder}
        </div>
      )}
      {playbackAttempt ? (
        <video
          key={playbackAttempt.id}
          ref={videoRef}
          src={playbackAttempt.rendition.src}
          aria-hidden="true"
          muted
          loop
          playsInline
          preload="none"
          data-examples-card
          {...events}
          className={`absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03] ${videoReady ? 'opacity-100' : 'opacity-0'}`}
        />
      ) : null}
    </div>
  );
}
