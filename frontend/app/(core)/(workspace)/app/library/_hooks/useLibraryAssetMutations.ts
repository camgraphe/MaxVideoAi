'use client';

import { useCallback, useRef, useState } from 'react';
import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import type { KeyedMutator } from 'swr';
import type { AssetBrowserAsset } from '@/components/library/AssetLibraryBrowser';
import { authFetch } from '@/lib/authFetch';
import { prepareImageFileForUpload } from '@/lib/client-image-upload';
import {
  resolveImageUploadErrorMessage,
  type AssetsResponse,
  type LibraryCopy,
  type LibraryKind,
  type LibraryView,
  type RecentOutputsResponse,
  type SavedAssetSource,
} from '../_lib/library-page-helpers';

export function useLibraryAssetMutations({
  activeKind,
  activeSource,
  copy,
  mutateAssets,
  mutateRecentOutputs,
  setActiveSource,
  setActiveView,
}: {
  activeKind: LibraryKind;
  activeSource: SavedAssetSource;
  copy: LibraryCopy;
  mutateAssets: KeyedMutator<AssetsResponse>;
  mutateRecentOutputs: KeyedMutator<RecentOutputsResponse>;
  setActiveSource: Dispatch<SetStateAction<SavedAssetSource>>;
  setActiveView: Dispatch<SetStateAction<LibraryView>>;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingOutputIds, setSavingOutputIds] = useState<Set<string>>(new Set());
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const clearMutationErrors = useCallback(() => {
    setDeleteError(null);
    setImportError(null);
    setSaveError(null);
  }, []);

  const resetSourceMutationState = useCallback(() => {
    clearMutationErrors();
    setDeletingId(null);
  }, [clearMutationErrors]);

  const handleImportChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0] ?? null;
      event.currentTarget.value = '';
      if (!file) return;

      setImportError(null);
      setSaveError(null);
      setIsImporting(true);
      try {
        const preparedFile =
          activeKind === 'image'
            ? await prepareImageFileForUpload(file, { maxBytes: 25 * 1024 * 1024 })
            : file;
        const formData = new FormData();
        formData.append('file', preparedFile, preparedFile.name);
        const uploadEndpoint =
          activeKind === 'video'
            ? '/api/uploads/video'
            : activeKind === 'audio'
              ? '/api/uploads/audio'
              : '/api/uploads/image';
        const response = await authFetch(uploadEndpoint, {
          method: 'POST',
          body: formData,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok || !payload?.asset?.url) {
          const message = resolveImageUploadErrorMessage(response.status, payload?.error, copy.browser.importFailed);
          throw new Error(message);
        }

        setActiveView('saved');
        if (activeSource !== 'all' && activeSource !== 'upload') {
          setActiveSource('upload');
        }
        await mutateAssets();
      } catch (error) {
        setImportError(error instanceof Error ? error.message : copy.browser.importFailed);
      } finally {
        setIsImporting(false);
      }
    },
    [activeKind, activeSource, copy.browser.importFailed, mutateAssets, setActiveSource, setActiveView]
  );

  const handleDeleteAsset = useCallback(
    async (assetId: string) => {
      setDeletingId(assetId);
      setDeleteError(null);
      setSaveError(null);
      try {
        const response = await authFetch(`/api/media-library/assets/${encodeURIComponent(assetId)}`, {
          method: 'DELETE',
        });
        const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error ?? copy.assets.deleteError);
        }
        await Promise.all([mutateAssets(), mutateRecentOutputs()]);
      } catch (error) {
        setDeleteError(error instanceof Error ? error.message : copy.assets.deleteError);
      } finally {
        setDeletingId((current) => (current === assetId ? null : current));
      }
    },
    [copy.assets.deleteError, mutateAssets, mutateRecentOutputs]
  );

  const handleSaveRecentOutput = useCallback(
    async (asset: AssetBrowserAsset) => {
      if (!asset.jobId || !asset.sourceOutputId || asset.isSaved) return;
      const outputId = asset.sourceOutputId;
      setSaveError(null);
      setSavingOutputIds((previous) => {
        const next = new Set(previous);
        next.add(outputId);
        return next;
      });
      try {
        const response = await authFetch('/api/media-library/save-output', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: asset.jobId, outputId }),
        });
        const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error ?? copy.review.saveError);
        }
        await Promise.all([mutateRecentOutputs(), mutateAssets()]);
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : copy.review.saveError);
      } finally {
        setSavingOutputIds((previous) => {
          const next = new Set(previous);
          next.delete(outputId);
          return next;
        });
      }
    },
    [copy.review.saveError, mutateAssets, mutateRecentOutputs]
  );

  return {
    importInputRef,
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
