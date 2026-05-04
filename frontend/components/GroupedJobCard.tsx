'use client';

/* eslint-disable @next/next/no-img-element */
import clsx from 'clsx';
import { ChevronDown, Maximize2, Plus } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EngineCaps } from '@/types/engines';
import type { GroupSummary } from '@/types/groups';
import { Card } from '@/components/ui/Card';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { AudioEqualizerBadge } from '@/components/ui/AudioEqualizerBadge';
import { AudioWaveformThumb } from '@/components/ui/AudioWaveformThumb';
import { ProcessingOverlay } from '@/components/groups/ProcessingOverlay';
import { Button, ButtonLink } from '@/components/ui/Button';
import { CURRENCY_LOCALE } from '@/lib/intl';
import { isPlaceholderMediaUrl } from '@/lib/media';

export type GroupedJobAction =
  | 'open'
  | 'view'
  | 'download'
  | 'copy'
  | 'continue'
  | 'refine'
  | 'branch'
  | 'compare'
  | 'remove'
  | 'save-image'
  | 'save-to-library';

const GROUPED_JOB_THUMB_SIZES = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 320px';

type NavigatorWithConnection = Navigator & {
  connection?: {
    effectiveType?: string;
    saveData?: boolean;
  };
};

function shouldWarmVisiblePreview(): boolean {
  if (typeof navigator === 'undefined') return true;
  const connection = (navigator as NavigatorWithConnection).connection;
  if (connection?.saveData) return false;
  const effectiveType = connection?.effectiveType;
  return effectiveType !== 'slow-2g' && effectiveType !== '2g';
}

function ThumbImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const baseClass = clsx('h-full w-full pointer-events-none', className);
  if (src.startsWith('data:')) {
    return <img src={src} alt={alt} className={baseClass} />;
  }
  return <Image src={src} alt={alt} fill className={baseClass} sizes={GROUPED_JOB_THUMB_SIZES} />;
}

export function GroupPreviewMedia({
  preview,
  audioUrl,
  audioLabel,
  shouldPlay,
  shouldWarm,
  fit = 'contain',
}: {
  preview: GroupSummary['previews'][number] | undefined;
  audioUrl?: string | null;
  audioLabel?: string | null;
  shouldPlay: boolean;
  shouldWarm: boolean;
  fit?: 'contain' | 'cover';
}) {
  const displayVideoUrl = preview?.previewVideoUrl ?? preview?.videoUrl ?? null;
  const hasOptimizedPreview = Boolean(preview?.previewVideoUrl);
  const hasVideo = Boolean(displayVideoUrl);
  const hasAudioOnly = Boolean(audioUrl) && !hasVideo;
  const thumbSrc = preview?.thumbUrl && !isPlaceholderMediaUrl(preview.thumbUrl) ? preview.thumbUrl : null;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoReadyRef = useRef(false);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    if (!hasVideo) return;
    videoReadyRef.current = false;
    setVideoReady(false);
  }, [hasVideo, displayVideoUrl]);

  const markVideoReady = useCallback(() => {
    if (videoReadyRef.current) return;
    videoReadyRef.current = true;
    setVideoReady(true);
  }, []);

  const playPreviewVideo = useCallback(() => {
    const element = videoRef.current;
    if (!element) return;
    element.preload = 'auto';
    if (
      element.networkState === HTMLMediaElement.NETWORK_EMPTY ||
      (element.networkState === HTMLMediaElement.NETWORK_IDLE && element.readyState < HTMLMediaElement.HAVE_CURRENT_DATA)
    ) {
      element.load();
    }
    if (element.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }
    const playPromise = element.play();
    if (playPromise) {
      playPromise.catch(() => {
        /* ignore autoplay rejection */
      });
    }
  }, []);

  useEffect(() => {
    if (!hasVideo) return;
    const element = videoRef.current;
    if (!element) return;
    if (shouldPlay) {
      playPreviewVideo();
    } else {
      element.pause();
      if (
        shouldWarm &&
        hasOptimizedPreview &&
        (element.networkState === HTMLMediaElement.NETWORK_EMPTY ||
          (element.networkState === HTMLMediaElement.NETWORK_IDLE && element.readyState < HTMLMediaElement.HAVE_CURRENT_DATA))
      ) {
        element.preload = 'auto';
        element.load();
      }
    }
  }, [hasVideo, hasOptimizedPreview, playPreviewVideo, displayVideoUrl, shouldPlay, shouldWarm]);

  const handleCanPlay = () => {
    markVideoReady();
    if (shouldPlay) {
      playPreviewVideo();
    }
  };

  const handleLoadedData = () => {
    markVideoReady();
    if (shouldPlay) {
      playPreviewVideo();
    }
  };

  if (hasVideo && displayVideoUrl) {
    const poster = thumbSrc ?? undefined;
    return (
      <div className="relative h-full w-full overflow-hidden rounded-[inherit]">
        {thumbSrc ? (
          <ThumbImage
            src={thumbSrc}
            alt=""
            className={clsx(
              'absolute inset-0 transition-opacity duration-150 ease-out',
              fit === 'cover' ? 'object-cover scale-[1.06] transform-gpu' : 'object-contain',
              shouldPlay && videoReady ? 'opacity-0' : 'opacity-100'
            )}
          />
        ) : null}
        <video
          ref={videoRef}
          src={displayVideoUrl}
          poster={poster}
          className={clsx(
            'absolute inset-0 h-full w-full pointer-events-none transition-opacity duration-150 ease-out',
            fit === 'cover' ? 'object-cover scale-[1.06] transform-gpu' : 'object-contain',
            videoReady ? 'opacity-100' : 'opacity-0'
          )}
          muted
          playsInline
          autoPlay={shouldPlay}
          loop
          preload={shouldPlay || (shouldWarm && hasOptimizedPreview) ? 'auto' : 'none'}
          onLoadedData={handleLoadedData}
          onCanPlay={handleCanPlay}
        />
      </div>
    );
  }
  if (hasAudioOnly) {
    return (
      <AudioWaveformThumb
        seed={audioUrl ?? preview?.id ?? 'audio-preview'}
        thumbSrc={thumbSrc}
        label={audioLabel}
        active={shouldPlay}
      />
    );
  }
  if (thumbSrc) {
    return (
      <div className="relative h-full w-full overflow-hidden rounded-[inherit]">
        <ThumbImage
          src={thumbSrc}
          alt=""
          className={fit === 'cover' ? 'object-cover scale-[1.06] transform-gpu' : 'object-contain'}
        />
      </div>
    );
  }
  return null;
}

