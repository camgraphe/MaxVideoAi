'use client';
/* eslint-disable @next/next/no-img-element */

import clsx from 'clsx';
import Image from 'next/image';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { EngineCaps, PricingSnapshot } from '@/types/engines';
import type { Job } from '@/types/jobs';
import { useEngines, useInfiniteJobs } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { JobMedia } from '@/components/JobMedia';
import { getPlaceholderMedia } from '@/lib/placeholderMedia';
import { CURRENCY_LOCALE } from '@/lib/intl';

function ThumbImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const baseClass = clsx('object-cover', className);
  if (src.startsWith('data:')) {
    return <img src={src} alt={alt} className={clsx('absolute inset-0 h-full w-full', baseClass)} />;
  }
  return <Image src={src} alt={alt} fill className={baseClass} />;
}

interface Props {
  engine: EngineCaps;
  currentPrompt: string;
  onReplacePrompt: (value: string) => void;
  onAppendPrompt: (value: string) => void;
  onFocusComposer: () => void;
  onRequestEngineSwitch: (engineId: string) => void;
  pendingItems?: Array<{
    id: string;
    engineId: string;
    engineLabel: string;
    createdAt: string;
    aspectRatio: string;
    durationSec: number;
    prompt: string;
    progress: number;
    message: string;
    videoUrl?: string;
    thumbUrl?: string;
    priceCents?: number;
    currency?: string;
    pricingSnapshot?: PricingSnapshot;
  }>;
  onSelectPreview?: (payload: {
    id?: string;
    videoUrl?: string;
    aspectRatio?: string;
    thumbUrl?: string;
    progress?: number;
    message?: string;
    priceCents?: number;
    currency?: string;
  }) => void;
}

interface SnackbarAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'ghost';
}

interface SnackbarState {
  message: string;
  actions?: SnackbarAction[];
  duration?: number;
}

