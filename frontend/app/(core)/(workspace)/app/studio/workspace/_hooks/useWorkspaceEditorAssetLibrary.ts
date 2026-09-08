'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
const WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE_VERSION = 'account-refs-v2';

function buildWorkspaceEditorAssetLibraryCacheKey(
  kind: WorkspaceLibraryKind | null,
  source: WorkspaceLibrarySource,
  accountId: string | null = null,
  q = ''
): string {
  return JSON.stringify([WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE_VERSION, accountId, kind, source, q.trim()]);
}

function mergeWorkspaceLibraryAssets(
  currentAssets: WorkspaceLibraryAsset[],
  nextAssets: WorkspaceLibraryAsset[],
  mode: 'replace' | 'append'
): WorkspaceLibraryAsset[] {
  const assets = mode === 'append' ? [...currentAssets, ...nextAssets] : nextAssets;
  return Array.from(new Map(assets.map((asset) => [asset.id, asset])).values());
}

export function patchWorkspaceEditorAssetLibraryCache(
  asset: WorkspaceLibraryAsset
): void {
  // Uploads invalidate cached listings; a caller without a verified account cannot populate them.
  if (!asset.id) return;
  WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE.clear();
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
  copy: StudioCopy['assetLibrary'],
  accountId: string | null = null
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
  const requestKey = isEnabled ? buildWorkspaceEditorAssetLibraryCacheKey(effectiveLibraryKind, activeSource, accountId, searchQuery) : null;
  const activeRequest = useRef<{ key: string | null; generation: number }>({ key: null, generation: 0 });
  if (activeRequest.current.key !== requestKey) activeRequest.current = { key: requestKey, generation: activeRequest.current.generation + 1 };
  const [retryVersion, setRetryVersion] = useState(0);
  useEffect(() => {
    setSelectedAssetIds([]);
    setSelectionAnchorId(null);
    return () => { activeRequest.current.generation += 1; };
  }, [requestKey]);
  useEffect(() => () => {
    for (const key of WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE.keys()) {
      if (JSON.parse(key)[1] === accountId) WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE.delete(key);
    }
  }, [accountId]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const fetchLibraryPage = useCallback(
    async (cursor: string | null, signal?: AbortSignal): Promise<WorkspaceEditorAssetLibraryCacheEntry> => {
      const response = await authFetch(buildWorkspaceUserLibraryUrl(effectiveLibraryKind, activeSource, {
        cursor,
        q: searchQuery,
      }), { signal });
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
    [activeSource, copy.signInToAccessLibrary, copy.unableToLoadLibrary, effectiveLibraryKind, searchQuery]
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
    const cached = accountId ? WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE.get(requestKey) : undefined;
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
    const controller = new AbortController();
    setUserAssets([]);
    setNextCursor(null);
    setHasMore(false);
    setIsLoading(true);
    setIsLoadingMore(false);
    setError(null);
    setLoadedKey(null);

    async function loadInitialPage() {
      try {
        const page = await fetchLibraryPage(null, controller.signal);
        if (cancelled) return;
        if (accountId && !page.error) WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE.set(currentRequestKey, page);
        while (WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE.size > 24) WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE.delete(WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE.keys().next().value!);
        setUserAssets(page.assets);
        setNextCursor(page.nextCursor);
        setHasMore(page.hasMore);
        setError(page.error);
        setLoadedKey(currentRequestKey);
      } catch {
        if (cancelled) return;
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
      controller.abort();
    };
  }, [accountId, copy.unableToLoadLibrary, fetchLibraryPage, isEnabled, requestKey, retryVersion]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (!requestKey || !hasMore || isLoading || isLoadingMore || !nextCursor) return;
    const currentRequestKey = requestKey;
    const generation = activeRequest.current.generation;
    const isCurrent = () => activeRequest.current.key === currentRequestKey && activeRequest.current.generation === generation;
    const cursor = nextCursor;
    setIsLoadingMore(true);
    setError(null);

    try {
      const page = await fetchLibraryPage(cursor);
      if (!isCurrent()) return;
      if (page.error) {
        if (accountId) WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE.set(currentRequestKey, {
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
        if (accountId) WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE.set(currentRequestKey, {
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
      if (isCurrent()) setError(copy.unableToLoadLibrary);
    } finally {
      if (isCurrent()) setIsLoadingMore(false);
    }
  }, [
    accountId,
    copy.unableToLoadLibrary,
    fetchLibraryPage,
    hasMore,
    isLoading,
    isLoadingMore,
    nextCursor,
    requestKey,
    userAssets,
  ]);

  const shouldUseFallback = false;
  const assets = useMemo(
    () => (loadedKey === requestKey ? userAssets : []),
    [loadedKey, requestKey, userAssets]
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
    scopeKey: accountId ?? 'anonymous',
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
    retry: () => { if (requestKey) WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE.delete(requestKey); setRetryVersion((value) => value + 1); },
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