export interface GroupedJobCardProps {
  group: GroupSummary;
  engine?: EngineCaps | null;
  onOpen?: (group: GroupSummary) => void;
  onAction?: (group: GroupSummary, action: GroupedJobAction) => void;
  metaLabel?: string | null;
  actionMenu?: boolean;
  menuVariant?: 'full' | 'compact' | 'gallery' | 'gallery-image';
  allowRemove?: boolean;
  isImageGroup?: boolean;
  savingToLibrary?: boolean;
  showImageCta?: boolean;
  imageCtaHref?: string;
  imageCtaLabel?: string;
  imageLibraryLabel?: string;
  imageLibrarySavingLabel?: string;
  showLibraryCta?: boolean;
  recreateHref?: string;
  recreateLabel?: string;
  openLabel?: string;
  actionMenuLabel?: string;
  eagerPreview?: boolean;
  warmOnVisible?: boolean;
}

export function GroupedJobCard({
  group,
  engine,
  onOpen,
  onAction,
  metaLabel,
  actionMenu = true,
  menuVariant = 'full',
  allowRemove = true,
  isImageGroup = false,
  savingToLibrary = false,
  showImageCta = false,
  imageCtaHref = '/app/image',
  imageCtaLabel = 'Generate images',
  imageLibraryLabel = 'Add to Library',
  imageLibrarySavingLabel = 'Saving…',
  showLibraryCta = false,
  recreateHref,
  recreateLabel = 'Generate same settings',
  openLabel = 'Open group',
  actionMenuLabel = 'Actions',
  eagerPreview = false,
  warmOnVisible = false,
}: GroupedJobCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const hero = group.hero;
  const splitLabel = `×${group.count}`;

  useEffect(() => {
    if (!menuOpen) return undefined;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || menuButtonRef.current?.contains(target)) {
        return;
      }
      setMenuOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  const formattedPrice = useMemo(() => {
    if (typeof group.totalPriceCents === 'number') {
      const currency = group.currency ?? hero.currency ?? 'USD';
      try {
        return new Intl.NumberFormat(CURRENCY_LOCALE, { style: 'currency', currency }).format(group.totalPriceCents / 100);
      } catch {
        return `${currency} ${(group.totalPriceCents / 100).toFixed(2)}`;
      }
    }
    if (typeof hero.priceCents === 'number') {
      const currency = hero.currency ?? group.currency ?? 'USD';
      try {
        return new Intl.NumberFormat(CURRENCY_LOCALE, { style: 'currency', currency }).format(hero.priceCents / 100);
      } catch {
        return `${currency} ${(hero.priceCents / 100).toFixed(2)}`;
      }
    }
    return null;
  }, [group.currency, group.totalPriceCents, hero.currency, hero.priceCents]);

  const previews = useMemo(() => {
    if (group.previews.length >= 4) return group.previews.slice(0, 4);
    return group.previews;
  }, [group.previews]);
  const previewCount = useMemo(() => Math.max(1, Math.min(4, group.count)), [group.count]);
  const isSinglePreview = previewCount === 1;
  const previewGridClass = useMemo(() => {
    if (previewCount === 1) return 'grid-cols-1';
    if (previewCount === 3) return 'grid-cols-3';
    return 'grid-cols-2';
  }, [previewCount]);
  const showMenu = Boolean(onAction) && actionMenu;
  const isCurated = Boolean(hero.job?.curated);
  const showAdvancedMenuActions = menuVariant === 'full';
  const showGalleryActions = menuVariant === 'gallery';
  const showGalleryImageActions = menuVariant === 'gallery-image';
  const showCompactMenuButton = menuVariant === 'compact';

  const handleAction = (action: GroupedJobAction) => {
    setMenuOpen(false);
    onAction?.(group, action);
  };

  const handleRemake = () => {
    setMenuOpen(false);
    onOpen?.(group);
  };

  const durationLabel = typeof hero.durationSec === 'number' ? `${hero.durationSec}s` : null;
  const detailLabel = metaLabel !== undefined ? metaLabel : durationLabel;
  const heroHasAudio = Boolean(group.hero.job?.hasAudio);

  const [hovered, setHovered] = useState(false);
  const [isPreviewWarm, setIsPreviewWarm] = useState(eagerPreview);

  useEffect(() => {
    if (eagerPreview) {
      setIsPreviewWarm(true);
    }
  }, [eagerPreview]);

  useEffect(() => {
    if (!warmOnVisible || isPreviewWarm || isImageGroup) return undefined;
    if (typeof IntersectionObserver === 'undefined' || !shouldWarmVisiblePreview()) return undefined;
    const element = cardRef.current;
    if (!element) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setIsPreviewWarm(true);
        observer.disconnect();
      },
      { root: null, rootMargin: '420px 0px', threshold: 0.01 }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [isImageGroup, isPreviewWarm, warmOnVisible]);

  return (
    <Card
      ref={cardRef}
      className={clsx(
        'relative overflow-visible rounded-card border border-border bg-surface-glass-90 p-0 shadow-card',
        menuOpen && 'z-30'
      )}
    >
      <figure
        className="group relative cursor-pointer overflow-hidden rounded-t-card"
        role="button"
        tabIndex={0}
        aria-label={openLabel}
        onClick={() => onOpen?.(group)}
        onPointerEnter={() => {
          setIsPreviewWarm(true);
          setHovered(true);
        }}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => {
          setIsPreviewWarm(true);
          setHovered(true);
        }}
        onBlur={() => setHovered(false)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onOpen?.(group);
          }
        }}
      >
        <div className="relative w-full" style={{ aspectRatio: '16 / 9' }}>
          <div
            className={clsx(
              'absolute inset-0 grid bg-placeholder',
              previewGridClass,
              isSinglePreview ? 'p-0' : 'gap-1 p-1'
            )}
          >
            {Array.from({ length: previewCount }).map((_, index) => {
              const preview = previews[index];
              const member = preview ? group.members.find((entry) => entry.id === preview.id) : undefined;
              const memberStatus = member?.status ?? 'completed';
              const memberAudioUrl = member?.audioUrl ?? member?.job?.audioUrl ?? null;
              const previewThumb = preview?.thumbUrl && !isPlaceholderMediaUrl(preview.thumbUrl) ? preview.thumbUrl : null;
              const previewHasMedia = Boolean(preview?.previewVideoUrl || preview?.videoUrl || previewThumb || memberAudioUrl);
              const isCompleted =
                memberStatus === 'completed' ||
                (previewHasMedia && memberStatus !== 'pending' && memberStatus !== 'failed');
              const previewKey = preview?.id ? `${preview.id}-${index}` : `preview-${index}`;
              return (
                <div
                  key={previewKey}
                  className={clsx(
                    'relative flex items-center justify-center overflow-hidden bg-[var(--surface-2)]',
                    isSinglePreview ? 'rounded-none' : 'rounded-card'
                  )}
                >
                  <div className="absolute inset-0">
                    {isCompleted ? (
                      <GroupPreviewMedia
                        preview={preview}
                        audioUrl={memberAudioUrl}
                        audioLabel={preview?.previewVideoUrl || preview?.videoUrl ? null : 'Audio'}
                        shouldPlay={hovered}
                        shouldWarm={isPreviewWarm || hovered}
                      />
                    ) : previewThumb ? (
                      <Image
                        src={previewThumb}
                        alt=""
                        fill
                        className="pointer-events-none object-contain"
                        sizes={GROUPED_JOB_THUMB_SIZES}
                      />
                    ) : null}
                  </div>
                  <div className="pointer-events-none block" style={{ width: '100%', aspectRatio: '16 / 9' }} aria-hidden />
                  {!isCompleted && member ? (
                    <ProcessingOverlay
                      className="absolute inset-0"
                      state={memberStatus === 'failed' ? 'error' : 'pending'}
                      message={member.message}
                      tone="light"
                      tileIndex={index + 1}
                      tileCount={previewCount}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
        {heroHasAudio ? <AudioEqualizerBadge tone="light" size="sm" label="Audio available" /> : null}
        {group.count > 1 ? (
          <div className="absolute left-3 top-3 inline-flex items-center rounded-full bg-surface-on-media-dark-65 px-2.5 py-0.5 text-[11px] font-semibold text-on-inverse shadow">
            {splitLabel}
          </div>
        ) : null}
        {onOpen ? (
          <div className="pointer-events-none absolute bottom-3 right-3 inline-flex max-w-[calc(100%-1.5rem)] items-center gap-1.5 rounded-full bg-surface-on-media-dark-75 px-2.5 py-1 text-[11px] font-semibold text-on-inverse shadow-md backdrop-blur transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus:opacity-100">
            <Maximize2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{openLabel}</span>
          </div>
        ) : null}
        {showMenu && (
          <button
            ref={menuButtonRef}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpen((prev) => !prev);
            }}
            className={clsx(
              'absolute right-3 top-3 flex h-8 items-center justify-center rounded-full border border-white/70 bg-white/85 text-black/80 shadow-md backdrop-blur hover:bg-white/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
              showCompactMenuButton ? 'gap-1.5 px-3 text-[12px] font-semibold' : 'w-8'
            )}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={actionMenuLabel}
          >
            {showCompactMenuButton ? (
              <>
                <span>{actionMenuLabel}</span>
                <ChevronDown
                  className={clsx('h-3.5 w-3.5 transition-transform', menuOpen ? 'rotate-180' : 'rotate-0')}
                  aria-hidden="true"
                />
              </>
            ) : (
              <span className="inline-flex translate-y-[1px] items-center justify-center gap-0.5" aria-hidden="true">
                <span className="h-1 w-1 rounded-full bg-black/60" />
                <span className="h-1 w-1 rounded-full bg-black/60" />
                <span className="h-1 w-1 rounded-full bg-black/60" />
              </span>
            )}
          </button>
        )}
      </figure>
      <div className="overflow-hidden rounded-b-card">
        <div className="flex items-center justify-between gap-4 border-t border-hairline bg-surface-glass-80 px-3 py-2 text-sm text-text-secondary">
          <div className="flex items-center gap-2">
            <EngineIcon engine={engine ?? undefined} label={hero.engineLabel} size={28} className="shrink-0" />
            {detailLabel ? (
              <span className="text-[11px] uppercase tracking-micro text-text-muted">{detailLabel}</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {(isImageGroup || showLibraryCta) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  if (showLibraryCta) {
                    handleAction('save-to-library');
                    return;
                  }
                  handleAction('save-image');
                }}
                disabled={savingToLibrary}
                title={savingToLibrary ? imageLibrarySavingLabel : imageLibraryLabel}
                className={clsx(
                  'min-h-0 h-auto rounded-pill px-2.5 py-1 text-[11px] font-semibold',
                  savingToLibrary
                    ? 'border-border bg-surface-glass-70 text-text-muted'
                    : 'border-brand bg-surface text-brand hover:bg-surface-2 hover:text-brand'
                )}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span className={showLibraryCta ? 'hidden xl:inline' : undefined}>
                  {savingToLibrary ? imageLibrarySavingLabel : imageLibraryLabel}
                </span>
              </Button>
            )}
            {isCurated ? (
              <div className="flex items-center gap-2">
                <span className="rounded-pill border border-hairline bg-bg px-2 py-0.5 text-[11px] font-semibold uppercase tracking-micro text-text-secondary">
                  Sample
                </span>
                {showImageCta ? (
                  <ButtonLink
                    href={imageCtaHref}
                    variant="outline"
                    size="sm"
                    className="min-h-0 h-auto rounded-pill border-brand px-2 py-0.5 text-[11px] font-semibold text-brand hover:bg-surface-2 hover:text-brand"
                  >
                    {imageCtaLabel}
                  </ButtonLink>
                ) : null}
              </div>
            ) : null}
            {formattedPrice ? (
              <span className="flex-shrink-0 text-[12px] font-semibold text-text-primary">{formattedPrice}</span>
            ) : null}
          </div>
        </div>
      </div>

      {showMenu && menuOpen && (
        <div
          ref={menuRef}
          className="absolute right-3 top-12 z-40 w-48 rounded-card border border-border bg-surface p-2 text-sm text-text-secondary shadow-card"
        >
          {showGalleryActions ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleAction('view')}
                className="w-full justify-between rounded-input px-2 py-1.5 text-left"
              >
                <span>Open</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemake}
                disabled={!onOpen}
                className={clsx(
                  'mt-1 w-full justify-between rounded-input px-2 py-1.5 text-left',
                  onOpen ? '' : 'cursor-not-allowed opacity-60'
                )}
              >
                <span>Remake</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleAction('download')}
                className="mt-1 w-full justify-between rounded-input px-2 py-1.5 text-left"
              >
                <span>Download</span>
              </Button>
            </>
          ) : showGalleryImageActions ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleAction('open')}
                className="w-full justify-between rounded-input px-2 py-1.5 text-left"
              >
                <span>Open</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleAction('save-image')}
                className="mt-1 w-full justify-between rounded-input px-2 py-1.5 text-left"
              >
                <span>Add to Library</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleAction('download')}
                className="mt-1 w-full justify-between rounded-input px-2 py-1.5 text-left"
              >
                <span>Download</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleAction('copy')}
                className="mt-1 w-full justify-between rounded-input px-2 py-1.5 text-left"
              >
                <span>Copy link</span>
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleAction('open')}
                className="w-full justify-between rounded-input px-2 py-1.5 text-left"
              >
                <span>{openLabel}</span>
                <span className="text-[11px] text-text-muted">↵</span>
              </Button>
              {recreateHref ? (
                <ButtonLink
                  href={recreateHref}
                  variant="ghost"
                  size="sm"
                  onClick={() => setMenuOpen(false)}
                  className="mt-1 w-full justify-between rounded-input px-2 py-1.5 text-left"
                >
                  <span>{recreateLabel}</span>
                </ButtonLink>
              ) : null}
              {showAdvancedMenuActions ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAction('continue')}
                    className="mt-1 w-full justify-between rounded-input px-2 py-1.5 text-left"
                  >
                    <span>Continue (Hero)</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAction('refine')}
                    className="mt-1 w-full justify-between rounded-input px-2 py-1.5 text-left"
                  >
                    <span>Refine (Hero)</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAction('branch')}
                    className="mt-1 w-full justify-between rounded-input px-2 py-1.5 text-left"
                  >
                    <span>Branch</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAction('compare')}
                    className="mt-1 w-full justify-between rounded-input px-2 py-1.5 text-left"
                  >
                    <span>Compare</span>
                  </Button>
                </>
              ) : null}
            </>
          )}
          {isImageGroup && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleAction('save-image')}
              className={clsx(
                'mt-1 w-full justify-between rounded-input px-2 py-1.5 text-left',
                savingToLibrary ? 'opacity-60' : ''
              )}
              disabled={savingToLibrary}
            >
              <span>{savingToLibrary ? 'Saving…' : 'Add to Library'}</span>
            </Button>
          )}
          {allowRemove && group.count <= 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleAction('remove')}
              className="mt-2 w-full justify-between rounded-input px-2 py-1.5 text-left text-error hover:bg-error-bg"
            >
              <span>Remove</span>
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
