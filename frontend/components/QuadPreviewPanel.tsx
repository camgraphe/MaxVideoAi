'use client';

import clsx from 'clsx';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { PriceFactorsBar, type PriceFactorKind } from '@/components/PriceFactorsBar';
import { Card } from '@/components/ui/Card';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { MediaLightbox, type MediaLightboxEntry } from '@/components/MediaLightbox';
import { AudioEqualizerBadge } from '@/components/ui/AudioEqualizerBadge';
import { Button } from '@/components/ui/Button';
import type { EngineCaps, PreflightResponse } from '@/types/engines';

export type QuadTileAction = 'continue' | 'refine' | 'branch' | 'copy' | 'open';
export type QuadGroupAction = 'open' | 'compare' | 'hero';

export interface QuadPreviewTile {
  localKey: string;
  batchId: string;
  id: string;
  jobId?: string;
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
  status: 'pending' | 'completed' | 'failed';
  hasAudio?: boolean;
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
  onRefreshJob?: (jobId: string) => Promise<void> | void;
}

const TILE_ACTIONS: Array<{ id: QuadTileAction; label: string; icon: string }> = [
  { id: 'continue', label: 'Continue', icon: '/assets/icons/play.svg' },
  { id: 'refine', label: 'Refine', icon: '/assets/icons/remix.svg' },
  { id: 'branch', label: 'Branch', icon: '/assets/icons/extend.svg' },
  { id: 'copy', label: 'Copy prompt', icon: '/assets/icons/copy.svg' },
  { id: 'open', label: 'Open in player', icon: '/assets/icons/expand.svg' },
];

function getAspectClass(aspectRatio?: string | null): string {
  const normalized = (aspectRatio ?? '').trim();
  switch (normalized) {
    case '1:1':
    case 'square':
      return 'aspect-square';
    case '9:16':
    case '9/16':
      return 'aspect-[9/16]';
    case '9:21':
    case '9/21':
      return 'aspect-[9/21]';
    case '16:9':
    case '16/9':
      return 'aspect-[16/9]';
    case '3:4':
    case '3/4':
      return 'aspect-[3/4]';
    case '4:3':
    case '4/3':
      return 'aspect-[4/3]';
    case '4:5':
    case '4/5':
      return 'aspect-[4/5]';
    case '5:4':
    case '5/4':
      return 'aspect-[5/4]';
    case '21:9':
    case '21/9':
      return 'aspect-[21/9]';
    default:
      return 'aspect-[16/9]';
  }
}

