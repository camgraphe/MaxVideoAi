 'use client';

import clsx from 'clsx';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AudioEqualizerBadge } from '@/components/ui/AudioEqualizerBadge';
import { CopyPromptButton } from '@/components/CopyPromptButton';
import { Button, ButtonLink } from '@/components/ui/Button';

export interface MediaLightboxEntry {
  id: string;
  label: string;
  videoUrl?: string | null;
  thumbUrl?: string | null;
  aspectRatio?: string | null;
  jobId?: string | null;
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
  mediaType?: 'image' | 'video';
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
  allowIndexingControls?: boolean;
  onToggleIndexable?: (entry: MediaLightboxEntry, nextIndexable: boolean) => Promise<void>;
  onSaveToLibrary?: (entry: MediaLightboxEntry) => Promise<void>;
  onRemixEntry?: (entry: MediaLightboxEntry) => void;
  remixLabel?: string;
  onUseTemplate?: (entry: MediaLightboxEntry) => void;
  templateLabel?: string;
}

function aspectRatioClass(aspectRatio?: string | null): string {
  if (!aspectRatio) return 'aspect-[16/9]';
  const value = aspectRatio.toLowerCase();
  if (value === '9:16') return 'aspect-[9/16]';
  if (value === '1:1') return 'aspect-square';
  if (value === '4:5') return 'aspect-[4/5]';
  if (value === '16:9') return 'aspect-[16/9]';
  if (value.includes(':')) {
    const [w, h] = value.split(':').map((part) => Number(part));
    if (Number.isFinite(w) && Number.isFinite(h) && h !== 0) {
      return `aspect-[${w}/${h}]`;
    }
  }
  return 'aspect-[16/9]';
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

export function MediaLightbox({
  title,
  subtitle,
  prompt,
  metadata = [],
  entries,
  onClose,
  onRefreshEntry,
  allowIndexingControls = false,
  onToggleIndexable,
  onSaveToLibrary,
  onRemixEntry,
  remixLabel,
  onUseTemplate,
  templateLabel,
}: MediaLightboxProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [refreshStates, setRefreshStates] = useState<Record<string, { loading: boolean; error: string | null }>>({});
  const [downloadStates, setDownloadStates] = useState<Record<string, { loading: boolean; error: string | null }>>({});
  const [indexingStates, setIndexingStates] = useState<
    Record<string, { loading: boolean; value?: boolean; error: string | null }>
  >({});
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
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Download failed (${response.status})`);
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      const extension = (() => {
        try {
          const pathname = new URL(url).pathname;
          const part = pathname.split('.').pop();
          return part && part.length <= 5 ? part : 'mp4';
        } catch {
          return 'mp4';
        }
      })();
      const safeLabel =
        entry.label?.trim().replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') ||
        (entry.jobId ?? entry.id ?? 'download');
      anchor.download = `${safeLabel}.${extension}`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(downloadUrl);
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
    setIndexingStates((prev) => {
      const activeIds = new Set(entries.map((entry) => entry.id));
      let mutated = false;
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (!activeIds.has(key)) {
          delete next[key];
          mutated = true;
        }
      });
      entries.forEach((entry) => {
        const state = next[entry.id];
        if (!state) return;
        if (!state.loading && state.error === null && typeof entry.indexable === 'boolean' && state.value === entry.indexable) {
          delete next[entry.id];
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

  const handleIndexingToggle = useCallback(
    (entry: MediaLightboxEntry, currentValue: boolean) => {
      if (!onToggleIndexable) return;
      const nextValue = !currentValue;
      setIndexingStates((prev) => ({
        ...prev,
        [entry.id]: { loading: true, value: nextValue, error: null },
      }));
      onToggleIndexable(entry, nextValue)
        .then(() => {
          setIndexingStates((prev) => ({
            ...prev,
            [entry.id]: { loading: false, value: nextValue, error: null },
          }));
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : 'Failed to update indexing';
          setIndexingStates((prev) => ({
            ...prev,
            [entry.id]: { loading: false, value: currentValue, error: message },
          }));
        });
    },
    [onToggleIndexable]
  );

  const hasAtLeastOneVideo = useMemo(() => entries.some((entry) => Boolean(entry.videoUrl)), [entries]);
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
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-surface-on-media-dark-60 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative max-h-full w-full max-w-5xl overflow-y-auto p-5">
        {!hasAtLeastOneVideo ? (
          <p className="mt-3 rounded-input border border-dashed border-border bg-bg px-3 py-2 text-sm text-text-muted">
            Media will be available once the render completes.
          </p>
        ) : null}

        <section className="relative mt-6 space-y-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="absolute right-0 top-0 rounded-pill border-border bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-micro text-text-secondary hover:bg-bg"
          >
            Close
          </Button>
          {entries.map((entry, index) => {
            const aspectClass = aspectRatioClass(entry.aspectRatio);
            const videoUrl = entry.videoUrl ?? undefined;
            const thumbUrl = entry.thumbUrl ?? undefined;
            const mediaUrl = entry.videoUrl ?? entry.thumbUrl ?? null;
            const libraryState = libraryStates[entry.id];
            const isProcessing = entry.status === 'pending';
            const progressLabel =
              typeof entry.progress === 'number'
                ? `${Math.max(0, Math.min(100, Math.round(entry.progress)))}%`
                : isProcessing
                  ? 'Processing'
                  : undefined;
            const statusLabel =
              entry.status === 'pending' ? 'Processing' : entry.status === 'failed' ? 'Failed' : entry.status === 'completed' ? 'Ready' : null;
            const createdLabel = entry.createdAt
              ? (() => {
                  try {
                    return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(entry.createdAt));
                  } catch {
                    return entry.createdAt;
                  }
                })()
              : null;
            const isVertical = isVerticalAspect(entry.aspectRatio);
            const refreshState = refreshStates[entry.id];
            const isRefreshing = Boolean(refreshState?.loading);
            const refreshError = refreshState?.error ?? null;
            const refreshTarget = entry.jobId ?? entry.id;
            const hasRefreshTarget = typeof refreshTarget === 'string' && refreshTarget.trim().length > 0;
            const canRefresh =
              Boolean(onRefreshEntry) &&
              hasRefreshTarget &&
              (entry.status === 'pending' || !entry.videoUrl);
            const canRemix = Boolean(onRemixEntry);
            const canTemplate = Boolean(onUseTemplate) && !entry.curated;
            const downloadState = downloadStates[entry.id];
            const isDownloading = Boolean(downloadState?.loading);
            const downloadError = downloadState?.error ?? null;
            const indexingState = indexingStates[entry.id];
            const displayIndexable =
              typeof indexingState?.value === 'boolean'
                ? indexingState.value
                : typeof entry.indexable === 'boolean'
                  ? entry.indexable
                  : undefined;
            const isIndexingLoading = Boolean(indexingState?.loading);
            const indexingError = indexingState?.error ?? null;
            const showPrompt = Boolean(prompt) && index === 0;
            const entrySpecs = [
              ...(entry.jobId ? [{ label: 'Job', value: entry.jobId }] : []),
              ...specs,
            ].filter((item) => {
              if (!item.value) return false;
              const normalized = item.label.toLowerCase();
              return (
                normalized !== 'engine' &&
                normalized !== 'duration' &&
                normalized !== 'batch' &&
                normalized !== 'created' &&
                normalized !== 'date'
              );
            });

            return (
              <article
                key={entry.id}
                className="rounded-[24px] border border-hairline bg-surface-glass-95 p-5 shadow-card backdrop-blur"
              >
                <div className="border-b border-hairline pb-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-text-primary">{entry.label}</h3>
                        {statusLabel ? (
                          <span className="rounded-input border border-border bg-bg px-2 py-0.5 text-[11px] font-semibold uppercase tracking-micro text-text-secondary">
                            {statusLabel}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-text-secondary">
                        {entry.engineLabel ? (
                          <div className="flex items-center gap-2">
                            <span className="uppercase tracking-micro text-text-muted">Engine</span>
                            <span className="font-semibold text-text-primary">{entry.engineLabel}</span>
                          </div>
                        ) : null}
                        {typeof entry.durationSec === 'number' ? (
                          <div className="flex items-center gap-2">
                            <span className="uppercase tracking-micro text-text-muted">Duration</span>
                            <span className="font-semibold text-text-primary">{entry.durationSec}s</span>
                          </div>
                        ) : null}
                        {entry.aspectRatio ? (
                          <div className="flex items-center gap-2">
                            <span className="uppercase tracking-micro text-text-muted">Aspect</span>
                            <span className="font-semibold text-text-primary">{entry.aspectRatio}</span>
                          </div>
                        ) : null}
                        {entry.hasAudio ? (
                          <div className="flex items-center gap-2">
                            <span className="uppercase tracking-micro text-text-muted">Audio</span>
                            <span className="font-semibold text-text-primary">Yes</span>
                          </div>
                        ) : null}
                        {createdLabel ? (
                          <div className="flex items-center gap-2">
                            <span className="uppercase tracking-micro text-text-muted">Created</span>
                            <span className="font-semibold text-text-primary">{createdLabel}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  <div className="flex items-start">
                    {index === 0 ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onClose}
                        className="rounded-pill border-border bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-micro text-text-secondary hover:bg-bg"
                      >
                        Close
                      </Button>
                    ) : null}
                  </div>
                </div>
                </div>

                <div className="mt-3">
                  <div
                    className={clsx(
                      'relative mx-auto w-full max-w-3xl overflow-hidden rounded-3xl border border-hairline bg-black',
                      aspectClass,
                      isVertical ? 'max-h-[42vh]' : 'max-h-[48vh]'
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
                      />
                    ) : thumbUrl ? (
                      <Image src={thumbUrl} alt="" fill className="object-contain" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-surface-2 via-surface to-surface-2 text-[12px] font-medium uppercase tracking-micro text-text-muted">
                        Preview unavailable
                      </div>
                    )}
                    {entry.hasAudio ? <AudioEqualizerBadge tone="light" size="sm" label="Audio available" /> : null}
                    {isProcessing && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-on-media-dark-45 px-3 text-center text-[11px] text-on-inverse backdrop-blur-sm">
                        <span className="uppercase tracking-micro">Processing…</span>
                        {entry.message ? <span className="mt-1 line-clamp-2 text-on-media-80">{entry.message}</span> : null}
                        {progressLabel ? <span className="mt-1 text-[12px] font-semibold text-on-inverse">{progressLabel}</span> : null}
                      </div>
                    )}
                  </div>
                </div>

                {entrySpecs.length > 0 ? (
                  <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-text-secondary">
                    {entrySpecs.map((item) => (
                      <div key={`${entry.id}-${item.label}`} className="flex items-center gap-2">
                        <span className="uppercase tracking-micro text-text-muted">{item.label}</span>
                        <span className="font-semibold text-text-primary">{item.value}</span>
                      </div>
                    ))}
                  </div>
                ) : null}

                {showPrompt ? (
                  <div className="mt-4 border-t border-hairline pt-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Prompt</p>
                      <CopyPromptButton prompt={prompt ?? ''} copyLabel="Copy" copiedLabel="Copied" />
                    </div>
                    <p className="mt-2 text-sm text-text-secondary">
                      {formatPromptPreview(prompt ?? '')}
                    </p>
                    {prompt && prompt.trim().length > 220 ? (
                      <details className="group mt-3">
                        <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-micro text-text-muted">
                          <span className="group-open:hidden">Show more</span>
                          <span className="hidden group-open:inline">Show less</span>
                        </summary>
                        <p className="mt-2 whitespace-pre-line text-sm text-text-secondary">{prompt}</p>
                      </details>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-4 border-t border-hairline pt-3">
                  <div className="flex flex-wrap items-center justify-center gap-2 sm:flex-nowrap">
                    {canRefresh ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          void handleRefreshEntry(entry).catch(() => undefined);
                        }}
                        disabled={isRefreshing}
                        className={clsx(
                          'px-3 py-2 text-[11px] font-semibold uppercase tracking-micro',
                          isRefreshing
                            ? 'border-border bg-bg text-text-muted'
                            : 'border-brand bg-surface-2 text-brand hover:bg-surface-3 hover:text-brand'
                        )}
                      >
                        {isRefreshing ? 'Checking...' : 'Refresh status'}
                      </Button>
                    ) : null}
                    <ButtonLink
                      linkComponent="a"
                      href={mediaUrl ?? '#'}
                      target="_blank"
                      rel="noreferrer"
                      variant="outline"
                      size="sm"
                      className={clsx(
                        'px-3 py-2 text-[11px] font-semibold uppercase tracking-micro',
                        !mediaUrl && 'pointer-events-none border-border/60 bg-bg text-text-muted'
                      )}
                    >
                      Open
                    </ButtonLink>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadEntry(entry, mediaUrl)}
                      disabled={!mediaUrl || isDownloading}
                      className={clsx(
                        'px-3 py-2 text-[11px] font-semibold uppercase tracking-micro',
                        !mediaUrl && 'cursor-not-allowed border-border/60 bg-bg text-text-muted'
                      )}
                    >
                      {isDownloading ? 'Downloading…' : 'Download'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyLink(entry.id, mediaUrl)}
                      disabled={!mediaUrl}
                      className={clsx(
                        'px-3 py-2 text-[11px] font-semibold uppercase tracking-micro',
                        mediaUrl
                          ? 'border-border bg-surface text-text-secondary hover:bg-bg disabled:cursor-not-allowed'
                          : 'cursor-not-allowed border-border/60 bg-bg text-text-muted'
                      )}
                    >
                      {copiedId === entry.id ? 'Link copied' : 'Copy link'}
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {onRemixEntry ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onRemixEntry(entry)}
                        disabled={!canRemix}
                        className={clsx(
                          'px-3 py-2 text-[11px] font-semibold uppercase tracking-micro',
                          canRemix
                            ? 'border-border bg-surface text-text-secondary hover:bg-bg'
                            : 'cursor-not-allowed border-border/60 bg-bg text-text-muted'
                        )}
                      >
                        {remixLabel ?? 'Remix'}
                      </Button>
                    ) : null}
                    {onUseTemplate ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onUseTemplate(entry)}
                        disabled={!canTemplate}
                        className={clsx(
                          'px-3 py-2 text-[11px] font-semibold uppercase tracking-micro',
                          canTemplate
                            ? 'border-border bg-surface text-text-secondary hover:bg-bg'
                            : 'cursor-not-allowed border-border/60 bg-bg text-text-muted'
                        )}
                      >
                        {templateLabel ?? 'Use as template'}
                      </Button>
                    ) : null}
                    {onSaveToLibrary ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleSaveEntryToLibrary(entry, mediaUrl)}
                        disabled={!mediaUrl || libraryState?.loading}
                        className={clsx(
                          'px-3 py-2 text-[11px] font-semibold uppercase tracking-micro',
                          mediaUrl
                            ? 'border-brand bg-surface-2 text-brand hover:bg-surface-3 hover:text-brand'
                            : 'cursor-not-allowed border-border/60 bg-bg text-text-muted'
                        )}
                      >
                        {libraryState?.loading
                          ? 'Saving…'
                          : libraryState?.success
                            ? 'Saved'
                            : libraryState?.error
                              ? 'Retry save'
                              : 'Save to library'}
                      </Button>
                    ) : null}
                  </div>
                </div>

                {entry.message && !isProcessing && !isUuidLike(entry.message.trim()) ? (
                  <p className="mt-3 text-sm text-text-secondary">{entry.message}</p>
                ) : null}
                {downloadError ? (
                  <p className="mt-2 text-xs text-state-warning">{downloadError}</p>
                ) : null}
                {refreshError ? (
                  <p className="mt-2 text-xs text-state-warning">{refreshError}</p>
                ) : null}
                {libraryState?.error ? (
                  <p className="mt-2 text-xs text-state-warning">{libraryState.error}</p>
                ) : null}
                {allowIndexingControls && onToggleIndexable && entry.jobId && typeof displayIndexable === 'boolean' ? (
                  <div className="mt-3 flex flex-col gap-1 text-sm text-text-secondary">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border border-border accent-brand"
                        checked={displayIndexable}
                        onChange={() => handleIndexingToggle(entry, displayIndexable)}
                        disabled={isIndexingLoading}
                      />
                      <span>{displayIndexable ? 'Included in indexing' : 'Excluded from indexing'}</span>
                    </label>
                    <p className="text-xs text-text-muted">Uncheck to keep this video out of public galleries and SEO feeds.</p>
                    {isIndexingLoading ? <span className="text-xs text-text-muted">Saving…</span> : null}
                    {indexingError ? <span className="text-xs text-state-warning">{indexingError}</span> : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>

      </div>
    </div>
  );
}
