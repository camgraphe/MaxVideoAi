'use client';

import clsx from 'clsx';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { VideoGroup, VideoItem } from '@/types/video-groups';
import { ProcessingOverlay } from '@/components/groups/ProcessingOverlay';
import { AudioEqualizerBadge } from '@/components/ui/AudioEqualizerBadge';
import { useI18n } from '@/lib/i18n/I18nProvider';

const DEFAULT_PREVIEW_COPY = {
  title: 'Composite Preview',
  empty: 'Select a take to preview',
  variants: {
    singular: '{count} variant',
    plural: '{count} variants',
  },
  controls: {
    play: { on: 'Pause', off: 'Play', ariaOn: 'Pause all previews', ariaOff: 'Play all previews' },
    mute: { on: 'Unmute', off: 'Mute', ariaOn: 'Unmute all previews', ariaOff: 'Mute all previews' },
    loop: { on: 'Loop on', off: 'Loop off', ariaOn: 'Disable looping', ariaOff: 'Enable looping' },
    modal: { label: 'Open modal', aria: 'Open preview in modal' },
    copyPrompt: 'Copy prompt',
  },
  placeholder: '—',
} as const;

type PreviewCopy = typeof DEFAULT_PREVIEW_COPY;

interface CompositePreviewDockProps {
  group: VideoGroup | null;
  isLoading?: boolean;
  onOpenModal?: (group: VideoGroup) => void;
  copyPrompt?: string | null;
  onCopyPrompt?: () => void;
}

const LAYOUT_SLOT_COUNT: Record<VideoGroup['layout'], number> = {
  x1: 1,
  x2: 2,
  x3: 4,
  x4: 4,
};

const GRID_CLASS: Record<VideoGroup['layout'], string> = {
  x1: 'grid-cols-1',
  x2: 'grid-cols-2',
  x3: 'md:grid-cols-2',
  x4: 'grid-cols-2',
};

function isVideo(item: VideoItem): boolean {
  const hint = typeof item.meta?.mediaType === 'string' ? String(item.meta.mediaType).toLowerCase() : null;
  if (hint === 'video') return true;
  if (hint === 'image') return false;
  const url = item.url.toLowerCase();
  return url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mov');
}

