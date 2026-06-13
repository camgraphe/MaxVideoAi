'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { authFetch } from '@/lib/authFetch';
import { studioApiSyncStatusFromResponse } from '../_state/workspace-api-persistence';
import type { WorkspaceNodeKind } from '../_lib/workspace-types';
import {
  WORKSPACE_LIBRARY_ASSETS,
  buildWorkspaceUserLibraryUrl,
  normalizeWorkspaceUserLibraryPage,
  workspaceLibraryAssetsForNodeKind,
  workspaceLibraryKindForNodeKind,
  workspaceLibrarySourceLabelsFromCopy,
  workspaceLibrarySourceOptionsForKind,
  type WorkspaceLibraryAsset,
  type WorkspaceLibraryKind,
  type WorkspaceLibrarySource,
  type WorkspaceUserLibraryPage,
} from '../_lib/workspace-library-assets';
import type { StudioCopy } from '../../_lib/studio-copy';

type WorkspaceLibraryKindFilter = 'all' | WorkspaceLibraryKind;

type WorkspaceEditorAssetLibraryCacheEntry = WorkspaceUserLibraryPage & {
  error: string | null;
};

const WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE = new Map<string, WorkspaceEditorAssetLibraryCacheEntry>();
const WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE_VERSION = 'with-outputs-v1';

function buildWorkspaceEditorAssetLibraryCacheKey(
  kind: WorkspaceLibraryKind | null,
  source: WorkspaceLibrarySource
): string {
  return `${WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE_VERSION}:${kind ?? 'all'}:${source}`;
}

function mergeWorkspaceLibraryAssets(
  currentAssets: WorkspaceLibraryAsset[],
  nextAssets: WorkspaceLibraryAsset[],
  mode: 'replace' | 'append'
): WorkspaceLibraryAsset[] {
  const assets = mode === 'append' ? [...currentAssets, ...nextAssets] : nextAssets;
  return Array.from(new Map(assets.map((asset) => [asset.id, asset])).values());
}

