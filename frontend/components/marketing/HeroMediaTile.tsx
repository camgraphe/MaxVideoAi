'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { AudioEqualizerBadge } from '@/components/ui/AudioEqualizerBadge';
import { Button } from '@/components/ui/Button';

const HeroMediaLightbox = dynamic(
  () => import('@/components/marketing/HeroMediaLightbox.client').then((mod) => mod.HeroMediaLightbox)
);

interface HeroMediaTileProps {
  label: string;
  priceLabel: string;
  videoSrc: string;
  posterSrc: string;
  videoPosterSrc?: string;
  alt: string;
  showAudioIcon?: boolean;
  audioBadgeLabel?: string;
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
  lightboxCopy?: {
    openPreviewAria?: string;
    openGeneratorAria?: string;
    dialogAria?: string;
    modelPage?: string;
    generateLikeThis?: string;
    viewDetails?: string;
    closePreview?: string;
  };
}

export function HeroMediaTile({
  label,
  priceLabel,
  videoSrc,
  posterSrc,
  videoPosterSrc,
  alt,
  showAudioIcon,
  audioBadgeLabel,
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
  lightboxCopy,
}: HeroMediaTileProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  const ctaHref = authenticatedHref ?? guestHref ?? null;
  const cardHref = detailHref ? null : ctaHref;
  const [shouldRenderVideo, setShouldRenderVideo] = useState<boolean>(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const idleIdRef = useRef<number | null>(null);
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearScheduledVideoLoad = () => {
    if (typeof window === 'undefined') return;
    if (idleIdRef.current != null && 'cancelIdleCallback' in window) {
      window.cancelIdleCallback(idleIdRef.current);
      idleIdRef.current = null;
    }
    if (timeoutIdRef.current != null) {
      globalThis.clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
  };

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
      clearScheduledVideoLoad();
      setShouldRenderVideo(false);
      setIsVideoReady(false);
      return;
    }
    if (typeof window === 'undefined') return;
    const node = containerRef.current;
    const scheduleVideoLoad = () => {
      if (shouldRenderVideo) return;
      clearScheduledVideoLoad();
      const load = () => {
        idleIdRef.current = null;
        timeoutIdRef.current = null;
        setShouldRenderVideo(true);
      };
      if ('requestIdleCallback' in window) {
        idleIdRef.current = window.requestIdleCallback(load, { timeout: 1200 });
        return;
      }
      timeoutIdRef.current = globalThis.setTimeout(load, 160);
    };
    if (!node) {
      scheduleVideoLoad();
      return clearScheduledVideoLoad;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          scheduleVideoLoad();
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      clearScheduledVideoLoad();
    };
  }, [prefersReducedMotion, shouldRenderVideo]);

  useEffect(() => {
    if (!shouldRenderVideo) {
      setIsVideoReady(false);
    }
  }, [shouldRenderVideo]);

  const content = (
    <figure className="group relative w-full overflow-hidden rounded-[28px] border border-preview-outline-idle bg-surface shadow-card">
      <div className="relative aspect-[16/9] w-full">
        {showAudioIcon ? (
          <AudioEqualizerBadge tone="light" size="sm" label={audioBadgeLabel ?? 'Audio enabled'} />
        ) : null}
        <Image
          src={posterSrc}
          alt={alt}
          fill
          priority={priority}
          fetchPriority={priority ? 'high' : undefined}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          quality={72}
          sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 40vw"
          className="object-cover"
        />
        {shouldRenderVideo && !prefersReducedMotion ? (
          <video
            className={`absolute inset-0 h-full w-full scale-[0.999] object-cover transition duration-500 group-hover:scale-[1.03] ${
              isVideoReady ? 'opacity-100 visible' : 'opacity-0 invisible'
            }`}
            autoPlay
            muted
            loop
            playsInline
            preload={priority ? 'metadata' : 'none'}
            poster={videoPosterSrc ?? posterSrc}
            aria-label={alt}
            onLoadedData={() => setIsVideoReady(true)}
          >
            <source src={videoSrc} type="video/mp4" />
          </video>
        ) : null}
        <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/65 via-black/25 to-transparent p-2.5 text-left text-on-inverse sm:p-4">
          <p className="text-lg font-semibold leading-tight sm:text-3xl">{label}</p>
          <p className="mt-0.5 text-[10px] font-medium leading-none text-on-media-80 sm:text-sm">{priceLabel}</p>
        </div>
        {badge ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 via-black/35 to-transparent p-4 text-left text-on-inverse">
            <span className="inline-flex h-6 items-center rounded-pill border border-surface-on-media-50 bg-surface-on-media-15 px-3 text-[11px] font-semibold uppercase tracking-micro text-on-inverse">
              {badge}
            </span>
          </div>
        ) : null}
      </div>
      <span className="sr-only">{alt}</span>
    </figure>
  );

  const overlay =
    overlayHref != null ? (
      <Link
        href={overlayHref}
        prefetch={false}
        onClick={(event) => {
          event.stopPropagation();
        }}
        className="pointer-events-auto absolute bottom-1.5 left-1/2 z-10 hidden -translate-x-1/2 items-center justify-center rounded-full px-2.5 py-1.5 text-[10px] font-medium text-on-media-90 transition hover:text-on-inverse focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-surface-on-media-40 sm:inline-flex sm:bottom-2 sm:min-h-[48px] sm:min-w-[48px] sm:px-3 sm:py-2 sm:text-xs"
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
      aria-label={(lightboxCopy?.openPreviewAria ?? 'Preview {label}').replace('{label}', label)}
    >
      {content}
    </Button>
  ) : cardHref ? (
    <Link
      href={cardHref}
      prefetch={false}
      className="block rounded-[28px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      aria-label={(lightboxCopy?.openGeneratorAria ?? 'Open {label} generator').replace('{label}', label)}
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
        <HeroMediaLightbox
          label={label}
          priceLabel={priceLabel}
          alt={alt}
          detailHref={detailHref}
          generateHref={generateHref}
          modelHref={modelHref}
          detailMeta={detailMeta}
          videoSrc={videoSrc}
          posterSrc={posterSrc}
          lightboxCopy={lightboxCopy}
          onClose={() => setLightboxOpen(false)}
        />
      ) : null}
    </div>
  );
}