export function CompositePreviewDock({ group, isLoading = false, onOpenModal, copyPrompt, onCopyPrompt }: CompositePreviewDockProps) {
  const { t } = useI18n();
  const copy = t('workspace.generate.preview', DEFAULT_PREVIEW_COPY) as PreviewCopy;
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [isLooping, setIsLooping] = useState(true);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  useEffect(() => {
    videoRefs.current.clear();
  }, [group?.id]);

  const slots = useMemo(() => {
    if (!group) return [] as Array<VideoItem | null>;
    const desired = LAYOUT_SLOT_COUNT[group.layout] ?? Math.min(group.items.length, 4);
    const list = group.items.slice(0, desired);
    const padded: Array<VideoItem | null> = Array.from({ length: desired }, (_, index) => list[index] ?? null);
    if (group.layout === 'x3' && padded.length === 4 && !padded[2]) {
      padded[2] = padded[3];
      padded[3] = null;
    }
    return padded;
  }, [group]);

  useEffect(() => {
    videoRefs.current.forEach((video) => {
      video.loop = isLooping;
    });
  }, [isLooping]);

  useEffect(() => {
    videoRefs.current.forEach((video) => {
      const previous = video.muted;
      video.muted = isMuted;
      if (!video.muted && previous !== video.muted) {
        void video.play().catch(() => undefined);
      }
    });
  }, [isMuted]);

  useEffect(() => {
    videoRefs.current.forEach((video) => {
      if (isPlaying) {
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => undefined);
        }
      } else {
        video.pause();
      }
    });
  }, [isPlaying, group?.id]);

  const registerVideo = useCallback(
    (itemId: string) => {
      return (element: HTMLVideoElement | null) => {
        if (!element) {
          videoRefs.current.delete(itemId);
          return;
        }
        element.loop = isLooping;
        element.muted = isMuted;
        if (isPlaying) {
          const playPromise = element.play();
          if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => undefined);
          }
        } else {
          element.pause();
        }
        videoRefs.current.set(itemId, element);
      };
    },
    [isLooping, isMuted, isPlaying]
  );

  const handleDownload = useCallback((item: VideoItem) => {
    if (!item.url) return;
    const anchor = document.createElement('a');
    anchor.href = item.url;
    anchor.download = `${item.id || 'video'}.mp4`;
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }, []);

  const handleOpenModal = useCallback(() => {
    if (group && onOpenModal) {
      onOpenModal(group);
    }
  }, [group, onOpenModal]);

  const gridClass = group ? GRID_CLASS[group.layout] ?? 'grid-cols-1' : 'grid-cols-1';
  const tileCount = group ? Math.min(group.items.length, LAYOUT_SLOT_COUNT[group.layout] ?? group.items.length) : 0;
  const showGroupError = group?.status === 'error';

  let showSkeleton = false;
  if (isLoading) {
    showSkeleton = true;
  } else if (group && group.status === 'loading') {
    showSkeleton = !group.items.some((item) => Boolean(item?.url || item?.thumb));
  }

  return (
    <section className="rounded-card border border-border bg-white/90 shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">{copy.title}</h2>
          <p className="text-xs text-text-muted">
            {group
              ? (group.items.length === 1 ? copy.variants.singular : copy.variants.plural).replace('{count}', String(group.items.length))
              : copy.empty}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPlaying((prev) => !prev)}
            className="rounded-full border border-border px-3 py-1 text-xs font-medium text-text-secondary transition hover:bg-accentSoft/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={isPlaying ? copy.controls.play.ariaOn : copy.controls.play.ariaOff}
            aria-pressed={isPlaying}
          >
            {isPlaying ? copy.controls.play.on : copy.controls.play.off}
          </button>
          <button
            type="button"
            onClick={() => setIsMuted((prev) => !prev)}
            className="rounded-full border border-border px-3 py-1 text-xs font-medium text-text-secondary transition hover:bg-accentSoft/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={isMuted ? copy.controls.mute.ariaOn : copy.controls.mute.ariaOff}
            aria-pressed={isMuted}
          >
            {isMuted ? copy.controls.mute.on : copy.controls.mute.off}
          </button>
          <button
            type="button"
            onClick={() => setIsLooping((prev) => !prev)}
            className="rounded-full border border-border px-3 py-1 text-xs font-medium text-text-secondary transition hover:bg-accentSoft/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={isLooping ? copy.controls.loop.ariaOn : copy.controls.loop.ariaOff}
            aria-pressed={isLooping}
          >
            {isLooping ? copy.controls.loop.on : copy.controls.loop.off}
          </button>
          <button
            type="button"
            onClick={handleOpenModal}
            disabled={!group}
            className="rounded-full border border-border px-3 py-1 text-xs font-medium text-text-secondary transition hover:bg-accentSoft/10 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={copy.controls.modal.aria}
          >
            {copy.controls.modal.label}
          </button>
          {copyPrompt && onCopyPrompt ? (
            <button
              type="button"
              onClick={onCopyPrompt}
              className="rounded-full border border-border bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-micro text-accent transition hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {copy.controls.copyPrompt}
            </button>
          ) : null}
        </div>
      </header>

      <div className="px-4 py-4">
        <div className="relative w-full rounded-[16px] border border-dashed border-border/70 bg-[#EDF1FA] p-[8px]" style={{ aspectRatio: '16 / 9' }}>
          {showSkeleton ? (
            <div className={clsx('grid h-full w-full gap-[6px]', gridClass)}>
              {Array.from({ length: group ? LAYOUT_SLOT_COUNT[group.layout] ?? 1 : 1 }).map((_, index) => (
                <div key={`dock-skeleton-${index}`} className="relative flex items-center justify-center overflow-hidden rounded-[12px] bg-white/70">
                  <div className="skeleton absolute inset-0" />
                </div>
              ))}
            </div>
          ) : group ? (
            <div className={clsx('grid h-full w-full gap-[6px]', gridClass)}>
              {slots.map((item, index) => {
                if (!item) {
                  return (
                    <div key={`dock-empty-${index}`} className="relative flex items-center justify-center overflow-hidden rounded-[12px] bg-white/70 text-xs text-text-muted">
                      {copy.placeholder}
                    </div>
                  );
                }

                const video = isVideo(item);
                const itemStatusRaw = typeof item.meta?.status === 'string' ? String(item.meta.status).toLowerCase() : null;
                const itemKey = item.id ? `${item.id}-${index}` : `dock-item-${index}`;
                const itemStatus: 'completed' | 'pending' | 'error' = (() => {
                  if (itemStatusRaw === 'completed' || itemStatusRaw === 'ready') return 'completed';
                  if (itemStatusRaw === 'failed' || itemStatusRaw === 'error') return 'error';
                  if (itemStatusRaw === 'pending' || itemStatusRaw === 'loading' || !item.url) return 'pending';
                  return 'completed';
                })();
                const itemProgress =
                  typeof item.meta?.progress === 'number'
                    ? Math.max(0, Math.min(100, Math.round(Number(item.meta.progress))))
                    : undefined;
                const itemMessage = typeof item.meta?.message === 'string' ? (item.meta.message as string) : undefined;

                const hasAudio =
                  typeof item?.hasAudio === 'boolean'
                    ? item.hasAudio
                    : Boolean(
                        item?.meta &&
                          typeof item.meta === 'object' &&
                          'hasAudio' in item.meta &&
                          (item.meta as Record<string, unknown>).hasAudio
                      );

                return (
                  <figure key={itemKey} className="group relative flex items-center justify-center overflow-hidden rounded-[12px] bg-[var(--surface-2)]">
                    <div className="absolute inset-0">
                      {itemStatus === 'completed' && video ? (
                        <video
                          ref={registerVideo(itemKey)}
                          src={item.url}
                          poster={item.thumb}
                          className="h-full w-full object-contain"
                          muted={isMuted}
                          playsInline
                          preload="metadata"
                          loop={isLooping}
                          autoPlay={isPlaying}
                        />
                      ) : item.thumb ? (
                        <Image src={item.thumb} alt="" fill className="object-contain pointer-events-none" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#e5ebf6] via-white to-[#f1f4ff] text-[11px] uppercase tracking-micro text-text-muted">
                          Media
                        </div>
                      )}
                    </div>
                    {hasAudio && itemStatus === 'completed' && video ? (
                      <AudioEqualizerBadge
                        tone="light"
                        size="sm"
                        label="Audio available"
                        className="absolute bottom-2 right-2"
                      />
                    ) : null}
                    <div className="pointer-events-none block" style={{ width: '100%', aspectRatio: '16 / 9' }} aria-hidden />
                    <div className="pointer-events-none absolute inset-0 rounded-[12px] border border-white/10 transition group-hover:border-white/30" />
                    {itemStatus !== 'completed' && !showGroupError ? (
                      <ProcessingOverlay
                        className="absolute inset-0"
                        state={itemStatus === 'error' ? 'error' : 'pending'}
                        message={itemMessage}
                        tone="light"
                        tileIndex={index + 1}
                        tileCount={tileCount || slots.length}
                      />
                    ) : null}
                    <div className="absolute bottom-2 left-2">
                      <button
                        type="button"
                        onClick={() => handleDownload(item)}
                        className="pointer-events-auto rounded-full border border-border bg-white/90 px-2 py-0.5 text-[10px] font-medium text-text-secondary shadow transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label="Download this take"
                      >
                        Download
                      </button>
                    </div>
                  </figure>
                );
              })}
            </div>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center rounded-[12px] bg-white/80 text-sm text-text-secondary">
              Select a take to preview
            </div>
          )}

          {showGroupError ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-[16px] bg-black/65 px-6 text-center text-white">
              <span className="text-sm font-semibold uppercase tracking-micro">Preview unavailable</span>
              <span className="mt-2 text-xs text-white/85">{group?.errorMsg ?? 'Generation failed. Please retry.'}</span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
