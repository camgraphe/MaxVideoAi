'use client';

import { useEffect, useMemo, useState } from 'react';
import { authFetch } from '@/lib/authFetch';
import { studioApiSyncStatusFromResponse } from '../_state/workspace-api-persistence';
import type { WorkspaceNodeKind } from '../_lib/workspace-types';
import {
  WORKSPACE_LIBRARY_ASSETS,
  WORKSPACE_LIBRARY_SOURCE_LABELS,
  buildWorkspaceUserLibraryUrl,
  normalizeWorkspaceUserLibraryPayload,
  workspaceLibraryAssetsForNodeKind,
  workspaceLibraryKindForNodeKind,
  workspaceLibrarySourceOptionsForKind,
  type WorkspaceLibraryAsset,
  type WorkspaceLibrarySource,
} from '../_lib/workspace-library-assets';
import type { StudioCopy } from '../../_lib/studio-copy';

type WorkspaceEditorAssetLibraryCacheEntry = {
  assets: WorkspaceLibraryAsset[];
  error: string | null;
};

const WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE = new Map<string, WorkspaceEditorAssetLibraryCacheEntry>();

function buildWorkspaceEditorAssetLibraryCacheKey(
  kind: ReturnType<typeof workspaceLibraryKindForNodeKind> | null,
  source: WorkspaceLibrarySource
): string {
  return `${kind ?? 'all'}:${source}`;
}

export function useWorkspaceEditorAssetLibrary(
  nodeKind: WorkspaceNodeKind | null | undefined,
  copy: StudioCopy['assetLibrary']
) {
  const isEnabled = nodeKind !== undefined;
  const libraryKind = nodeKind ? workspaceLibraryKindForNodeKind(nodeKind) : null;
  const sourceOptions = useMemo(() => workspaceLibrarySourceOptionsForKind(libraryKind), [libraryKind]);
  const [source, setSource] = useState<WorkspaceLibrarySource>('all');
  const activeSource = sourceOptions.includes(source) ? source : 'all';
  const fallbackAssets = useMemo(
    () => {
      if (nodeKind) return workspaceLibraryAssetsForNodeKind(nodeKind);
      if (nodeKind === null) return WORKSPACE_LIBRARY_ASSETS;
      return [];
    },
    [nodeKind]
  );
  const [userAssets, setUserAssets] = useState<WorkspaceLibraryAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestKey = isEnabled ? buildWorkspaceEditorAssetLibraryCacheKey(libraryKind, activeSource) : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!sourceOptions.includes(source)) {
      setSource('all');
    }
  }, [source, sourceOptions]);

  useEffect(() => {
    if (!isEnabled) {
      setUserAssets([]);
      setError(null);
      setIsLoading(false);
      setLoadedKey(null);
      return;
    }

    if (!requestKey) return;
    const currentRequestKey = requestKey;
    const cached = WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE.get(requestKey);
    if (cached) {
      setUserAssets(cached.assets);
      setError(cached.error);
      setLoadedKey(currentRequestKey);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setUserAssets([]);
    setIsLoading(true);
    setError(null);
    setLoadedKey(null);

    async function loadUserLibrary() {
      try {
        const response = await authFetch(buildWorkspaceUserLibraryUrl(libraryKind, activeSource));
        if (cancelled) return;
        const status = studioApiSyncStatusFromResponse(response);
        if (status === 'unauthorized') {
          WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE.set(currentRequestKey, {
            assets: [],
            error: copy.signInToAccessLibrary,
          });
          setUserAssets([]);
          setError(copy.signInToAccessLibrary);
          setLoadedKey(currentRequestKey);
          return;
        }
        if (status !== 'ready') {
          WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE.set(currentRequestKey, {
            assets: [],
            error: copy.unableToLoadLibrary,
          });
          setUserAssets([]);
          setError(copy.unableToLoadLibrary);
          setLoadedKey(currentRequestKey);
          return;
        }
        const payload = await response.json().catch(() => null);
        if (!payload?.ok) {
          throw new Error(copy.unableToLoadLibrary);
        }
        const normalizedAssets = normalizeWorkspaceUserLibraryPayload(payload, libraryKind);
        WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE.set(currentRequestKey, {
          assets: normalizedAssets,
          error: null,
        });
        setUserAssets(normalizedAssets);
        setLoadedKey(currentRequestKey);
      } catch {
        if (cancelled) return;
        const nextError = copy.unableToLoadLibrary;
        WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE.set(currentRequestKey, {
          assets: [],
          error: nextError,
        });
        setUserAssets([]);
        setError(nextError);
        setLoadedKey(currentRequestKey);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadUserLibrary();

    return () => {
      cancelled = true;
    };
  }, [activeSource, copy.signInToAccessLibrary, copy.unableToLoadLibrary, isEnabled, libraryKind, requestKey]);

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
    error,
    libraryKind,
    source: activeSource,
    setSource,
    sourceOptions,
    sourceLabels: WORKSPACE_LIBRARY_SOURCE_LABELS,
    usingFallback: shouldUseFallback,
  };
}

export type WorkspaceEditorAssetLibraryState = ReturnType<typeof useWorkspaceEditorAssetLibrary>;
