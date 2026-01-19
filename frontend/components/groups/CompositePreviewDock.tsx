'use client';

import clsx from 'clsx';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Download, ExternalLink, Pause, Play, Repeat, Volume2, VolumeX } from 'lucide-react';
import type { VideoGroup, VideoItem } from '@/types/video-groups';
import { ProcessingOverlay } from '@/components/groups/ProcessingOverlay';
import { AudioEqualizerBadge } from '@/components/ui/AudioEqualizerBadge';
import { Button } from '@/components/ui/Button';
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
    download: { label: 'Download', aria: 'Download preview' },
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
  'flex h-9 w-9 items-center justify-center rounded-lg border border-hairline/70 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px';

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
  const [isSafari, setIsSafari] = useState(false);
  const [readyItems, setReadyItems] = useState<Record<string, boolean>>({});
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
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

  useEffect(() => {
    videoRefs.current.clear();
    setReadyItems({});
  }, [group?.id]);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const ua = navigator.userAgent;
    const isSafariBrowser =
      /safari/i.test(ua) && !/chrome|chromium|crios|fxios|edg|opr|brave|vivaldi/i.test(ua);
    setIsSafari(isSafariBrowser);
  }, []);

  const markReady = useCallback((itemKey: string) => {
    setReadyItems((prev) => {
      if (prev[itemKey]) return prev;
      return { ...prev, [itemKey]: true };
    });
  }, []);

  useEffect(() => {
    const target = previewRef.current;
    const toolbar = toolbarRef.current;
    if (!target || !toolbar) return;
    const parent = target.parentElement;
    if (!parent) return;
    let frame = 0;
    const updatePreviewSize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const viewportHeight = window.innerHeight || 0;
        const maxHeight = viewportHeight * 0.5;
        const maxWidth = 960;
        const availableWidth = parent.clientWidth;
        const width = Math.min(availableWidth, maxWidth, (maxHeight * 16) / 9);
        const height = Math.max(1, (width * 9) / 16);
        const widthPx = `${Math.round(width)}px`;
        const heightPx = `${Math.round(height)}px`;
        if (target.style.width !== widthPx) target.style.width = widthPx;
        if (target.style.height !== heightPx) target.style.height = heightPx;
        if (toolbar.style.width !== widthPx) toolbar.style.width = widthPx;
      });
    };

    updatePreviewSize();
    window.addEventListener('resize', updatePreviewSize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePreviewSize);
    };
  }, []);

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

  const gridClass = group ? GRID_CLASS[group.layout] ?? 'grid-cols-1' : 'grid-cols-1';
  const tileCount = group ? Math.min(group.items.length, LAYOUT_SLOT_COUNT[group.layout] ?? group.items.length) : 0;
  const showGroupError = group?.status === 'error';
  const primaryMediaUrl = useMemo(() => {
    if (!group) return null;
    const videoItem = group.items.find((item) => Boolean(item?.url) && isVideo(item));
    if (videoItem?.url) return videoItem.url;
    const fallback = group.items.find((item) => Boolean(item?.url));
    return fallback?.url ?? null;
  }, [group]);

  const handleOpenModal = useCallback(() => {
    if (group && onOpenModal) {
      onOpenModal(group);
    }
  }, [group, onOpenModal]);

  const handleDownload = useCallback(() => {
    if (!primaryMediaUrl) return;
    const anchor = document.createElement('a');
    anchor.href = primaryMediaUrl;
    anchor.download = '';
    anchor.target = '_blank';
    anchor.rel = 'noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }, [primaryMediaUrl]);

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

  const toolbarItems = [
    {
      key: 'play',
      element: (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setIsPlaying((prev) => !prev)}
          className={clsx(
            ICON_BUTTON_BASE,
            'p-0',
            isPlaying ? 'text-text-primary shadow-inner' : 'text-text-secondary hover:text-text-primary'
          )}
          aria-label={isPlaying ? controls.play.ariaOn : controls.play.ariaOff}
          title={isPlaying ? controls.play.on : controls.play.off}
          aria-pressed={isPlaying}
        >
          <UIIcon icon={isPlaying ? Pause : Play} />
          <span className="sr-only">{isPlaying ? controls.play.on : controls.play.off}</span>
        </Button>
      ),
    },
    {
      key: 'mute',
      element: (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setIsMuted((prev) => !prev)}
          className={clsx(
            ICON_BUTTON_BASE,
            'p-0',
            isMuted ? 'text-text-primary shadow-inner' : 'text-text-secondary hover:text-text-primary'
          )}
          aria-label={isMuted ? controls.mute.ariaOn : controls.mute.ariaOff}
          title={isMuted ? controls.mute.on : controls.mute.off}
          aria-pressed={isMuted}
        >
          <UIIcon icon={isMuted ? VolumeX : Volume2} />
          <span className="sr-only">{isMuted ? controls.mute.on : controls.mute.off}</span>
        </Button>
      ),
    },
    {
      key: 'loop',
      element: (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setIsLooping((prev) => !prev)}
          className={clsx(
            ICON_BUTTON_BASE,
            'p-0',
            isLooping ? 'text-text-primary shadow-inner' : 'text-text-secondary hover:text-text-primary'
          )}
          aria-label={isLooping ? controls.loop.ariaOn : controls.loop.ariaOff}
          title={isLooping ? controls.loop.on : controls.loop.off}
          aria-pressed={isLooping}
        >
          <span className="relative inline-flex">
            <UIIcon icon={Repeat} />
            {!isLooping ? (
              <span
                aria-hidden="true"
                className="absolute left-1/2 top-1/2 h-[2px] w-5 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-current"
              />
            ) : null}
          </span>
          <span className="sr-only">{isLooping ? controls.loop.on : controls.loop.off}</span>
        </Button>
      ),
    },
    {
      key: 'download',
      element: (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={handleDownload}
          disabled={!primaryMediaUrl}
          className={clsx(ICON_BUTTON_BASE, 'p-0 text-text-secondary hover:text-text-primary', 'disabled:opacity-50')}
          aria-label={controls.download.aria}
          title={controls.download.label}
        >
          <UIIcon icon={Download} />
          <span className="sr-only">{controls.download.label}</span>
        </Button>
      ),
    },
    {
      key: 'modal',
      element: (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={handleOpenModal}
          disabled={!group}
          className={clsx(ICON_BUTTON_BASE, 'p-0 text-text-secondary hover:text-text-primary', 'disabled:opacity-50')}
          aria-label={controls.modal.aria}
          title={controls.modal.label}
        >
          <UIIcon icon={ExternalLink} />
          <span className="sr-only">{controls.modal.label}</span>
        </Button>
      ),
    },
  ];

  const toolbarControls = (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {toolbarItems.map((item) => (
        <span key={item.key}>{item.element}</span>
      ))}
    </div>
  );

  return (
    <section className="rounded-card border border-border bg-white/90 shadow-card">
      <header className="border-b border-hairline px-4 py-3">
        {engineSettings ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">{engineSettings}</div>
              {!showTitle && copyPrompt && onCopyPrompt ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onCopyPrompt}
                  className="min-h-0 h-auto rounded-full border-border bg-surface-2 px-3 py-1 text-xs font-semibold uppercase tracking-micro text-brand hover:bg-surface-3"
                >
                  {controls.copyPrompt}
                </Button>
              ) : null}
            </div>
            {showTitle ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                {headerTitle}
                {copyPrompt && onCopyPrompt ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onCopyPrompt}
                    className="min-h-0 h-auto rounded-full border-border bg-surface-2 px-3 py-1 text-xs font-semibold uppercase tracking-micro text-brand hover:bg-surface-3"
                  >
                    {controls.copyPrompt}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            {headerTitle}
            <div className="flex flex-wrap items-center gap-2">
              {copyPrompt && onCopyPrompt ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onCopyPrompt}
                  className="min-h-0 h-auto rounded-full border-border bg-surface-2 px-3 py-1 text-xs font-semibold uppercase tracking-micro text-brand hover:bg-surface-3"
                >
                  {controls.copyPrompt}
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </header>

      <div className="px-4 py-4">
        <div className="flex flex-col items-center">
          <div
            ref={previewRef}
            className="relative w-full max-w-[960px] rounded-card border border-dashed border-border/70 bg-[#EDF1FA] p-[8px]"
            style={{ aspectRatio: '16 / 9' }}
          >
            {showSkeleton ? (
              <div className={clsx('grid h-full w-full gap-[6px]', gridClass)}>
                {Array.from({ length: group ? LAYOUT_SLOT_COUNT[group.layout] ?? 1 : 1 }).map((_, index) => (
                  <div key={`dock-skeleton-${index}`} className="relative flex items-center justify-center overflow-hidden rounded-card bg-white/70">
                    <div className="skeleton absolute inset-0" />
                  </div>
                ))}
              </div>
            ) : group ? (
              <div className={clsx('grid h-full w-full gap-[6px]', gridClass)}>
                {slots.map((item, index) => {
                  if (!item) {
                    return (
                      <div key={`dock-empty-${index}`} className="relative flex items-center justify-center overflow-hidden rounded-card bg-white/70 text-xs text-text-muted">
                        {copy.placeholder}
                      </div>
                    );
                  }

                  const video = isVideo(item);
                  const itemStatusRaw = typeof item.meta?.status === 'string' ? String(item.meta.status).toLowerCase() : null;
                  const itemKey = item.id ? `${item.id}-${index}` : `dock-item-${index}`;
                  const isVideoReady = Boolean(readyItems[itemKey]);
                  const showSafariThumb = isSafari && item.thumb;
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
                    <figure key={itemKey} className="group relative flex items-center justify-center overflow-hidden rounded-card bg-[var(--surface-2)]">
                      <div className="absolute inset-0">
                        {itemStatus === 'completed' && video ? (
                          <>
                            {showSafariThumb ? (
                              <Image
                                src={item.thumb as string}
                                alt=""
                                fill
                                className={clsx(
                                  'object-contain pointer-events-none transition-opacity duration-150',
                                  isVideoReady ? 'opacity-0' : 'opacity-100'
                                )}
                              />
                            ) : null}
                            <video
                              ref={registerVideo(itemKey)}
                              src={item.url}
                              poster={item.thumb}
                              className={clsx(
                                'h-full w-full object-contain',
                                isSafari ? 'transition-opacity duration-150' : null,
                                isSafari && !isVideoReady ? 'opacity-0' : 'opacity-100'
                              )}
                              muted={isMuted}
                              playsInline
                              preload="metadata"
                              loop={isLooping}
                              autoPlay={isPlaying}
                              onLoadedData={() => markReady(itemKey)}
                            />
                          </>
                        ) : item.thumb ? (
                          <Image
                            src={item.thumb}
                            alt=""
                            fill
                            className="object-contain pointer-events-none"
                            onLoadingComplete={() => markReady(itemKey)}
                          />
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
                      <div className="pointer-events-none absolute inset-0 rounded-card border border-white/10 transition group-hover:border-white/30" />
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
              <div className="flex h-full w-full flex-col items-center justify-center rounded-card bg-white/80 text-sm text-text-secondary">
                Select a take to preview
              </div>
            )}

            {showGroupError ? (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-card bg-black/65 px-6 text-center text-white">
                <span className="text-sm font-semibold uppercase tracking-micro">Preview unavailable</span>
                <span className="mt-2 text-xs text-white/85">{group?.errorMsg ?? 'Generation failed. Please retry.'}</span>
              </div>
            ) : null}
          </div>
          <div className="mt-3 flex w-full max-w-[960px]">
            <div
              ref={toolbarRef}
              className="flex w-full items-center justify-center rounded-card border border-hairline/70 bg-white/75 px-3 py-2 shadow-sm backdrop-blur"
            >
              {toolbarControls}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