export function GalleryRail({
  engine,
  currentPrompt,
  onReplacePrompt,
  onAppendPrompt,
  onFocusComposer,
  onRequestEngineSwitch,
  pendingItems,
  onSelectPreview,
}: Props) {
  const { data, error, isLoading, isValidating, setSize, mutate } = useInfiniteJobs(24);
  const { data: enginesData } = useEngines();
  const jobs = useMemo(() => data?.flatMap((page) => page.jobs) ?? [], [data]);
  const lastPage = data?.[data.length - 1];
  const hasMore = Boolean(lastPage?.nextCursor);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [snackbar, setSnackbar] = useState<SnackbarState | null>(null);

  const engineMap = useMemo(() => {
    const map = new Map<string, EngineCaps>();
    if (enginesData?.engines) {
      enginesData.engines.forEach((entry) => {
        map.set(entry.id, entry);
      });
    }
    map.set(engine.id, engine);
    return map;
  }, [engine, enginesData?.engines]);

  const closeSnackbar = useCallback(() => setSnackbar(null), []);

  const applyPrompt = useCallback(
    (job: Job, mode: 'replace' | 'append', options?: { successMessage?: string }) => {
      if (mode === 'replace') {
        onReplacePrompt(job.prompt);
      } else {
        onAppendPrompt(job.prompt);
      }
      onFocusComposer();

      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        void navigator.clipboard.writeText(job.prompt).catch(() => undefined);
      }

      const successMessage = options?.successMessage ?? (mode === 'replace' ? 'Prompt replaced' : 'Prompt appended');

      if (job.engineId && job.engineId !== engine.id) {
        setSnackbar({
          message: `Switch to ${job.engineLabel}?`,
          actions: [
            {
              label: 'Switch',
              variant: 'primary',
              onClick: () => {
                if (job.engineId) {
                  onRequestEngineSwitch(job.engineId);
                }
                setSnackbar({ message: `${job.engineLabel} selected`, duration: 2200 });
              },
            },
            {
              label: 'Keep current',
              onClick: () => {
                setSnackbar({ message: successMessage, duration: 2200 });
              },
            },
          ],
        });
        return;
      }

      setSnackbar({ message: successMessage, duration: 2200 });
    },
    [engine.id, onAppendPrompt, onFocusComposer, onReplacePrompt, onRequestEngineSwitch]
  );

  const handleCopyPrompt = useCallback(
    (job: Job) => {
      if (!currentPrompt.trim()) {
        applyPrompt(job, 'replace', { successMessage: 'Prompt pasted' });
        return;
      }

      setSnackbar({
        message: 'Replace or append this prompt?',
        actions: [
          {
            label: 'Replace',
            variant: 'primary',
            onClick: () => {
              applyPrompt(job, 'replace');
            },
          },
          {
            label: 'Append',
            onClick: () => {
              applyPrompt(job, 'append');
            },
          },
          {
            label: 'Cancel',
            onClick: () => {
              closeSnackbar();
            },
          },
        ],
      });
    },
    [applyPrompt, closeSnackbar, currentPrompt]
  );

  const loadMore = useCallback(() => {
    if (!hasMore || isLoading || isValidating) return;
    setSize((current) => current + 1);
  }, [hasMore, isLoading, isValidating, setSize]);

  const retry = useCallback(() => {
    void mutate();
  }, [mutate]);

  useEffect(() => {
    const element = sentinelRef.current;
    if (!element || !hasMore) return undefined;

    let previousY = 0;
    let previousRatio = 0;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && (entry.boundingClientRect.y > previousY || entry.intersectionRatio > previousRatio)) {
            loadMore();
          }
          previousY = entry.boundingClientRect.y;
          previousRatio = entry.intersectionRatio;
        });
      },
      {
        threshold: 0.2,
        root: scrollContainerRef.current ?? null,
      }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  const isInitialLoading = isLoading && jobs.length === 0;
  const isFetchingMore = isValidating && jobs.length > 0;

  return (
    <aside className="hidden xl:flex h-[calc(125vh-var(--header-height))] w-[272px] shrink-0 flex-col border-l border-border bg-bg/80 px-4 pb-6 pt-4">
      <header className="flex items-center justify-between">
        <h2 className="text-[12px] font-semibold uppercase tracking-micro text-text-muted">Latest renders</h2>
        <Link
          href="/jobs"
          className="rounded-[10px] border border-transparent px-3 py-1 text-[12px] font-medium text-text-muted transition hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View all
        </Link>
      </header>

      {error && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-[10px] border border-[#FACC15]/60 bg-[#FEF3C7] px-3 py-2 text-[12px] text-[#92400E]">
          <span role="alert">Failed to load latest renders. Please retry.</span>
          <button
            type="button"
            onClick={retry}
            className="inline-flex items-center rounded-[8px] border border-[#92400E]/20 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-micro text-[#92400E] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#92400E]/40"
          >
            Retry
          </button>
        </div>
      )}

      <div ref={scrollContainerRef} className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
          {pendingItems && pendingItems.length > 0 && (
          <div className="space-y-4">
            {pendingItems.map((item, index) => {
              const placeholder = getPlaceholderMedia(`${item.id}-${index}`);
              const videoUrl = item.videoUrl ?? placeholder.videoUrl;
              const aspectRatio = item.aspectRatio ?? placeholder.aspectRatio;
              const thumbUrl = item.thumbUrl ?? placeholder.posterUrl;
              const resolvedEngine = engineMap.get(item.engineId) ?? engineList.find((entry) => entry.label === item.engineLabel);

              if (!videoUrl) {
                return (
                  <PendingTile
                    key={item.id}
                    item={item}
                    engine={resolvedEngine}
                    onOpenPreview={() =>
                      onSelectPreview?.({
                        id: item.id,
                        aspectRatio: item.aspectRatio,
                        thumbUrl: item.thumbUrl,
                        progress: item.progress,
                        message: item.message,
                        priceCents: item.priceCents,
                        currency: item.currency,
                      })
                    }
                  />
                );
              }

              return (
                <JobTile
                  key={item.id}
                  job={{
                    jobId: item.id,
                    engineLabel: item.engineLabel,
                    durationSec: item.durationSec,
                    prompt: item.prompt,
                    thumbUrl,
                    videoUrl,
                    createdAt: item.createdAt,
                    engineId: item.engineId,
                    aspectRatio,
                    finalPriceCents: item.priceCents,
                    currency: item.currency ?? 'USD',
                    pricingSnapshot: item.pricingSnapshot,
                  } as Job}
                  onCopyPrompt={handleCopyPrompt}
                  onOpenPreview={() =>
                    onSelectPreview?.({
                      id: item.id,
                      videoUrl,
                      aspectRatio,
                      thumbUrl,
                      priceCents: item.priceCents,
                      currency: item.currency,
                    })
                  }
                  engineCaps={resolvedEngine}
                />
              );
            })}
          </div>
        )}
        {jobs.map((job, index) => {
          const placeholder = getPlaceholderMedia(`${job.jobId}-${index}`);
          const videoUrl = job.videoUrl ?? placeholder.videoUrl;
          const aspectRatio = job.aspectRatio ?? placeholder.aspectRatio;
          const thumbUrl = job.thumbUrl ?? placeholder.posterUrl;

          return (
            <JobTile
              key={job.jobId}
              job={{
                ...job,
                videoUrl,
                thumbUrl,
                aspectRatio,
              }}
              engineCaps={job.engineId ? engineMap.get(job.engineId) : engineMap.get(engine.id)}
              onCopyPrompt={handleCopyPrompt}
              onOpenPreview={() =>
                onSelectPreview?.({
                  videoUrl,
                  aspectRatio,
                  thumbUrl,
                  priceCents: job.finalPriceCents ?? job.pricingSnapshot?.totalCents,
                  currency: job.currency ?? job.pricingSnapshot?.currency,
                })
              }
            />
          );
        })}

        {(isInitialLoading || isFetchingMore) && (
          <div className="space-y-4" aria-hidden>
            {Array.from({ length: 3 }).map((_, index) => (
              <SkeletonTile key={index} />
            ))}
          </div>
        )}

        <div ref={sentinelRef} className="h-1 w-full" aria-hidden />
      </div>

      <Snackbar state={snackbar} onClose={closeSnackbar} />
    </aside>
  );
}

