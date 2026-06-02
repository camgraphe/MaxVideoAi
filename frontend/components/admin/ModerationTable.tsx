"use client";

import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import {
  compareChronologically,
  isFailedVideo,
  matchesBucket,
  resolvePublicationState,
} from '@/components/admin/moderation/moderation-table-utils';
import { ModerationTableHeader } from '@/components/admin/moderation/ModerationTableHeader';
import { ModerationTableView } from '@/components/admin/moderation/ModerationTableView';
import { ModerationVideoSeoCandidateButton } from '@/components/admin/moderation/ModerationVideoSeoCandidateButton';
import { ModerationWallView } from '@/components/admin/moderation/ModerationWallView';
import type { ModerationBucket, ModerationSurface, ModerationVideo, ModerationViewMode } from '@/components/admin/moderation/moderation-types';
import { Button } from '@/components/ui/Button';
import { authFetch } from '@/lib/authFetch';
import { useModerationPlaylists } from '@/components/admin/moderation/useModerationPlaylists';

export type { ModerationBucket, ModerationSurface, ModerationVideo, PlaylistOption, PlaylistTag, PublicationState } from '@/components/admin/moderation/moderation-types';

type ModerationTableProps = {
  videos: ModerationVideo[];
  initialCursor: string | null;
  initialBucket?: ModerationBucket;
  initialSurface?: ModerationSurface;
  embedded?: boolean;
};

