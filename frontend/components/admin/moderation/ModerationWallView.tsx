"use client";

import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import clsx from 'clsx';
import { VideoThumbnailEditor } from '@/components/admin/VideoThumbnailEditor.client';
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

type ModerationWallViewProps = {
  bucket: ModerationBucket;
  displayItems: ModerationVideo[];
  isLoadingMore: boolean;
  loadBucket: (bucket: ModerationBucket, options?: { append?: boolean; surface?: ModerationSurface }) => void;
  nextCursor: string | null;
  onSelectVideo: (videoId: string) => void;
  onThumbnailUpdated: (videoId: string, thumbUrl: string) => void;
  playlistAssignments: Record<string, Array<{ id: string; name: string }>>;
  renderModerationActions: (video: ModerationVideo, options?: { compact?: boolean }) => ReactNode;
  renderPlaylistControls: (video: ModerationVideo, options?: { compact?: boolean; emphasizeAssigned?: boolean; enabled?: boolean }) => ReactNode;
  selectedVideo: ModerationVideo | null;
  surface: ModerationSurface;
};

export function ModerationWallView({
  bucket,
  displayItems,
  isLoadingMore,
  loadBucket,
  nextCursor,
  onSelectVideo,
  onThumbnailUpdated,
  playlistAssignments,
  renderModerationActions,
  renderPlaylistControls,
  selectedVideo,
  surface,
}: ModerationWallViewProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        {displayItems.map((video) => {
          const isFailed = isFailedVideo(video);
          const canManagePlaylists = surface === 'video' && !isFailed;
          const normalizedVideoUrl = video.videoUrl ? normalizeMediaUrl(video.videoUrl) ?? video.videoUrl : undefined;
          const normalizedThumbUrl = video.thumbUrl ? normalizeMediaUrl(video.thumbUrl) ?? video.thumbUrl : undefined;
          const hasThumbPreview = Boolean(normalizedThumbUrl && !isPlaceholderMediaUrl(normalizedThumbUrl));
          const hasVideoPreview = Boolean(normalizedVideoUrl);
          const assignedPlaylists = playlistAssignments[video.id] ?? [];
          const isSelected = selectedVideo?.id === video.id;

          return (
            <div
              key={video.id}
              className={clsx(
                'overflow-hidden rounded-card border bg-surface text-left transition',
                isSelected ? 'border-text-primary shadow-[0_0_0_1px_rgba(255,255,255,0.1)]' : 'border-border hover:border-text-muted'
              )}
            >
              <button type="button" onClick={() => onSelectVideo(video.id)} className="block w-full text-left">
                <div className="relative aspect-video overflow-hidden bg-black">
                  {hasThumbPreview && normalizedThumbUrl ? (
                    <Image
                      src={normalizedThumbUrl}
                      alt="Thumbnail"
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1536px) 50vw, 33vw"
                    />
                  ) : hasVideoPreview ? (
                    <video src={normalizedVideoUrl} className="absolute inset-0 h-full w-full object-cover" muted playsInline preload="metadata" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-on-media-70">No preview</div>
                  )}
                  <div className="absolute left-2 top-2 flex flex-wrap gap-2">
                    <PublicationPill state={video.publicationState} />
                    {video.hasLegacyMismatch ? <StatePill tone="warn">Legacy mismatch</StatePill> : null}
                    {isFailed ? <StatePill tone="warn">Issue</StatePill> : null}
                    {video.seoWatch ? <StatePill tone="neutral">Google Video rollout</StatePill> : null}
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-3 py-2">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{video.engineLabel}</p>
                        <p className="text-[11px] text-white/70">
                          {getPublicationLabel(video)} · {video.durationSec}s
                          {video.aspectRatio ? ` · ${video.aspectRatio}` : ''}
                        </p>
                      </div>
                      <span className="rounded-full border border-white/20 bg-black/45 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-micro text-white">
                        Queued
                      </span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="line-clamp-1 text-sm font-medium text-text-primary">{video.prompt}</p>
                    {video.status ? <span className="shrink-0 text-[10px] uppercase tracking-micro text-text-muted">{video.status}</span> : null}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-text-muted">
                    <span>{formatDate(video.createdAt)}</span>
                    {assignedPlaylists.length ? <span>{assignedPlaylists.length} playlist{assignedPlaylists.length > 1 ? 's' : ''}</span> : null}
                  </div>
                </div>
              </button>
              <div className="space-y-2 border-t border-border p-3">
                {renderPlaylistControls(video, { compact: true, emphasizeAssigned: true, enabled: canManagePlaylists })}
                <div className="flex flex-wrap gap-2">
                  {renderModerationActions(video, { compact: true })}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-md border-hairline px-2.5 text-[11px] font-semibold uppercase tracking-micro text-text-secondary hover:border-text-muted hover:text-text-primary"
                    onClick={() => onSelectVideo(video.id)}
                  >
                    Details
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedVideo ? (
        <SelectedModerationItem
          onThumbnailUpdated={onThumbnailUpdated}
          renderModerationActions={renderModerationActions}
          renderPlaylistControls={renderPlaylistControls}
          selectedVideo={selectedVideo}
          surface={surface}
        />
      ) : null}

      {nextCursor ? (
        <div className="xl:col-span-2">
          <div className="rounded-card border border-border bg-surface px-4 py-3 text-center">
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
        </div>
      ) : null}
    </div>
  );
}

function SelectedModerationItem({
  onThumbnailUpdated,
  renderModerationActions,
  renderPlaylistControls,
  selectedVideo,
  surface,
}: Pick<ModerationWallViewProps, 'onThumbnailUpdated' | 'renderModerationActions' | 'renderPlaylistControls' | 'selectedVideo' | 'surface'> & {
  selectedVideo: ModerationVideo;
}) {
  const selectedIsFailed = isFailedVideo(selectedVideo);
  const canManageSelectedPlaylists = surface === 'video' && !selectedIsFailed;

  return (
    <aside className="h-fit rounded-card border border-border bg-surface xl:sticky xl:top-4">
      <div className="space-y-4 p-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Selected item</p>
          <div className="relative aspect-video overflow-hidden rounded-card border border-hairline bg-black">
            {selectedVideo.videoUrl ? (
              <video
                src={normalizeMediaUrl(selectedVideo.videoUrl) ?? selectedVideo.videoUrl}
                poster={selectedVideo.thumbUrl ? normalizeMediaUrl(selectedVideo.thumbUrl) ?? selectedVideo.thumbUrl : undefined}
                className="absolute inset-0 h-full w-full object-cover"
                controls
                muted
                playsInline
                preload="metadata"
              />
            ) : selectedVideo.thumbUrl ? (
              <Image src={normalizeMediaUrl(selectedVideo.thumbUrl) ?? selectedVideo.thumbUrl} alt="Thumbnail" fill className="object-cover" sizes="352px" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-on-media-70">No preview</div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-text-primary">{selectedVideo.engineLabel}</p>
            <div className="flex flex-wrap gap-2">
              <PublicationPill state={selectedVideo.publicationState} />
              <StatePill tone={selectedVideo.isPublishedOnSite ? 'ok' : 'warn'}>{getPublicationLabel(selectedVideo)}</StatePill>
              {selectedVideo.hasLegacyMismatch ? <StatePill tone="warn">Legacy mismatch</StatePill> : null}
              {selectedIsFailed ? <StatePill tone="warn">Issue</StatePill> : null}
              {selectedVideo.seoWatch ? (
                <Link href="/admin/video-seo" className="inline-flex rounded-full border border-border bg-bg px-2 py-1 text-[11px] font-semibold text-text-secondary hover:text-text-primary">
                  In Google Video rollout
                </Link>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-text-secondary">
            <span>Duration: {selectedVideo.durationSec}s</span>
            <span>Aspect: {selectedVideo.aspectRatio ?? 'auto'}</span>
            <span>Created: {formatDate(selectedVideo.createdAt)}</span>
            <span>Updated: {selectedVideo.updatedAt ? formatDate(selectedVideo.updatedAt) : '—'}</span>
            <span>User: {selectedVideo.userId ?? '—'}</span>
            <span>Status: {selectedVideo.status ?? '—'}</span>
          </div>

          {selectedVideo.message ? (
            <div className="rounded-md border border-warning-border bg-warning-bg px-3 py-2 text-xs text-warning">
              Runtime message: {selectedVideo.message}
            </div>
          ) : null}

          <details className="rounded-md border border-border bg-bg px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-micro text-text-muted">Prompt</summary>
            <p className="mt-2 text-sm text-text-secondary">{selectedVideo.prompt}</p>
          </details>
        </div>

        {surface === 'video' ? (
          <VideoThumbnailEditor
            key={selectedVideo.id}
            videoId={selectedVideo.id}
            title={selectedVideo.prompt}
            engineLabel={selectedVideo.engineLabel}
            initialThumbUrl={selectedVideo.thumbUrl ?? null}
            videoUrl={selectedVideo.videoUrl ?? null}
            className="max-w-none"
            onThumbnailUpdated={(thumbUrl) => onThumbnailUpdated(selectedVideo.id, thumbUrl)}
          />
        ) : null}

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">Moderation</p>
          <div className="flex flex-wrap gap-2">{renderModerationActions(selectedVideo)}</div>
          {selectedIsFailed ? (
            <p className="text-xs text-warning">This item should be handled in Job Audit, not in the editorial moderation queue.</p>
          ) : (
            <p className="text-xs text-text-muted">
              Publishing on site controls whether the asset is live on public surfaces. Google Video rollout membership is managed separately.
            </p>
          )}
          {selectedVideo.hasLegacyMismatch ? (
            <p className="text-xs text-warning">This row still has a legacy visibility/indexable mismatch. Publishing or making it private will normalize it.</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {surface === 'video' && !selectedIsFailed && selectedVideo.isPublishedOnSite ? (
            <ButtonLink href={`/video/${encodeURIComponent(selectedVideo.id)}`} variant="outline" size="sm" prefetch={false}>
              Open watch page
            </ButtonLink>
          ) : null}
          <ButtonLink href={`/admin/jobs?jobId=${encodeURIComponent(selectedVideo.id)}`} variant="outline" size="sm" prefetch={false}>
            Open job audit
          </ButtonLink>
          {selectedVideo.seoWatch ? (
            <ButtonLink href="/admin/video-seo" variant="outline" size="sm" prefetch={false}>
              Open Video SEO
            </ButtonLink>
          ) : null}
        </div>

        {renderPlaylistControls(selectedVideo, { emphasizeAssigned: true, enabled: canManageSelectedPlaylists })}
      </div>
    </aside>
  );
}
