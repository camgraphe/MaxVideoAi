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
import {
  resetWorkspaceAssetSelection,
  selectWorkspaceAsset,
  type WorkspaceAssetSelectionMode,
} from '../_lib/workspace-asset-selection';

type WorkspaceLibraryKindFilter = 'all' | WorkspaceLibraryKind;
export type WorkspaceAssetLibraryMediaKindFilter = WorkspaceLibraryKindFilter;
type WorkspaceAssetLibraryStatus = 'idle' | 'loading' | 'ready' | 'error';

type WorkspaceEditorAssetLibraryCacheEntry = WorkspaceUserLibraryPage & {
  error: string | null;
};

const WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE = new Map<string, WorkspaceEditorAssetLibraryCacheEntry>();
const WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE_VERSION = 'with-outputs-v1';
const WORKSPACE_EDITOR_PATCH_SOURCES = ['all', 'upload'] as const satisfies readonly WorkspaceLibrarySource[];

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

function cacheKindsForAsset(asset: WorkspaceLibraryAsset): Array<WorkspaceLibraryKind | null> {
  if (asset.kind === 'image' || asset.kind === 'video' || asset.kind === 'audio') return [null, asset.kind];
  return [null];
}

export function patchWorkspaceEditorAssetLibraryCache(
  asset: WorkspaceLibraryAsset,
  sources: readonly WorkspaceLibrarySource[] = WORKSPACE_EDITOR_PATCH_SOURCES
): void {
  for (const kind of cacheKindsForAsset(asset)) {
    for (const source of sources) {
      const cacheKey = buildWorkspaceEditorAssetLibraryCacheKey(kind, source);
      const cached = WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE.get(cacheKey);
      WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE.set(cacheKey, {
        assets: mergeWorkspaceLibraryAssets([asset], cached?.assets ?? [], 'append'),
        nextCursor: cached?.nextCursor ?? null,
        hasMore: cached?.hasMore ?? false,
        error: null,
      });
    }
  }
}

export function invalidateWorkspaceEditorAssetLibraryCache(assetIds?: string | readonly string[]): void {
  if (assetIds === undefined) {
    WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE.clear();
    return;
  }
  const ids = new Set(Array.isArray(assetIds) ? assetIds : [assetIds]);
  for (const [cacheKey, cached] of WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE.entries()) {
    const nextAssets = cached.assets.filter((asset) => !ids.has(asset.id));
    if (nextAssets.length === cached.assets.length) continue;
    WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE.set(cacheKey, {
      ...cached,
      assets: nextAssets,
    });
  }
}

export function useWorkspaceEditorAssetLibrary(
  nodeKind: WorkspaceNodeKind | null | undefined,
  copy: StudioCopy['assetLibrary']
) {
  const isEnabled = nodeKind !== undefined;
  const libraryKind = nodeKind ? workspaceLibraryKindForNodeKind(nodeKind) : null;
  const [kindFilter, setKindFilter] = useState<WorkspaceLibraryKindFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null);
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
      const resetSelection = resetWorkspaceAssetSelection();
      setSelectedAssetIds(resetSelection.selectedAssetIds);
      setSelectionAnchorId(resetSelection.selectionAnchorId);
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

  const loadMore = useCallback(async (): Promise<void> => {
    if (!requestKey || !hasMore || isLoading || isLoadingMore || !nextCursor) return;
    const currentRequestKey = requestKey;
    const cursor = nextCursor;
    setIsLoadingMore(true);
    setError(null);

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
  const assets = useMemo(
    () => (userAssets.length ? userAssets : shouldUseFallback ? fallbackAssets : []),
    [fallbackAssets, shouldUseFallback, userAssets]
  );

  const toggleAssetSelection = useCallback((assetId: string, mode: 'replace' | 'toggle' | 'range') => {
    const nextSelection = selectWorkspaceAsset({
      assetIds: assets.map((asset) => asset.id),
      selection: { selectedAssetIds, selectionAnchorId },
      assetId,
      mode,
    });
    setSelectedAssetIds(nextSelection.selectedAssetIds);
    setSelectionAnchorId(nextSelection.selectionAnchorId);
  }, [assets, selectedAssetIds, selectionAnchorId]);

  const resetSelection = useCallback(() => {
    const selection = resetWorkspaceAssetSelection();
    setSelectedAssetIds(selection.selectedAssetIds);
    setSelectionAnchorId(selection.selectionAnchorId);
  }, []);

  useEffect(() => {
    const availableAssetIds = new Set(assets.map((asset) => asset.id));
    setSelectedAssetIds((currentIds) => {
      const nextIds = currentIds.filter((assetId) => availableAssetIds.has(assetId));
      return nextIds.length === currentIds.length ? currentIds : nextIds;
    });
  }, [assets]);

  const status: WorkspaceAssetLibraryStatus = !isEnabled
    ? 'idle'
    : isLoading
      ? 'loading'
      : error
        ? 'error'
        : 'ready';

  return {
    assets,
    userAssets,
    fallbackAssets,
    isLoading,
    isLoadingMore,
    error,
    status,
    libraryKind,
    effectiveLibraryKind,
    kindFilter,
    setKindFilter,
    mediaKindFilter: kindFilter,
    setMediaKindFilter: setKindFilter,
    searchQuery,
    setSearchQuery,
    selectedAssetIds,
    toggleAssetSelection,
    resetSelection,
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

export type WorkspaceEditorAssetLibraryState = ReturnType<typeof useWorkspaceEditorAssetLibrary> & {
  status: WorkspaceAssetLibraryStatus;
  mediaKindFilter: WorkspaceAssetLibraryMediaKindFilter;
  searchQuery: string;
  selectedAssetIds: string[];
  loadMore: () => Promise<void>;
  setMediaKindFilter: (kind: WorkspaceAssetLibraryMediaKindFilter) => void;
  setSearchQuery: (query: string) => void;
  toggleAssetSelection: (assetId: string, mode: WorkspaceAssetSelectionMode) => void;
  resetSelection: () => void;
};