export function ModerationTable({
  videos,
  initialCursor,
  initialBucket = 'not-published',
  initialSurface = 'video',
  embedded = false,
}: ModerationTableProps) {
  const [items, setItems] = useState(videos);
  const [bucket, setBucket] = useState<ModerationBucket>(initialBucket);
  const [surface, setSurface] = useState<ModerationSurface>(initialSurface);
  const [nextCursor, setNextCursor] = useState<string | null>(initialCursor);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isLoadingMore, setLoadingMore] = useState(false);
  const [isLoadingBucket, setLoadingBucket] = useState(false);
  const [viewMode, setViewMode] = useState<ModerationViewMode>('wall');
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(videos[0]?.id ?? null);

  const displayItems = useMemo(() => [...items].sort(compareChronologically), [items]);
  const hasVideos = displayItems.length > 0;
  const selectedVideo = useMemo(
    () => displayItems.find((item) => item.id === selectedVideoId) ?? displayItems[0] ?? null,
    [displayItems, selectedVideoId]
  );

  const {
    appendPlaylistAssignments,
    clearPlaylistStatus,
    playlistAssignments,
    playlistFetchError,
    renderPlaylistControls,
    replacePlaylistAssignments,
  } = useModerationPlaylists(videos);

  const stats = useMemo(() => {
    const total = items.length;
    const publishedCount = items.filter((item) => item.isPublishedOnSite).length;
    const legacyMismatchCount = items.filter((item) => item.hasLegacyMismatch).length;
    const notPublishedCount = total - publishedCount;
    const seoWatchCount = items.filter((item) => item.seoWatch).length;
    return { total, publishedCount, legacyMismatchCount, notPublishedCount, seoWatchCount };
  }, [items]);

  const handleThumbnailUpdated = useCallback((videoId: string, thumbUrl: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === videoId
          ? {
              ...item,
              thumbUrl,
              updatedAt: new Date().toISOString(),
            }
          : item
      )
    );
  }, []);

  useEffect(() => {
    if (!displayItems.length) {
      setSelectedVideoId(null);
      return;
    }
    if (!selectedVideoId || !displayItems.some((item) => item.id === selectedVideoId)) {
      setSelectedVideoId(displayItems[0]?.id ?? null);
    }
  }, [displayItems, selectedVideoId]);

  const loadBucket = useCallback(
    async (nextBucket: ModerationBucket, options?: { append?: boolean; surface?: ModerationSurface }) => {
      const append = options?.append ?? false;
      const nextSurface = options?.surface ?? surface;
      if (append && !nextCursor) return;

      if (append) {
        setLoadingMore(true);
      } else {
        setLoadingBucket(true);
      }
      setError(null);

      try {
        const params = new URLSearchParams({
          limit: append ? '50' : '30',
          bucket: nextBucket,
          surface: nextSurface,
        });
        if (append && nextCursor) {
          params.set('cursor', nextCursor);
        }

        const response = await authFetch(`/api/admin/videos/pending?${params.toString()}`, {
          cache: 'no-store',
        });
        const json = await response.json().catch(() => null);
        if (!response.ok || !json?.ok || !Array.isArray(json?.videos)) {
          throw new Error(json?.error ?? `Failed to load moderation queue (${response.status})`);
        }

        const incoming = json.videos as ModerationVideo[];

        if (append) {
          setItems((current) => {
            const seen = new Set(current.map((item) => item.id));
            const merged = [...current];
            incoming.forEach((item) => {
              if (!seen.has(item.id)) {
                merged.push(item);
                seen.add(item.id);
              }
            });
            return merged;
          });
          appendPlaylistAssignments(incoming);
        } else {
          setBucket(nextBucket);
          setSurface(nextSurface);
          setItems(incoming);
          replacePlaylistAssignments(incoming);
          clearPlaylistStatus();
        }

        setNextCursor(typeof json.nextCursor === 'string' ? json.nextCursor : null);
      } catch (loadError) {
        console.error('[moderation] failed to load bucket', loadError);
        setError(loadError instanceof Error ? loadError.message : 'Failed to load moderation queue');
      } finally {
        if (append) {
          setLoadingMore(false);
        } else {
          setLoadingBucket(false);
        }
      }
    },
    [appendPlaylistAssignments, clearPlaylistStatus, nextCursor, replacePlaylistAssignments, surface]
  );

  const updateVisibility = useCallback(
    (video: ModerationVideo, visibility: 'public' | 'private', indexable: boolean) => {
      startTransition(async () => {
        setError(null);
        try {
          const response = await authFetch(`/api/admin/videos/${video.id}/visibility`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ visibility, indexable }),
          });
          const json = await response.json().catch(() => null);
          if (!response.ok || !json?.ok || !json.video) {
            throw new Error(json?.error ?? 'Failed to update moderation state');
          }

          const nextVideo: ModerationVideo = {
            ...video,
            visibility: json.video.visibility === 'private' ? 'private' : 'public',
            indexable: Boolean(json.video.indexable),
          };
          nextVideo.publicationState = resolvePublicationState(nextVideo);
          nextVideo.isPublishedOnSite = nextVideo.publicationState === 'published';
          nextVideo.hasLegacyMismatch = nextVideo.publicationState === 'legacy-mismatch';

          setItems((current) => {
            if (!matchesBucket(nextVideo, bucket)) {
              return current.filter((item) => item.id !== video.id);
            }
            return current.map((item) => (item.id === video.id ? nextVideo : item));
          });
        } catch (updateError) {
          console.error('[moderation] update failed', updateError);
          setError(updateError instanceof Error ? updateError.message : 'Failed to update moderation state');
        }
      });
    },
    [bucket, startTransition]
  );

  const handleSeoCandidateCreated = useCallback((videoId: string) => {
    setItems((current) => current.map((item) => (item.id === videoId ? { ...item, seoWatch: true } : item)));
    setFeedback('Draft Video SEO candidate created');
  }, []);

  const renderModerationActions = useCallback(
    (video: ModerationVideo, options?: { compact?: boolean }) => {
      if (isFailedVideo(video)) {
        return null;
      }
      const compact = options?.compact ?? false;
      const baseClass = compact
        ? 'h-8 rounded-md px-2.5 text-[11px] font-semibold uppercase tracking-micro'
        : 'rounded-input px-3 py-1 text-xs font-semibold uppercase tracking-micro';

      return (
        <>
          {video.isPublishedOnSite ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={clsx(baseClass, 'border-error-border bg-error-bg text-error hover:bg-error-bg hover:text-error')}
              onClick={() => updateVisibility(video, 'private', false)}
              disabled={isPending}
            >
              Make private
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              className={clsx(baseClass, 'bg-success text-on-inverse hover:bg-success')}
              onClick={() => updateVisibility(video, 'public', true)}
              disabled={isPending}
            >
              Publish on site
            </Button>
          )}
          <ModerationVideoSeoCandidateButton
            compact={compact}
            disabled={isPending}
            enabled={surface === 'video'}
            onCandidateCreated={handleSeoCandidateCreated}
            onError={setError}
            video={video}
          />
        </>
      );
    },
    [handleSeoCandidateCreated, isPending, surface, updateVisibility]
  );

  return (
    <div className={embedded ? 'space-y-5' : 'stack-gap-lg'}>
      <ModerationTableHeader
        bucket={bucket}
        embedded={embedded}
        isLoadingBucket={isLoadingBucket}
        onLoadBucket={(nextBucket, options) => void loadBucket(nextBucket, options)}
        onSetViewMode={setViewMode}
        stats={stats}
        surface={surface}
        viewMode={viewMode}
      />

      {surface === 'video' && playlistFetchError ? (
        <div className="rounded-card border border-warning-border bg-warning-bg px-4 py-3 text-sm text-warning">{playlistFetchError}</div>
      ) : null}

      {feedback ? <div className="rounded-card border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">{feedback}</div> : null}

      {error ? <div className="rounded-card border border-error-border bg-error-bg px-4 py-3 text-sm text-error">{error}</div> : null}

      {!hasVideos ? (
        <div className="rounded-card border border-hairline bg-surface p-8 text-center text-sm text-text-secondary">
          {isLoadingBucket ? 'Loading moderation queue…' : `No ${surface} items in this moderation bucket.`}
        </div>
      ) : viewMode === 'wall' ? (
        <ModerationWallView
          bucket={bucket}
          displayItems={displayItems}
          isLoadingMore={isLoadingMore}
          loadBucket={(nextBucket, options) => void loadBucket(nextBucket, options)}
          nextCursor={nextCursor}
          onSelectVideo={setSelectedVideoId}
          onThumbnailUpdated={handleThumbnailUpdated}
          playlistAssignments={playlistAssignments}
          renderModerationActions={renderModerationActions}
          renderPlaylistControls={renderPlaylistControls}
          selectedVideo={selectedVideo}
          surface={surface}
        />
      ) : (
        <ModerationTableView
          bucket={bucket}
          displayItems={displayItems}
          isLoadingMore={isLoadingMore}
          isPending={isPending}
          loadBucket={(nextBucket, options) => void loadBucket(nextBucket, options)}
          nextCursor={nextCursor}
          renderModerationActions={renderModerationActions}
          renderPlaylistControls={renderPlaylistControls}
          surface={surface}
        />
      )}
    </div>
  );
}
