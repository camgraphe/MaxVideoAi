'use client';

import clsx from 'clsx';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AudioWaveform,
  CalendarDays,
  ChevronRight,
  Clock3,
  Download,
  ExternalLink,
  Film,
  Link as LinkIcon,
  Monitor,
  Play,
  RefreshCw,
  Sparkles,
  WandSparkles,
  X,
  type LucideIcon,
} from 'lucide-react';
import { AudioEqualizerBadge } from '@/components/ui/AudioEqualizerBadge';
import { CopyPromptButton } from '@/components/CopyPromptButton';
import { Button, ButtonLink } from '@/components/ui/Button';
import { suggestDownloadFilename, triggerAppDownload } from '@/lib/download';
import type { JobSurface } from '@/types/billing';

export interface MediaLightboxEntry {
  id: string;
  label: string;
  videoUrl?: string | null;
  audioUrl?: string | null;
  imageUrl?: string | null;
  thumbUrl?: string | null;
  aspectRatio?: string | null;
  jobId?: string | null;
  surface?: JobSurface | null;
  status?: 'pending' | 'completed' | 'failed';
  progress?: number | null;
  message?: string | null;
  engineLabel?: string | null;
  engineId?: string | null;
  durationSec?: number | null;
  createdAt?: string | null;
  indexable?: boolean;
  visibility?: 'public' | 'private';
  hasAudio?: boolean;
  mediaType?: 'image' | 'video' | 'audio';
  prompt?: string | null;
  priceCents?: number | null;
  currency?: string | null;
  curated?: boolean;
}

export interface MediaLightboxProps {
  title: string;
  subtitle?: string;
  prompt?: string | null;
  metadata?: Array<{ label: string; value: string }>;
  entries: MediaLightboxEntry[];
  onClose: () => void;
  onRefreshEntry?: (entry: MediaLightboxEntry) => Promise<void> | void;
  onSaveToLibrary?: (entry: MediaLightboxEntry) => Promise<void>;
  onRemixEntry?: (entry: MediaLightboxEntry) => void;
  remixLabel?: string;
  onUseTemplate?: (entry: MediaLightboxEntry) => void;
  templateLabel?: string;
}

function isVerticalAspect(aspectRatio?: string | null): boolean {
  if (!aspectRatio) return false;
  const value = aspectRatio.toLowerCase();
  if (!value.includes(':')) return false;
  const [w, h] = value.split(':').map((part) => Number(part));
  if (!Number.isFinite(w) || !Number.isFinite(h) || h === 0) return false;
  return h > w;
}

