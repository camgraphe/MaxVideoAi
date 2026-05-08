'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { copyTextToClipboard } from '@/lib/clipboard';
import { suggestDownloadFilename, triggerAppDownload } from '@/lib/download';
import { MediaLightboxEntryCard } from '@/components/media-lightbox/MediaLightboxEntryCard';
import type {
  MediaLightboxEntry,
  MediaLightboxLibraryState,
  MediaLightboxLoadingState,
  MediaLightboxProps,
} from '@/components/media-lightbox/media-lightbox-types';

export type {
  MediaLightboxEntry,
  MediaLightboxProps,
} from '@/components/media-lightbox/media-lightbox-types';

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
  const [refreshStates, setRefreshStates] = useState<Record<string, MediaLightboxLoadingState>>({});
  const [downloadStates, setDownloadStates] = useState<Record<string, MediaLightboxLoadingState>>({});
  const [libraryStates, setLibraryStates] = useState<Record<string, MediaLightboxLibraryState>>({});

  const handleCopyLink = useCallback(
    async (entryId: string, url?: string | null) => {
      if (!url) return;
      const copied = await copyTextToClipboard(url);
      if (copied) {
        setCopiedId(entryId);
        window.setTimeout(() => setCopiedId((current) => (current === entryId ? null : current)), 1800);
      } else {
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
          {entries.map((entry, index) => (
            <MediaLightboxEntryCard
              key={entry.id}
              copiedId={copiedId}
              detailSpecsBase={specs}
              downloadState={downloadStates[entry.id]}
              entry={entry}
              index={index}
              libraryState={libraryStates[entry.id]}
              prompt={prompt}
              refreshState={refreshStates[entry.id]}
              remixLabel={remixLabel}
              subtitle={subtitle}
              templateLabel={templateLabel}
              title={title}
              onClose={onClose}
              onCopyLink={(entryId, url) => {
                void handleCopyLink(entryId, url);
              }}
              onDownloadEntry={(targetEntry, url) => {
                void handleDownloadEntry(targetEntry, url);
              }}
              onRefreshEntry={
                onRefreshEntry
                  ? (targetEntry) => {
                      void handleRefreshEntry(targetEntry);
                    }
                  : undefined
              }
              onRemixEntry={onRemixEntry}
              onSaveEntryToLibrary={
                onSaveToLibrary
                  ? (targetEntry, mediaUrl) => {
                      void handleSaveEntryToLibrary(targetEntry, mediaUrl);
                    }
                  : undefined
              }
              onUseTemplate={onUseTemplate}
            />
          ))}
        </section>
      </div>
    </div>
  );
}
