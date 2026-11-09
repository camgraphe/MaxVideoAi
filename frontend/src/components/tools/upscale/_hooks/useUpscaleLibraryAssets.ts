import { useLibraryCacheRevision, libraryCacheRevision } from '@/hooks/useLibraryCacheRevision';
import { mediaReadAccessFields } from '@/lib/library-media-access';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type AssetBrowserAsset,
  type AssetLibrarySource,
} from '@/components/library/AssetLibraryBrowser';
import { ownedAuthFetch } from '@/lib/owned-auth-fetch';
import {
  buildMediaLibraryAssetsUrl,
  fetchMediaLibraryAssets,
  type MediaLibraryAsset,
} from '@/lib/media-library-client';
import type { UpscaleMediaType } from '@/types/tools-upscale';
import { buildLibraryCacheKey } from '../_lib/upscale-workspace-helpers';
import type { GeneratedVideoCandidate } from '@/lib/generated-video-candidates';

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
        ...asset,
        id: asset.id,
        assetId: asset.assetId, ref: asset.ref,
        ...mediaReadAccessFields(asset),
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

function mergeAssetsByIdentity(...assetGroups: AssetBrowserAsset[][]): AssetBrowserAsset[] {
  const assetsByIdentity = new Map<string, AssetBrowserAsset>();
  for (const asset of assetGroups.flat()) {
    const output = asset.ref?.type === 'job-output' ? asset.ref.outputId : asset.sourceOutputId;
    const job = asset.ref?.type === 'job-output' ? asset.ref.jobId : asset.jobId;
    const identity = JSON.stringify(output ? ['output', job, output, asset.kind, asset.url] : ['asset', asset.id, asset.kind, asset.url]);
    const existing = assetsByIdentity.get(identity);
    if (!existing) {
      assetsByIdentity.set(identity, asset);
    } else if (!existing.thumbUrl && asset.thumbUrl) {
      // Preserve saved asset identity while recovering a missing cover from its job.
      assetsByIdentity.set(identity, { ...existing, thumbUrl: asset.thumbUrl });
    }
  }
  return [...assetsByIdentity.values()];
}

