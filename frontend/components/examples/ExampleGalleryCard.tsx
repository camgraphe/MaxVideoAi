'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import clsx from 'clsx';
import { AudioEqualizerBadge } from '@/components/ui/AudioEqualizerBadge';
import { DeferredSourcePrompt } from '@/components/i18n/DeferredSourcePrompt.client';
import {
  buildWatchAnchorText,
  LANDSCAPE_SIZES,
  parseAspectRatio,
  PORTRAIT_SIZES,
  TALL_CARD_MEDIA_PERCENT,
} from '@/components/examples/examples-gallery-helpers';
import type { ExampleGalleryVideo } from '@/components/examples/examples-gallery-types';
import mediaStyles from './examples-media.module.css';

type ExampleGalleryCardProps = {
  altText: string;
  audioAvailableLabel: string;
  detailsCtaLabel: string;
  enableInlineVideo: boolean;
  enableTallCardLayout: boolean;
  forceExclusivePlay: boolean;
  isFirst: boolean;
  locale: string;
  noPreviewLabel: string;
  video: ExampleGalleryVideo;
};

export function ExampleGalleryCard({
  altText,
  audioAvailableLabel,
  detailsCtaLabel,
  enableInlineVideo,
  enableTallCardLayout,
  forceExclusivePlay,
  isFirst,
  locale,
  noPreviewLabel,
  video,
}: ExampleGalleryCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [inView, setInView] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const rawAspect = useMemo(() => (video.aspectRatio ? parseAspectRatio(video.aspectRatio) : 16 / 9), [video.aspectRatio]);
  const isPortrait = rawAspect < 1;
  const posterSizes = isPortrait ? PORTRAIT_SIZES : LANDSCAPE_SIZES;
  const inlineVideoUrl = video.previewVideoUrl ?? video.videoUrl ?? null;
  const shouldLoadVideo = enableInlineVideo && inView && Boolean(inlineVideoUrl);
  const shouldPlay = shouldLoadVideo && (isHovered || isFirst || forceExclusivePlay);
  const mediaPaddingPercent = Number((100 / rawAspect).toFixed(3));
  const tallCardEnabled = enableTallCardLayout && isPortrait;
  const mediaPadding = tallCardEnabled
    ? `calc(${TALL_CARD_MEDIA_PERCENT}% + var(--examples-grid-row-gap, 10px))`
    : `${mediaPaddingPercent}%`;

  useEffect(() => {
    const node = cardRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setInView(entry.isIntersecting);
      },
      { rootMargin: '120px 0px 120px 0px', threshold: 0.25 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = videoRef.current;
    if (!node || !shouldPlay) return;
    const pauseOthers = () => {
      if (!forceExclusivePlay) return;
      try {
        document.querySelectorAll('video[data-examples-card]').forEach((el) => {
          if (el !== node) {
            (el as HTMLVideoElement).pause();
          }
        });
      } catch {
        // ignore autoplay coordination errors
      }
    };

    const play = async () => {
      try {
        pauseOthers();
        await node.play();
        setVideoReady(true);
      } catch {
        // ignore autoplay failures
      }
    };
    void play();
    return () => {
      node.pause();
    };
  }, [shouldPlay, forceExclusivePlay]);

  const posterSrc = video.rawPosterUrl ?? null;
  const watchAnchorText = buildWatchAnchorText(locale, video);
  const playingLabel = locale === 'fr' ? 'Lecture' : locale === 'es' ? 'En reproducción' : 'Playing';
  const durationLabel = locale === 'es' ? `${video.durationSec} s` : `${video.durationSec}s`;

  return (
    <div
      ref={cardRef}
      className="group relative overflow-hidden rounded-[18px] border border-hairline bg-surface shadow-card focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-bg"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link href={video.href} className="absolute inset-0 z-0" aria-label={watchAnchorText} prefetch={false}>
        <span className="sr-only">{watchAnchorText}</span>
      </Link>
      <div className="pointer-events-none relative z-10">
        <div className={clsx(mediaStyles.mediaOuter, 'relative w-full overflow-hidden bg-surface-on-media-dark-5')}>
          <div className="relative w-full" style={{ paddingBottom: mediaPadding }}>
            <div className="absolute inset-0">
              {shouldLoadVideo && inlineVideoUrl ? (
                <video
                  ref={videoRef}
                  muted
                  loop
                  playsInline
                  poster={posterSrc ?? undefined}
                  data-examples-card
                  className="h-full w-full object-cover object-center transition duration-500 group-hover:scale-[1.02]"
                >
                  <source src={inlineVideoUrl} type="video/mp4" />
                </video>
              ) : posterSrc ? (
                <Image
                  src={posterSrc}
                  alt={altText}
                  fill
                  className="h-full w-full object-cover object-center"
                  decoding="async"
                  sizes={posterSizes}
                  quality={52}
                  priority={isFirst}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-placeholder text-[11px] font-semibold uppercase tracking-micro text-text-muted">
                  {noPreviewLabel}
                </div>
              )}
              {video.hasAudio ? <AudioEqualizerBadge tone="light" size="sm" label={audioAvailableLabel} /> : null}
            </div>
          </div>
        </div>
        <div className="space-y-1 px-3 py-2.5 text-left sm:px-4 sm:py-3">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-micro text-text-muted sm:gap-2 sm:text-xs">
            {video.modelHref ? (
              <Link href={video.modelHref} prefetch={false} className="pointer-events-auto hover:text-text-primary">
                {video.engineLabel}
              </Link>
            ) : (
              <span>{video.engineLabel}</span>
            )}
          </div>
          <DeferredSourcePrompt
            locale={locale}
            prompt={video.prompt}
            mode="inline"
            promptClassName="line-clamp-2 text-[13px] font-semibold leading-snug text-text-primary sm:text-sm"
            fallbackClassName="line-clamp-2 text-[13px] font-semibold leading-snug text-text-primary sm:text-sm"
          />
          <p className="text-[10px] text-text-secondary sm:text-[11px]">
            {video.aspectRatio ?? 'Auto'} · {durationLabel} {videoReady ? `· ${playingLabel}` : ''}
          </p>
          <p
            aria-hidden="true"
            className="pt-0.5 text-[11px] font-semibold text-brand transition group-hover:text-brand-hover"
          >
            {detailsCtaLabel} →
          </p>
        </div>
      </div>
    </div>
  );
}
