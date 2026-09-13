import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type AssetBrowserAsset,
  type AssetLibrarySource,
} from '@/components/library/AssetLibraryBrowser';
import { authFetch } from '@/lib/authFetch';
import {
  buildMediaLibraryAssetsUrl,
  fetchMediaLibraryAssets,
  type MediaLibraryAsset,
} from '@/lib/media-library-client';
import type { UpscaleMediaType } from '@/types/tools-upscale';
import { buildLibraryCacheKey } from '../_lib/upscale-workspace-helpers';
import type {
  JobsLibraryResponse,
} from '../_lib/upscale-workspace-types';

type UseUpscaleLibraryAssetsParams = {
  libraryErrorCopy: string;
  mediaType: UpscaleMediaType;
  user: unknown;
};

const UPSCALE_LIBRARY_PAGE_SIZE = 30;

function resolveLibraryUserId(user: unknown): string | null {
  if (typeof user === 'string') return user;
  if (user && typeof user === 'object' && 'id' in user && typeof user.id === 'string') return user.id;
  return null;
}

function buildAccountLibraryCacheKey(
  kind: UpscaleMediaType,
  source: AssetLibrarySource,
  userId: string | null
): string {
  return `${userId ?? 'guest'}:${buildLibraryCacheKey(kind, source)}`;
}

function projectSavedAssets(assets: MediaLibraryAsset[], kind: UpscaleMediaType): AssetBrowserAsset[] {
  return assets
    .filter((asset) => !asset.mime || asset.mime.startsWith(`${kind}/`))
    .map((asset) => {
      const mime = asset.mime ?? null;
      return {
        id: asset.id,
        url: asset.url,
        thumbUrl: asset.thumbUrl?.trim() || null,
        kind: asset.kind ?? (mime?.startsWith('video/') ? 'video' : 'image'),
        width: asset.width ?? null,
        height: asset.height ?? null,
        size: asset.size ?? null,
        mime,
        source: asset.source === 'saved_job_output' ? 'generated' : asset.source ?? null,
        createdAt: asset.createdAt,
        canDelete: false,
      } satisfies AssetBrowserAsset;
    })
    .filter((asset) =>
      kind === 'video'
        ? asset.kind === 'video' || asset.mime?.startsWith('video/')
        : asset.kind === 'image' || !asset.mime || asset.mime.startsWith('image/')
    );
}

function mergeAssetsByUrl(...assetGroups: AssetBrowserAsset[][]): AssetBrowserAsset[] {
  const assetsByUrl = new Map<string, AssetBrowserAsset>();
  for (const asset of assetGroups.flat()) {
    const existing = assetsByUrl.get(asset.url);
    if (!existing) {
      assetsByUrl.set(asset.url, asset);
    } else if (!existing.thumbUrl && asset.thumbUrl) {
      // Preserve saved asset identity while recovering a missing cover from its job.
      assetsByUrl.set(asset.url, { ...existing, thumbUrl: asset.thumbUrl });
    }
  }
  return [...assetsByUrl.values()];
}

