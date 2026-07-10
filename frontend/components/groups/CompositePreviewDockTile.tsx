'use client';

import clsx from 'clsx';
import Image from 'next/image';
import type { VideoItem } from '@/types/video-groups';
import { ProcessingOverlay } from '@/components/groups/ProcessingOverlay';
import { AudioEqualizerBadge } from '@/components/ui/AudioEqualizerBadge';
import {
  getInlinePreviewUrl,
  isVideo,
  resolvePreviewItemHasAudio,
  resolvePreviewItemStatus,
} from './composite-preview-dock-utils';

interface CompositePreviewDockTileProps {
  activeVideoKey: string | null;
  index: number;
  isLooping: boolean;
  isMuted: boolean;
  isPlaying: boolean;
  isSingleLayout: boolean;
  isVideoReady: boolean;
  item: VideoItem;
  itemKey: string;
  markReady: (itemKey: string) => void;
  onVideoCanPlay: (itemKey: string, video: HTMLVideoElement) => void;
  onVideoLoadedData: (itemKey: string, video: HTMLVideoElement) => void;
  registerVideo: (itemKey: string) => (element: HTMLVideoElement | null) => void;
  showGroupError: boolean;
  tileCount: number;
}

export function CompositePreviewDockTile({
  activeVideoKey,
  index,
  isLooping,
  isMuted,
  isPlaying,
  isSingleLayout,
  isVideoReady,
  item,
  itemKey,
  markReady,
  onVideoCanPlay,
  onVideoLoadedData,
  registerVideo,
  showGroupError,
  tileCount,
}: CompositePreviewDockTileProps) {
  const video = isVideo(item);
  const mediaFitClass = 'object-contain';
  const itemStatus = resolvePreviewItemStatus(item);
  const shouldPlayVideo = isPlaying && itemKey === activeVideoKey;
  const inlinePreviewUrl = shouldPlayVideo ? getInlinePreviewUrl(item) : undefined;
  const showReadyThumb = Boolean(item.thumb);
  const itemMessage = typeof item.meta?.message === 'string' ? (item.meta.message as string) : undefined;
  const hasAudio = resolvePreviewItemHasAudio(item);

  return (
    <figure
      className={clsx(
        'group relative flex items-center justify-center overflow-hidden bg-[var(--surface-2)]',
        isSingleLayout ? 'rounded-none' : 'rounded-card'
      )}
    >
      <div className="absolute inset-0">
        {itemStatus === 'completed' && video ? (
          <>
            {showReadyThumb ? (
              <Image
                src={item.thumb as string}
                alt=""
                fill
                priority={itemKey === activeVideoKey}
                fetchPriority={itemKey === activeVideoKey ? 'high' : undefined}
                sizes="(max-width: 1024px) 100vw, calc(100vw - 420px)"
                className={clsx(
                  'pointer-events-none z-10 transition-opacity duration-150',
                  mediaFitClass,
                  shouldPlayVideo && isVideoReady ? 'opacity-0' : 'opacity-100'
                )}
              />
            ) : null}
            {shouldPlayVideo ? (
              <video
                ref={registerVideo(itemKey)}
                data-preview-video="active"
                src={inlinePreviewUrl}
                poster={item.thumb}
                className={clsx('relative z-0 h-full w-full', mediaFitClass)}
                muted={isMuted}
                playsInline
                autoPlay
                preload="auto"
                loop={isLooping}
                onLoadedData={(event) => onVideoLoadedData(itemKey, event.currentTarget)}
                onCanPlay={(event) => onVideoCanPlay(itemKey, event.currentTarget)}
              />
            ) : null}
          </>
        ) : item.thumb ? (
          <Image
            src={item.thumb}
            alt=""
            fill
            sizes="(max-width: 1024px) 100vw, calc(100vw - 420px)"
            className={clsx('pointer-events-none', mediaFitClass)}
            onLoadingComplete={() => markReady(itemKey)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-surface-2 via-surface to-surface-2 text-[11px] uppercase tracking-micro text-text-muted">
            Media
          </div>
        )}
      </div>
      {hasAudio && itemStatus === 'completed' && video ? (
        <AudioEqualizerBadge tone="light" size="sm" label="Audio available" className="absolute bottom-2 right-2" />
      ) : null}
      <div className="pointer-events-none block" style={{ width: '100%', aspectRatio: '16 / 9' }} aria-hidden />
      <div
        className={clsx(
          'pointer-events-none absolute inset-0 border transition',
          isSingleLayout
            ? 'border-transparent rounded-none'
            : 'border-preview-outline-idle rounded-card group-hover:border-preview-outline-hover'
        )}
      />
      {itemStatus !== 'completed' && !showGroupError ? (
        <ProcessingOverlay
          className="absolute inset-0"
          state={itemStatus === 'error' ? 'error' : 'pending'}
          message={itemMessage}
          tone="light"
          tileIndex={index + 1}
          tileCount={tileCount}
        />
      ) : null}
    </figure>
  );
}