function JobTile({
  job,
  onCopyPrompt,
  onOpenPreview,
  engineCaps,
}: {
  job: Job;
  onCopyPrompt: (job: Job) => void;
  onOpenPreview?: () => void;
  engineCaps?: EngineCaps;
}) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [audioPopoverOpen, setAudioPopoverOpen] = useState(false);
  const [audioAnchorRect, setAudioAnchorRect] = useState<DOMRect | null>(null);
  const audioButtonRef = useRef<HTMLButtonElement>(null);
  const audioPopoverRef = useRef<HTMLDivElement>(null);

  const supportsUpscale = Boolean(engineCaps?.upscale4k ?? job.canUpscale);
  const supportsAudio = Boolean(engineCaps?.audio ?? job.hasAudio);

  const updateAnchorRect = useCallback(() => {
    if (!buttonRef.current) return;
    setAnchorRect(buttonRef.current.getBoundingClientRect());
  }, []);

  const togglePopover = useCallback(() => {
    if (popoverOpen) {
      setPopoverOpen(false);
      return;
    }
    updateAnchorRect();
    setPopoverOpen(true);
  }, [popoverOpen, updateAnchorRect]);

  const updateAudioAnchorRect = useCallback(() => {
    if (!audioButtonRef.current) return;
    setAudioAnchorRect(audioButtonRef.current.getBoundingClientRect());
  }, []);

  const toggleAudioPopover = useCallback(() => {
    if (audioPopoverOpen) {
      setAudioPopoverOpen(false);
      return;
    }
    updateAudioAnchorRect();
    setAudioPopoverOpen(true);
  }, [audioPopoverOpen, updateAudioAnchorRect]);

  useEffect(() => {
    if (!popoverOpen && !audioPopoverOpen) return undefined;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPopoverOpen(false);
        setAudioPopoverOpen(false);
      }
    };

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || buttonRef.current?.contains(target)) {
        return;
      }
      if (audioPopoverRef.current?.contains(target) || audioButtonRef.current?.contains(target)) {
        return;
      }
      setPopoverOpen(false);
      setAudioPopoverOpen(false);
    };

    const handleScroll = () => {
      if (popoverOpen) updateAnchorRect();
      if (audioPopoverOpen) updateAudioAnchorRect();
    };

    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('resize', handleScroll);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('resize', handleScroll);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [popoverOpen, audioPopoverOpen, updateAnchorRect, updateAudioAnchorRect]);

  useEffect(() => {
    if (!supportsUpscale && popoverOpen) {
      setPopoverOpen(false);
    }
  }, [supportsUpscale, popoverOpen]);

  useEffect(() => {
    if (!supportsAudio && audioPopoverOpen) {
      setAudioPopoverOpen(false);
    }
  }, [supportsAudio, audioPopoverOpen]);

  const aspectClass = useMemo(() => {
    if (job.aspectRatio === '9:16') return 'aspect-[9/16]';
    if (job.aspectRatio === '1:1') return 'aspect-square';
    return 'aspect-[16/9]';
  }, [job.aspectRatio]);

  const priceCents = job.finalPriceCents ?? job.pricingSnapshot?.totalCents;
  const currency = job.currency ?? job.pricingSnapshot?.currency ?? 'USD';
  const formattedPrice = useMemo(() => {
    if (typeof priceCents !== 'number') return null;
    try {
      return new Intl.NumberFormat(CURRENCY_LOCALE, { style: 'currency', currency }).format(priceCents / 100);
    } catch {
      return `${currency} ${(priceCents / 100).toFixed(2)}`;
    }
  }, [currency, priceCents]);

  return (
    <Card className="relative overflow-hidden rounded-card border border-border bg-white/80 p-0 shadow-card">
      <figure className="relative overflow-hidden">
        <div className={clsx('relative bg-[#EFF3FA] cursor-pointer', aspectClass)} onClick={onOpenPreview}>
          <JobMedia job={job} />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/35" aria-hidden />

        {(supportsUpscale || supportsAudio) && (
          <div className="absolute right-3 top-3 z-10 flex flex-col gap-1.5">
            {supportsUpscale && (
              <IconOverlayButton
                ref={buttonRef}
                iconSrc="/assets/icons/upscale.svg"
                label="Upscale"
                onClick={togglePopover}
                aria-expanded={popoverOpen}
                aria-label="Upscale"
              />
            )}
            {supportsAudio && (
              <IconOverlayButton
                ref={audioButtonRef}
                iconSrc="/assets/icons/audio.svg"
                label="Add audio"
                onClick={toggleAudioPopover}
                aria-expanded={audioPopoverOpen}
                aria-label="Add audio"
              />
            )}
          </div>
        )}

        <div className="absolute inset-x-3 bottom-3 z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <EngineBadge label={job.engineLabel} engine={engineCaps} />
            <span className="inline-flex items-center rounded-full bg-black/45 px-2 py-1 text-[11px] font-medium text-white">
              {job.durationSec}s
            </span>
            {formattedPrice && (
              <span className="inline-flex items-center rounded-full bg-black/60 px-2 py-1 text-[11px] font-semibold text-white">
                {formattedPrice}
              </span>
            )}
          </div>
          <IconOverlayButton
            iconSrc="/assets/icons/copy.svg"
            label="Copy prompt"
            onClick={() => onCopyPrompt(job)}
            aria-label="Copy prompt"
          />
        </div>
      </figure>

      {popoverOpen && anchorRect &&
        createPortal(
          <UpscalePopover
            anchorRect={anchorRect}
            onClose={() => setPopoverOpen(false)}
            popoverRef={popoverRef}
          />,
          document.body
        )}

      {audioPopoverOpen && audioAnchorRect &&
        createPortal(
          <AudioPopover
            anchorRect={audioAnchorRect}
            onClose={() => setAudioPopoverOpen(false)}
            popoverRef={audioPopoverRef}
          />,
          document.body
        )}
    </Card>
  );
}

