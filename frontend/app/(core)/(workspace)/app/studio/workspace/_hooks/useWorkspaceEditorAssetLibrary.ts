'use client';

import { useEffect, useMemo, useState } from 'react';
import { authFetch } from '@/lib/authFetch';
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

export function useWorkspaceEditorAssetLibrary(nodeKind: WorkspaceNodeKind | null | undefined) {
  const isEnabled = nodeKind !== undefined;
  const libraryKind = nodeKind ? workspaceLibraryKindForNodeKind(nodeKind) : null;
  const sourceOptions = useMemo(() => workspaceLibrarySourceOptionsForKind(libraryKind), [libraryKind]);
  const [source, setSource] = useState<WorkspaceLibrarySource>('all');
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
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    async function loadUserLibrary() {
      try {
        const response = await authFetch(buildWorkspaceUserLibraryUrl(libraryKind, source));
        if (cancelled) return;
        if (response.status === 401) {
          setUserAssets([]);
          setError('Sign in to access your app library.');
          return;
        }
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok) {
          throw new Error(typeof payload?.error === 'string' ? payload.error : 'Unable to load your app library.');
        }
        setUserAssets(normalizeWorkspaceUserLibraryPayload(payload, libraryKind));
      } catch (loadError) {
        if (cancelled) return;
        setUserAssets([]);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load your app library.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadUserLibrary();

    return () => {
      cancelled = true;
    };
  }, [isEnabled, libraryKind, source]);

  const assets = userAssets.length ? userAssets : fallbackAssets;

  return {
    assets,
    userAssets,
    fallbackAssets,
    isLoading,
    error,
    libraryKind,
    source,
    setSource,
    sourceOptions,
    sourceLabels: WORKSPACE_LIBRARY_SOURCE_LABELS,
    usingFallback: userAssets.length === 0 && fallbackAssets.length > 0,
  };
}
