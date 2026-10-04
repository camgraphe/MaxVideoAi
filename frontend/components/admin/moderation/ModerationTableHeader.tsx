"use client";

import clsx from 'clsx';
import { BUCKET_OPTIONS, SURFACE_OPTIONS } from '@/components/admin/moderation/moderation-table-utils';
import type { ModerationBucket, ModerationSurface, ModerationViewMode } from '@/components/admin/moderation/moderation-types';
import { Button } from '@/components/ui/Button';

type ModerationStats = {
  total: number;
  publishedCount: number;
  legacyMismatchCount: number;
  notPublishedCount: number;
  seoWatchCount: number;
};

export function ModerationTableHeader({
  bucket,
  embedded,
  isLoadingBucket,
  onLoadBucket,
  onSetViewMode,
  stats,
  surface,
  viewMode,
}: {
  bucket: ModerationBucket;
  embedded: boolean;
  isLoadingBucket: boolean;
  onLoadBucket: (bucket: ModerationBucket, options?: { surface?: ModerationSurface }) => void;
  onSetViewMode: (viewMode: ModerationViewMode) => void;
  stats: ModerationStats;
  surface: ModerationSurface;
  viewMode: ModerationViewMode;
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-border pb-4 xl:flex-row xl:items-start xl:justify-between">
      <div className="space-y-2">
        {!embedded ? (
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">Publication queue</h1>
            <p className="text-sm text-text-secondary">
              Manage publishable media by surface, publish or unpublish assets on the site, and curate playlists for video only. Incidents and
              failures live in Jobs. Google Video rollout stays separate.
            </p>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {SURFACE_OPTIONS.map((option) => (
            <Button
              key={option.id}
              type="button"
              size="sm"
              variant="outline"
              disabled={isLoadingBucket}
              aria-pressed={surface === option.id}
              onClick={() => onLoadBucket(bucket, { surface: option.id })}
              className={clsx(
                'gap-2 border-border px-3 text-left',
                surface === option.id ? 'border-text-primary bg-surface text-text-primary' : 'bg-bg text-text-secondary hover:bg-surface'
              )}
            >
              <span>{option.label}</span>
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {BUCKET_OPTIONS.map((option) => (
            <Button
              key={option.id}
              type="button"
              size="sm"
              variant="outline"
              disabled={isLoadingBucket}
              aria-pressed={bucket === option.id}
              onClick={() => onLoadBucket(option.id)}
              className={clsx(
                'gap-2 border-border px-3 text-left',
                bucket === option.id ? 'border-text-primary bg-surface text-text-primary' : 'bg-bg text-text-secondary hover:bg-surface'
              )}
            >
              <span>{option.label}</span>
            </Button>
          ))}
        </div>
        <p className="text-xs text-text-muted">{BUCKET_OPTIONS.find((option) => option.id === bucket)?.helper ?? 'Moderation queue'}</p>

      </div>

      <div className="flex flex-col gap-3 xl:items-end">
        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <div className="inline-flex rounded-md border border-border bg-surface p-1">
            {(['wall', 'table'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={viewMode === mode}
                onClick={() => onSetViewMode(mode)}
                className={clsx(
                  'rounded-sm px-3 py-1.5 text-xs font-medium capitalize transition',
                  viewMode === mode ? 'bg-bg text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'
                )}
              >
                {mode}
              </button>
            ))}
          </div>

        </div>
        <div className="grid gap-1 text-right text-xs text-text-muted sm:grid-cols-2 xl:grid-cols-3">
          <span>{stats.total} loaded media</span>
          {stats.legacyMismatchCount > 0 ? <span>{stats.legacyMismatchCount} legacy mismatches</span> : null}
        </div>
      </div>
    </header>
  );
}
