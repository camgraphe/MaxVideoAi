'use client';

import { useCallback, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import useSWRInfinite from 'swr/infinite';
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

function dedupeById<T extends { id: string }>(pages: T[][]): T[] {
  const seen = new Set<string>();
  return pages.flatMap((page) => page.filter((item) => !seen.has(item.id) && Boolean(seen.add(item.id))));
}

export function useLibraryPageData({
  userId,
  activeView,
  activeKind,
  activeSource,
  toolsEnabled,
  jobId,
}: {
  userId: string | null | undefined;
  activeView: LibraryView;
  activeKind: LibraryKind;
  activeSource: SavedAssetSource;
  toolsEnabled: boolean;
  jobId?: string | null;
}) {
  const [searchQuery, setSearchQueryState] = useState('');
  const router = useRouter();
  const pathname = usePathname();
  const urlSearchParams = useSearchParams();
  const activeJobId = activeView === 'review' ? jobId ?? null : null;

  const setSearchQuery = useCallback((value: string) => {
    setSearchQueryState(value.slice(0, 200));
  }, []);
  const clearJobFilter = useCallback(() => {
    const params = new URLSearchParams(urlSearchParams?.toString() ?? '');
    params.delete('job');
    const query = params.toString();
    const routePath = pathname ?? '/app/library';
    router.replace(query ? `${routePath}?${query}` : routePath, { scroll: false });
  }, [pathname, router, urlSearchParams]);

  const assetsQuery = useSWRInfinite<AssetsResponse>(
    (pageIndex, previousPageData) => {
      if (previousPageData && !previousPageData.nextCursor) return null;
      return buildSavedAssetsKey({
        userId,
        activeKind,
        activeSource,
        activeView,
        searchQuery,
        cursor: pageIndex === 0 ? null : previousPageData?.nextCursor,
      });
    },
    assetsFetcher,
    {
      dedupingInterval: 60_000,
      keepPreviousData: true,
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      revalidateFirstPage: false,
    }
  );
  const recentOutputsQuery = useSWRInfinite<RecentOutputsResponse>(
    (pageIndex, previousPageData) => {
      if (previousPageData && !previousPageData.nextCursor) return null;
      return buildRecentOutputsKey({
        userId,
        activeKind,
        activeView,
        searchQuery,
        jobId: activeJobId,
        cursor: pageIndex === 0 ? null : previousPageData?.nextCursor,
      });
    },
    recentOutputsFetcher,
    {
      dedupingInterval: 30_000,
      keepPreviousData: true,
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      revalidateFirstPage: false,
    }
  );

  const assetPages = useMemo(() => assetsQuery.data?.map((page) => page.assets) ?? [], [assetsQuery.data]);
  const recentPages = useMemo(
    () => recentOutputsQuery.data?.map((page) => page.outputs) ?? [],
    [recentOutputsQuery.data]
  );
  const assets = useMemo(
    () =>
      dedupeById(assetPages).filter((asset) =>
        toolsEnabled
          ? true
          : asset.source !== 'storyboard' && asset.source !== 'character' && asset.source !== 'angle'
      ),
    [assetPages, toolsEnabled]
  );
  const recentOutputs = useMemo(() => dedupeById(recentPages), [recentPages]);
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
      recentOutputs
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
    [activeKind, recentOutputs]
  );

  const activeQuery = activeView === 'saved' ? assetsQuery : recentOutputsQuery;
  const activeLastPage = activeQuery.data?.at(-1);
  const isLoadingMore = Boolean(
    activeQuery.isValidating && activeQuery.data && activeQuery.size > activeQuery.data.length
  );
  const loadMore = useCallback(() => {
    if (activeLastPage?.nextCursor && !isLoadingMore) void activeQuery.setSize((size) => size + 1);
  }, [activeLastPage?.nextCursor, activeQuery, isLoadingMore]);
  const visibleSavedAssets = assetsQuery.isLoading ? [] : savedBrowserAssets;
  const visibleReviewAssets = recentOutputsQuery.isLoading ? [] : reviewBrowserAssets;

  return {
    assetsData: assetsQuery.data?.at(-1),
    assetsError: assetsQuery.error,
    assetsLoading: assetsQuery.isLoading,
    assetsValidating: assetsQuery.isValidating,
    mutateAssets: assetsQuery.mutate,
    recentData: recentOutputsQuery.data?.at(-1),
    recentError: recentOutputsQuery.error,
    recentLoading: recentOutputsQuery.isLoading,
    recentValidating: recentOutputsQuery.isValidating,
    mutateRecentOutputs: recentOutputsQuery.mutate,
    savedBrowserAssets: visibleSavedAssets,
    reviewBrowserAssets: visibleReviewAssets,
    currentAssets: activeView === 'saved' ? visibleSavedAssets : visibleReviewAssets,
    searchQuery,
    setSearchQuery,
    hasMore: Boolean(activeLastPage?.nextCursor),
    loadMore,
    isLoadingMore,
    activeJobId,
    clearJobFilter,
  };
}
