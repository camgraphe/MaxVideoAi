'use client';

import clsx from 'clsx';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PriceFactorsBar } from '@/components/PriceFactorsBar';
import { Card } from '@/components/ui/Card';
import { MediaLightbox, type MediaLightboxEntry } from '@/components/MediaLightbox';
import { QuadMosaicFigure } from '@/components/quad-preview/QuadMosaicFigure';
import { QuadSingleTilesGrid } from '@/components/quad-preview/QuadSingleTilesGrid';
import { buildTilesWithPlaceholders, formatCurrency } from '@/components/quad-preview/quad-preview-helpers';
import { Button } from '@/components/ui/Button';
import { PRIMARY_VIDEO_READY_EVENT } from '@/lib/video-warmup-events';
import type { QuadMosaicStatus, QuadPreviewPanelProps } from '@/components/quad-preview/quad-preview-types';

export type {
  QuadGroupAction,
  QuadPreviewPanelProps,
  QuadPreviewTile,
  QuadTileAction,
} from '@/components/quad-preview/quad-preview-types';

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
  const lastPrimaryReadyEventKeyRef = useRef<string | null>(null);

  const sortedTiles = useMemo(() => [...tiles].sort((a, b) => a.iterationIndex - b.iterationIndex), [tiles]);
  const iterationCount = sortedTiles[0]?.iterationCount ?? iterations ?? 1;

  const tilesWithPlaceholders = useMemo(
    () => buildTilesWithPlaceholders(sortedTiles, iterationCount),
    [sortedTiles, iterationCount]
  );

  const totalPrice = useMemo(() => {
    if (typeof totalPriceCents === 'number') return formatCurrency(totalPriceCents, currency);
    const aggregate = sortedTiles.reduce<number>((sum, tile) => sum + (tile.priceCents ?? 0), 0);
    return aggregate > 0 ? formatCurrency(aggregate, currency) : null;
  }, [sortedTiles, totalPriceCents, currency]);

  const primaryAspect = sortedTiles[0]?.aspectRatio ?? '16:9';
  const isVerticalComposite = primaryAspect === '9:16';
  const mosaicSlots = tilesWithPlaceholders.length;
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
    const map = new Map<string, QuadMosaicStatus>();
    sortedTiles.forEach((tile) => {
      map.set(tile.localKey, { status: tile.status, progress: tile.progress, message: tile.message, etaLabel: tile.etaLabel });
    });
    return map;
  }, [sortedTiles]);
  const hasMosaicMedia = sortedTiles.some((tile) => tile.thumbUrl || tile.videoUrl);

  useEffect(() => {
    const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('[data-quad-video]'));
    videos.forEach((video) => {
      const isActivePreview = video.dataset.quadVideo === 'active';
      if (isPlaying && isActivePreview) {
        const promise = video.play();
        if (promise && typeof promise.catch === 'function') {
          promise.catch(() => undefined);
        }
      } else {
        video.pause();
      }
    });
  }, [heroKey, isPlaying, sortedTiles]);

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
  const heroKeyResolved = heroTile?.localKey ?? null;
  const handlePrimaryVideoReady = useCallback(
    (tileKey?: string | null) => {
      if (!tileKey || tileKey !== heroKeyResolved || lastPrimaryReadyEventKeyRef.current === tileKey) return;
      lastPrimaryReadyEventKeyRef.current = tileKey;
      const warmupWindow = window as Window & { __maxVideoPrimaryVideoReady?: boolean };
      warmupWindow.__maxVideoPrimaryVideoReady = true;
      window.dispatchEvent(new Event(PRIMARY_VIDEO_READY_EVENT));
    },
    [heroKeyResolved]
  );

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

      {iterationCount > 1 ? (
        <QuadMosaicFigure
          heroTile={heroTile}
          isPlaying={isPlaying}
          mosaicGridClass={mosaicGridClass}
          mosaicStatusMap={mosaicStatusMap}
          mosaicTiles={mosaicTiles}
          primaryAspect={primaryAspect}
          onPrimaryVideoReady={handlePrimaryVideoReady}
        />
      ) : null}

      {iterationCount <= 1 ? (
        <QuadSingleTilesGrid
          currency={currency}
          engineMap={engineMap}
          heroKey={heroKey}
          heroTile={heroTile}
          isPlaying={isPlaying}
          iterationCount={iterationCount}
          sortedTilesLength={sortedTiles.length}
          tilesWithPlaceholders={tilesWithPlaceholders}
          onGroupAction={onGroupAction}
          onPrimaryVideoReady={handlePrimaryVideoReady}
          onSelectHero={onSelectHero}
          onTileAction={onTileAction}
        />
      ) : null}

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
