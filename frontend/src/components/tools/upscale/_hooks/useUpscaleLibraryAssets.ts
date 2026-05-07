import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type AssetBrowserAsset,
  type AssetLibrarySource,
} from '@/components/library/AssetLibraryBrowser';
import { authFetch } from '@/lib/authFetch';
import type { UpscaleMediaType } from '@/types/tools-upscale';
import { buildLibraryCacheKey } from '../_lib/upscale-workspace-helpers';
import type {
  JobsLibraryResponse,
  UserAssetsResponse,
} from '../_lib/upscale-workspace-types';

type UseUpscaleLibraryAssetsParams = {
  libraryErrorCopy: string;
  mediaType: UpscaleMediaType;
  user: unknown;
};

export function useUpscaleLibraryAssets({
  libraryErrorCopy,
  mediaType,
  user,
}: UseUpscaleLibraryAssetsParams) {
  const [libraryModalOpen, setLibraryModalOpen] = useState(false);
  const [libraryAssets, setLibraryAssets] = useState<AssetBrowserAsset[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [librarySource, setLibrarySource] = useState<AssetLibrarySource>('all');
  const [libraryLoadedKey, setLibraryLoadedKey] = useState<string | null>(null);

  const libraryCacheKey = libraryModalOpen ? buildLibraryCacheKey(mediaType, librarySource) : null;
  const librarySourceOptions = useMemo(
    () =>
      mediaType === 'video'
        ? (['all', 'upload', 'generated', 'upscale'] as const)
        : (['all', 'upload', 'generated', 'character', 'angle', 'upscale'] as const),
    [mediaType]
  );
  const visibleLibraryAssets = useMemo(
    () =>
      libraryAssets.filter((asset) =>
        mediaType === 'video'
          ? asset.kind === 'video' || asset.mime?.startsWith('video/')
          : asset.kind === 'image' || !asset.mime || asset.mime.startsWith('image/')
      ),
    [libraryAssets, mediaType]
  );

  const resetLibraryState = useCallback((nextSource?: AssetLibrarySource) => {
    setLibraryAssets([]);
    setLibraryError(null);
    setLibraryLoadedKey(null);
    if (nextSource) {
      setLibrarySource(nextSource);
    }
  }, []);

  const fetchLibraryAssets = useCallback(
    async (options?: { source?: AssetLibrarySource; kind?: UpscaleMediaType }) => {
      const sourceFilter = options?.source ?? librarySource;
      const kind = options?.kind ?? mediaType;
      const requestKey = buildLibraryCacheKey(kind, sourceFilter);
      setLibraryLoading(true);
      setLibraryError(null);
      try {
        if (!user) {
          setLibraryAssets([]);
          setLibraryError(kind === 'video' ? 'Sign in to access your video library.' : 'Sign in to access your image library.');
          setLibraryLoadedKey(requestKey);
          return;
        }

        const assetUrl =
          sourceFilter === 'all'
            ? '/api/user-assets?limit=80'
            : `/api/user-assets?limit=80&source=${encodeURIComponent(sourceFilter)}`;
        const requests: Array<Promise<Response>> = [authFetch(assetUrl)];
        if (kind === 'video' && sourceFilter !== 'upload') {
          const jobsUrl = sourceFilter === 'upscale' ? '/api/jobs?limit=80&surface=upscale' : '/api/jobs?limit=80&type=video';
          requests.push(authFetch(jobsUrl));
        }

        const [assetsResponse, jobsResponse] = await Promise.all(requests);
        if (assetsResponse.status === 401 || jobsResponse?.status === 401) {
          setLibraryAssets([]);
          setLibraryError(kind === 'video' ? 'Sign in to access your video library.' : 'Sign in to access your image library.');
          setLibraryLoadedKey(requestKey);
          return;
        }

        const assetsPayload = (await assetsResponse.json().catch(() => null)) as UserAssetsResponse | null;
        if (!assetsResponse.ok || !assetsPayload?.ok) {
          throw new Error(assetsPayload?.error ?? libraryErrorCopy);
        }

        const savedAssets = Array.isArray(assetsPayload.assets)
          ? assetsPayload.assets.map((asset) => {
              const mime = asset.mime ?? null;
              return {
                id: asset.id,
                url: asset.url,
                kind: mime?.startsWith('video/') ? 'video' : 'image',
                width: asset.width ?? null,
                height: asset.height ?? null,
                size: asset.size ?? null,
                mime,
                source: asset.source ?? null,
                createdAt: asset.createdAt,
                canDelete: false,
              } satisfies AssetBrowserAsset;
            })
          : [];
        const filteredAssets = savedAssets.filter((asset) =>
          kind === 'video'
            ? asset.kind === 'video' || asset.mime?.startsWith('video/')
            : asset.kind === 'image' || !asset.mime || asset.mime.startsWith('image/')
        );

        let generatedVideos: AssetBrowserAsset[] = [];
        if (kind === 'video' && jobsResponse) {
          const jobsPayload = (await jobsResponse.json().catch(() => null)) as JobsLibraryResponse | null;
          if (jobsResponse.ok && Array.isArray(jobsPayload?.jobs)) {
            generatedVideos = jobsPayload.jobs
              .map((job) => ({
                id: `job:${job.jobId}`,
                url: job.videoUrl ?? job.readyVideoUrl ?? '',
                kind: 'video' as const,
                mime: 'video/mp4',
                source: 'generated',
                createdAt: job.createdAt,
                canDelete: false,
              }))
              .filter((asset) => asset.url.trim().length > 0);
          }
        }

        const combined = kind === 'video' ? [...filteredAssets, ...generatedVideos] : filteredAssets;
        const deduped = combined.filter(
          (asset, index, list) => list.findIndex((entry) => entry.url === asset.url) === index
        );
        setLibraryAssets(deduped);
        setLibraryLoadedKey(requestKey);
      } catch (libraryLoadError) {
        console.error('[upscale] failed to load library assets', libraryLoadError);
        setLibraryAssets([]);
        setLibraryError(libraryLoadError instanceof Error ? libraryLoadError.message : libraryErrorCopy);
        setLibraryLoadedKey(requestKey);
      } finally {
        setLibraryLoading(false);
      }
    },
    [libraryErrorCopy, librarySource, mediaType, user]
  );

  useEffect(() => {
    if (!libraryModalOpen || !libraryCacheKey || libraryLoading) return;
    if (libraryLoadedKey === libraryCacheKey) return;
    setLibraryAssets([]);
    setLibraryError(null);
    void fetchLibraryAssets({ kind: mediaType, source: librarySource });
  }, [
    fetchLibraryAssets,
    libraryCacheKey,
    libraryLoadedKey,
    libraryLoading,
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
    libraryLoading,
    libraryModalOpen,
    librarySource,
    librarySourceOptions,
    openLibraryModal,
    resetLibraryState,
    setLibraryModalOpen,
    visibleLibraryAssets,
  };
}
