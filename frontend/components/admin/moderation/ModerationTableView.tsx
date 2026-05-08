"use client";

import Image from 'next/image';
import type { ReactNode } from 'react';
import clsx from 'clsx';
import {
  PublicationPill,
  StatePill,
  formatDate,
  getPublicationLabel,
  isFailedVideo,
} from '@/components/admin/moderation/moderation-table-utils';
import type { ModerationBucket, ModerationSurface, ModerationVideo } from '@/components/admin/moderation/moderation-types';
import { Button, ButtonLink } from '@/components/ui/Button';
import { isPlaceholderMediaUrl, normalizeMediaUrl } from '@/lib/media';

type ModerationTableViewProps = {
  bucket: ModerationBucket;
  displayItems: ModerationVideo[];
  isLoadingMore: boolean;
  isPending: boolean;
  loadBucket: (bucket: ModerationBucket, options?: { append?: boolean; surface?: ModerationSurface }) => void;
  nextCursor: string | null;
  renderModerationActions: (video: ModerationVideo, options?: { compact?: boolean }) => ReactNode;
  renderPlaylistControls: (video: ModerationVideo, options?: { compact?: boolean; emphasizeAssigned?: boolean; enabled?: boolean }) => ReactNode;
  surface: ModerationSurface;
};

export function ModerationTableView({
  bucket,
  displayItems,
  isLoadingMore,
  isPending,
  loadBucket,
  nextCursor,
  renderModerationActions,
  renderPlaylistControls,
  surface,
}: ModerationTableViewProps) {
  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-bg text-xs uppercase tracking-micro text-text-muted">
          <tr>
            <th scope="col" className="px-4 py-3 text-left">Preview</th>
            <th scope="col" className="px-4 py-3 text-left">State</th>
            <th scope="col" className="px-4 py-3 text-left">Prompt</th>
            <th scope="col" className="px-4 py-3 text-left">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {displayItems.map((video) => {
            const isFailed = isFailedVideo(video);
            const normalizedVideoUrl = video.videoUrl ? normalizeMediaUrl(video.videoUrl) ?? video.videoUrl : undefined;
            const normalizedThumbUrl = video.thumbUrl ? normalizeMediaUrl(video.thumbUrl) ?? video.thumbUrl : undefined;
            const hasThumbPreview = Boolean(normalizedThumbUrl && !isPlaceholderMediaUrl(normalizedThumbUrl));
            const hasVideoPreview = Boolean(normalizedVideoUrl);
            const posterUrl = hasThumbPreview ? normalizedThumbUrl : undefined;
            const canOpenWatchPage = surface === 'video' && !isFailed && video.isPublishedOnSite;
            const canManagePlaylists = surface === 'video' && !isFailed;

            return (
              <tr key={video.id} className={clsx(isPending && 'opacity-90')}>
                <td className="px-4 py-4">
                  <div className="relative h-24 w-40 overflow-hidden rounded-card border border-hairline bg-black">
                    {hasVideoPreview ? (
                      <video
                        src={normalizedVideoUrl}
                        poster={posterUrl}
                        className="absolute inset-0 h-full w-full object-cover"
                        muted
                        loop
                        playsInline
                        autoPlay
                        preload="metadata"
                      />
                    ) : hasThumbPreview && normalizedThumbUrl ? (
                      <Image src={normalizedThumbUrl} alt="Thumbnail" fill className="object-cover" sizes="160px" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-on-media-70">No preview</div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="space-y-2 text-xs text-text-secondary">
                    <div className="flex flex-wrap gap-2">
                      <PublicationPill state={video.publicationState} />
                      <StatePill tone={video.isPublishedOnSite ? 'ok' : 'warn'}>{getPublicationLabel(video)}</StatePill>
                      {video.hasLegacyMismatch ? <StatePill tone="warn">Legacy mismatch</StatePill> : null}
                      {isFailed ? <StatePill tone="warn">Issue</StatePill> : null}
                      {video.seoWatch ? <StatePill tone="neutral">Google Video rollout</StatePill> : null}
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-text-primary">{video.engineLabel}</span>
                      <span>Duration: {video.durationSec}s</span>
                      <span>Aspect: {video.aspectRatio ?? 'auto'}</span>
                      <span>Created: {formatDate(video.createdAt)}</span>
                      {video.updatedAt ? <span>Updated: {formatDate(video.updatedAt)}</span> : null}
                      <span>User: {video.userId ?? '—'}</span>
                      {video.status ? <span>Status: {video.status}</span> : null}
                      {video.message ? <span className="text-warning">Runtime message: {video.message}</span> : null}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 align-top text-xs text-text-secondary">
                  <p className="max-w-xs whitespace-pre-line">{video.prompt}</p>
                </td>
                <td className="px-4 py-4 align-top">
                  <div className="flex min-w-[18rem] flex-col gap-3">
                    <div className="flex flex-wrap gap-2">{renderModerationActions(video)}</div>
                    <div>{renderPlaylistControls(video, { enabled: canManagePlaylists })}</div>
                    <div className="flex flex-wrap gap-2">
                      {canOpenWatchPage ? (
                        <ButtonLink href={`/video/${encodeURIComponent(video.id)}`} variant="outline" size="sm" prefetch={false}>
                          Watch page
                        </ButtonLink>
                      ) : null}
                      <ButtonLink href={`/admin/jobs?jobId=${encodeURIComponent(video.id)}`} variant="outline" size="sm" prefetch={false}>
                        Job audit
                      </ButtonLink>
                      {video.seoWatch ? (
                        <ButtonLink href="/admin/video-seo" variant="outline" size="sm" prefetch={false}>
                          Video SEO
                        </ButtonLink>
                      ) : null}
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {nextCursor ? (
        <div className="border-t border-border bg-surface px-4 py-3 text-center">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => loadBucket(bucket, { append: true })}
            disabled={isLoadingMore}
            className="rounded-input border-border bg-bg px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface"
          >
            {isLoadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
