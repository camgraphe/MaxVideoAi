'use client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useExampleCardPlayback } from '@/components/examples/useExampleCardPlayback';
import type { GroupSummary } from '@/types/groups';

/** Curated demonstrations share public playback policy; replacing a source cannot add idle video transfers. */
export function AppDemoCardMedia({ preview, requested }: { preview: GroupSummary['previews'][number] | undefined; requested: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const { videoRef, playbackAttempt, events, videoReady } = useExampleCardPlayback(
    preview?.previewVideoUrl ?? preview?.videoUrl ?? null, requested && visible, false,
  );
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.25 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <div ref={root} className="relative h-full w-full overflow-hidden">
    {preview?.thumbUrl ? <Image src={preview.thumbUrl} alt="" fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 320px" className={`object-contain ${videoReady ? 'opacity-0' : 'opacity-100'}`} /> : null}
    {playbackAttempt ? <video key={playbackAttempt.id} ref={videoRef} data-examples-card
      src={playbackAttempt.rendition.src} muted playsInline loop preload="none" {...events}
      className={`absolute inset-0 h-full w-full object-contain ${videoReady ? 'opacity-100' : 'opacity-0'}`} /> : null}
  </div>;
}
