'use client';
import { useLibraryCacheRevision, libraryRevisionKey, useLibraryScopePersistence } from '@/hooks/useLibraryCacheRevision';

import { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';
import type { AssetLibrarySource } from '@/components/library/AssetLibraryBrowser';
import { ownedAuthFetch } from '@/lib/owned-auth-fetch';
import {
  buildMediaLibraryAssetsKey,
  fetchMediaLibraryAssets,
  type MediaLibraryAssetsResponse,
} from '@/lib/media-library-client';
import type { CharacterReferenceSelection, CharacterReferencesResponse } from '@/types/image-generation';
import type { LibraryAsset } from '../_lib/image-workspace-types';

export const IMAGE_LIBRARY_PAGE_SIZE = 30;

/** Account is part of every cache identity; canonical first pages are shared with the Media page. */
export function useImageLibraryData({ userId, source, isCharacterMode, enabled = true }: {
  userId: string | null;
  source: AssetLibrarySource;
  isCharacterMode: boolean;
  enabled?: boolean;
}) {
  const revision = useLibraryCacheRevision(userId);
  const persistSize = useLibraryScopePersistence(JSON.stringify([userId, source, isCharacterMode]));
  const assetsQuery = useSWRInfinite<MediaLibraryAssetsResponse>(
    (pageIndex, previousPageData) => {
      if (!enabled || isCharacterMode || (previousPageData && !previousPageData.nextCursor)) return null;
      return libraryRevisionKey(buildMediaLibraryAssetsKey({
        userId,
        kind: 'image',
        source,
        limit: IMAGE_LIBRARY_PAGE_SIZE,
        cursor: pageIndex === 0 ? null : previousPageData?.nextCursor,
      }), revision);
    },
    fetchMediaLibraryAssets,
    {
      keepPreviousData: false,
      persistSize,
    }
  );
  const characterKey = enabled && userId && isCharacterMode
    ? ['/api/character-references?limit=60', userId] as const
    : null;
  const characterQuery = useSWR<CharacterReferencesResponse>(characterKey, async ([url, ownerId]: readonly [string, string]) => {
    const response = await ownedAuthFetch(url, ownerId);
    const payload = (await response.json().catch(() => null)) as CharacterReferencesResponse | null;
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error ?? 'Failed to load Media');
    }
    return payload;
  }, { keepPreviousData: false });

  const assets = useMemo<LibraryAsset[] | undefined>(() => {
    if (!assetsQuery.data) return undefined;
    const seen = new Set<string>();
    return assetsQuery.data.flatMap((page) =>
      page.assets.filter((asset) => !seen.has(asset.id) && Boolean(seen.add(asset.id)))
    );
  }, [assetsQuery.data]);
  const lastAssetPage = assetsQuery.data?.at(-1);
  const isLoadingMore = Boolean(
    assetsQuery.isValidating && assetsQuery.data && assetsQuery.size > assetsQuery.data.length
  );
  const loadMore = useCallback(() => {
    if (enabled && !isCharacterMode && lastAssetPage?.nextCursor && !isLoadingMore) {
      void assetsQuery.setSize((size) => size + 1);
    }
  }, [assetsQuery, enabled, isCharacterMode, isLoadingMore, lastAssetPage?.nextCursor]);

  if (isCharacterMode) {
    return {
      data: characterQuery.data?.characters as CharacterReferenceSelection[] | undefined,
      error: characterQuery.error,
      hasMore: false,
      isLoading: characterQuery.isLoading,
      isLoadingMore: false,
      loadMore,
      mutate: characterQuery.mutate,
    };
  }

  return {
    data: assets,
    error: assetsQuery.error,
    hasMore: Boolean(lastAssetPage?.nextCursor),
    isLoading: assetsQuery.isLoading,
    isLoadingMore,
    loadMore,
    mutate: assetsQuery.mutate,
  };
}