interface UpscalePopoverProps {
  anchorRect: DOMRect;
  onClose: () => void;
  popoverRef: RefObject<HTMLDivElement>;
}

function UpscalePopover({ anchorRect, onClose, popoverRef }: UpscalePopoverProps) {
  const width = 260;
  const top = anchorRect.bottom + window.scrollY + 8;
  const maxLeft = window.innerWidth - width - 16;
  const left = Math.min(anchorRect.left + window.scrollX - width + anchorRect.width, Math.max(16, maxLeft));

  return (
    <div className="fixed inset-0 z-[9999]" role="presentation">
      <div
        ref={popoverRef}
        style={{ top, left, width }}
        className="absolute rounded-[12px] border border-border bg-white p-4 text-sm text-text-secondary shadow-float"
        role="dialog"
        aria-label="Upscale options"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-[12px] font-semibold uppercase tracking-micro text-text-muted">Upscale</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[8px] border border-transparent px-2 py-1 text-[11px] text-text-muted transition hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Close
          </button>
        </div>
        <dl className="mt-3 space-y-2 text-[13px]">
          <PopoverOption label="Method" value="Neural 4×" />
          <PopoverOption label="Intensity" value="Medium" />
          <PopoverOption label="Estimated price" value="+$0.30" />
        </dl>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-[8px] border border-hairline bg-white/70 px-3 py-1.5 text-[12px] font-medium text-text-secondary transition hover:bg-accentSoft/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-[8px] border border-transparent bg-accent px-3 py-1.5 text-[12px] font-semibold text-white opacity-60 cursor-not-allowed"
          >
            Coming soon
          </button>
        </div>
      </div>
    </div>
  );
}

