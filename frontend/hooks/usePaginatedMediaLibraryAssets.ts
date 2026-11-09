'use client';
import { useLibraryCacheRevision, libraryRevisionKey, useLibraryScopePersistence } from '@/hooks/useLibraryCacheRevision';

import { useCallback, useMemo } from 'react';
import useSWRInfinite from 'swr/infinite';
import {
  buildMediaLibraryAssetsKey,
  fetchMediaLibraryAssets,
  type MediaLibraryAsset,
  type MediaLibraryAssetKind,
  type MediaLibraryAssetsResponse,
} from '@/lib/media-library-client';

export const MEDIA_LIBRARY_PICKER_PAGE_SIZE = 30;

export function usePaginatedMediaLibraryAssets({
  enabled,
  userId,
  kind,
  source,
}: {
  enabled: boolean;
  userId: string | null;
  kind: MediaLibraryAssetKind;
  source?: string | null;
}) {
  const revision = useLibraryCacheRevision(userId);
  const persistSize = useLibraryScopePersistence(JSON.stringify([userId, kind, source, enabled]));
  const query = useSWRInfinite<MediaLibraryAssetsResponse>(
    (pageIndex, previousPageData) => {
      if (!enabled || (previousPageData && !previousPageData.nextCursor)) return null;
      return libraryRevisionKey(buildMediaLibraryAssetsKey({
        userId,
        kind,
        source,
        limit: MEDIA_LIBRARY_PICKER_PAGE_SIZE,
        cursor: pageIndex === 0 ? null : previousPageData?.nextCursor,
      }), revision);
    },
    fetchMediaLibraryAssets,
    { persistSize, revalidateFirstPage: false }
  );

  const assets = useMemo<MediaLibraryAsset[]>(() => {
    const seen = new Set<string>();
    return (query.data ?? []).flatMap((page) =>
      page.assets.filter((asset) => !seen.has(asset.id) && Boolean(seen.add(asset.id)))
    );
  }, [query.data]);
  const lastPage = query.data?.at(-1);
  const isLoadingMore = Boolean(query.isValidating && query.data && query.size > query.data.length);
  const loadMore = useCallback(() => {
    if (lastPage?.nextCursor && !isLoadingMore) {
      void query.setSize((size) => size + 1);
    }
  }, [isLoadingMore, lastPage?.nextCursor, query]);

  return {
    assets,
    error: query.error,
    hasMore: Boolean(lastPage?.hasMore && lastPage.nextCursor),
    isLoading: query.isLoading,
    isLoadingMore,
    loadMore,
  };
}
