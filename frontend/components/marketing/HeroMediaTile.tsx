'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AudioEqualizerBadge } from '@/components/ui/AudioEqualizerBadge';
import { supabase } from '@/lib/supabaseClient';

interface HeroMediaTileProps {
  label: string;
  priceLabel: string;
  videoSrc: string;
  posterSrc: string;
  alt: string;
  showAudioIcon?: boolean;
  badge?: string;
  priority?: boolean;
  authenticatedHref?: string;
  guestHref?: string;
  overlayHref?: string;
  overlayLabel?: string;
}

export function HeroMediaTile({
  label,
  priceLabel,
  videoSrc,
  posterSrc,
  alt,
  showAudioIcon,
  badge,
  priority,
  authenticatedHref,
  guestHref,
  overlayHref,
  overlayLabel,
}: HeroMediaTileProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  const [targetHref, setTargetHref] = useState<string | null>(() => guestHref ?? authenticatedHref ?? null);

  useEffect(() => {
    if (!authenticatedHref && !guestHref) {
      return;
    }
    let mounted = true;
    const resolveHref = (sessionPresent: boolean) => {
      const next = sessionPresent ? authenticatedHref ?? guestHref ?? null : guestHref ?? authenticatedHref ?? null;
      if (mounted) {
        setTargetHref(next);
      }
    };
    supabase.auth
      .getSession()
      .then(({ data }) => {
        resolveHref(Boolean(data.session));
      })
      .catch(() => {
        resolveHref(false);
      });
    const { data: authSubscription } = supabase.auth.onAuthStateChange((_event, session) => {
      resolveHref(Boolean(session));
    });
    return () => {
      mounted = false;
      authSubscription?.subscription.unsubscribe();
    };
  }, [authenticatedHref, guestHref]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  const content = (
    <figure className="group relative overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-card">
      <div className="relative aspect-[16/9] w-full">
        {showAudioIcon ? (
          <AudioEqualizerBadge tone="light" size="sm" label="Audio enabled" />
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

  const overlay =
    overlayHref != null ? (
      <Link
        href={overlayHref}
        onClick={(event) => {
          event.stopPropagation();
        }}
        className="pointer-events-auto absolute bottom-2 left-1/2 z-10 -translate-x-1/2 text-xs font-medium text-white/90 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40"
      >
        {overlayLabel ?? 'Clone these settings'}
      </Link>
    ) : null;

  const card = targetHref ? (
    <Link
      href={targetHref}
      className="block rounded-[28px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      aria-label={`Open ${label} generator`}
    >
      {content}
    </Link>
  ) : (
    content
  );

  return (
    <div className="relative">
      {card}
      {overlay}
    </div>
  );
}
