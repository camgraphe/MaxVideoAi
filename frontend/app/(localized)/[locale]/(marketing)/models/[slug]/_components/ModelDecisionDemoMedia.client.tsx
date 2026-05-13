'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { ExternalLink, Play } from 'lucide-react';

import { Link } from '@/i18n/navigation';
import { UIIcon } from '@/components/ui/UIIcon';

type ModelDecisionDemoMediaProps = {
  posterSrc: string | null;
  videoSrc: string | null;
  alt: string;
  durationLabel: string;
  aspectLabel: string;
  renderHref: string | null;
  renderLabel: string;
};

export function ModelDecisionDemoMedia({
  posterSrc,
  videoSrc,
  alt,
  durationLabel,
  aspectLabel,
  renderHref,
  renderLabel,
}: ModelDecisionDemoMediaProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const normalizedVideoSrc = (videoSrc ?? '').toLowerCase();
  const sourceType = normalizedVideoSrc.includes('.webm') ? 'video/webm' : 'video/mp4';

  const handlePlay = () => {
    if (!videoSrc) return;
    setIsPlaying(true);
    window.requestAnimationFrame(() => {
      void videoRef.current?.play().catch(() => {});
    });
  };

  return (
    <figure className="relative min-h-[230px] overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-[0_18px_48px_-30px_rgba(15,23,42,0.55)] dark:border-white/10">
      {isPlaying && videoSrc ? (
        <video
          ref={videoRef}
          className="h-full min-h-[260px] w-full object-cover"
          controls
          playsInline
          preload="metadata"
          poster={posterSrc ?? undefined}
          aria-label={alt}
          onPlay={() => setIsPlaying(true)}
          onEnded={() => setIsPlaying(false)}
        >
          <source src={videoSrc} type={sourceType} />
        </video>
      ) : posterSrc ? (
        <Image src={posterSrc} alt={alt} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 620px" quality={80} />
      ) : (
        <div className="flex h-full min-h-[260px] items-center justify-center text-sm font-semibold text-white/70">{alt}</div>
      )}

      {!isPlaying ? (
        <>
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,7,18,0.08),rgba(3,7,18,0.62))]" />
          {videoSrc ? (
            <button
              type="button"
              onClick={handlePlay}
              aria-label="Play demo video"
              className="absolute left-1/2 top-1/2 inline-flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-slate-950/68 text-white shadow-[0_18px_44px_rgba(0,0,0,0.35)] backdrop-blur transition hover:scale-105 hover:bg-slate-950/82 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <UIIcon icon={Play} size={24} fill="currentColor" />
            </button>
          ) : null}
        </>
      ) : null}

      <div className="pointer-events-none absolute right-4 top-4 flex gap-2">
        <span className="rounded-lg bg-slate-950/78 px-3 py-1.5 text-xs font-semibold text-white">{durationLabel}</span>
        <span className="rounded-lg bg-slate-950/78 px-3 py-1.5 text-xs font-semibold text-white">{aspectLabel}</span>
      </div>

      {renderHref && !isPlaying ? (
        <Link
          href={renderHref}
          className="absolute bottom-4 right-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/20 bg-slate-950/56 px-4 py-2 text-sm font-semibold text-white shadow-sm backdrop-blur transition hover:bg-slate-950/72 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <span>{renderLabel}</span>
          <UIIcon icon={ExternalLink} size={14} />
        </Link>
      ) : null}
    </figure>
  );
}
