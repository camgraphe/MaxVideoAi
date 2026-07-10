'use client';

import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { VideoGroup } from '@/types/video-groups';
import { Button } from '@/components/ui/Button';
import { UIIcon } from '@/components/ui/UIIcon';
import { suggestDownloadFilename, triggerAppDownload } from '@/lib/download';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { PRIMARY_VIDEO_READY_EVENT } from '@/lib/video-warmup-events';
import { CompositePreviewDockHeader } from './CompositePreviewDockHeader';
import { CompositePreviewDockTile } from './CompositePreviewDockTile';
import { CompositePreviewDockToolbar } from './CompositePreviewDockToolbar';
import {
  DEFAULT_PREVIEW_COPY,
  GRID_CLASS,
  LAYOUT_SLOT_COUNT,
  isVideo,
  resolveCompositePreviewSlots,
  resolvePrimaryMediaUrl,
  type PreviewCopy,
} from './composite-preview-dock-utils';

export interface CompositePreviewDockProps {
  density?: 'default' | 'workspace';
  group: VideoGroup | null;
  isLoading?: boolean;
  onOpenModal?: (group: VideoGroup) => void;
  copyPrompt?: string | null;
  onCopyPrompt?: () => void;
  engineSettings?: ReactNode;
  showTitle?: boolean;
  autoPlayRequestId?: number;
  guidedNavigation?: {
    currentIndex: number;
    total: number;
    canPrev: boolean;
    canNext: boolean;
    onPrev: () => void;
    onNext: () => void;
  } | null;
}

