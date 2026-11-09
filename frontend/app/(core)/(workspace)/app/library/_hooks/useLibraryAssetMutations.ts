'use client';
import { invalidateLibraryMedia } from '@/hooks/useLibraryCacheRevision';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import type { AssetBrowserAsset } from '@/components/library/AssetLibraryBrowser';
import { useLibraryImportQueue } from '@/hooks/useLibraryImportQueue';
import { ownedAuthFetch } from '@/lib/owned-auth-fetch';
import {
  type LibraryCopy,
  type LibraryKind,
  type LibraryView,
  type SavedAssetSource,
} from '../_lib/library-page-helpers';

export function useLibraryAssetMutations({
  userId,
  activeSource,
  copy,
  mutateAssets,
  setActiveSource,
  setActiveView,
}: {
  userId?: string;
  activeKind: LibraryKind | 'all';
  activeSource: SavedAssetSource;
  copy: LibraryCopy;
  mutateAssets: () => Promise<unknown>;
  mutateRecentOutputs: () => Promise<unknown>;
  setActiveSource: Dispatch<SetStateAction<SavedAssetSource>>;
  setActiveView: Dispatch<SetStateAction<LibraryView>>;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingOutputIds, setSavingOutputIds] = useState<Set<string>>(new Set());
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { queue: importQueue, state: importState } = useLibraryImportQueue(userId);
  const [importQueueOpen, setImportQueueOpen] = useState(false);
  const isImporting = importState.running;
  const [importError, setImportError] = useState<string | null>(null);
  useEffect(() => {
    if (!importState.running && importState.files.length && importState.files.every(file => file.status === 'success')) {
      setImportError(null);
    }
  }, [importState]);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const ownerRef = useRef({ userId });
  if (ownerRef.current.userId !== userId) ownerRef.current = { userId };
  useEffect(() => { setImportQueueOpen(false); }, [userId]);

  const clearMutationErrors = useCallback(() => {
    setDeleteError(null);
    setImportError(null);
    setSaveError(null);
  }, []);

  const resetSourceMutationState = useCallback(() => {
    clearMutationErrors();
    setDeletingId(null);
  }, [clearMutationErrors]);

  const handleImportChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';
    if (!files.length || !userId) return;
    const initiatingScope = ownerRef.current;
    setImportError(null); setImportQueueOpen(true);
    try {
      importQueue.add(files);
      await importQueue.start();
      if (ownerRef.current !== initiatingScope) return;
      const state = importQueue.getSnapshot();
      if (state.files.some(file => file.status === 'failed')) setImportError(copy.browser.importFailed);
      if (state.files.some(file => file.status === 'success')) {
        setActiveView('saved');
        if (activeSource !== 'all' && activeSource !== 'upload') setActiveSource('upload');
        await mutateAssets();
      }
    } catch (error) {
      if (ownerRef.current === initiatingScope) setImportError(error instanceof Error ? error.message : copy.browser.importFailed);
    }
  }, [userId, importQueue, activeSource, copy.browser.importFailed, mutateAssets, setActiveSource, setActiveView]);

  const handleDeleteAsset = useCallback(
    async (assetId: string) => {
      if (!userId) return;
      const initiatingScope = ownerRef.current;
      const isCurrent = () => ownerRef.current === initiatingScope;
      setDeletingId(assetId);
      setDeleteError(null);
      setSaveError(null);
      try {
        const response = await ownedAuthFetch(`/api/media-library/assets/${encodeURIComponent(assetId)}`, userId, {
          method: 'DELETE',
        });
        const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error ?? copy.assets.deleteError);
        }
        invalidateLibraryMedia(userId);
        if (!isCurrent()) return;
      } catch (error) {
        if (!isCurrent()) return;
        setDeleteError(error instanceof Error ? error.message : copy.assets.deleteError);
      } finally {
        if (isCurrent()) setDeletingId((current) => (current === assetId ? null : current));
      }
    },
    [copy.assets.deleteError, userId]
  );

  const handleSaveRecentOutput = useCallback(
    async (asset: AssetBrowserAsset) => {
      if (!userId || !asset.jobId || !asset.sourceOutputId || asset.isSaved) return;
      const initiatingScope = ownerRef.current;
      const isCurrent = () => ownerRef.current === initiatingScope;
      const outputId = asset.sourceOutputId;
      setSaveError(null);
      setSavingOutputIds((previous) => {
        const next = new Set(previous);
        next.add(outputId);
        return next;
      });
      try {
        const response = await ownedAuthFetch('/api/media-library/save-output', userId, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: asset.jobId, outputId }),
        });
        const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error ?? copy.review.saveError);
        }
        invalidateLibraryMedia(userId);
        if (!isCurrent()) return;
      } catch (error) {
        if (!isCurrent()) return;
        setSaveError(error instanceof Error ? error.message : copy.review.saveError);
      } finally {
        if (isCurrent()) setSavingOutputIds((previous) => {
          const next = new Set(previous);
          next.delete(outputId);
          return next;
        });
      }
    },
    [copy.review.saveError, userId]
  );

  return {
    importInputRef,
    importQueue, importQueueOpen, setImportQueueOpen,
    deletingId,
    savingOutputIds,
    deleteError,
    saveError,
    isImporting,
    importError,
    clearMutationErrors,
    resetSourceMutationState,
    setDeleteError,
    setImportError,
    setSaveError,
    handleImportChange,
    handleDeleteAsset,
    handleSaveRecentOutput,
  };
}
