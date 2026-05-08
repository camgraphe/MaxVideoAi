'use client';

import clsx from 'clsx';
import Image from 'next/image';
import { AudioEqualizerBadge } from '@/components/ui/AudioEqualizerBadge';
import { Button } from '@/components/ui/Button';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { formatCurrency, getAspectClass, TILE_ACTIONS } from './quad-preview-helpers';
import type { QuadGroupAction, QuadPreviewTile, QuadTileAction } from './quad-preview-types';
import type { EngineCaps } from '@/types/engines';

type QuadSingleTilesGridProps = {
  currency: string;
  engineMap: Map<string, EngineCaps>;
  heroKey?: string;
  heroTile?: QuadPreviewTile;
  isPlaying: boolean;
  iterationCount: number;
  sortedTilesLength: number;
  tilesWithPlaceholders: Array<QuadPreviewTile | null>;
  onGroupAction: (action: QuadGroupAction, tile?: QuadPreviewTile) => void;
  onPrimaryVideoReady: (tileKey?: string | null) => void;
  onSelectHero: (tile: QuadPreviewTile) => void;
  onTileAction: (action: QuadTileAction, tile: QuadPreviewTile) => void;
};

export function QuadSingleTilesGrid({
  currency,
  engineMap,
  heroKey,
  heroTile,
  isPlaying,
  iterationCount,
  sortedTilesLength,
  tilesWithPlaceholders,
  onGroupAction,
  onPrimaryVideoReady,
  onSelectHero,
  onTileAction,
}: QuadSingleTilesGridProps) {
  return (
    <div
      className={clsx(
        'grid grid-gap-sm',
        sortedTilesLength === 1 ? 'md:grid-cols-1' : 'md:grid-cols-2',
        iterationCount >= 3 ? 'auto-rows-[minmax(120px,1fr)]' : undefined
      )}
    >
      {tilesWithPlaceholders.map((tile, index) => {
        if (!tile) {
          return (
            <div
              key={`placeholder-${index}`}
              className="flex rounded-card border border-dashed border-border bg-gradient-to-br from-surface-2 via-surface to-surface-2"
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
        const shouldPlayPreview = Boolean(isPlaying && tile.localKey === heroTile?.localKey);

        return (
          <div
            key={tile.localKey}
            className={clsx(
              'flex flex-col overflow-hidden rounded-card border',
              isFailed
                ? 'border-error-border bg-error-bg shadow-card'
                : isHero
                  ? 'border-brand shadow-lg'
                  : 'border-border bg-surface-glass-85 shadow-card'
            )}
          >
            <div
              className={clsx(
                'flex items-center justify-between gap-2 border-b px-3 py-2 text-[11px] font-semibold uppercase tracking-micro',
                isFailed ? 'border-error-border bg-error-bg text-error' : 'border-hairline bg-surface text-text-muted'
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

            <div className={clsx('relative bg-placeholder', tileAspectClass)} data-quad-tile={tile.localKey}>
              <div className="relative h-full w-full">
                {tile.status !== 'failed' && tile.videoUrl ? (
                  <video
                    data-quad-video={shouldPlayPreview ? 'active' : 'idle'}
                    data-quad-tile-fallback
                    key={tile.videoUrl}
                    src={tile.videoUrl}
                    className="absolute inset-0 h-full w-full object-cover pointer-events-none"
                    muted
                    playsInline
                    autoPlay={shouldPlayPreview}
                    loop
                    preload={shouldPlayPreview ? 'auto' : 'none'}
                    poster={tile.thumbUrl}
                    onLoadedData={() => onPrimaryVideoReady(tile.localKey)}
                    onCanPlay={() => onPrimaryVideoReady(tile.localKey)}
                  />
                ) : tile.status !== 'failed' && tile.thumbUrl ? (
                  <Image
                    src={tile.thumbUrl}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="absolute inset-0 object-cover pointer-events-none"
                    priority={false}
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-surface-2 via-surface to-surface-2" />
                )}
                {tile.status !== 'failed' && tile.videoUrl && tile.hasAudio ? (
                  <AudioEqualizerBadge tone="light" size="sm" label="Audio available" />
                ) : null}
              </div>
              <div className="absolute inset-0 z-10" data-quad-tile-root={tile.localKey} />
              {tile.status === 'failed' ? (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-error-bg px-4 text-center text-[12px] text-error backdrop-blur-sm">
                  <span className="font-semibold uppercase tracking-micro text-error">Generation failed</span>
                  <span className="text-[11px] leading-snug text-error">
                    {failureMessage ??
                      'The service reported a failure without details. Try again. If it fails repeatedly, contact support with your request ID.'}
                  </span>
                </div>
              ) : tile.status !== 'completed' ? (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-surface-on-media-dark-40 px-4 text-center text-[12px] text-on-inverse backdrop-blur-sm">
                  <span className="uppercase tracking-micro">Processing</span>
                  {tile.message ? <span className="mt-1 text-[11px] text-on-media-80">{tile.message}</span> : null}
                  <span className="mt-2 text-[11px] font-semibold text-on-media-90">{tile.progress}%</span>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 border-t border-hairline bg-surface px-3 py-2 text-[12px] text-text-secondary">
              {isFailed ? (
                <div className="rounded-md border border-error-border bg-error-bg px-3 py-2 text-left">
                  <p className="text-[10px] font-semibold uppercase tracking-micro text-error">Refund note</p>
                  <p className="mt-1 text-[11px] leading-snug text-error">
                    {failureMessage ??
                      'The service reported a failure without details. Try again. If it fails repeatedly, contact support with your request ID.'}
                  </p>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 font-medium text-text-primary">
                  <EngineIcon engine={engineCaps ?? undefined} label={tile.engineLabel} size={28} className="shrink-0" />
                  {tile.engineLabel}
                </span>
                {formattedPrice ? <span className="text-[11px] font-semibold text-text-primary">{formattedPrice}</span> : null}
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
  );
}
