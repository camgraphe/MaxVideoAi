'use client';

import clsx from 'clsx';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { PriceFactorsBar, type PriceFactorKind } from '@/components/PriceFactorsBar';
import { Card } from '@/components/ui/Card';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { MediaLightbox, type MediaLightboxEntry } from '@/components/MediaLightbox';
import type { EngineCaps, PreflightResponse } from '@/types/engines';

export type QuadTileAction = 'continue' | 'refine' | 'branch' | 'copy' | 'open';
export type QuadGroupAction = 'open' | 'compare' | 'hero';

export interface QuadPreviewTile {
  localKey: string;
  batchId: string;
  id: string;
  iterationIndex: number;
  iterationCount: number;
  videoUrl?: string;
  thumbUrl?: string;
  aspectRatio: string;
  progress: number;
  message: string;
  priceCents?: number;
  currency?: string;
  durationSec: number;
  engineLabel: string;
  engineId: string;
  etaLabel?: string;
  prompt: string;
  status: 'pending' | 'completed';
}

interface QuadPreviewPanelProps {
  tiles: QuadPreviewTile[];
  heroKey?: string;
  preflight: PreflightResponse | null;
  iterations: number;
  currency: string;
  totalPriceCents?: number | null;
  onNavigateFactor?: (kind: PriceFactorKind) => void;
  onTileAction: (action: QuadTileAction, tile: QuadPreviewTile) => void;
  onGroupAction: (action: QuadGroupAction, tile?: QuadPreviewTile) => void;
  onSelectHero: (tile: QuadPreviewTile) => void;
  engineMap: Map<string, EngineCaps>;
  onSaveComposite?: () => void;
}

const TILE_ACTIONS: Array<{ id: QuadTileAction; label: string; icon: string }> = [
  { id: 'continue', label: 'Continue', icon: '/assets/icons/play.svg' },
  { id: 'refine', label: 'Refine', icon: '/assets/icons/remix.svg' },
  { id: 'branch', label: 'Branch', icon: '/assets/icons/extend.svg' },
  { id: 'copy', label: 'Copy prompt', icon: '/assets/icons/copy.svg' },
  { id: 'open', label: 'Open in player', icon: '/assets/icons/expand.svg' },
];

function formatCurrency(amountCents?: number, currency = 'USD') {
  if (typeof amountCents !== 'number') return null;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amountCents / 100);
  } catch {
    return `${currency} ${(amountCents / 100).toFixed(2)}`;
  }
}

function getLayoutPlaceholder(count: number, iterationCount: number): number {
  if (iterationCount <= count) return 0;
  const missing = iterationCount - count;
  if (iterationCount === 3 && count === 3) {
    return 1;
  }
  return Math.max(0, missing);
}

