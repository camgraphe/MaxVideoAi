'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import type { AssetBrowserAsset } from '@/components/library/AssetLibraryBrowser';
import {
  assetsFetcher,
  buildRecentOutputsKey,
  buildSavedAssetsKey,
  inferKind,
  recentOutputsFetcher,
  type AssetsResponse,
  type LibraryKind,
  type LibraryView,
  type RecentOutputsResponse,
  type SavedAssetSource,
} from '../_lib/library-page-helpers';

export function useLibraryPageData({
  userId,
  activeView,
  activeKind,
  activeSource,
  savedAssetLimit,
  recentOutputLimit,
  toolsEnabled,
}: {
  userId: string | null | undefined;
  activeView: LibraryView;
  activeKind: LibraryKind;
  activeSource: SavedAssetSource;
  savedAssetLimit: number;
  recentOutputLimit: number;
  toolsEnabled: boolean;
}) {
  const savedAssetsKey = buildSavedAssetsKey({
    userId,
    activeKind,
    activeSource,
    limit: savedAssetLimit,
  });
  const recentOutputsKey = buildRecentOutputsKey({
    userId,
    activeKind,
    activeView,
    limit: recentOutputLimit,
  });

  const assetsQuery = useSWR<AssetsResponse>(savedAssetsKey, assetsFetcher, {
    dedupingInterval: 60_000,
    keepPreviousData: true,
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  const recentOutputsQuery = useSWR<RecentOutputsResponse>(recentOutputsKey, recentOutputsFetcher, {
    dedupingInterval: 30_000,
    keepPreviousData: true,
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  const assets = useMemo(
    () =>
      (assetsQuery.data?.assets ?? []).filter((asset) =>
        toolsEnabled
          ? true
          : asset.source !== 'storyboard' && asset.source !== 'character' && asset.source !== 'angle'
      ),
    [assetsQuery.data?.assets, toolsEnabled]
  );
  const savedBrowserAssets = useMemo<AssetBrowserAsset[]>(
    () =>
      assets.map((asset) => ({
        id: asset.id,
        url: asset.url,
        thumbUrl: asset.thumbUrl,
        previewUrl: asset.previewUrl,
        kind: inferKind(asset),
        width: asset.width,
        height: asset.height,
        size: asset.size,
        mime: asset.mime,
        source: asset.source,
        createdAt: asset.createdAt,
        canDelete: true,
        jobId: asset.jobId ?? null,
        sourceOutputId: asset.sourceOutputId ?? null,
      })),
    [assets]
  );
  const reviewBrowserAssets = useMemo<AssetBrowserAsset[]>(
    () =>
      (recentOutputsQuery.data?.outputs ?? [])
        .filter((output) => output.kind === activeKind)
        .map((output) => ({
          id: output.id,
          url: output.url,
          thumbUrl: output.thumbUrl,
          previewUrl: output.previewUrl,
          kind: activeKind,
          width: output.width,
          height: output.height,
          size: null,
          mime: output.mime,
          source: 'recent',
          createdAt: output.createdAt,
          canDelete: false,
          jobId: output.jobId,
          sourceOutputId: output.id,
          isSaved: Boolean(output.isSaved),
          savedAssetId: output.savedAssetId ?? null,
        })),
    [activeKind, recentOutputsQuery.data?.outputs]
  );

  return {
    assetsData: assetsQuery.data,
    assetsError: assetsQuery.error,
    assetsLoading: assetsQuery.isLoading,
    assetsValidating: assetsQuery.isValidating,
    mutateAssets: assetsQuery.mutate,
    recentData: recentOutputsQuery.data,
    recentError: recentOutputsQuery.error,
    recentLoading: recentOutputsQuery.isLoading,
    recentValidating: recentOutputsQuery.isValidating,
    mutateRecentOutputs: recentOutputsQuery.mutate,
    savedBrowserAssets,
    reviewBrowserAssets,
    currentAssets: activeView === 'saved' ? savedBrowserAssets : reviewBrowserAssets,
  };
}
