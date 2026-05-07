'use client';

import { Button } from '@/components/ui/Button';
import { formatAudioDurationLabel } from '@/lib/audio-generation';
import { formatDateTime } from '../_lib/audio-workspace-helpers';
import type { GeneratedSourceVideo } from '../_lib/audio-workspace-types';
import type { AudioWorkspaceCopy } from '../copy';

export function AudioGeneratedVideoPickerModal({
  open,
  videos,
  isLoading,
  error,
  locale,
  copy,
  onClose,
  onSelect,
}: {
  open: boolean;
  videos: GeneratedSourceVideo[];
  isLoading: boolean;
  error: string | null;
  locale: string;
  copy: AudioWorkspaceCopy;
  onClose: () => void;
  onSelect: (video: GeneratedSourceVideo) => void | Promise<void>;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-surface-on-media-dark-55 px-4">
      <div className="absolute inset-0" role="presentation" onClick={onClose} />
      <div className="relative z-10 flex max-h-[80vh] w-full max-w-4xl flex-col overflow-hidden rounded-card border border-border bg-surface shadow-float">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{copy.picker.title}</h2>
            <p className="mt-1 text-sm text-text-secondary">{copy.picker.description}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {copy.picker.close}
          </Button>
        </div>
        <div className="overflow-y-auto p-5">
          {error ? (
            <div className="rounded-card border border-warning-border bg-warning-bg p-4 text-sm text-warning">
              {error}
            </div>
          ) : null}
          {!error && !videos.length && isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`generated-source-skeleton-${index}`} className="overflow-hidden rounded-card border border-border bg-surface shadow-card" aria-hidden>
                  <div className="aspect-[16/9] w-full bg-skeleton" />
                  <div className="space-y-2 px-4 py-4">
                    <div className="h-4 w-36 rounded-full bg-skeleton" />
                    <div className="h-3 w-28 rounded-full bg-skeleton" />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {!error && !videos.length && !isLoading ? (
            <div className="rounded-card border border-border bg-bg p-5 text-sm text-text-secondary">
              {copy.picker.empty}
            </div>
          ) : null}
          {videos.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {videos.map((video) => (
                <button
                  key={video.jobId}
                  type="button"
                  className="overflow-hidden rounded-card border border-border bg-surface text-left shadow-card transition hover:border-border-hover hover:bg-surface-hover"
                  onClick={() => {
                    void onSelect(video);
                  }}
                >
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-bg">
                    <video
                      src={video.url}
                      poster={video.thumbUrl ?? undefined}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                      loop
                      autoPlay
                      preload="metadata"
                    />
                  </div>
                  <div className="space-y-2 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-semibold text-text-primary">{video.label}</p>
                      {video.hasAudio ? (
                        <span className="rounded-full border border-border bg-bg px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                          {copy.picker.audioBadge}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-text-secondary">
                      {video.durationSec ? formatAudioDurationLabel(video.durationSec) : copy.source.durationPending}{video.aspectRatio ? ` • ${video.aspectRatio}` : ''}
                    </p>
                    <p className="text-xs text-text-muted">{formatDateTime(video.createdAt, locale)}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
