 'use client';

import clsx from 'clsx';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AudioEqualizerBadge } from '@/components/ui/AudioEqualizerBadge';
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

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative max-h-full w-full max-w-5xl overflow-y-auto rounded-modal border border-border bg-white p-6 shadow-float">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          className="absolute right-5 top-5 border-border bg-white px-3 py-1 text-sm font-medium text-text-secondary hover:bg-bg"
        >
          Close
        </Button>

        <header className="pr-14">
          <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-text-secondary">{subtitle}</p> : null}
          {!hasAtLeastOneVideo ? (
            <p className="mt-2 rounded-input border border-dashed border-border bg-bg px-3 py-2 text-sm text-text-muted">
              Media will be available once the render completes.
            </p>
          ) : null}
        </header>

        {metadata.length > 0 && (
          <section className="mt-5 grid grid-gap-sm text-sm text-text-secondary md:grid-cols-2">
            {metadata.map((item) => (
              <div key={item.label}>
                <p className="text-xs uppercase tracking-micro text-text-muted">{item.label}</p>
                <p className="mt-1 text-text-primary">{item.value}</p>
              </div>
            ))}
          </section>
        )}

        <section className="mt-6 space-y-4">
          {entries.map((entry) => {
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

            return (
              <article
                key={entry.id}
                className="rounded-card border border-border bg-white/90 p-4 shadow-card md:flex md:items-start md:gap-4"
              >
                <div className={clsx('relative overflow-hidden rounded-card bg-[#EFF3FA] md:w-[360px] md:flex-shrink-0', aspectClass)}>
                  {videoUrl ? (
                    <video
                      key={videoUrl}
                      src={videoUrl}
                      poster={thumbUrl}
                      className="absolute inset-0 h-full w-full object-cover"
                      controls
                      playsInline
                      autoPlay
                      muted
                    />
                  ) : thumbUrl ? (
                    <Image src={thumbUrl} alt="" fill className="object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#dfe7ff] via-white to-[#f1f4ff] text-[12px] font-medium uppercase tracking-micro text-text-muted">
                    Preview unavailable
                  </div>
                )}
                {entry.hasAudio ? <AudioEqualizerBadge tone="light" size="sm" label="Audio available" /> : null}
                {isProcessing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 px-3 text-center text-[11px] text-white backdrop-blur-sm">
                      <span className="uppercase tracking-micro">Processing…</span>
                      {entry.message ? <span className="mt-1 line-clamp-2 text-white/80">{entry.message}</span> : null}
                      {progressLabel ? <span className="mt-1 text-[12px] font-semibold text-white">{progressLabel}</span> : null}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex-1 md:mt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-text-primary">{entry.label}</h3>
                    {entry.engineLabel ? (
                      <span className="rounded-input border border-border bg-bg px-2 py-0.5 text-xs text-text-secondary">
                        {entry.engineLabel}
                      </span>
                    ) : null}
                    {typeof entry.durationSec === 'number' ? (
                      <span className="rounded-input border border-border bg-bg px-2 py-0.5 text-xs text-text-secondary">
                        {entry.durationSec}s
                      </span>
                    ) : null}
                    {entry.createdAt ? (
                      <span className="rounded-input border border-border bg-bg px-2 py-0.5 text-xs text-text-secondary">
                        {(() => {
                          try {
                            return new Intl.DateTimeFormat(undefined, {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            }).format(new Date(entry.createdAt!));
                          } catch {
                            return entry.createdAt;
                          }
                        })()}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <ButtonLink
                      linkComponent="a"
                      href={mediaUrl ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      variant="outline"
                      size="sm"
                      className={clsx(
                        'px-3 py-1.5 text-sm font-medium',
                        mediaUrl
                          ? 'border-border bg-white text-text-secondary hover:bg-bg'
                          : 'pointer-events-none border-border/60 bg-bg text-text-muted'
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
                        'px-3 py-1.5 text-sm font-medium',
                        mediaUrl
                          ? 'border-border bg-white text-text-secondary hover:bg-bg disabled:cursor-not-allowed'
                          : 'cursor-not-allowed border-border/60 bg-bg text-text-muted'
                      )}
                    >
                      {isDownloading ? 'Downloading…' : 'Download'}
                    </Button>
                    {onRemixEntry ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onRemixEntry(entry)}
                        disabled={!canRemix}
                        className={clsx(
                          'px-3 py-1.5 text-sm font-medium',
                          canRemix
                            ? 'border-border bg-white text-text-secondary hover:bg-bg'
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
                          'px-3 py-1.5 text-sm font-medium',
                          canTemplate
                            ? 'border-border bg-white text-text-secondary hover:bg-bg'
                            : 'cursor-not-allowed border-border/60 bg-bg text-text-muted'
                        )}
                      >
                        {templateLabel ?? 'Use as template'}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyLink(entry.id, mediaUrl)}
                      disabled={!mediaUrl}
                      className={clsx(
                        'px-3 py-1.5 text-sm font-medium',
                        mediaUrl
                          ? 'border-border bg-white text-text-secondary hover:bg-bg disabled:cursor-not-allowed'
                          : 'cursor-not-allowed border-border/60 bg-bg text-text-muted'
                      )}
                    >
                      {copiedId === entry.id ? 'Link copied' : 'Copy link'}
                    </Button>
                    {onSaveToLibrary ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleSaveEntryToLibrary(entry, mediaUrl)}
                        disabled={!mediaUrl || libraryState?.loading}
                        className={clsx(
                          'px-3 py-1.5 text-sm font-medium',
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
                          'px-3 py-1.5 text-sm font-medium',
                          isRefreshing
                            ? 'border-border bg-bg text-text-muted'
                            : 'border-brand bg-surface-2 text-brand hover:bg-surface-3 hover:text-brand'
                        )}
                      >
                        {isRefreshing ? 'Checking...' : 'Refresh status'}
                      </Button>
                    ) : null}
                  </div>

                  {entry.message && !isProcessing ? (
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
                      <p className="text-xs text-text-muted">
                        Uncheck to keep this video out of public galleries and SEO feeds.
                      </p>
                      {isIndexingLoading ? <span className="text-xs text-text-muted">Saving…</span> : null}
                      {indexingError ? <span className="text-xs text-state-warning">{indexingError}</span> : null}
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>

        {prompt ? (
          <section className="mt-6">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-micro text-text-muted">Prompt</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (navigator?.clipboard) {
                  void navigator.clipboard.writeText(prompt).catch(() => undefined);
                }
              }}
              className="border-border bg-white px-3 py-1 text-xs font-medium text-text-secondary hover:bg-bg"
            >
              Copy
            </Button>
            </div>
            <div className="mt-2 max-h-[180px] overflow-y-auto rounded-input border border-border bg-bg px-4 py-3 text-sm text-text-primary">
              <pre className="whitespace-pre-wrap break-words font-sans">{prompt}</pre>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
