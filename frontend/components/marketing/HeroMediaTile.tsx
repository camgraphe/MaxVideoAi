'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { AudioEqualizerBadge } from '@/components/ui/AudioEqualizerBadge';
import { Button } from '@/components/ui/Button';
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
  detailHref?: string | null;
  generateHref?: string | null;
  modelHref?: string | null;
  detailMeta?: {
    prompt?: string | null;
    engineLabel?: string | null;
    durationSec?: number | null;
  } | null;
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
  detailHref,
  generateHref,
  modelHref,
  detailMeta,
}: HeroMediaTileProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  const [ctaHref, setCtaHref] = useState<string | null>(() => guestHref ?? authenticatedHref ?? null);
  const cardHref = detailHref ? null : ctaHref;
  const [shouldRenderVideo, setShouldRenderVideo] = useState<boolean>(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!authenticatedHref && !guestHref) {
      setCtaHref(null);
      return;
    }
    let mounted = true;
    const resolveHref = (sessionPresent: boolean) => {
      const next = sessionPresent ? authenticatedHref ?? guestHref ?? null : guestHref ?? authenticatedHref ?? null;
      if (mounted) {
        setCtaHref(next);
      }
    };
    const runAuthCheck = () => {
      supabase.auth
        .getSession()
        .then(({ data }) => {
          resolveHref(Boolean(data.session));
        })
        .catch(() => {
          resolveHref(false);
        });
    };

    let cancelScheduledAuthCheck: (() => void) | null = null;
    if (typeof window === 'undefined') {
      runAuthCheck();
    } else {
      const idleWindow = window as typeof window & {
        requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
        cancelIdleCallback?: (handle: number) => void;
      };
      if (typeof idleWindow.requestIdleCallback === 'function') {
        const handle = idleWindow.requestIdleCallback(
          () => {
            runAuthCheck();
          },
          { timeout: 500 }
        );
        cancelScheduledAuthCheck = () => idleWindow.cancelIdleCallback?.(handle);
      } else {
        const rafHandle = window.requestAnimationFrame(() => {
          runAuthCheck();
        });
        cancelScheduledAuthCheck = () => window.cancelAnimationFrame(rafHandle);
      }
    }

    const { data: authSubscription } = supabase.auth.onAuthStateChange((_event, session) => {
      resolveHref(Boolean(session));
    });
    return () => {
      mounted = false;
      authSubscription?.subscription.unsubscribe();
      cancelScheduledAuthCheck?.();
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

  useEffect(() => {
    if (prefersReducedMotion) {
      setShouldRenderVideo(false);
      return;
    }
    if (typeof window === 'undefined') return;
    const node = containerRef.current;
    if (!node) {
      setShouldRenderVideo(true);
      return;
    }
    const delayMs = priority ? 4000 : 0;
    let idleHandle: number | null = null;
    let timeoutHandle: number | null = null;
    let scheduled = false;
    const cleanupInteraction = () => {
      window.removeEventListener('pointerdown', handleInteraction);
      window.removeEventListener('pointermove', handleInteraction);
      window.removeEventListener('scroll', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
    const startVideo = () => {
      if (scheduled) return;
      scheduled = true;
      setShouldRenderVideo(true);
      cleanupInteraction();
    };
    const handleInteraction = () => {
      startVideo();
    };
    const scheduleVideo = () => {
      if (scheduled) return;
      if (delayMs <= 0) {
        const idleWindow = window as typeof window & {
          requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
          cancelIdleCallback?: (handle: number) => void;
        };
        if (typeof idleWindow.requestIdleCallback === 'function') {
          idleHandle = idleWindow.requestIdleCallback(startVideo, { timeout: 300 });
        } else {
          timeoutHandle = window.setTimeout(startVideo, 0);
        }
        return;
      }
      window.addEventListener('pointerdown', handleInteraction, { passive: true });
      window.addEventListener('pointermove', handleInteraction, { passive: true });
      window.addEventListener('scroll', handleInteraction, { passive: true });
      window.addEventListener('keydown', handleInteraction);
      timeoutHandle = window.setTimeout(startVideo, delayMs);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          scheduleVideo();
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      cleanupInteraction();
      if (idleHandle !== null) {
        (window as typeof window & { cancelIdleCallback?: (handle: number) => void }).cancelIdleCallback?.(idleHandle);
      }
      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle);
      }
    };
  }, [prefersReducedMotion, priority]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLightboxOpen(false);
      }
    };
    document.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [lightboxOpen]);

  const content = (
    <figure className="group relative overflow-hidden rounded-[28px] border border-preview-outline-idle bg-surface shadow-card">
      <div className="relative aspect-[16/9] w-full">
        {showAudioIcon ? (
          <AudioEqualizerBadge tone="light" size="sm" label="Audio enabled" />
        ) : null}
        {shouldRenderVideo && !prefersReducedMotion ? (
          <video
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            autoPlay
            muted
            loop
            playsInline
            preload={priority ? 'none' : 'metadata'}
            poster={posterSrc}
            aria-label={alt}
          >
            <source src={videoSrc} type="video/mp4" />
          </video>
        ) : (
          <Image
            src={posterSrc}
            alt={alt}
            fill
            priority={priority}
            fetchPriority={priority ? 'high' : undefined}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            quality={80}
            sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 40vw"
            className="object-cover"
          />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-gradient-to-t from-black/65 via-black/35 to-transparent p-4 text-left text-on-inverse">
          {badge ? (
            <span className="inline-flex h-6 items-center rounded-pill border border-surface-on-media-50 bg-surface-on-media-15 px-3 text-[11px] font-semibold uppercase tracking-micro text-on-inverse">
              {badge}
            </span>
          ) : null}
          <figcaption className="space-y-1">
            <p className="text-2xl font-semibold sm:text-3xl">{label}</p>
            <p className="text-sm font-medium text-on-media-80">{priceLabel}</p>
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
        className="pointer-events-auto absolute bottom-2 left-1/2 z-10 -translate-x-1/2 inline-flex min-h-[48px] min-w-[48px] items-center justify-center rounded-full px-3 py-2 text-xs font-medium text-on-media-90 transition hover:text-on-inverse focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-surface-on-media-40"
      >
        {overlayLabel ?? 'Clone these settings'}
      </Link>
    ) : null;

  const card = detailHref ? (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={() => setLightboxOpen(true)}
      className="min-h-0 h-auto w-full items-stretch justify-start rounded-[28px] p-0 text-left font-normal"
      aria-label={`Preview ${label}`}
    >
      {content}
    </Button>
  ) : cardHref ? (
    <Link
      href={cardHref}
      prefetch={false}
      className="block rounded-[28px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      aria-label={`Open ${label} generator`}
    >
      {content}
    </Link>
  ) : (
    content
  );

  return (
    <div className="relative" ref={containerRef}>
      {card}
      {overlay}
      {lightboxOpen && detailHref ? (
        <div
          className="fixed inset-0 z-[180] flex items-center justify-center bg-surface-on-media-dark-80 px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-label={`${label} preview`}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setLightboxOpen(false);
            }
          }}
        >
          <div
            className="relative w-full max-w-4xl rounded-[32px] border border-surface-on-media-20 bg-surface-glass-95 p-4 text-left shadow-float"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-hairline pb-4 pr-14">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-micro text-text-muted">
                  <span>{detailMeta?.engineLabel ?? label}</span>
                  {modelHref ? (
                    <Link
                      href={modelHref}
                      className="inline-flex items-center gap-1 rounded-full bg-surface-glass-90 px-2 py-0.5 text-[11px] font-semibold text-brand shadow-sm transition hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span>Model page</span>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
                        <path
                          d="M4 12L12 4M5 4h7v7"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </Link>
                  ) : null}
                </div>
                <h3 className="text-xl font-semibold text-text-primary">{label}</h3>
                {detailMeta?.prompt ? (
                  <p className="text-sm text-text-secondary">{detailMeta.prompt}</p>
                ) : null}
                <p className="text-xs font-medium text-text-muted">
                  {priceLabel}
                  {typeof detailMeta?.durationSec === 'number' ? ` · ${detailMeta.durationSec}s` : null}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {generateHref ? (
                  <Link
                    href={generateHref}
                    prefetch={false}
                    className="inline-flex rounded-pill bg-brand px-4 py-2 text-xs font-semibold uppercase tracking-micro text-on-brand transition hover:bg-brandHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Generate like this
                  </Link>
                ) : null}
                <Link
                  href={detailHref}
                  className="rounded-pill border border-hairline px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-primary transition hover:border-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  View details
                </Link>
              </div>
            </div>
            <div className="mt-4 overflow-hidden rounded-3xl border border-hairline bg-black">
              <video
                key={videoSrc}
                className="h-full w-full object-contain"
                controls
                autoPlay
                muted
                playsInline
                preload="metadata"
                poster={posterSrc}
              >
                <source src={videoSrc} type="video/mp4" />
              </video>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setLightboxOpen(false)}
              className="absolute right-4 top-4 h-11 w-11 min-h-0 rounded-full bg-surface-glass-95 p-0 text-text-primary shadow-lg ring-1 ring-border hover:bg-surface"
              aria-label="Close preview"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M18 6L6 18M6 6l12 12"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