function formatCurrency(amountCents?: number, currency = 'USD') {
  if (typeof amountCents !== 'number') return null;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amountCents / 100);
  } catch {
    return `${currency} ${(amountCents / 100).toFixed(2)}`;
  }
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
  onRefreshJob,
}: QuadPreviewPanelProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const sortedTiles = useMemo(() => [...tiles].sort((a, b) => a.iterationIndex - b.iterationIndex), [tiles]);
  const iterationCount = sortedTiles[0]?.iterationCount ?? iterations ?? 1;

  const tilesWithPlaceholders: Array<QuadPreviewTile | null> = useMemo(() => {
    if (sortedTiles.length === 0) return [];

    const primaryAspectRatio = sortedTiles[0]?.aspectRatio ?? '16:9';
    const desiredSlots = (() => {
      if (iterationCount <= 1) return 1;
      if (iterationCount === 2) return 2;
      if (primaryAspectRatio === '9:16' && iterationCount === 3) return 3;
      if (iterationCount >= 3) return 4;
      return 1;
    })();

    const list: Array<QuadPreviewTile | null> = [...sortedTiles];
    while (list.length < desiredSlots) {
      list.push(null);
    }

    if (primaryAspectRatio === '9:16' && desiredSlots === 4 && sortedTiles.length === 2) {
      const first = sortedTiles[0] ?? null;
      const second = sortedTiles[1] ?? null;
      return [null, first, second, null];
    }

    return list.slice(0, desiredSlots);
  }, [sortedTiles, iterationCount]);

  const totalPrice = useMemo(() => {
    if (typeof totalPriceCents === 'number') return formatCurrency(totalPriceCents, currency);
    const aggregate = sortedTiles.reduce<number>((sum, tile) => sum + (tile.priceCents ?? 0), 0);
    return aggregate > 0 ? formatCurrency(aggregate, currency) : null;
  }, [sortedTiles, totalPriceCents, currency]);

  const primaryAspect = sortedTiles[0]?.aspectRatio ?? '16:9';
  const isVerticalComposite = primaryAspect === '9:16';
  const mosaicSlots = tilesWithPlaceholders.length;
  const compositeAspectClass = getAspectClass(primaryAspect);
  const mosaicGridClass = useMemo(() => {
    if (mosaicSlots <= 1) return 'grid-cols-1';
    if (isVerticalComposite) {
      if (mosaicSlots === 2) return 'grid-cols-2';
      if (mosaicSlots === 3) return 'grid-cols-3';
      return 'grid-cols-4';
    }
    return 'grid-cols-2';
  }, [mosaicSlots, isVerticalComposite]);


  const mosaicTiles = useMemo(() => tilesWithPlaceholders.slice(0, mosaicSlots), [tilesWithPlaceholders, mosaicSlots]);
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
        jobId: tile.id,
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
        hasAudio: Boolean(tile.hasAudio),
      })),
    [sortedTiles]
  );

  const groupTitle = `Prise ×${iterationCount}`;
  const heroTile = sortedTiles.find((tile) => tile.localKey === heroKey) ?? sortedTiles[0];

  return (
    <Card className="space-y-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-[12px] font-semibold uppercase tracking-micro text-text-muted">Batch preview</h2>
          <p className="text-[12px] text-text-secondary">
            {iterationCount} takes · {totalPrice ? `Batch total ${totalPrice}` : 'Pricing pending'}
          </p>
        </div>
        {hasMosaicMedia && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onSaveComposite}
            className="min-h-0 h-auto rounded-input border-hairline bg-surface px-3 py-1.5 text-[12px] font-medium text-text-secondary hover:border-text-muted hover:bg-surface-2"
          >
            <Image src="/assets/icons/save.svg" alt="" width={14} height={14} className="h-3.5 w-3.5" aria-hidden />
            Save composite
          </Button>
        )}
      </header>

      <PriceFactorsBar
        preflight={preflight}
        currency={currency}
        iterations={iterations}
        onNavigate={onNavigateFactor}
      />

      {iterationCount > 1 && (
        <figure className="overflow-hidden rounded-card border border-border bg-surface-glass-80 p-3 text-center">
          <div className={clsx('relative w-full', compositeAspectClass)}>
            <div className={clsx('absolute inset-0 grid gap-2 rounded-card bg-[#E7ECF7] p-1', mosaicGridClass)}>
              {mosaicTiles.map((preview, index) => {
                const slotKey = preview?.localKey ?? `slot-${index}`;
                const statusInfo = preview?.localKey ? mosaicStatusMap.get(preview.localKey) : undefined;
                const cellAspect = getAspectClass(preview?.aspectRatio ?? primaryAspect);
                const tileStatus = statusInfo?.status ?? preview?.status ?? 'pending';
                const failureMessageRaw = statusInfo?.message ?? preview?.message ?? null;
                const failureMessage =
                  failureMessageRaw && typeof failureMessageRaw === 'string'
                    ? failureMessageRaw.replace(/\s+/g, ' ').trim()
                    : null;
                const showPendingOverlay = tileStatus !== 'completed' && tileStatus !== 'failed';
                const showFailedOverlay = tileStatus === 'failed';

                return (
                  <div
                    key={slotKey}
                    data-quad-cell={slotKey}
                    className="relative flex items-center justify-center overflow-hidden rounded-input bg-surface-glass-70"
                  >
                    <div className={clsx('relative h-full w-full', cellAspect)}>
                      {tileStatus !== 'failed' && preview?.videoUrl ? (
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
                      ) : tileStatus !== 'failed' && preview?.thumbUrl ? (
                        <Image
                          data-quad-fallback
                          src={preview.thumbUrl}
                          alt=""
                          fill
                          className="absolute inset-0 object-cover pointer-events-none"
                          priority={false}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-[#dfe7ff] via-white to-[#f1f4ff]" />
                      )}
                      {Boolean(preview?.hasAudio) && tileStatus !== 'failed' ? (
                        <AudioEqualizerBadge tone="light" size="sm" label="Audio available" />
                      ) : null}
                    </div>
                    <div className="absolute inset-0 z-10" data-quad-player-root={slotKey} />
                    {showPendingOverlay && (
                      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-surface-on-media-dark-45 px-2 text-center text-[10px] text-white backdrop-blur-sm">
                        <span className="uppercase tracking-micro">Processing</span>
                        {(statusInfo?.message || preview?.message) && (
                          <span className="mt-1 max-w-[140px] text-[10px] text-on-media-80">
                            {statusInfo?.message ?? preview?.message}
                          </span>
                        )}
                        {typeof statusInfo?.progress === 'number' && (
                          <span className="mt-1 text-[10px] font-semibold">{statusInfo.progress}%</span>
                        )}
                        {statusInfo?.etaLabel && <span className="mt-1 text-[9px] text-on-media-70">{statusInfo.etaLabel}</span>}
                      </div>
                    )}
                    {showFailedOverlay && (
                      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1 rounded-input bg-red-50 px-3 text-center text-[10px] text-red-700">
                        <span className="font-semibold uppercase tracking-micro text-red-600">Failed</span>
                        {failureMessage && <span className="line-clamp-4 text-[10px] leading-tight text-red-700">{failureMessage}</span>}
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

      {iterationCount <= 1 && (
        <div
          className={clsx(
            'grid grid-gap-sm',
            sortedTiles.length === 1 ? 'md:grid-cols-1' : 'md:grid-cols-2',
            iterationCount >= 3 ? 'auto-rows-[minmax(120px,1fr)]' : undefined
          )}
        >
          {tilesWithPlaceholders.map((tile, index) => {
            if (!tile) {
              return (
                <div
                  key={`placeholder-${index}`}
                  className="flex rounded-card border border-dashed border-border bg-gradient-to-br from-[#eef2ff] via-white to-[#f2f6ff]"
                />
              );
            }

            const engineCaps = engineMap.get(tile.engineId);
            const statusLabel =
              tile.status === 'completed' ? 'Final' : tile.status === 'failed' ? 'Failed' : 'Processing';
            const formattedPrice = formatCurrency(tile.priceCents, tile.currency ?? currency);
            const versionLabel = `V${tile.iterationIndex + 1}`;
            const branchLabel = `Branch ${String.fromCharCode(65 + tile.iterationIndex)}`;
            const isHero = heroKey === tile.localKey;
            const tileAspectClass = getAspectClass(tile.aspectRatio);
            const isFailed = tile.status === 'failed';
            const failureMessage =
              tile.message && typeof tile.message === 'string' ? tile.message.replace(/\s+/g, ' ').trim() : null;

            return (
              <div
                key={tile.localKey}
                className={clsx(
                  'flex flex-col overflow-hidden rounded-card border',
                  isFailed
                    ? 'border-red-200 bg-red-50/60 shadow-card'
                    : isHero
                      ? 'border-brand shadow-lg'
                      : 'border-border bg-surface-glass-85 shadow-card'
                )}
              >
                <div
                  className={clsx(
                    'flex items-center justify-between gap-2 border-b px-3 py-2 text-[11px] font-semibold uppercase tracking-micro',
                    isFailed
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-hairline bg-surface text-text-muted'
                  )}
                >
                  <span className="inline-flex items-center gap-2">
                    <span className={clsx('rounded-full px-2 py-0.5', isHero ? 'bg-surface-2 text-brand' : 'bg-surface-on-media-dark-5 text-text-secondary')}>
                      {versionLabel}
                    </span>
                    <span>{statusLabel}</span>
                    <span className="hidden sm:inline text-text-secondary">{branchLabel}</span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onSelectHero(tile)}
                    className={clsx(
                      'min-h-0 h-auto rounded-full px-2 py-0.5 text-[10px]',
                      isHero ? 'border-brand bg-brand text-on-brand' : 'border-hairline bg-surface text-text-secondary hover:border-text-muted hover:bg-surface-2'
                    )}
                  >
                    <Image src="/assets/icons/pin.svg" alt="" width={12} height={12} className="h-3 w-3" aria-hidden />
                    Hero
                  </Button>
                </div>

                <div className={clsx('relative bg-[#E7ECF7]', tileAspectClass)} data-quad-tile={tile.localKey}>
                  <div className="relative h-full w-full">
                    {tile.status !== 'failed' && tile.videoUrl ? (
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
                    ) : tile.status !== 'failed' && tile.thumbUrl ? (
                      <Image
                        src={tile.thumbUrl}
                        alt=""
                        fill
                        sizes="(min-width: 768px) 50vw, 100vw"
                        className="absolute inset-0 object-cover pointer-events-none"
                        priority={false}
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-[#dfe7ff] via-white to-[#f1f4ff]" />
                    )}
                    {tile.status !== 'failed' && tile.videoUrl && tile.hasAudio ? (
                      <AudioEqualizerBadge tone="light" size="sm" label="Audio available" />
                    ) : null}
                  </div>
                  <div className="absolute inset-0 z-10" data-quad-tile-root={tile.localKey} />
                  {tile.status === 'failed' ? (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-red-50/95 px-4 text-center text-[12px] text-red-700 backdrop-blur-sm">
                      <span className="font-semibold uppercase tracking-micro text-red-600">Generation failed</span>
                      <span className="text-[11px] leading-snug text-red-700">
                        {failureMessage ??
                          'The service reported a failure without details. Try again. If it fails repeatedly, contact support with your request ID.'}
                      </span>
                    </div>
                  ) : tile.status !== 'completed' ? (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-surface-on-media-dark-40 px-4 text-center text-[12px] text-white backdrop-blur-sm">
                      <span className="uppercase tracking-micro">Processing</span>
                      {tile.message && <span className="mt-1 text-[11px] text-on-media-80">{tile.message}</span>}
                      <span className="mt-2 text-[11px] font-semibold text-on-media-90">{tile.progress}%</span>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2 border-t border-hairline bg-surface px-3 py-2 text-[12px] text-text-secondary">
                  {isFailed && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-left">
                      <p className="text-[10px] font-semibold uppercase tracking-micro text-red-600">Refund note</p>
                      <p className="mt-1 text-[11px] leading-snug text-red-700">
                        {failureMessage ??
                          'The service reported a failure without details. Try again. If it fails repeatedly, contact support with your request ID.'}
                      </p>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 font-medium text-text-primary">
                      <EngineIcon engine={engineCaps ?? undefined} label={tile.engineLabel} size={28} className="shrink-0" />
                      {tile.engineLabel}
                    </span>
                    {formattedPrice && <span className="text-[11px] font-semibold text-text-primary">{formattedPrice}</span>}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-text-muted">
                    <span>{tile.durationSec}s</span>
                    <span>
                      {tile.etaLabel ??
                        (tile.status === 'completed' ? 'Ready' : tile.status === 'failed' ? 'Failed' : 'Estimating…')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-1 border-t border-hairline bg-surface px-2 py-1.5">
                  <div className="flex gap-1">
                    {TILE_ACTIONS.map((action) => (
                      <Button
                        key={action.id}
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onTileAction(action.id, tile)}
                        className="h-8 w-8 min-h-0 rounded-full border-hairline bg-surface p-0 text-text-secondary hover:border-text-muted hover:bg-surface-2"
                        aria-label={action.label}
                      >
                        <Image src={action.icon} alt="" width={14} height={14} className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    ))}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onGroupAction('open', tile)}
                    className="min-h-0 h-auto rounded-full border-hairline bg-surface px-2.5 py-1 text-[11px] font-semibold uppercase tracking-micro text-text-secondary hover:border-text-muted hover:bg-surface-2"
                  >
                    View
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-input border border-dashed border-border bg-surface-glass-70 px-3 py-2 text-[11px] font-medium uppercase tracking-micro text-text-muted">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setIsPlaying((prev) => !prev)}
            className={clsx(
              'min-h-0 h-auto rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-micro',
              isPlaying ? 'border-hairline bg-surface text-text-secondary hover:border-text-muted hover:bg-surface-2' : 'border-brand bg-surface-2 text-brand'
            )}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setIsLightboxOpen(true)}
            className="min-h-0 h-auto rounded-full border-hairline bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-micro text-text-secondary hover:border-text-muted hover:bg-surface-2"
          >
            <Image src="/assets/icons/expand.svg" alt="" width={12} height={12} className="h-3 w-3" />
            Open takes
          </Button>
        </div>
        {heroTile && (
          <span className="text-[10px] uppercase tracking-micro text-text-muted">
            Hero • V{heroTile.iterationIndex + 1}
          </span>
        )}
      </div>

      {isLightboxOpen && (
        <MediaLightbox
          title={groupTitle}
          subtitle={heroTile ? `${heroTile.engineLabel} • V${heroTile.iterationIndex + 1}` : undefined}
          prompt={heroTile?.prompt ?? undefined}
          metadata={[
            { label: 'Iterations', value: String(iterationCount) },
            { label: 'Duration (hero)', value: heroTile ? `${heroTile.durationSec}s` : 'N/A' },
          ]}
          entries={lightboxEntries}
          onClose={() => setIsLightboxOpen(false)}
          onRefreshEntry={
            onRefreshJob
              ? (entry) => {
                  const jobId = entry.jobId ?? entry.id;
                  if (!jobId) return;
                  return onRefreshJob(jobId);
                }
              : undefined
          }
        />
      )}
    </Card>
  );
}
