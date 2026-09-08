'use client';

import { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';
import type { AssetLibrarySource } from '@/components/library/AssetLibraryBrowser';
import { authFetch } from '@/lib/authFetch';
import {
  buildMediaLibraryAssetsKey,
  fetchMediaLibraryAssets,
  type MediaLibraryAssetsResponse,
} from '@/lib/media-library-client';
import type { CharacterReferenceSelection, CharacterReferencesResponse } from '@/types/image-generation';
import type { LibraryAsset } from '../_lib/image-workspace-types';

export const IMAGE_LIBRARY_PAGE_SIZE = 30;

/** Account is part of every cache identity; canonical first pages are shared with the Media page. */
export function useImageLibraryData({ userId, source, isCharacterMode }: {
  userId: string | null;
  source: AssetLibrarySource;
  isCharacterMode: boolean;
}) {
  const assetsQuery = useSWRInfinite<MediaLibraryAssetsResponse>(
    (pageIndex, previousPageData) => {
      if (isCharacterMode || (previousPageData && !previousPageData.nextCursor)) return null;
      return buildMediaLibraryAssetsKey({
        userId,
        kind: 'image',
        source,
        limit: IMAGE_LIBRARY_PAGE_SIZE,
        cursor: pageIndex === 0 ? null : previousPageData?.nextCursor,
      });
    },
    fetchMediaLibraryAssets,
    {
      keepPreviousData: false,
      persistSize: false,
    }
  );
  const characterKey = userId && isCharacterMode
    ? ['/api/character-references?limit=60', userId] as const
    : null;
  const characterQuery = useSWR<CharacterReferencesResponse>(characterKey, async ([url]: readonly [string, string]) => {
    const response = await authFetch(url);
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
    if (!isCharacterMode && lastAssetPage?.nextCursor && !isLoadingMore) {
      void assetsQuery.setSize((size) => size + 1);
    }
  }, [assetsQuery, isCharacterMode, isLoadingMore, lastAssetPage?.nextCursor]);

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