function AudioPopover({ anchorRect, onClose, popoverRef }: UpscalePopoverProps) {
  const width = 260;
  const top = anchorRect.bottom + window.scrollY + 8;
  const maxLeft = window.innerWidth - width - 16;
  const left = Math.min(anchorRect.left + window.scrollX - width + anchorRect.width, Math.max(16, maxLeft));

  return (
    <div className="fixed inset-0 z-[9999]" role="presentation">
      <div
        ref={popoverRef}
        style={{ top, left, width }}
        className="absolute rounded-[12px] border border-border bg-white p-4 text-sm text-text-secondary shadow-float"
        role="dialog"
        aria-label="Add audio options"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-[12px] font-semibold uppercase tracking-micro text-text-muted">Add audio</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[8px] border border-transparent px-2 py-1 text-[11px] text-text-muted transition hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Close
          </button>
        </div>
        <dl className="mt-3 space-y-2 text-[13px]">
          <PopoverOption label="Mode" value="Generate music" />
          <PopoverOption label="Style" value="Cinematic" />
          <PopoverOption label="Estimated price" value="+$0.00 (placeholder)" />
        </dl>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-[8px] border border-hairline bg-white/70 px-3 py-1.5 text-[12px] font-medium text-text-secondary transition hover:bg-accentSoft/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-[8px] border border-transparent bg-accent px-3 py-1.5 text-[12px] font-semibold text-white opacity-60 cursor-not-allowed"
          >
            Coming soon
          </button>
        </div>
      </div>
    </div>
  );
}

function PopoverOption({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[13px] text-text-secondary">
      <span className="text-[12px] uppercase tracking-micro text-text-muted">{label}</span>
      <span className="font-medium text-text-primary">{value}</span>
    </div>
  );
}

function EngineBadge({ engine, label }: { engine?: EngineCaps | null; label: string }) {
  return (
    <span className="inline-flex max-w-[160px] items-center gap-1.5 rounded-input border border-border bg-white/90 px-2.5 py-1 text-[11px] font-medium text-text-secondary">
      <EngineIcon engine={engine ?? undefined} label={label} size={20} rounded="full" className="shrink-0 border border-hairline bg-white" />
      <span className="truncate">{label}</span>
    </span>
  );
}

const GhostOverlayButton = forwardRef<HTMLButtonElement, { label: string; iconSrc: string; onClick?: () => void; 'aria-expanded'?: boolean }>(
  ({ label, iconSrc, onClick, ...rest }, ref) => (
    <button
      type="button"
      onClick={onClick}
      ref={ref}
      className="inline-flex items-center gap-1.5 rounded-[10px] border border-white/30 bg-white/30 px-2.5 py-1 text-[11px] font-medium uppercase tracking-micro text-white shadow-sm backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9DA7B8CC]"
      {...rest}
    >
      <Image src={iconSrc} alt="" width={14} height={14} aria-hidden className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  )
);
GhostOverlayButton.displayName = 'GhostOverlayButton';

// Icon-only, smaller sticker-like button
const IconOverlayButton = forwardRef<HTMLButtonElement, { iconSrc: string; label: string; onClick?: () => void; 'aria-expanded'?: boolean; 'aria-label'?: string }>(
  ({ iconSrc, label, onClick, ...rest }, ref) => (
    <div className="relative group inline-flex">
      <button
        type="button"
        onClick={onClick}
        ref={ref}
        className="inline-flex h-6 w-6 items-center justify-center rounded-[8px] border border-white/30 bg-white/30 text-white shadow-sm backdrop-blur transition hover:bg-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9DA7B8CC]"
        {...rest}
      >
        <Image src={iconSrc} alt="" width={12} height={12} aria-hidden className="h-3 w-3" />
      </button>
      <div className="pointer-events-none absolute right-full top-1/2 z-[1] -translate-y-1/2 pr-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
        <div className="rounded-[8px] border border-border bg-black/85 px-2 py-1 text-[11px] font-medium text-white shadow-float whitespace-nowrap">
          {label}
        </div>
      </div>
    </div>
  )
);
IconOverlayButton.displayName = 'IconOverlayButton';