export function CompositePreviewDock({
  density = 'default',
  group,
  isLoading = false,
  onOpenModal,
  copyPrompt,
  onCopyPrompt,
  engineSettings,
  showTitle = true,
  autoPlayRequestId = 0,
  guidedNavigation = null,
}: CompositePreviewDockProps) {
  const workspaceDensity = density === 'workspace';
  const { t } = useI18n();
  const copy = t('workspace.generate.preview', DEFAULT_PREVIEW_COPY) as PreviewCopy;
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isLooping, setIsLooping] = useState(true);
  const [readyItems, setReadyItems] = useState<Record<string, boolean>>({});
  const readyItemsRef = useRef<Record<string, boolean>>({});
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const videoRefCallbacksRef = useRef<Map<string, (element: HTMLVideoElement | null) => void>>(new Map());
  const playbackStateRef = useRef<{
    activeVideoKey: string | null;
    isLooping: boolean;
    isMuted: boolean;
    isPlaying: boolean;
  }>({
    activeVideoKey: null,
    isLooping: true,
    isMuted: true,
    isPlaying: false,
  });
  const lastPrimaryReadyEventKeyRef = useRef<string | null>(null);
  const lastAutoPlayRequestRef = useRef(0);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const controls = {
    play: { ...DEFAULT_PREVIEW_COPY.controls.play, ...(copy.controls?.play ?? {}) },
    mute: { ...DEFAULT_PREVIEW_COPY.controls.mute, ...(copy.controls?.mute ?? {}) },
    loop: { ...DEFAULT_PREVIEW_COPY.controls.loop, ...(copy.controls?.loop ?? {}) },
    download: { ...DEFAULT_PREVIEW_COPY.controls.download, ...(copy.controls?.download ?? {}) },
    modal: { ...DEFAULT_PREVIEW_COPY.controls.modal, ...(copy.controls?.modal ?? {}) },
    openTake: { ...DEFAULT_PREVIEW_COPY.controls.openTake, ...(copy.controls?.openTake ?? {}) },
    copyPrompt: copy.controls?.copyPrompt ?? DEFAULT_PREVIEW_COPY.controls.copyPrompt,
  };
  const guidedCopy = {
    ...DEFAULT_PREVIEW_COPY.guided,
    ...(copy.guided ?? {}),
  };

  useEffect(() => {
    readyItemsRef.current = {};
    videoRefs.current.clear();
    videoRefCallbacksRef.current.clear();
    setReadyItems({});
  }, [group?.id]);

  useEffect(() => {
    if (!autoPlayRequestId || lastAutoPlayRequestRef.current === autoPlayRequestId) return;
    lastAutoPlayRequestRef.current = autoPlayRequestId;
    setIsPlaying(true);
  }, [autoPlayRequestId]);

  const markReady = useCallback((itemKey: string) => {
    if (readyItemsRef.current[itemKey]) return;
    const next = { ...readyItemsRef.current, [itemKey]: true };
    readyItemsRef.current = next;
    setReadyItems(next);
  }, []);

  useEffect(() => {
    const target = previewRef.current;
    const toolbar = toolbarRef.current;
    if (!target || !toolbar) return;
    const parent = target.parentElement;
    if (!parent) return;
    let frame = 0;
    let observer: ResizeObserver | null = null;
    const updatePreviewSize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const viewportHeight = window.innerHeight || 0;
        const maxHeight = viewportHeight * 0.5;
        const maxWidth = 960;
        const availableWidth = parent.clientWidth;
        const workspaceHeightRatio = window.innerWidth < 640 ? 0.25 : 0.32;
        const width = workspaceDensity
          ? Math.min(availableWidth, maxWidth)
          : Math.min(availableWidth, maxWidth, (maxHeight * 16) / 9);
        const height = workspaceDensity
          ? Math.max(1, Math.min(viewportHeight * workspaceHeightRatio, 340))
          : Math.max(1, (width * 9) / 16);
        const widthPx = `${Math.round(width)}px`;
        const heightPx = `${Math.round(height)}px`;
        if (target.style.width !== widthPx) target.style.width = widthPx;
        if (target.style.height !== heightPx) target.style.height = heightPx;
        if (toolbar.style.width !== widthPx) toolbar.style.width = widthPx;
      });
    };

    updatePreviewSize();
    window.addEventListener('resize', updatePreviewSize);
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => updatePreviewSize());
      observer.observe(parent);
    }

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePreviewSize);
      if (observer) {
        observer.disconnect();
      }
    };
  }, [workspaceDensity]);

  const slots = useMemo(() => {
    return resolveCompositePreviewSlots(group);
  }, [group]);

  const activeVideoKey = useMemo(() => {
    const index = slots.findIndex((item) => item && isVideo(item));
    const item = index >= 0 ? slots[index] : null;
    return item ? `${item.id}-${index}` : null;
  }, [slots]);
  playbackStateRef.current = {
    activeVideoKey,
    isLooping,
    isMuted,
    isPlaying,
  };

  const handleMediaReady = useCallback(
    (itemKey: string) => {
      markReady(itemKey);
    },
    [markReady]
  );

  const playVideoWhenReady = useCallback((video: HTMLVideoElement) => {
    video.preload = 'auto';
    if (
      video.networkState === HTMLMediaElement.NETWORK_EMPTY ||
      (video.networkState === HTMLMediaElement.NETWORK_IDLE && video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA)
    ) {
      video.load();
    }
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => undefined);
    }
  }, []);

  const handleVideoCanPlay = useCallback(
    (itemKey: string, video: HTMLVideoElement) => {
      handleMediaReady(itemKey);
      if (itemKey === activeVideoKey && isPlaying) {
        playVideoWhenReady(video);
      }
    },
    [activeVideoKey, handleMediaReady, isPlaying, playVideoWhenReady]
  );

  const handleVideoLoadedData = useCallback(
    (itemKey: string, video: HTMLVideoElement) => {
      handleMediaReady(itemKey);
      if (itemKey === activeVideoKey && isPlaying) {
        playVideoWhenReady(video);
      }
    },
    [activeVideoKey, handleMediaReady, isPlaying, playVideoWhenReady]
  );

  useEffect(() => {
    if (!activeVideoKey || !readyItems[activeVideoKey] || lastPrimaryReadyEventKeyRef.current === activeVideoKey) return;
    lastPrimaryReadyEventKeyRef.current = activeVideoKey;
    const warmupWindow = window as Window & { __maxVideoPrimaryVideoReady?: boolean };
    warmupWindow.__maxVideoPrimaryVideoReady = true;
    window.dispatchEvent(new Event(PRIMARY_VIDEO_READY_EVENT));
  }, [activeVideoKey, readyItems]);

  useEffect(() => {
    videoRefs.current.forEach((video) => {
      video.loop = isLooping;
    });
  }, [isLooping]);

  useEffect(() => {
    videoRefs.current.forEach((video) => {
      const previous = video.muted;
      video.muted = isMuted;
      if (!video.muted && previous !== video.muted && video.dataset.previewVideo === 'active') {
        playVideoWhenReady(video);
      }
    });
  }, [isMuted, playVideoWhenReady]);

  useEffect(() => {
    videoRefs.current.forEach((video, itemId) => {
      const isActivePreview = itemId === activeVideoKey;
      video.dataset.previewVideo = isActivePreview ? 'active' : 'idle';
      video.loop = isLooping;
      video.muted = isMuted;
      if (isPlaying && isActivePreview) {
        playVideoWhenReady(video);
      } else {
        video.pause();
      }
    });
  }, [activeVideoKey, group?.id, isLooping, isMuted, isPlaying, playVideoWhenReady]);

  const registerVideo = useCallback(
    (itemId: string) => {
      const existing = videoRefCallbacksRef.current.get(itemId);
      if (existing) return existing;

      const callback = (element: HTMLVideoElement | null) => {
        if (!element) {
          videoRefs.current.delete(itemId);
          return;
        }
        const playback = playbackStateRef.current;
        const isActivePreview = itemId === playback.activeVideoKey;
        element.loop = playback.isLooping;
        element.muted = playback.isMuted;
        element.dataset.previewVideo = isActivePreview ? 'active' : 'idle';
        if (isActivePreview && element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          handleMediaReady(itemId);
        }
        if (playback.isPlaying && isActivePreview) {
          playVideoWhenReady(element);
        } else {
          element.pause();
        }
        videoRefs.current.set(itemId, element);
      };

      videoRefCallbacksRef.current.set(itemId, callback);
      return callback;
    },
    [handleMediaReady, playVideoWhenReady]
  );

  const gridClass = group ? GRID_CLASS[group.layout] ?? 'grid-cols-1' : 'grid-cols-1';
  const tileCount = group ? Math.min(group.items.length, LAYOUT_SLOT_COUNT[group.layout] ?? group.items.length) : 0;
  const showGroupError = group?.status === 'error';
  const isSingleLayout = group?.layout === 'x1';
  const primaryMediaUrl = useMemo(() => {
    return resolvePrimaryMediaUrl(group);
  }, [group]);

  const handleOpenModal = useCallback(() => {
    if (group && onOpenModal) {
      onOpenModal(group);
    }
  }, [group, onOpenModal]);

  const handleDownload = useCallback(() => {
    if (!primaryMediaUrl) return;
    triggerAppDownload(primaryMediaUrl, suggestDownloadFilename(primaryMediaUrl, 'preview'));
  }, [primaryMediaUrl]);

  let showSkeleton = false;
  if (isLoading) {
    showSkeleton = true;
  } else if (group && group.status === 'loading') {
    showSkeleton = !group.items.some((item) => Boolean(item?.url || item?.thumb));
  }

  return (
    <section className="rounded-card border border-border bg-surface-glass-90 shadow-card">
      <CompositePreviewDockHeader
        controls={controls}
        copy={copy}
        copyPrompt={copyPrompt}
        density={density}
        engineSettings={engineSettings}
        groupItemCount={group?.items.length ?? null}
        onCopyPrompt={onCopyPrompt}
        showTitle={showTitle}
      />

      <div className={workspaceDensity ? 'px-0 py-2' : 'px-4 py-4'}>
        <div className="flex flex-col items-center">
          <div
            ref={previewRef}
            className={clsx(
              'relative w-full max-w-[960px] rounded-card bg-placeholder',
              isSingleLayout ? 'overflow-hidden p-0' : 'border border-surface-on-media-25 p-[8px]'
            )}
            style={{ aspectRatio: '16 / 9' }}
          >
            {showSkeleton ? (
              <div className={clsx('grid h-full w-full', gridClass, isSingleLayout ? 'gap-0' : 'gap-[6px]')}>
                {Array.from({ length: group ? LAYOUT_SLOT_COUNT[group.layout] ?? 1 : 1 }).map((_, index) => (
                  <div
                    key={`dock-skeleton-${index}`}
                    className={clsx(
                      'relative flex items-center justify-center overflow-hidden bg-surface-glass-70',
                      isSingleLayout ? 'rounded-none' : 'rounded-card'
                    )}
                  >
                    <div className="skeleton absolute inset-0" />
                  </div>
                ))}
              </div>
            ) : group ? (
              <div className={clsx('grid h-full w-full', gridClass, isSingleLayout ? 'gap-0' : 'gap-[6px]')}>
                {slots.map((item, index) => {
                  if (!item) {
                    return (
                      <div
                        key={`dock-empty-${index}`}
                        className={clsx(
                          'relative flex items-center justify-center overflow-hidden bg-surface-glass-70 text-xs text-text-muted',
                          isSingleLayout ? 'rounded-none' : 'rounded-card'
                        )}
                      >
                        {copy.placeholder}
                      </div>
                    );
                  }

                  const itemKey = item.id ? `${item.id}-${index}` : `dock-item-${index}`;
                  return (
                    <CompositePreviewDockTile
                      key={itemKey}
                      activeVideoKey={activeVideoKey}
                      index={index}
                      isLooping={isLooping}
                      isMuted={isMuted}
                      isPlaying={isPlaying}
                      isSingleLayout={isSingleLayout}
                      isVideoReady={Boolean(readyItems[itemKey])}
                      item={item}
                      itemKey={itemKey}
                      markReady={markReady}
                      onVideoCanPlay={handleVideoCanPlay}
                      onVideoLoadedData={handleVideoLoadedData}
                      registerVideo={registerVideo}
                      showGroupError={showGroupError}
                      tileCount={tileCount || slots.length}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center rounded-card bg-surface-glass-80 text-sm text-text-secondary">
                Select a take to preview
              </div>
            )}

            {showGroupError ? (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-card bg-surface-on-media-dark-65 px-6 text-center text-on-inverse">
                <span className="text-sm font-semibold uppercase tracking-micro">Preview unavailable</span>
                <span className="mt-2 text-xs text-on-media-85">{group?.errorMsg ?? 'Generation failed. Please retry.'}</span>
              </div>
            ) : null}
            {guidedNavigation && group ? (
              <>
                <div className="pointer-events-none absolute right-3 top-3 z-20">
                  <span className="inline-flex rounded-full border border-surface-on-media-25 bg-surface-on-media-dark-65 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-on-inverse shadow-sm backdrop-blur">
                    {guidedCopy.badge
                      .replace('{current}', String(guidedNavigation.currentIndex + 1))
                      .replace('{total}', String(guidedNavigation.total))}
                  </span>
                </div>
                <div className="pointer-events-none absolute inset-y-0 left-0 right-0 z-20 flex items-center justify-between px-3 sm:px-4">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={guidedNavigation.onPrev}
                    disabled={!guidedNavigation.canPrev}
                    className={clsx(
                      'pointer-events-auto h-11 w-11 rounded-full border border-surface-on-media-25 bg-surface-on-media-dark-55 p-0 text-on-inverse shadow-sm backdrop-blur transition hover:bg-surface-on-media-dark-70',
                      'disabled:cursor-not-allowed disabled:opacity-35'
                    )}
                    aria-label={guidedCopy.previous}
                    title={guidedCopy.previous}
                  >
                    <span className="inline-flex h-5 w-5 items-center justify-center">
                      <UIIcon icon={ChevronLeft} size={18} />
                    </span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={guidedNavigation.onNext}
                    disabled={!guidedNavigation.canNext}
                    className={clsx(
                      'pointer-events-auto h-11 w-11 rounded-full border border-surface-on-media-25 bg-surface-on-media-dark-55 p-0 text-on-inverse shadow-sm backdrop-blur transition hover:bg-surface-on-media-dark-70',
                      'disabled:cursor-not-allowed disabled:opacity-35'
                    )}
                    aria-label={guidedCopy.next}
                    title={guidedCopy.next}
                  >
                    <span className="inline-flex h-5 w-5 items-center justify-center">
                      <UIIcon icon={ChevronRight} size={18} />
                    </span>
                  </Button>
                </div>
              </>
            ) : null}
          </div>
          <div className={clsx('flex w-full max-w-[960px]', workspaceDensity ? 'mt-2' : 'mt-3')}>
            <div
              ref={toolbarRef}
              className="flex w-full items-center justify-center rounded-card border border-surface-on-media-25 bg-surface-glass-80 px-3 py-2 shadow-sm"
            >
              <CompositePreviewDockToolbar
                controls={controls}
                hasGroup={Boolean(group)}
                isLooping={isLooping}
                isMuted={isMuted}
                isPlaying={isPlaying}
                onDownload={handleDownload}
                onOpenModal={onOpenModal ? handleOpenModal : undefined}
                onToggleLoop={() => setIsLooping((prev) => !prev)}
                onToggleMute={() => setIsMuted((prev) => !prev)}
                onTogglePlay={() => setIsPlaying((prev) => !prev)}
                primaryMediaUrl={primaryMediaUrl}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
