'use client';

import clsx from 'clsx';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ExternalLink, Pause, Play, Repeat, Volume2, VolumeX } from 'lucide-react';
import type { VideoGroup, VideoItem } from '@/types/video-groups';
import { ProcessingOverlay } from '@/components/groups/ProcessingOverlay';
import { AudioEqualizerBadge } from '@/components/ui/AudioEqualizerBadge';
import { UIIcon } from '@/components/ui/UIIcon';
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
    openTake: { label: 'Open', aria: 'Open this take' },
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
  engineSettings?: ReactNode;
  showTitle?: boolean;
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

const ICON_BUTTON_BASE =
  'flex h-8 w-8 items-center justify-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function isVideo(item: VideoItem): boolean {
  const hint = typeof item.meta?.mediaType === 'string' ? String(item.meta.mediaType).toLowerCase() : null;
  if (hint === 'video') return true;
  if (hint === 'image') return false;
  const url = item.url.toLowerCase();
  return url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mov');
}

export function CompositePreviewDock({
  group,
  isLoading = false,
  onOpenModal,
  copyPrompt,
  onCopyPrompt,
  engineSettings,
  showTitle = true,
}: CompositePreviewDockProps) {
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

  const headerTitle = showTitle ? (
    <div>
      <h2 className="text-sm font-semibold text-text-primary">{copy.title}</h2>
      <p className="text-xs text-text-muted">
        {group
          ? (group.items.length === 1 ? copy.variants.singular : copy.variants.plural).replace('{count}', String(group.items.length))
          : copy.empty}
      </p>
    </div>
  ) : null;

  const toolbar = (
    <div className="flex items-center gap-1 rounded-full border border-hairline/70 bg-white/60 p-0.5 shadow-sm backdrop-blur">
      <button
        type="button"
        onClick={() => setIsPlaying((prev) => !prev)}
        className={clsx(
          ICON_BUTTON_BASE,
          isPlaying ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'
        )}
        aria-label={isPlaying ? copy.controls.play.ariaOn : copy.controls.play.ariaOff}
        aria-pressed={isPlaying}
      >
        <UIIcon icon={isPlaying ? Pause : Play} />
        <span className="sr-only">{isPlaying ? copy.controls.play.on : copy.controls.play.off}</span>
      </button>
      <button
        type="button"
        onClick={() => setIsMuted((prev) => !prev)}
        className={clsx(
          ICON_BUTTON_BASE,
          isMuted ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'
        )}
        aria-label={isMuted ? copy.controls.mute.ariaOn : copy.controls.mute.ariaOff}
        aria-pressed={isMuted}
      >
        <UIIcon icon={isMuted ? VolumeX : Volume2} />
        <span className="sr-only">{isMuted ? copy.controls.mute.on : copy.controls.mute.off}</span>
      </button>
      <button
        type="button"
        onClick={() => setIsLooping((prev) => !prev)}
        className={clsx(
          ICON_BUTTON_BASE,
          isLooping
            ? 'text-text-primary bg-neutral-800/20 hover:bg-neutral-800/30'
            : 'text-text-secondary hover:text-text-primary'
        )}
        aria-label={isLooping ? copy.controls.loop.ariaOn : copy.controls.loop.ariaOff}
        aria-pressed={isLooping}
      >
        <UIIcon icon={Repeat} />
        <span className="sr-only">{isLooping ? copy.controls.loop.on : copy.controls.loop.off}</span>
      </button>
      <button
        type="button"
        onClick={handleOpenModal}
        disabled={!group}
        className={clsx(ICON_BUTTON_BASE, 'text-text-secondary hover:text-text-primary', 'disabled:opacity-50')}
        aria-label={copy.controls.modal.aria}
      >
        <UIIcon icon={ExternalLink} />
        <span className="sr-only">{copy.controls.modal.label}</span>
      </button>
    </div>
  );

  return (
    <section className="rounded-card border border-border bg-white/90 shadow-card">
      <header className="border-b border-hairline px-4 py-3">
        {engineSettings ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">{engineSettings}</div>
              {!showTitle && copyPrompt && onCopyPrompt ? (
                <button
                  type="button"
                  onClick={onCopyPrompt}
                  className="rounded-full border border-border bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-micro text-accent transition hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {copy.controls.copyPrompt}
                </button>
              ) : null}
            </div>
            {showTitle ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                {headerTitle}
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
            ) : null}
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            {headerTitle}
            <div className="flex flex-wrap items-center gap-2">
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
          </div>
        )}
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
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-center justify-center pb-3">
            <div className="pointer-events-auto">
              {toolbar}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
