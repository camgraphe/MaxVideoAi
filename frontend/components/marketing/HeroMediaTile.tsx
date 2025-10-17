'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
      <path d="M10 9H7v6h3l4 4V5l-4 4Z" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 9.5c.64.64 1 1.52 1 2.5s-.36 1.86-1 2.5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface HeroMediaTileProps {
  label: string;
  priceLabel: string;
  videoSrc: string;
  posterSrc: string;
  alt: string;
  showAudioIcon?: boolean;
  badge?: string;
  priority?: boolean;
}

export function HeroMediaTile({ label, priceLabel, videoSrc, posterSrc, alt, showAudioIcon, badge, priority }: HeroMediaTileProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  return (
    <figure className="group relative overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-card">
      <div className="relative aspect-[16/9] w-full">
        {showAudioIcon ? (
          <span className="absolute right-3 top-3 z-10 inline-flex items-center justify-center rounded-full bg-black/65 p-2 text-white shadow-card">
            <SpeakerIcon />
            <span className="sr-only">Audio on by default</span>
          </span>
        ) : null}
        {prefersReducedMotion ? (
          <Image src={posterSrc} alt={alt} fill priority={priority} sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" />
        ) : (
          <video
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster={posterSrc}
            aria-label={alt}
          >
            <source src={videoSrc} type="video/mp4" />
          </video>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-gradient-to-t from-black/65 via-black/35 to-transparent p-4 text-left text-white">
          {badge ? (
            <span className="inline-flex h-6 items-center rounded-pill border border-white/50 bg-white/15 px-3 text-[11px] font-semibold uppercase tracking-micro text-white">
              {badge}
            </span>
          ) : null}
          <figcaption className="space-y-1">
            <p className="text-2xl font-semibold sm:text-3xl">{label}</p>
            <p className="text-sm font-medium text-white/80">{priceLabel}</p>
          </figcaption>
        </div>
      </div>
      <span className="sr-only">{alt}</span>
    </figure>
  );
}
