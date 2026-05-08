'use client';

import clsx from 'clsx';
import Image from 'next/image';
import { AudioEqualizerBadge } from '@/components/ui/AudioEqualizerBadge';
import { getAspectClass } from './quad-preview-helpers';
import type { QuadMosaicStatus, QuadPreviewTile } from './quad-preview-types';

type QuadMosaicFigureProps = {
  heroTile?: QuadPreviewTile;
  isPlaying: boolean;
  mosaicGridClass: string;
  mosaicStatusMap: Map<string, QuadMosaicStatus>;
  mosaicTiles: Array<QuadPreviewTile | null>;
  primaryAspect: string;
  onPrimaryVideoReady: (tileKey?: string | null) => void;
};

export function QuadMosaicFigure({
  heroTile,
  isPlaying,
  mosaicGridClass,
  mosaicStatusMap,
  mosaicTiles,
  primaryAspect,
  onPrimaryVideoReady,
}: QuadMosaicFigureProps) {
  return (
    <figure className="overflow-hidden rounded-card border border-border bg-surface-glass-80 p-3 text-center">
      <div className={clsx('relative w-full', getAspectClass(primaryAspect))}>
        <div className={clsx('absolute inset-0 grid gap-2 rounded-card bg-placeholder p-1', mosaicGridClass)}>
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
            const shouldPlayPreview = Boolean(isPlaying && preview?.localKey === heroTile?.localKey);

            return (
              <div
                key={slotKey}
                data-quad-cell={slotKey}
                className="relative flex items-center justify-center overflow-hidden rounded-input bg-surface-glass-70"
              >
                <div className={clsx('relative h-full w-full', cellAspect)}>
                  {tileStatus !== 'failed' && preview?.videoUrl ? (
                    <video
                      data-quad-video={shouldPlayPreview ? 'active' : 'idle'}
                      data-quad-fallback
                      src={preview.videoUrl}
                      className="absolute inset-0 h-full w-full object-cover pointer-events-none"
                      autoPlay={shouldPlayPreview}
                      muted
                      playsInline
                      loop
                      preload={shouldPlayPreview ? 'auto' : 'none'}
                      poster={preview?.thumbUrl}
                      onLoadedData={() => onPrimaryVideoReady(preview?.localKey)}
                      onCanPlay={() => onPrimaryVideoReady(preview?.localKey)}
                    />
                  ) : tileStatus !== 'failed' && preview?.thumbUrl ? (
                    <Image
                      data-quad-fallback
                      src={preview.thumbUrl}
                      alt=""
                      fill
                      sizes="(max-width: 768px) 50vw, 320px"
                      className="absolute inset-0 object-cover pointer-events-none"
                      priority={false}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-surface-2 via-surface to-surface-2" />
                  )}
                  {Boolean(preview?.hasAudio) && tileStatus !== 'failed' ? (
                    <AudioEqualizerBadge tone="light" size="sm" label="Audio available" />
                  ) : null}
                </div>
                <div className="absolute inset-0 z-10" data-quad-player-root={slotKey} />
                {showPendingOverlay ? (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-surface-on-media-dark-45 px-2 text-center text-[10px] text-on-inverse backdrop-blur-sm">
                    <span className="uppercase tracking-micro">Processing</span>
                    {(statusInfo?.message || preview?.message) ? (
                      <span className="mt-1 max-w-[140px] text-[10px] text-on-media-80">
                        {statusInfo?.message ?? preview?.message}
                      </span>
                    ) : null}
                    {typeof statusInfo?.progress === 'number' ? (
                      <span className="mt-1 text-[10px] font-semibold">{statusInfo.progress}%</span>
                    ) : null}
                    {statusInfo?.etaLabel ? <span className="mt-1 text-[9px] text-on-media-70">{statusInfo.etaLabel}</span> : null}
                  </div>
                ) : null}
                {showFailedOverlay ? (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1 rounded-input bg-error-bg px-3 text-center text-[10px] text-error">
                    <span className="font-semibold uppercase tracking-micro text-error">Failed</span>
                    {failureMessage ? <span className="line-clamp-4 text-[10px] leading-tight text-error">{failureMessage}</span> : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      <figcaption className="mt-2 text-[11px] text-text-muted">Composite preview</figcaption>
    </figure>
  );
}