export function useWorkspaceEditorAssetLibrary(
  nodeKind: WorkspaceNodeKind | null | undefined,
  copy: StudioCopy['assetLibrary']
) {
  const isEnabled = nodeKind !== undefined;
  const libraryKind = nodeKind ? workspaceLibraryKindForNodeKind(nodeKind) : null;
  const [kindFilter, setKindFilter] = useState<WorkspaceLibraryKindFilter>('all');
  const effectiveLibraryKind = libraryKind ?? (kindFilter === 'all' ? null : kindFilter);
  const canFilterKind = nodeKind === null;
  const sourceOptions = useMemo(() => workspaceLibrarySourceOptionsForKind(effectiveLibraryKind), [effectiveLibraryKind]);
  const sourceLabels = useMemo(() => workspaceLibrarySourceLabelsFromCopy(copy), [copy]);
  const [source, setSource] = useState<WorkspaceLibrarySource>('all');
  const activeSource = sourceOptions.includes(source) ? source : 'all';
  const fallbackAssets = useMemo(
    () => {
      if (nodeKind) return workspaceLibraryAssetsForNodeKind(nodeKind);
      if (nodeKind === null && effectiveLibraryKind) {
        return WORKSPACE_LIBRARY_ASSETS.filter((asset) => asset.kind === effectiveLibraryKind);
      }
      if (nodeKind === null) return WORKSPACE_LIBRARY_ASSETS;
      return [];
    },
    [effectiveLibraryKind, nodeKind]
  );
  const [userAssets, setUserAssets] = useState<WorkspaceLibraryAsset[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestKey = isEnabled ? buildWorkspaceEditorAssetLibraryCacheKey(effectiveLibraryKind, activeSource) : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const fetchLibraryPage = useCallback(
    async (cursor: string | null): Promise<WorkspaceEditorAssetLibraryCacheEntry> => {
      const response = await authFetch(buildWorkspaceUserLibraryUrl(effectiveLibraryKind, activeSource, {
        cursor,
        includeOutputs: true,
      }));
      const status = studioApiSyncStatusFromResponse(response);
      if (status === 'unauthorized') {
        return {
          assets: [],
          nextCursor: null,
          hasMore: false,
          error: copy.signInToAccessLibrary,
        };
      }
      if (status !== 'ready') {
        throw new Error(copy.unableToLoadLibrary);
      }
      const payload = await response.json().catch(() => null);
      if (!payload?.ok) {
        throw new Error(copy.unableToLoadLibrary);
      }
      return {
        ...normalizeWorkspaceUserLibraryPage(payload, effectiveLibraryKind),
        error: null,
      };
    },
    [activeSource, copy.signInToAccessLibrary, copy.unableToLoadLibrary, effectiveLibraryKind]
  );

  useEffect(() => {
    if (!sourceOptions.includes(source)) {
      setSource('all');
    }
  }, [source, sourceOptions]);

  useEffect(() => {
    if (!canFilterKind && kindFilter !== 'all') {
      setKindFilter('all');
    }
  }, [canFilterKind, kindFilter]);

  useEffect(() => {
    if (!isEnabled) {
      setUserAssets([]);
      setNextCursor(null);
      setHasMore(false);
      setError(null);
      setIsLoading(false);
      setIsLoadingMore(false);
      setLoadedKey(null);
      return;
    }

    if (!requestKey) return;
    const currentRequestKey = requestKey;
    const cached = WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE.get(requestKey);
    if (cached) {
      setUserAssets(cached.assets);
      setNextCursor(cached.nextCursor);
      setHasMore(cached.hasMore);
      setError(cached.error);
      setLoadedKey(currentRequestKey);
      setIsLoading(false);
      setIsLoadingMore(false);
      return;
    }

    let cancelled = false;
    setUserAssets([]);
    setNextCursor(null);
    setHasMore(false);
    setIsLoading(true);
    setIsLoadingMore(false);
    setError(null);
    setLoadedKey(null);

    async function loadInitialPage() {
      try {
        const page = await fetchLibraryPage(null);
        if (cancelled) return;
        WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE.set(currentRequestKey, page);
        setUserAssets(page.assets);
        setNextCursor(page.nextCursor);
        setHasMore(page.hasMore);
        setError(page.error);
        setLoadedKey(currentRequestKey);
      } catch {
        if (cancelled) return;
        const nextEntry: WorkspaceEditorAssetLibraryCacheEntry = {
          assets: [],
          nextCursor: null,
          hasMore: false,
          error: copy.unableToLoadLibrary,
        };
        WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE.set(currentRequestKey, nextEntry);
        setUserAssets([]);
        setNextCursor(null);
        setHasMore(false);
        setError(copy.unableToLoadLibrary);
        setLoadedKey(currentRequestKey);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadInitialPage();

    return () => {
      cancelled = true;
    };
  }, [copy.unableToLoadLibrary, fetchLibraryPage, isEnabled, requestKey]);

  const loadMore = useCallback(() => {
    if (!requestKey || !hasMore || isLoading || isLoadingMore || !nextCursor) return;
    const currentRequestKey = requestKey;
    const cursor = nextCursor;
    setIsLoadingMore(true);
    setError(null);

    async function loadNextPage() {
      try {
        const page = await fetchLibraryPage(cursor);
        if (page.error) {
          WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE.set(currentRequestKey, {
            assets: userAssets,
            nextCursor: null,
            hasMore: false,
            error: page.error,
          });
          setNextCursor(null);
          setHasMore(false);
          setError(page.error);
          setLoadedKey(currentRequestKey);
          return;
        }
        setUserAssets((currentAssets) => {
          const mergedAssets = mergeWorkspaceLibraryAssets(currentAssets, page.assets, 'append');
          WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE.set(currentRequestKey, {
            assets: mergedAssets,
            nextCursor: page.nextCursor,
            hasMore: page.hasMore,
            error: null,
          });
          return mergedAssets;
        });
        setNextCursor(page.nextCursor);
        setHasMore(page.hasMore);
        setLoadedKey(currentRequestKey);
      } catch {
        setError(copy.unableToLoadLibrary);
      } finally {
        setIsLoadingMore(false);
      }
    }

    void loadNextPage();
  }, [
    copy.unableToLoadLibrary,
    fetchLibraryPage,
    hasMore,
    isLoading,
    isLoadingMore,
    nextCursor,
    requestKey,
    userAssets,
  ]);

  const hasLoadedCurrentLibrary = Boolean(requestKey && loadedKey === requestKey);
  const shouldUseFallback =
    hasLoadedCurrentLibrary &&
    !isLoading &&
    userAssets.length === 0 &&
    fallbackAssets.length > 0 &&
    Boolean(error) &&
    error !== copy.signInToAccessLibrary;
  const assets = userAssets.length ? userAssets : shouldUseFallback ? fallbackAssets : [];

  return {
    assets,
    userAssets,
    fallbackAssets,
    isLoading,
    isLoadingMore,
    error,
    libraryKind,
    effectiveLibraryKind,
    kindFilter,
    setKindFilter,
    canFilterKind,
    source: activeSource,
    setSource,
    sourceOptions,
    sourceLabels,
    hasMore,
    loadMore,
    nextCursor,
    usingFallback: shouldUseFallback,
  };
}

export type WorkspaceEditorAssetLibraryState = ReturnType<typeof useWorkspaceEditorAssetLibrary>;
