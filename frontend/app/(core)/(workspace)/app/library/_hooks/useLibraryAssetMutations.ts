'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import type { AssetBrowserAsset } from '@/components/library/AssetLibraryBrowser';
import { loadSupabaseClient } from '@/lib/supabaseClientLoader';
import { authFetch } from '@/lib/authFetch';
import { ownedAuthFetch } from '@/lib/owned-auth-fetch';
import { uploadVideoFile } from '@/lib/client-video-upload';
import { prepareImageFileForUpload } from '@/lib/client-image-upload';
import {
  resolveImageUploadErrorMessage,
  type LibraryCopy,
  type LibraryKind,
  type LibraryView,
  type SavedAssetSource,
} from '../_lib/library-page-helpers';

export function useLibraryAssetMutations({
  userId,
  activeKind,
  activeSource,
  copy,
  mutateAssets,
  mutateRecentOutputs,
  setActiveSource,
  setActiveView,
}: {
  userId?: string;
  activeKind: LibraryKind;
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
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const importRequestRef = useRef<AbortController | null>(null);
  const ownerRef = useRef(userId);
  ownerRef.current = userId;
  useEffect(() => () => { importRequestRef.current?.abort(); }, [userId]);

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
      if (!file || !userId) return;
      importRequestRef.current?.abort();
      const request = new AbortController();
      importRequestRef.current = request;
      const isCurrent = () => !request.signal.aborted && ownerRef.current === userId;


      setImportError(null);
      setSaveError(null);
      setIsImporting(true);
      try {
        const preparedFile =
          activeKind === 'image'
            ? await prepareImageFileForUpload(file, { maxBytes: 25 * 1024 * 1024 })
            : file;
        if (!isCurrent()) return;
        const client = await loadSupabaseClient();
        if (!isCurrent()) return;
        const { data, error } = await client.auth.getSession();
        if (!isCurrent()) return;
        const session = data.session;
        if (error || !session?.access_token || session.user.id !== userId) {
          throw new Error(copy.browser.importFailed);
        }
        if (activeKind === 'video') {
          try {
            await uploadVideoFile(file, {
              request: (input, init) => ownedAuthFetch(input, userId, {...init, signal: request.signal}),
              abortRequest: (input, init) => ownedAuthFetch(input, userId, {...init, signal: AbortSignal.timeout(10_000)}),
            });
          } catch (error) {
            const failure = error as {status?: number; code?: unknown};
            throw new Error(resolveImageUploadErrorMessage(failure.status ?? 0, failure.code, copy.browser.importFailed));
          }
          if (!isCurrent()) return;
        } else {
          const formData = new FormData();
          formData.append('file', preparedFile, preparedFile.name);
          const uploadEndpoint = activeKind === 'audio' ? '/api/uploads/audio' : '/api/uploads/image';
          const response = await authFetch(uploadEndpoint, {
            method: 'POST',
            body: formData,
            signal: request.signal,
            headers: { Authorization: `Bearer ${session.access_token}` },
            credentials: 'omit',
          });
          if (!isCurrent()) return;
          const payload = await response.json().catch(() => null);
          if (!isCurrent()) return;
          if (!response.ok || !payload?.ok || !payload?.asset?.url) {
            const message = resolveImageUploadErrorMessage(response.status, payload?.error, copy.browser.importFailed);
            throw new Error(message);
          }
        }

        setActiveView('saved');
        if (activeSource !== 'all' && activeSource !== 'upload') {
          setActiveSource('upload');
        }
        await mutateAssets();
      } catch (error) {
        if (!isCurrent()) return;
        setImportError(error instanceof Error ? error.message : copy.browser.importFailed);
      } finally {
        if (isCurrent()) setIsImporting(false);
      }
    },
    [userId, activeKind, activeSource, copy.browser.importFailed, mutateAssets, setActiveSource, setActiveView]
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