function formatPromptPreview(prompt: string, maxLength = 220): string {
  const normalized = prompt.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trim()}…`;
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function formatEntryDate(value?: string | null): string | null {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function resolveStatusLabel(status?: MediaLightboxEntry['status']): string | null {
  if (status === 'pending') return 'Processing';
  if (status === 'failed') return 'Failed';
  if (status === 'completed') return 'Ready';
  return null;
}

function statusBadgeClass(status?: MediaLightboxEntry['status']): string {
  if (status === 'failed') return 'border-warning-border bg-warning-bg text-warning';
  if (status === 'pending') return 'border-brand/30 bg-[var(--brand-soft)] text-brand';
  return 'border-[var(--brand-border)] bg-[var(--brand-soft)] text-brand';
}

function resolveOpenLabel(entry: MediaLightboxEntry): string {
  if (entry.audioUrl && !entry.videoUrl) return 'Open audio';
  if (entry.imageUrl && !entry.videoUrl) return 'Open image';
  return 'Open in player';
}

function MetaItem({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex min-w-[132px] items-center gap-3 border-r border-hairline pr-5 last:border-r-0">
      <Icon className="h-5 w-5 shrink-0 text-text-muted" aria-hidden />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">{label}</p>
        <p className="truncate text-sm font-semibold text-text-primary">{value}</p>
      </div>
    </div>
  );
}

function ActionCard({
  icon: Icon,
  title,
  body,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'group flex min-h-[108px] items-center gap-3 rounded-[16px] border border-hairline bg-surface-2/70 p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        disabled ? 'cursor-not-allowed opacity-55' : 'hover:border-[var(--brand-border)] hover:bg-[var(--brand-soft)]'
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand-soft)] text-brand">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-text-primary">{title}</span>
        <span className="mt-1 block text-xs leading-relaxed text-text-secondary">{body}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-brand transition-transform group-hover:translate-x-0.5" aria-hidden />
    </button>
  );
}

function RenderDecorVisual({ previewUrl }: { previewUrl?: string | null }) {
  return (
    <div className="relative hidden min-h-[118px] overflow-hidden rounded-[16px] border border-hairline bg-[linear-gradient(145deg,#f7faff_0%,#eef4ff_52%,#e6f2ed_100%)] p-3 xl:block">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_22%,rgba(62,142,114,0.18),transparent_34%),radial-gradient(circle_at_18%_88%,rgba(78,125,226,0.16),transparent_42%)]" />
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/70 blur-2xl" />
      <div className="relative ml-auto mt-1 h-[86px] w-[132px] rotate-[-5deg] overflow-hidden rounded-[18px] border border-white/75 bg-[#17243b] shadow-[0_18px_34px_rgba(31,58,96,0.22)]">
        {previewUrl ? (
          <Image src={previewUrl} alt="" fill className="object-cover" sizes="132px" />
        ) : (
          <svg viewBox="0 0 132 86" className="h-full w-full" aria-hidden>
            <rect width="132" height="86" fill="#AFC4E6" />
            <path d="M0 0h132v52C100 36 73 34 52 46 31 57 13 55 0 46Z" fill="#DDE8FB" opacity="0.78" />
            <path d="M0 66c19-12 39-15 61-8 19 6 33 1 47-10 9-7 17-9 24-7v45H0Z" fill="#203A60" opacity="0.62" />
            <path d="M12 24h42M12 36h26" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" opacity="0.58" />
          </svg>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-white/15" />
        <div className="absolute bottom-3 left-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#27456c] shadow-card">
          <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
        </div>
        <div className="absolute bottom-4 left-12 h-1.5 w-16 overflow-hidden rounded-full bg-white/40">
          <div className="h-full w-2/3 rounded-full bg-white" />
        </div>
      </div>
      <div className="absolute bottom-4 left-5 h-9 w-12 rotate-[8deg] rounded-[10px] border border-white/70 bg-white/75 shadow-[0_10px_22px_rgba(31,58,96,0.14)]">
        <div className="mx-auto mt-2 h-2 w-7 rounded-full bg-[#9cb2d2]" />
        <div className="mx-auto mt-1.5 h-2 w-5 rounded-full bg-[#c2d1e8]" />
      </div>
      <div className="absolute right-5 top-4 h-3 w-3 rounded-full bg-success/70 shadow-[0_0_0_6px_rgba(62,142,114,0.10)]" />
    </div>
  );
}

export function MediaLightbox({
  title,
  subtitle,
  prompt,
  metadata = [],
  entries,
  onClose,
  onRefreshEntry,
  onSaveToLibrary,
  onRemixEntry,
  remixLabel,
  onUseTemplate,
  templateLabel,
}: MediaLightboxProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [refreshStates, setRefreshStates] = useState<Record<string, { loading: boolean; error: string | null }>>({});
  const [downloadStates, setDownloadStates] = useState<Record<string, { loading: boolean; error: string | null }>>({});
  const [libraryStates, setLibraryStates] = useState<Record<string, { loading: boolean; success: boolean; error: string | null }>>({});

  const handleCopyLink = useCallback(
    async (entryId: string, url?: string | null) => {
      if (!url) return;
      try {
        await navigator.clipboard.writeText(url);
        setCopiedId(entryId);
        window.setTimeout(() => setCopiedId((current) => (current === entryId ? null : current)), 1800);
      } catch {
        setCopiedId((current) => (current === entryId ? null : current));
      }
    },
    []
  );

  const handleDownloadEntry = useCallback(async (entry: MediaLightboxEntry, url?: string | null) => {
    if (!url) return;
    setDownloadStates((prev) => ({
      ...prev,
      [entry.id]: { loading: true, error: null },
    }));
    try {
      const safeLabel =
        entry.label?.trim().replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') ||
        (entry.jobId ?? entry.id ?? 'download');
      triggerAppDownload(url, suggestDownloadFilename(url, safeLabel));
      setDownloadStates((prev) => {
        const next = { ...prev };
        delete next[entry.id];
        return next;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to download file';
      setDownloadStates((prev) => ({
        ...prev,
        [entry.id]: { loading: false, error: message },
      }));
    }
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    setRefreshStates((prev) => {
      const activeIds = new Set(entries.map((entry) => entry.id));
      let mutated = false;
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (!activeIds.has(key)) {
          delete next[key];
          mutated = true;
        }
      });
      return mutated ? next : prev;
    });
  }, [entries]);

  useEffect(() => {
    setDownloadStates((prev) => {
      const activeIds = new Set(entries.map((entry) => entry.id));
      let mutated = false;
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (!activeIds.has(key)) {
          delete next[key];
          mutated = true;
        }
      });
      return mutated ? next : prev;
    });
  }, [entries]);

  useEffect(() => {
    setLibraryStates((prev) => {
      const activeIds = new Set(entries.map((entry) => entry.id));
      let mutated = false;
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (!activeIds.has(key)) {
          delete next[key];
          mutated = true;
        }
      });
      return mutated ? next : prev;
    });
  }, [entries]);

  const handleRefreshEntry = useCallback(
    async (entry: MediaLightboxEntry) => {
      if (!onRefreshEntry) return;
      setRefreshStates((prev) => ({
        ...prev,
        [entry.id]: { loading: true, error: null },
      }));
      try {
        await onRefreshEntry(entry);
        setRefreshStates((prev) => {
          const next = { ...prev };
          delete next[entry.id];
          return next;
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to refresh status';
        setRefreshStates((prev) => ({
          ...prev,
          [entry.id]: { loading: false, error: message },
        }));
      }
    },
    [onRefreshEntry]
  );

  const handleSaveEntryToLibrary = useCallback(
    async (entry: MediaLightboxEntry, mediaUrl?: string | null) => {
      if (!onSaveToLibrary || !mediaUrl) return;
      setLibraryStates((prev) => ({
        ...prev,
        [entry.id]: { loading: true, success: false, error: null },
      }));
      try {
        await onSaveToLibrary(entry);
        setLibraryStates((prev) => ({
          ...prev,
          [entry.id]: { loading: false, success: true, error: null },
        }));
        window.setTimeout(() => {
          setLibraryStates((prev) => {
            const next = { ...prev };
            if (next[entry.id]?.success) {
              delete next[entry.id];
            }
            return next;
          });
        }, 2500);
      } catch (error) {
        setLibraryStates((prev) => ({
          ...prev,
          [entry.id]: {
            loading: false,
            success: false,
            error: error instanceof Error ? error.message : 'Unable to save image',
          },
        }));
      }
    },
    [onSaveToLibrary]
  );

  const hasAtLeastOneRenderableMedia = useMemo(
    () => entries.some((entry) => Boolean(entry.videoUrl || entry.audioUrl || entry.imageUrl || entry.thumbUrl)),
    [entries]
  );
  const specs = useMemo(() => {
    const next: Array<{ label: string; value: string }> = [];
    if (title) {
      next.push({ label: 'Group', value: title });
    }
    if (subtitle) {
      next.push({ label: 'Created', value: subtitle });
    }
    const existing = new Set(next.map((item) => item.label.toLowerCase()));
    metadata.forEach((item) => {
      const key = item.label.toLowerCase();
      if (!existing.has(key)) {
        next.push(item);
        existing.add(key);
      }
    });
    return next;
  }, [metadata, subtitle, title]);

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-[3px]"
      role="dialog"
      aria-modal="true"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-[1180px] max-h-[calc(100vh-48px)] overflow-y-auto rounded-[30px] border border-hairline bg-surface p-6 shadow-float sm:p-7">
        {!hasAtLeastOneRenderableMedia ? (
          <p className="mb-4 rounded-input border border-dashed border-border bg-bg px-3 py-2 text-sm text-text-muted">
            Media will be available once the render completes.
          </p>
        ) : null}

        <section className="space-y-8">
          {entries.map((entry, index) => {
            const videoUrl = entry.videoUrl ?? undefined;
            const audioUrl = entry.audioUrl ?? undefined;
            const imageUrl = entry.imageUrl ?? undefined;
            const thumbUrl = entry.thumbUrl ?? undefined;
            const mediaUrl = entry.videoUrl ?? entry.audioUrl ?? entry.imageUrl ?? entry.thumbUrl ?? null;
            const libraryState = libraryStates[entry.id];
            const isProcessing = entry.status === 'pending';
            const progressLabel =
              typeof entry.progress === 'number'
                ? `${Math.max(0, Math.min(100, Math.round(entry.progress)))}%`
                : isProcessing
                  ? 'Processing'
                  : undefined;
            const statusLabel = resolveStatusLabel(entry.status);
            const createdLabel = formatEntryDate(entry.createdAt) ?? specs.find((item) => item.label.toLowerCase() === 'created')?.value ?? null;
            const isVertical = isVerticalAspect(entry.aspectRatio);
            const refreshState = refreshStates[entry.id];
            const isRefreshing = Boolean(refreshState?.loading);
            const refreshError = refreshState?.error ?? null;
            const refreshTarget = entry.jobId ?? entry.id;
            const hasRefreshTarget = typeof refreshTarget === 'string' && refreshTarget.trim().length > 0;
            const canRefresh =
              Boolean(onRefreshEntry) &&
              hasRefreshTarget &&
              (entry.status === 'pending' || (!entry.videoUrl && !entry.audioUrl));
            const canRemix = Boolean(onRemixEntry);
            const canTemplate = Boolean(onUseTemplate) && !entry.curated;
            const downloadState = downloadStates[entry.id];
            const isDownloading = Boolean(downloadState?.loading);
            const downloadError = downloadState?.error ?? null;
            const showPrompt = Boolean(prompt) && index === 0;
            const displayTitle = entry.engineLabel ?? subtitle ?? title;
            const detailSpecs = [
              ...(entry.jobId ? [{ label: 'Job ID', value: entry.jobId }] : []),
              ...specs.filter((item) => !['engine', 'created', 'date'].includes(item.label.toLowerCase())),
            ].filter((item) => Boolean(item.value));
            const technicalSpecs = [
              ...(entry.aspectRatio ? [{ label: 'Aspect', value: entry.aspectRatio, icon: Monitor }] : []),
              ...(typeof entry.durationSec === 'number' ? [{ label: 'Duration', value: `${entry.durationSec}s`, icon: Clock3 }] : []),
              { label: 'Audio', value: entry.hasAudio ? 'Yes' : audioUrl ? 'Audio file' : 'No', icon: AudioWaveform },
            ];

            return (
              <article key={entry.id}>
                <header className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-2xl font-semibold text-text-primary">{displayTitle}</h3>
                      {statusLabel ? (
                        <span className={clsx('rounded-pill border px-3 py-1 text-[11px] font-semibold uppercase tracking-micro', statusBadgeClass(entry.status))}>
                          {statusLabel}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-5 flex flex-wrap items-center gap-y-3 text-sm text-text-primary">
                      {entry.engineLabel ? (
                        <MetaItem icon={Film} label="Engine" value={entry.engineLabel} />
                      ) : null}
                      {typeof entry.durationSec === 'number' ? (
                        <MetaItem icon={Clock3} label="Duration" value={`${entry.durationSec}s`} />
                      ) : null}
                      {entry.aspectRatio ? (
                        <MetaItem icon={Monitor} label="Aspect" value={entry.aspectRatio} />
                      ) : null}
                      <MetaItem icon={AudioWaveform} label="Audio" value={entry.hasAudio || audioUrl ? 'Yes' : 'No'} />
                      {createdLabel ? (
                        <MetaItem icon={CalendarDays} label="Created" value={createdLabel} />
                      ) : null}
                    </div>
                  </div>
                  {index === 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onClose}
                      aria-label="Close"
                      className="h-9 w-9 shrink-0 rounded-full border-hairline bg-surface p-0 text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </Button>
                  ) : null}
                </header>

                <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_310px]">
                  <div>
                    <div
                      className={clsx(
                        'relative overflow-hidden rounded-[18px] border border-hairline bg-black shadow-card',
                        isVertical ? 'mx-auto aspect-[9/16] max-h-[58vh] max-w-sm' : 'aspect-video'
                      )}
                    >
                      {videoUrl ? (
                        <video
                          key={videoUrl}
                          src={videoUrl}
                          poster={thumbUrl}
                          className="absolute inset-0 h-full w-full object-contain"
                          controls
                          playsInline
                          autoPlay
                          muted
                          preload="metadata"
                        />
                      ) : audioUrl ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(124,85,234,0.28),_transparent_52%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(30,41,59,0.88))] px-6 py-6 text-center">
                          {thumbUrl ? <Image src={thumbUrl} alt="" fill className="object-cover opacity-20" sizes="(max-width: 1024px) 100vw, calc(100vw - 360px)" /> : null}
                          <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-white/15 bg-white/10">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/assets/icons/audio.svg" alt="" className="h-10 w-10 opacity-95" />
                          </div>
                          <p className="relative mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-white/70">
                            Audio output
                          </p>
                          <div className="relative mt-5 w-full max-w-xl">
                            <audio controls src={audioUrl} className="w-full" />
                          </div>
                        </div>
                      ) : imageUrl || thumbUrl ? (
                        <Image src={imageUrl ?? thumbUrl ?? ''} alt="" fill className="object-contain" sizes="(max-width: 1024px) 100vw, calc(100vw - 360px)" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-surface-2 via-surface to-surface-2 text-[12px] font-medium uppercase tracking-micro text-text-muted">
                          Preview unavailable
                        </div>
                      )}
                      {entry.hasAudio ? <AudioEqualizerBadge tone="light" size="sm" label="Audio available" /> : null}
                      {isProcessing && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-on-media-dark-45 px-3 text-center text-[11px] text-on-inverse backdrop-blur-sm">
                          <span className="uppercase tracking-micro">Processing...</span>
                          {entry.message ? <span className="mt-1 line-clamp-2 text-on-media-80">{entry.message}</span> : null}
                          {progressLabel ? <span className="mt-1 text-[12px] font-semibold text-on-inverse">{progressLabel}</span> : null}
                        </div>
                      )}
                    </div>

                    <div className="mt-7 flex flex-wrap justify-center gap-4">
                      {canRefresh ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="md"
                          onClick={() => {
                            void handleRefreshEntry(entry).catch(() => undefined);
                          }}
                          disabled={isRefreshing}
                          className="min-w-[180px] border-[var(--brand-border)] px-5 text-brand hover:bg-[var(--brand-soft)]"
                        >
                          <RefreshCw className="h-4 w-4" aria-hidden />
                          {isRefreshing ? 'Checking...' : 'Refresh status'}
                        </Button>
                      ) : null}
                      <ButtonLink
                        linkComponent="a"
                        href={mediaUrl ?? '#'}
                        target="_blank"
                        rel="noreferrer"
                        size="md"
                        className={clsx('min-w-[180px] px-5', !mediaUrl && 'pointer-events-none opacity-50')}
                      >
                        <ExternalLink className="h-4 w-4" aria-hidden />
                        {resolveOpenLabel(entry)}
                      </ButtonLink>
                      <Button
                        type="button"
                        variant="outline"
                        size="md"
                        onClick={() => handleDownloadEntry(entry, mediaUrl)}
                        disabled={!mediaUrl || isDownloading}
                        className="min-w-[180px] border-hairline px-5 text-text-primary hover:bg-surface-2"
                      >
                        <Download className="h-4 w-4" aria-hidden />
                        {isDownloading ? 'Downloading...' : 'Download'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="md"
                        onClick={() => handleCopyLink(entry.id, mediaUrl)}
                        disabled={!mediaUrl}
                        className="min-w-[180px] border-hairline px-5 text-text-primary hover:bg-surface-2"
                      >
                        <LinkIcon className="h-4 w-4" aria-hidden />
                        {copiedId === entry.id ? 'Link copied' : 'Copy link'}
                      </Button>
                    </div>
                  </div>

                  <aside className="space-y-0 overflow-hidden rounded-[18px] border border-hairline bg-surface-2/60">
                    <div className="p-5">
                      <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Render details</p>
                      <dl className="mt-4 space-y-4 text-sm">
                        {detailSpecs.length > 0 ? (
                          detailSpecs.map((item) => (
                            <div key={`${entry.id}-detail-${item.label}`}>
                              <dt className="text-xs font-medium text-text-muted">{item.label}</dt>
                              <dd className="mt-1 break-words font-medium text-text-primary">{item.value}</dd>
                            </div>
                          ))
                        ) : (
                          <div>
                            <dt className="text-xs font-medium text-text-muted">Render</dt>
                            <dd className="mt-1 font-medium text-text-primary">{entry.label || title}</dd>
                          </div>
                        )}
                      </dl>
                    </div>

                    {showPrompt ? (
                      <div className="border-t border-hairline p-5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Prompt</p>
                          <CopyPromptButton prompt={prompt ?? ''} copyLabel="Copy" copiedLabel="Copied" />
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-text-primary">
                          {formatPromptPreview(prompt ?? '')}
                        </p>
                        {prompt && prompt.trim().length > 220 ? (
                          <details className="group mt-3">
                            <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-micro text-brand">
                              <span className="group-open:hidden">Show more</span>
                              <span className="hidden group-open:inline">Show less</span>
                            </summary>
                            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-text-secondary">{prompt}</p>
                          </details>
                        ) : null}
                      </div>
                    ) : null}
                  </aside>
                </div>

                <div className="mt-8 border-t border-hairline pt-5">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {onRemixEntry ? (
                      <ActionCard
                        icon={WandSparkles}
                        title={remixLabel ?? 'Remix'}
                        body="Create a new version based on this render"
                        disabled={!canRemix}
                        onClick={() => onRemixEntry(entry)}
                      />
                    ) : null}
                    {onUseTemplate ? (
                      <ActionCard
                        icon={CalendarDays}
                        title={templateLabel ?? 'Use as template'}
                        body="Reuse settings and prompt for a new render"
                        disabled={!canTemplate}
                        onClick={() => onUseTemplate(entry)}
                      />
                    ) : null}
                    {onSaveToLibrary ? (
                      <ActionCard
                        icon={Sparkles}
                        title={
                          libraryState?.loading
                            ? 'Saving...'
                            : libraryState?.success
                              ? 'Saved'
                              : libraryState?.error
                                ? 'Retry save'
                                : 'Save to library'
                        }
                        body="Keep this media in your library"
                        disabled={!mediaUrl || libraryState?.loading}
                        onClick={() => handleSaveEntryToLibrary(entry, mediaUrl)}
                      />
                    ) : null}
                    <div className="rounded-[16px] border border-hairline bg-surface-2/70 p-4">
                      <div className="space-y-3">
                        {technicalSpecs.map((item) => {
                          const Icon = item.icon;
                          return (
                            <div key={`${entry.id}-tech-${item.label}`} className="flex items-center gap-3 text-sm">
                              <Icon className="h-4 w-4 text-text-muted" aria-hidden />
                              <span className="min-w-20 text-text-muted">{item.label}</span>
                              <span className="font-semibold text-text-primary">{item.value}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <RenderDecorVisual previewUrl={thumbUrl ?? imageUrl ?? null} />
                  </div>
                </div>

                {entry.message && !isProcessing && !isUuidLike(entry.message.trim()) ? (
                  <p className="mt-4 text-sm text-text-secondary">{entry.message}</p>
                ) : null}
                {downloadError ? <p className="mt-2 text-xs text-state-warning">{downloadError}</p> : null}
                {refreshError ? <p className="mt-2 text-xs text-state-warning">{refreshError}</p> : null}
                {libraryState?.error ? <p className="mt-2 text-xs text-state-warning">{libraryState.error}</p> : null}
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
}
