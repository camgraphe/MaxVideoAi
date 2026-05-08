'use client';

/* eslint-disable @next/next/no-img-element */
import clsx from 'clsx';
import { ChevronDown, Maximize2, Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { EngineCaps } from '@/types/engines';
import type { GroupSummary } from '@/types/groups';
import { Card } from '@/components/ui/Card';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { AudioEqualizerBadge } from '@/components/ui/AudioEqualizerBadge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { CURRENCY_LOCALE } from '@/lib/intl';
import { GroupedJobCardMenu } from './GroupedJobCardMenu';
import { shouldWarmVisiblePreview } from './GroupedJobCardMedia';
import { GroupedJobCardPreviewGrid } from './GroupedJobCardPreviewGrid';
import type { GroupedJobAction, GroupedJobMenuVariant } from './grouped-job-card-types';

export type { GroupedJobAction } from './grouped-job-card-types';
export { GroupPreviewMedia } from './GroupedJobCardMedia';

export interface GroupedJobCardProps {
  group: GroupSummary;
  engine?: EngineCaps | null;
  onOpen?: (group: GroupSummary) => void;
  onAction?: (group: GroupSummary, action: GroupedJobAction) => void;
  metaLabel?: string | null;
  actionMenu?: boolean;
  menuVariant?: GroupedJobMenuVariant;
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
  showOpenOverlay?: boolean;
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
  showOpenOverlay = true,
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
          <GroupedJobCardPreviewGrid
            group={group}
            hovered={hovered}
            isPreviewWarm={isPreviewWarm}
            isSinglePreview={isSinglePreview}
            previewCount={previewCount}
            previewGridClass={previewGridClass}
            previews={previews}
          />
        </div>
        {heroHasAudio ? <AudioEqualizerBadge tone="light" size="sm" label="Audio available" /> : null}
        {group.count > 1 ? (
          <div className="absolute left-3 top-3 inline-flex items-center rounded-full bg-surface-on-media-dark-65 px-2.5 py-0.5 text-[11px] font-semibold text-on-inverse shadow">
            {splitLabel}
          </div>
        ) : null}
        {showOpenOverlay && onOpen ? (
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

      {showMenu && menuOpen ? (
        <GroupedJobCardMenu
          allowRemove={allowRemove}
          closeMenu={() => setMenuOpen(false)}
          group={group}
          handleAction={handleAction}
          handleRemake={handleRemake}
          isImageGroup={isImageGroup}
          menuRef={menuRef}
          menuVariant={menuVariant}
          onOpen={onOpen}
          openLabel={openLabel}
          recreateHref={recreateHref}
          recreateLabel={recreateLabel}
          savingToLibrary={savingToLibrary}
        />
      ) : null}
    </Card>
  );
}