type GeneratedLibraryPage = { ok?: boolean; jobs: GeneratedVideoCandidate[]; nextCursor?:string|null };
function projectGeneratedVideos(page: GeneratedLibraryPage): AssetBrowserAsset[] {
  return page.jobs.map(job => ({
    id: job.sourceOutputId ? `output:${job.sourceOutputId}` : `job:${job.jobId}`,
    jobId: job.jobId, sourceOutputId: job.sourceOutputId, sourceRevision: job.sourceRevision, ref: job.ref,
    url: job.videoUrl ?? '', thumbUrl: job.thumbUrl?.trim() || job.previewFrame?.trim() || null,
    durationSec: job.durationSec ?? null, width: job.width ?? null, height: job.height ?? null,
    kind: 'video' as const, mime: 'video/mp4', source: 'generated', createdAt: job.createdAt, canDelete: false,
  })).filter(asset => Boolean(asset.url));
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
  const [generatedNextCursor, setGeneratedNextCursor] = useState<string | null>(null);
  const [libraryNextCursor, setLibraryNextCursor] = useState<string | null>(null);
  const [libraryHasMore, setLibraryHasMore] = useState(false);
  const [libraryLoadingMore, setLibraryLoadingMore] = useState(false);

  const userId = resolveLibraryUserId(user);
  const revision = useLibraryCacheRevision(userId);
  const revisionRef = useRef(revision);
  if (revisionRef.current !== revision) { revisionRef.current = revision; requestRef.current += 1; loadingKeyRef.current = null; }
  const libraryCacheKey = libraryModalOpen
    ? `${revision}:${buildAccountLibraryCacheKey(mediaType, librarySource, userId)}`
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
      (libraryLoadedKey === `${revision}:${buildAccountLibraryCacheKey(mediaType, librarySource, userId)}` ? libraryAssets : []).filter((asset) =>
        mediaType === 'video'
          ? asset.kind === 'video' || asset.mime?.startsWith('video/')
          : asset.kind === 'image' || !asset.mime || asset.mime.startsWith('image/')
      ),
    [libraryAssets, mediaType, libraryLoadedKey, librarySource, userId, revision]
  );

  const resetLibraryState = useCallback((nextSource?: AssetLibrarySource) => {
    requestRef.current += 1;
    loadingKeyRef.current = null;
    setLibraryLoading(false);
    setLibraryAssets([]);
    setLibraryError(null);
    setLibraryLoadedKey(null);
    setLibraryNextCursor(null);
    setGeneratedNextCursor(null);
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
      const requestKey = `${revision}:${buildAccountLibraryCacheKey(kind, sourceFilter, userId)}`;
      loadingKeyRef.current = requestKey;
      setLibraryLoading(true);
      setLibraryLoadingMore(false);
      setLibraryError(null);
      setLibraryNextCursor(null);
      setGeneratedNextCursor(null);
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
          const jobsUrl = `/api/media-library/generated-videos?limit=30&surface=${sourceFilter === 'upscale' ? 'upscale' : 'video'}`;
          jobsRequest = ownedAuthFetch(jobsUrl, userId, { cache: 'no-store' });
        }

        const [assetsPayload, jobsResponse] = await Promise.all([assetsRequest, jobsRequest]);
        if (requestId !== requestRef.current || revision !== libraryCacheRevision(userId)) return;
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
        let generatedCursor: string | null = null;
        if (kind === 'video' && jobsResponse) {
          const jobsPayload = (await jobsResponse.json().catch(() => null)) as GeneratedLibraryPage | null;
          if (!jobsResponse.ok || !jobsPayload?.ok || !Array.isArray(jobsPayload.jobs)) throw Error(libraryErrorCopy);
          generatedVideos = projectGeneratedVideos(jobsPayload);
          generatedCursor = jobsPayload.nextCursor ?? null;
        }

        if (requestId !== requestRef.current || revision !== libraryCacheRevision(userId)) return;
        const nextCursor = assetsPayload.nextCursor ?? null;
        setLibraryAssets(mergeAssetsByIdentity(savedAssets, generatedVideos));
        setLibraryNextCursor(nextCursor);
        setGeneratedNextCursor(generatedCursor);
        setLibraryHasMore(Boolean((assetsPayload.hasMore && nextCursor) || generatedCursor));
        setLibraryLoadedKey(requestKey);
      } catch (libraryLoadError) {
        if (requestId !== requestRef.current || revision !== libraryCacheRevision(userId)) return;
        console.error('[upscale] failed to load library assets', libraryLoadError);
        setLibraryAssets([]);
        setLibraryError(libraryLoadError instanceof Error ? libraryLoadError.message : libraryErrorCopy);
        setLibraryLoadedKey(requestKey);
      } finally {
        if (requestId === requestRef.current && revision === libraryCacheRevision(userId)) {
          loadingKeyRef.current = null;
          setLibraryLoading(false);
        }
      }
    },
    [libraryErrorCopy, librarySource, mediaType, userId, revision]
  );

  const loadMoreLibraryAssets = useCallback(async () => {
    const sourceFilter = librarySource;
    const kind = mediaType;
    const requestKey = `${revision}:${buildAccountLibraryCacheKey(kind, sourceFilter, userId)}`;
    if (!userId || (!libraryNextCursor && !generatedNextCursor) || libraryLoadingMore || libraryLoadedKey !== requestKey) return;

    const requestId = ++requestRef.current;
    setLibraryLoadingMore(true);
    setLibraryError(null);
    try {
      const [assetsPayload, generatedPage] = await Promise.all([
        libraryNextCursor ? fetchMediaLibraryAssets([
          buildMediaLibraryAssetsUrl({kind, source: sourceFilter, limit: UPSCALE_LIBRARY_PAGE_SIZE, cursor: libraryNextCursor}), userId,
        ]) : Promise.resolve({assets: [], hasMore: false, nextCursor: null}),
        generatedNextCursor ? ownedAuthFetch(`/api/media-library/generated-videos?limit=30&surface=${sourceFilter === 'upscale' ? 'upscale' : 'video'}&cursor=${encodeURIComponent(generatedNextCursor)}`, userId, {cache:'no-store'}).then(async response => {
          const page = await response.json() as GeneratedLibraryPage;
          if (!response.ok || !page.ok || !Array.isArray(page.jobs)) throw Error(libraryErrorCopy);
          return page;
        }) : Promise.resolve(null),
      ]);
      if (requestId !== requestRef.current || revision !== libraryCacheRevision(userId)) return;

      const nextCursor = assetsPayload.nextCursor ?? null;
      const nextAssets = Array.isArray(assetsPayload.assets)
        ? projectSavedAssets(assetsPayload.assets, kind)
        : [];
      setLibraryAssets((existing) => mergeAssetsByIdentity(existing, nextAssets, generatedPage ? projectGeneratedVideos(generatedPage) : []));
      setLibraryNextCursor(nextCursor);
      setGeneratedNextCursor(generatedPage?.nextCursor ?? null);
      setLibraryHasMore(Boolean((assetsPayload.hasMore && nextCursor) || generatedPage?.nextCursor));
    } catch (libraryLoadError) {
      if (requestId !== requestRef.current || revision !== libraryCacheRevision(userId)) return;
      console.error('[upscale] failed to load more library assets', libraryLoadError);
      setLibraryError(libraryLoadError instanceof Error ? libraryLoadError.message : libraryErrorCopy);
    } finally {
      if (requestId === requestRef.current && revision === libraryCacheRevision(userId)) setLibraryLoadingMore(false);
    }
  }, [generatedNextCursor, libraryErrorCopy, libraryLoadedKey, libraryLoadingMore, libraryNextCursor, librarySource, mediaType, userId, revision]);

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