export function useUpscaleLibraryAssets({
  libraryErrorCopy,
  mediaType,
  user,
}: UseUpscaleLibraryAssetsParams) {
  const requestRef = useRef(0);
  const loadingKeyRef = useRef<string | null>(null);
  useEffect(() => () => { requestRef.current += 1; }, []);
  const [libraryModalOpen, setLibraryModalOpen] = useState(false);
  const [libraryAssets, setLibraryAssets] = useState<AssetBrowserAsset[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [librarySource, setLibrarySource] = useState<AssetLibrarySource>('all');
  const [libraryLoadedKey, setLibraryLoadedKey] = useState<string | null>(null);
  const [libraryNextCursor, setLibraryNextCursor] = useState<string | null>(null);
  const [libraryHasMore, setLibraryHasMore] = useState(false);
  const [libraryLoadingMore, setLibraryLoadingMore] = useState(false);

  const userId = resolveLibraryUserId(user);
  const libraryCacheKey = libraryModalOpen
    ? buildAccountLibraryCacheKey(mediaType, librarySource, userId)
    : null;
  const librarySourceOptions = useMemo(
    () =>
      mediaType === 'video'
        ? (['all', 'upload', 'generated', 'upscale'] as const)
        : (['all', 'upload', 'generated', 'character', 'angle', 'upscale'] as const),
    [mediaType]
  );
  const visibleLibraryAssets = useMemo(
    () =>
      (libraryLoadedKey === buildAccountLibraryCacheKey(mediaType, librarySource, userId) ? libraryAssets : []).filter((asset) =>
        mediaType === 'video'
          ? asset.kind === 'video' || asset.mime?.startsWith('video/')
          : asset.kind === 'image' || !asset.mime || asset.mime.startsWith('image/')
      ),
    [libraryAssets, mediaType, libraryLoadedKey, librarySource, userId]
  );

  const resetLibraryState = useCallback((nextSource?: AssetLibrarySource) => {
    requestRef.current += 1;
    loadingKeyRef.current = null;
    setLibraryLoading(false);
    setLibraryAssets([]);
    setLibraryError(null);
    setLibraryLoadedKey(null);
    setLibraryNextCursor(null);
    setLibraryHasMore(false);
    setLibraryLoadingMore(false);
    if (nextSource) {
      setLibrarySource(nextSource);
    }
  }, []);

  const fetchLibraryAssets = useCallback(
    async (options?: { source?: AssetLibrarySource; kind?: UpscaleMediaType }) => {
      const requestId = ++requestRef.current;
      const sourceFilter = options?.source ?? librarySource;
      const kind = options?.kind ?? mediaType;
      const requestKey = buildAccountLibraryCacheKey(kind, sourceFilter, userId);
      loadingKeyRef.current = requestKey;
      setLibraryLoading(true);
      setLibraryLoadingMore(false);
      setLibraryError(null);
      setLibraryNextCursor(null);
      setLibraryHasMore(false);
      setLibrarySource(sourceFilter);
      try {
        if (!userId) {
          setLibraryAssets([]);
          setLibraryError('Sign in to access Media.');
          setLibraryLoadedKey(requestKey);
          return;
        }

        const assetsRequest = fetchMediaLibraryAssets([
          buildMediaLibraryAssetsUrl({ kind, source: sourceFilter, limit: UPSCALE_LIBRARY_PAGE_SIZE }),
          userId,
        ]);
        let jobsRequest: Promise<Response> | null = null;
        if (kind === 'video' && sourceFilter !== 'upload') {
          const jobsUrl = sourceFilter === 'upscale' ? '/api/jobs?limit=80&surface=upscale' : '/api/jobs?limit=80&type=video';
          jobsRequest = authFetch(jobsUrl);
        }

        const [assetsPayload, jobsResponse] = await Promise.all([assetsRequest, jobsRequest]);
        if (requestId !== requestRef.current) return;
        if (jobsResponse?.status === 401) {
          setLibraryAssets([]);
          setLibraryError('Sign in to access Media.');
          setLibraryLoadedKey(requestKey);
          return;
        }

        const savedAssets = Array.isArray(assetsPayload.assets)
          ? projectSavedAssets(assetsPayload.assets, kind)
          : [];

        let generatedVideos: AssetBrowserAsset[] = [];
        if (kind === 'video' && jobsResponse) {
          const jobsPayload = (await jobsResponse.json().catch(() => null)) as JobsLibraryResponse | null;
          if (jobsResponse.ok && Array.isArray(jobsPayload?.jobs)) {
            generatedVideos = jobsPayload.jobs
              .map((job) => ({
                id: `job:${job.jobId}`,
                url: job.videoUrl ?? job.readyVideoUrl ?? '',
                thumbUrl: job.thumbUrl?.trim() || job.previewFrame?.trim() || null,
                kind: 'video' as const,
                mime: 'video/mp4',
                source: 'generated',
                createdAt: job.createdAt,
                canDelete: false,
              }))
              .filter((asset) => asset.url.trim().length > 0);
          }
        }

        if (requestId !== requestRef.current) return;
        const nextCursor = assetsPayload.nextCursor ?? null;
        setLibraryAssets(mergeAssetsByUrl(savedAssets, generatedVideos));
        setLibraryNextCursor(nextCursor);
        setLibraryHasMore(Boolean(assetsPayload.hasMore && nextCursor));
        setLibraryLoadedKey(requestKey);
      } catch (libraryLoadError) {
        if (requestId !== requestRef.current) return;
        console.error('[upscale] failed to load library assets', libraryLoadError);
        setLibraryAssets([]);
        setLibraryError(libraryLoadError instanceof Error ? libraryLoadError.message : libraryErrorCopy);
        setLibraryLoadedKey(requestKey);
      } finally {
        if (requestId === requestRef.current) {
          loadingKeyRef.current = null;
          setLibraryLoading(false);
        }
      }
    },
    [libraryErrorCopy, librarySource, mediaType, userId]
  );

  const loadMoreLibraryAssets = useCallback(async () => {
    const sourceFilter = librarySource;
    const kind = mediaType;
    const requestKey = buildAccountLibraryCacheKey(kind, sourceFilter, userId);
    if (!userId || !libraryNextCursor || libraryLoadingMore || libraryLoadedKey !== requestKey) return;

    const requestId = ++requestRef.current;
    setLibraryLoadingMore(true);
    setLibraryError(null);
    try {
      const assetsPayload = await fetchMediaLibraryAssets([
        buildMediaLibraryAssetsUrl({
          kind,
          source: sourceFilter,
          limit: UPSCALE_LIBRARY_PAGE_SIZE,
          cursor: libraryNextCursor,
        }),
        userId,
      ]);
      if (requestId !== requestRef.current) return;

      const nextCursor = assetsPayload.nextCursor ?? null;
      const nextAssets = Array.isArray(assetsPayload.assets)
        ? projectSavedAssets(assetsPayload.assets, kind)
        : [];
      setLibraryAssets((existing) => mergeAssetsByUrl(existing, nextAssets));
      setLibraryNextCursor(nextCursor);
      setLibraryHasMore(Boolean(assetsPayload.hasMore && nextCursor));
    } catch (libraryLoadError) {
      if (requestId !== requestRef.current) return;
      console.error('[upscale] failed to load more library assets', libraryLoadError);
      setLibraryError(libraryLoadError instanceof Error ? libraryLoadError.message : libraryErrorCopy);
    } finally {
      if (requestId === requestRef.current) setLibraryLoadingMore(false);
    }
  }, [libraryErrorCopy, libraryLoadedKey, libraryLoadingMore, libraryNextCursor, librarySource, mediaType, userId]);

  useEffect(() => {
    if (!libraryModalOpen || !libraryCacheKey) return;
    if (libraryLoadedKey === libraryCacheKey) return;
    if (loadingKeyRef.current === libraryCacheKey) return;
    setLibraryAssets([]);
    setLibraryError(null);
    void fetchLibraryAssets({ kind: mediaType, source: librarySource });
  }, [
    fetchLibraryAssets,
    libraryCacheKey,
    libraryLoadedKey,
    libraryModalOpen,
    librarySource,
    mediaType,
  ]);

  const openLibraryModal = useCallback(() => {
    const nextSource: AssetLibrarySource = mediaType === 'video' ? 'generated' : 'all';
    if (librarySource !== nextSource) {
      resetLibraryState(nextSource);
    }
    setLibraryModalOpen(true);
  }, [librarySource, mediaType, resetLibraryState]);

  return {
    fetchLibraryAssets,
    libraryError,
    libraryHasMore,
    libraryLoading,
    libraryLoadingMore,
    libraryModalOpen,
    librarySource,
    librarySourceOptions,
    loadMoreLibraryAssets,
    openLibraryModal,
    resetLibraryState,
    setLibraryModalOpen,
    visibleLibraryAssets,
  };
}