function SkeletonTile() {
  return (
    <div className="rounded-card border border-border bg-white/60 p-0">
      <div className="relative overflow-hidden rounded-card">
        <div className="relative aspect-[16/9]">
          <div className="skeleton absolute inset-0" />
        </div>
      </div>
    </div>
  );
}

type PendingItem = NonNullable<Props['pendingItems']>[number];

function PendingTile({ item, onOpenPreview, engine }: { item: PendingItem; onOpenPreview?: () => void; engine?: EngineCaps | null }) {
  const aspectClass = item.aspectRatio === '9:16' ? 'aspect-[9/16]' : item.aspectRatio === '1:1' ? 'aspect-square' : 'aspect-[16/9]';
  return (
    <div className="relative overflow-hidden rounded-card border border-border bg-white/80 p-0 shadow-card">
      <figure className="relative overflow-hidden">
        <div className={clsx('relative bg-[#EFF3FA] cursor-pointer', aspectClass)} onClick={onOpenPreview}>
          {item.thumbUrl ? (
            <ThumbImage src={item.thumbUrl} alt="" className="object-cover" />
          ) : (
            <div className="absolute inset-0" />
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/30 text-white">
            <span className="inline-flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-micro">
              <Image src="/assets/icons/live.svg" alt="" width={12} height={12} className="h-3 w-3" />
              Live
            </span>
            <div className="w-3/4 overflow-hidden rounded-full border border-white/30">
              <div className="h-2 bg-white/80" style={{ width: `${Math.max(5, Math.min(100, item.progress))}%` }} />
            </div>
            <span className="text-[12px] text-white/90">{item.message}</span>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/35" aria-hidden />
        <div className="absolute inset-x-3 bottom-3 z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white">
              <EngineIcon engine={engine ?? undefined} label={item.engineLabel} size={18} rounded="full" className="shrink-0 border border-white/40 bg-white/95 text-black" />
              <span className="uppercase tracking-micro">{item.engineLabel}</span>
            </span>
            <span className="inline-flex items-center rounded-full bg-black/45 px-2 py-1 text-[11px] font-medium text-white">
              {item.durationSec}s
            </span>
            {typeof item.priceCents === 'number' && (
              <span className="inline-flex items-center rounded-full bg-black/60 px-2 py-1 text-[11px] font-semibold text-white">
                {new Intl.NumberFormat(CURRENCY_LOCALE, {
                  style: 'currency',
                  currency: item.currency ?? 'USD',
                }).format(item.priceCents / 100)}
              </span>
            )}
          </div>
        </div>
      </figure>
    </div>
  );
}

function Snackbar({ state, onClose }: { state: SnackbarState | null; onClose: () => void }) {
  useEffect(() => {
    if (!state?.duration) return undefined;
    const timeout = window.setTimeout(onClose, state.duration);
    return () => window.clearTimeout(timeout);
  }, [state, onClose]);

  useEffect(() => {
    if (!state) return undefined;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [state, onClose]);

  if (!state) return null;

  const actions = state.actions ?? [];

  return createPortal(
    <div className="fixed inset-x-0 bottom-6 z-[9998] flex justify-center px-4">
      <div className="inline-flex max-w-xl flex-wrap items-center gap-3 rounded-[14px] border border-white/15 bg-black/80 px-4 py-3 text-[13px] text-white shadow-lg backdrop-blur">
        <span>{state.message}</span>
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => {
                  onClose();
                  action.onClick();
                }}
                className={clsx(
                  'inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-semibold uppercase tracking-micro transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9DA7B8CC]',
                  action.variant === 'primary'
                    ? 'border-transparent bg-accent text-white hover:brightness-110'
                    : 'border border-white/30 bg-transparent text-white hover:bg-white/10'
                )}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
