'use client';

/* eslint-disable @next/next/no-img-element */
import clsx from 'clsx';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { EngineCaps } from '@/types/engines';
import type { GroupSummary } from '@/types/groups';
import { Card } from '@/components/ui/Card';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { AudioEqualizerBadge } from '@/components/ui/AudioEqualizerBadge';
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
  | 'save-image';

function ThumbImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const baseClass = clsx('h-full w-full pointer-events-none', className);
  if (src.startsWith('data:')) {
    return <img src={src} alt={alt} className={baseClass} />;
  }
  return <Image src={src} alt={alt} fill className={baseClass} />;
}

function GroupPreviewMedia({
  preview,
  shouldPlay,
}: {
  preview: GroupSummary['previews'][number] | undefined;
  shouldPlay: boolean;
}) {
  const hasVideo = Boolean(preview?.videoUrl);
  const thumbSrc = preview?.thumbUrl && !isPlaceholderMediaUrl(preview.thumbUrl) ? preview.thumbUrl : null;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    if (!hasVideo) return;
    setVideoReady(false);
  }, [hasVideo, preview?.videoUrl]);

  useEffect(() => {
    if (!hasVideo) return;
    const element = videoRef.current;
    if (!element) return;
    if (shouldPlay) {
      const playPromise = element.play();
      if (playPromise) {
        playPromise.catch(() => {
          /* ignore autoplay rejection */
        });
      }
    } else {
      element.pause();
    }
  }, [hasVideo, preview?.videoUrl, shouldPlay]);

  if (hasVideo && preview?.videoUrl) {
    const poster = thumbSrc ?? undefined;
    return (
      <div className="relative h-full w-full">
        {thumbSrc ? (
          <ThumbImage
            src={thumbSrc}
            alt=""
            className={clsx(
              'absolute inset-0 object-contain transition-opacity duration-150 ease-out',
              videoReady && shouldPlay ? 'opacity-0' : 'opacity-100'
            )}
          />
        ) : null}
        <video
          ref={videoRef}
          src={preview.videoUrl}
          poster={poster}
          className={clsx(
            'absolute inset-0 h-full w-full pointer-events-none object-contain transition-opacity duration-150 ease-out',
            videoReady ? 'opacity-100' : 'opacity-0'
          )}
          muted
          playsInline
          loop
          preload="auto"
          onLoadedData={() => setVideoReady(true)}
        />
      </div>
    );
  }
  if (thumbSrc) {
    return <ThumbImage src={thumbSrc} alt="" className="object-contain" />;
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
  recreateHref?: string;
  recreateLabel?: string;
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
  recreateHref,
  recreateLabel = 'Generate same settings',
}: GroupedJobCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
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

  return (
    <Card
      className={clsx(
        'relative overflow-visible rounded-card border border-border bg-surface-glass-90 p-0 shadow-card',
        menuOpen && 'z-30'
      )}
    >
      <figure
        className="relative cursor-pointer overflow-hidden rounded-t-card"
        role="button"
        tabIndex={0}
        onClick={() => onOpen?.(group)}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onOpen?.(group);
          }
        }}
      >
        <div className="relative w-full" style={{ aspectRatio: '16 / 9' }}>
          <div className={clsx('absolute inset-0 grid gap-1 bg-[#E7ECF7] p-1', previewGridClass)}>
            {Array.from({ length: previewCount }).map((_, index) => {
              const preview = previews[index];
              const member = preview ? group.members.find((entry) => entry.id === preview.id) : undefined;
              const memberStatus = member?.status ?? 'completed';
              const previewThumb = preview?.thumbUrl && !isPlaceholderMediaUrl(preview.thumbUrl) ? preview.thumbUrl : null;
              const previewHasMedia = Boolean(preview?.videoUrl || previewThumb);
              const isCompleted = memberStatus === 'completed' || previewHasMedia;
              const previewKey = preview?.id ? `${preview.id}-${index}` : `preview-${index}`;
              return (
                <div
                  key={previewKey}
                  className="relative flex items-center justify-center overflow-hidden rounded-card bg-[var(--surface-2)]"
                >
                  <div className="absolute inset-0">
                    {isCompleted ? (
                      <GroupPreviewMedia preview={preview} shouldPlay={hovered} />
                    ) : previewThumb ? (
                      <Image src={previewThumb} alt="" fill className="pointer-events-none object-contain" />
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
        {showMenu && (
          <Button
            ref={menuButtonRef}
            type="button"
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpen((prev) => !prev);
            }}
            className="absolute right-3 top-3 h-8 w-8 min-h-0 rounded-full border border-surface-on-media-30 bg-surface-on-media-dark-55 p-0 text-on-inverse hover:bg-surface-on-media-dark-70"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Group actions"
          >
            <span className="text-lg leading-none">•••</span>
          </Button>
        )}
      </figure>
      <div className="flex items-center justify-between gap-4 border-t border-hairline bg-surface-glass-80 px-3 py-2 text-sm text-text-secondary">
        <div className="flex items-center gap-2">
          <EngineIcon engine={engine ?? undefined} label={hero.engineLabel} size={28} className="shrink-0" />
          {detailLabel ? (
            <span className="text-[11px] uppercase tracking-micro text-text-muted">{detailLabel}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {isImageGroup && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                handleAction('save-image');
              }}
              disabled={savingToLibrary}
              className={clsx(
                'min-h-0 h-auto rounded-pill px-2.5 py-1 text-[11px] font-semibold',
                savingToLibrary
                  ? 'border-border bg-surface-glass-70 text-text-muted'
                  : 'border-brand bg-surface text-brand hover:bg-surface-2 hover:text-brand'
              )}
            >
              {savingToLibrary ? imageLibrarySavingLabel : imageLibraryLabel}
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
                <span>Open group</span>
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
              className="mt-2 w-full justify-between rounded-input px-2 py-1.5 text-left text-red-600 hover:bg-red-50"
            >
              <span>Remove</span>
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