export function QuadPreviewPanel({
  tiles,
  heroKey,
  preflight,
  iterations,
  currency,
  totalPriceCents,
  onNavigateFactor,
  onTileAction,
  onGroupAction,
  onSelectHero,
  engineMap,
  onSaveComposite,
}: QuadPreviewPanelProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const sortedTiles = useMemo(() => [...tiles].sort((a, b) => a.iterationIndex - b.iterationIndex), [tiles]);
  const iterationCount = sortedTiles[0]?.iterationCount ?? iterations ?? 1;
  const placeholders = getLayoutPlaceholder(sortedTiles.length, iterationCount);

  const tilesWithPlaceholders: Array<QuadPreviewTile | null> = useMemo(() => {
    const list: Array<QuadPreviewTile | null> = [...sortedTiles];
    for (let index = 0; index < placeholders; index += 1) {
      list.push(null);
    }
    if (iterationCount === 3 && list.length < 4) {
      list.push(null);
    }
    return list;
  }, [sortedTiles, placeholders, iterationCount]);

  const totalPrice = useMemo(() => {
    if (typeof totalPriceCents === 'number') return formatCurrency(totalPriceCents, currency);
    const aggregate = sortedTiles.reduce<number>((sum, tile) => sum + (tile.priceCents ?? 0), 0);
    return aggregate > 0 ? formatCurrency(aggregate, currency) : null;
  }, [sortedTiles, totalPriceCents, currency]);

  const mosaicSlots = Math.max(1, Math.min(4, iterationCount));
  const primaryAspect = sortedTiles[0]?.aspectRatio;
  const isVerticalComposite = primaryAspect === '9:16';
  const compositeAspectClass = 'aspect-[16/9]';
  const mosaicGridClass = isVerticalComposite
    ? mosaicSlots >= 4
      ? 'grid-cols-4'
      : mosaicSlots === 3
        ? 'grid-cols-3'
        : 'grid-cols-2'
    : 'grid-cols-2';

  const getAspectClass = (aspect?: string): string => {
    if (!aspect) return 'aspect-[16/9]';
    switch (aspect) {
      case '9:16':
        return 'aspect-[9/16]';
      case '1:1':
        return 'aspect-square';
      case '4:5':
        return 'aspect-[4/5]';
      case '16:9':
        return 'aspect-[16/9]';
      default: {
        if (aspect.includes(':')) {
          const [w, h] = aspect.split(':').map((value) => Number(value));
          if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
            return `aspect-[${w}/${h}]`;
          }
        }
        return 'aspect-[16/9]';
      }
    }
  };

  const mosaicPreviews = useMemo(
    () =>
      sortedTiles.slice(0, mosaicSlots).map((tile) => ({
        id: tile.localKey,
        localKey: tile.localKey,
        thumbUrl: tile.thumbUrl ?? undefined,
        videoUrl: tile.videoUrl ?? undefined,
        aspectRatio: tile.aspectRatio,
      })),
    [sortedTiles, mosaicSlots]
  );
  const mosaicStatusMap = useMemo(() => {
    const map = new Map<string, { status: QuadPreviewTile['status']; progress: number; message: string; etaLabel?: string }>();
    sortedTiles.forEach((tile) => {
      map.set(tile.localKey, { status: tile.status, progress: tile.progress, message: tile.message, etaLabel: tile.etaLabel });
    });
    return map;
  }, [sortedTiles]);
  const hasMosaicMedia = sortedTiles.some((tile) => tile.thumbUrl || tile.videoUrl);

  useEffect(() => {
    const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('[data-quad-video]'));
    videos.forEach((video) => {
      if (isPlaying) {
        const promise = video.play();
        if (promise && typeof promise.catch === 'function') {
          promise.catch(() => undefined);
        }
      } else {
        video.pause();
      }
    });
  }, [isPlaying, sortedTiles]);

  const lightboxEntries: MediaLightboxEntry[] = useMemo(
    () =>
      sortedTiles.map((tile) => ({
        id: tile.id,
        label: `Version ${tile.iterationIndex + 1}`,
        videoUrl: tile.videoUrl ?? undefined,
        thumbUrl: tile.thumbUrl ?? undefined,
        aspectRatio: tile.aspectRatio,
        status: tile.status,
        progress: tile.progress,
        message: tile.message,
        engineLabel: tile.engineLabel,
        durationSec: tile.durationSec,
        createdAt: undefined,
      })),
    [sortedTiles]
  );

  const groupTitle = `Prise ×${iterationCount}`;
  const heroTile = sortedTiles.find((tile) => tile.localKey === heroKey) ?? sortedTiles[0];

  return (
    <Card className="space-y-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[12px] font-semibold uppercase tracking-micro text-text-muted">Batch preview</h2>
          <p className="text-[12px] text-text-secondary">
            {iterationCount} takes · {totalPrice ? `Batch total ${totalPrice}` : 'Pricing pending'}
          </p>
        </div>
        {hasMosaicMedia && (
          <button
            type="button"
            onClick={onSaveComposite}
            className="inline-flex items-center gap-2 rounded-input border border-hairline bg-white px-3 py-1.5 text-[12px] font-medium text-text-secondary transition hover:border-accentSoft/50 hover:bg-accentSoft/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Image src="/assets/icons/save.svg" alt="" width={14} height={14} className="h-3.5 w-3.5" aria-hidden />
            Save composite
          </button>
        )}
      </header>

      <PriceFactorsBar
        preflight={preflight}
        currency={currency}
        iterations={iterations}
        onNavigate={onNavigateFactor}
      />

      {iterationCount > 1 && (
        <figure className="overflow-hidden rounded-card border border-border bg-white/80 p-3 text-center">
          <div className={clsx('relative w-full', compositeAspectClass)}>
            <div className={clsx('absolute inset-0 grid gap-2 rounded-[12px] bg-[#E7ECF7] p-1', mosaicGridClass)}>
              {Array.from({ length: mosaicSlots }).map((_, index) => {
                const preview = mosaicPreviews[index];
                const slotKey = preview?.localKey ?? preview?.id ?? `slot-${index}`;
                const statusInfo = preview?.localKey ? mosaicStatusMap.get(preview.localKey) : undefined;
                const aspectClass = getAspectClass(preview?.aspectRatio);
                return (
                  <div
                    key={slotKey}
                    data-quad-cell={slotKey}
                    className="relative flex items-center justify-center overflow-hidden rounded-[10px] bg-white/70"
                  >
                    <div className={clsx('relative w-full', aspectClass)}>
                      {preview?.videoUrl ? (
                        <video
                          data-quad-video
                          data-quad-fallback
                          src={preview.videoUrl}
                          className="absolute inset-0 h-full w-full object-cover pointer-events-none"
                          autoPlay={isPlaying}
                          muted
                          playsInline
                          loop
                          poster={preview?.thumbUrl}
                        />
                      ) : preview?.thumbUrl ? (
                        <Image
                          data-quad-fallback
                          src={preview.thumbUrl}
                          alt=""
                          fill
                          className="absolute inset-0 object-cover pointer-events-none"
                          priority={false}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#dfe7ff] via-white to-[#f1f4ff] text-[10px] font-semibold uppercase tracking-micro text-text-muted pointer-events-none">
                          En attente
                        </div>
                      )}
                    </div>
                    <div className="absolute inset-0 z-10" data-quad-player-root={slotKey} />
                    {statusInfo && statusInfo.status !== 'completed' && (
                      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/45 px-2 text-center text-[10px] text-white backdrop-blur-sm">
                        <span className="uppercase tracking-micro">Processing</span>
                        {statusInfo.message && <span className="mt-1 max-w-[120px] text-[10px] text-white/80">{statusInfo.message}</span>}
                        <span className="mt-1 text-[10px] font-semibold">{statusInfo.progress}%</span>
                        {statusInfo.etaLabel && <span className="mt-1 text-[9px] text-white/70">{statusInfo.etaLabel}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <figcaption className="mt-2 text-[11px] text-text-muted">Composite preview</figcaption>
        </figure>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-input border border-dashed border-border bg-white/70 px-3 py-2 text-[11px] font-medium uppercase tracking-micro text-text-muted">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPlaying((prev) => !prev)}
            className={clsx(
              'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-micro transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isPlaying ? 'border-hairline bg-white text-text-secondary hover:border-accentSoft/50 hover:bg-accentSoft/10' : 'border-accent bg-accent/10 text-accent'
            )}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            onClick={() => setIsLightboxOpen(true)}
            className="inline-flex items-center gap-1 rounded-full border border-hairline bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-micro text-text-secondary transition hover:border-accentSoft/50 hover:bg-accentSoft/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Image src="/assets/icons/expand.svg" alt="" width={12} height={12} className="h-3 w-3" />
            Open takes
          </button>
        </div>
        {heroTile && (
          <span className="text-[10px] uppercase tracking-micro text-text-muted">
            Hero • V{heroTile.iterationIndex + 1}
          </span>
        )}
      </div>

      {iterationCount <= 1 && (
        <div
          className={clsx(
            'grid gap-3',
            iterationCount <= 2 ? 'md:grid-cols-2' : 'md:grid-cols-2',
            iterationCount >= 3 ? 'auto-rows-[minmax(120px,1fr)]' : undefined
          )}
        >
          {tilesWithPlaceholders.map((tile, index) => {
            if (!tile) {
              return (
                <div
                  key={`placeholder-${index}`}
                  className="flex flex-col items-center justify-center rounded-card border border-dashed border-border bg-white/70 p-6 text-center text-sm text-text-muted"
                >
                  <span className="text-[12px] font-semibold uppercase tracking-micro text-text-muted">Waiting</span>
                  <span className="mt-1 text-[12px] text-text-secondary">Processing slot</span>
                </div>
              );
            }

            const engineCaps = engineMap.get(tile.engineId);
            const statusLabel = tile.status === 'completed' ? 'Final' : 'Processing';
            const formattedPrice = formatCurrency(tile.priceCents, tile.currency ?? currency);
            const versionLabel = `V${tile.iterationIndex + 1}`;
            const branchLabel = `Branch ${String.fromCharCode(65 + tile.iterationIndex)}`;
            const isHero = heroKey === tile.localKey;
            const aspectClass = tile.aspectRatio === '9:16' ? 'aspect-[9/16]' : tile.aspectRatio === '1:1' ? 'aspect-square' : 'aspect-[16/9]';

            return (
              <div
                key={tile.localKey}
                className={clsx(
                  'flex flex-col overflow-hidden rounded-card border',
                  isHero ? 'border-accent shadow-lg' : 'border-border bg-white/85 shadow-card'
                )}
              >
                <div className="flex items-center justify-between gap-2 border-b border-hairline bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-micro text-text-muted">
                  <span className="inline-flex items-center gap-2">
                    <span className={clsx('rounded-full px-2 py-0.5', isHero ? 'bg-accent/10 text-accent' : 'bg-black/5 text-text-secondary')}>
                      {versionLabel}
                    </span>
                    <span>{statusLabel}</span>
                    <span className="hidden sm:inline text-text-secondary">{branchLabel}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectHero(tile)}
                    className={clsx(
                      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isHero ? 'border-accent bg-accent text-white' : 'border-hairline bg-white text-text-secondary hover:border-accentSoft/50 hover:bg-accentSoft/10'
                    )}
                  >
                    <Image src="/assets/icons/pin.svg" alt="" width={12} height={12} className="h-3 w-3" aria-hidden />
                    Hero
                  </button>
                </div>

                <div className={clsx('relative bg-[#E7ECF7]', aspectClass)} data-quad-tile={tile.localKey}>
                  {tile.videoUrl ? (
                    <video
                      data-quad-video
                      data-quad-tile-fallback
                      key={tile.videoUrl}
                      src={tile.videoUrl}
                      className="absolute inset-0 h-full w-full object-cover pointer-events-none"
                      muted
                      playsInline
                      autoPlay={isPlaying}
                      loop
                      poster={tile.thumbUrl}
                    />
                  ) : tile.thumbUrl ? (
                    <Image
                      src={tile.thumbUrl}
                      alt=""
                      fill
                      sizes="(min-width: 768px) 50vw, 100vw"
                      className="absolute inset-0 object-cover pointer-events-none"
                      priority={false}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#dfe7ff] via-white to-[#f1f4ff] text-[11px] font-medium uppercase tracking-micro text-text-muted pointer-events-none">
                      Aperçu à venir
                    </div>
                  )}
                  <div className="absolute inset-0 z-10" data-quad-tile-root={tile.localKey} />
                  {tile.status !== 'completed' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 text-center text-[12px] text-white backdrop-blur-sm">
                      <span className="uppercase tracking-micro">Processing</span>
                      <span className="mt-1 text-[11px] text-white/80">{tile.message}</span>
                      <span className="mt-2 text-[11px] font-semibold text-white/90">{tile.progress}%</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 border-t border-hairline bg-white px-3 py-2 text-[12px] text-text-secondary">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 font-medium text-text-primary">
                      <EngineIcon engine={engineCaps ?? undefined} label={tile.engineLabel} size={28} className="shrink-0" />
                      {tile.engineLabel}
                    </span>
                    {formattedPrice && <span className="text-[11px] font-semibold text-text-primary">{formattedPrice}</span>}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-text-muted">
                    <span>{tile.durationSec}s</span>
                    <span>{tile.etaLabel ?? (tile.status === 'completed' ? 'Ready' : 'Estimating…')}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-1 border-t border-hairline bg-white px-2 py-1.5">
                  <div className="flex gap-1">
                    {TILE_ACTIONS.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        onClick={() => onTileAction(action.id, tile)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-hairline bg-white text-text-secondary transition hover:border-accentSoft/50 hover:bg-accentSoft/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={action.label}
                      >
                        <Image src={action.icon} alt="" width={14} height={14} className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => onGroupAction('open', tile)}
                    className="inline-flex items-center gap-1 rounded-full border border-hairline bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-micro text-text-secondary transition hover:border-accentSoft/50 hover:bg-accentSoft/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    View
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {isLightboxOpen && (
        <MediaLightbox
          title={groupTitle}
          subtitle={heroTile ? `${heroTile.engineLabel} • V${heroTile.iterationIndex + 1}` : undefined}
          prompt={heroTile?.prompt ?? undefined}
          metadata={[
            { label: 'Iterations', value: String(iterationCount) },
            { label: 'Durée (Hero)', value: heroTile ? `${heroTile.durationSec}s` : 'N/A' },
          ]}
          entries={lightboxEntries}
          onClose={() => setIsLightboxOpen(false)}
        />
      )}
    </Card>
  );
}
