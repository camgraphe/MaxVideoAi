import { useLibraryCacheRevision, libraryRevisionKey, invalidateLibraryMedia } from '@/hooks/useLibraryCacheRevision';
import { ownedAuthFetch } from '@/lib/owned-auth-fetch';
import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import useSWR from 'swr';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { saveImageToLibrary } from '@/lib/api';
import { suggestDownloadFilename, triggerAppDownload } from '@/lib/download';
import { resolveStableMediaUrl } from '@/lib/media';
import {
  buildMediaLibraryAssetsKey,
  fetchMediaLibraryAssets,
  type MediaLibraryAssetsResponse,
} from '@/lib/media-library-client';
import type {
  HistoryEntry,
  LibraryAsset,
} from '../_lib/image-workspace-types';

type UseImagePreviewActionsParams = {
  canUseWorkspace: boolean;
  genericError: string;
  librarySource?: string;
  previewEntry: HistoryEntry | undefined;
  removedFromLibraryMessage: string;
  savedToLibraryMessage: string;
  selectedPreviewImageIndex: number;
  setError: Dispatch<SetStateAction<string | null>>;
  setStatusMessage: Dispatch<SetStateAction<string | null>>;
};

export function useImagePreviewActions({
  canUseWorkspace,
  genericError,
  librarySource = 'generated',
  previewEntry,
  removedFromLibraryMessage,
  savedToLibraryMessage,
  selectedPreviewImageIndex,
  setError,
  setStatusMessage,
}: UseImagePreviewActionsParams) {
  const { user } = useRequireAuth({ redirectIfLoggedOut: false });
  const revision = useLibraryCacheRevision(user?.id);
  const owner = useRef({ userId: user?.id });
  if (owner.current.userId !== user?.id) owner.current = { userId: user?.id };
  const [isSavingToLibrary, setIsSavingToLibrary] = useState(false);
  const [isRemovingFromLibrary, setIsRemovingFromLibrary] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const selectedPreviewImage = previewEntry?.images?.[selectedPreviewImageIndex];
  const selectedPreviewUrl = resolveStableMediaUrl(selectedPreviewImage?.url, selectedPreviewImage?.thumbUrl);
  const savedAssetLookupKey = libraryRevisionKey(buildMediaLibraryAssetsKey({
    userId: canUseWorkspace ? user?.id : null,
    kind: 'image',
    source: librarySource,
    limit: 1,
    originUrl: selectedPreviewUrl,
  }), revision);
  const {
    data: savedAssetsResponse,
  } = useSWR<MediaLibraryAssetsResponse>(savedAssetLookupKey, fetchMediaLibraryAssets);
  const savedAsset = (savedAssetsResponse?.assets[0] as LibraryAsset | undefined) ?? null;
  const isInLibrary = Boolean(savedAsset?.id);

  const handleCopy = useCallback((url: string) => {
    if (!navigator?.clipboard) {
      setCopiedUrl(url);
      return;
    }
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopiedUrl(url);
        setTimeout(() => setCopiedUrl(null), 2000);
      })
      .catch(() => setCopiedUrl(null));
  }, []);

  const handleDownload = useCallback((url: string) => {
    triggerAppDownload(url, suggestDownloadFilename(url, 'image-generation'));
  }, []);

  const handleAddToLibrary = useCallback(
    (url: string) => {
      if (!previewEntry?.id || !user?.id) return;
      const initiatedBy = user.id;
      const initiatingScope = owner.current;
      const isCurrent = () => owner.current === initiatingScope;
      if (isSavingToLibrary) return;
      if (isRemovingFromLibrary) return;
      setIsSavingToLibrary(true);
      setError(null);
      setStatusMessage(null);
      void saveImageToLibrary({
        url,
        jobId: previewEntry.jobId ?? previewEntry.id,
        label: previewEntry.prompt ?? undefined,
        source: librarySource,
      }, { fetch: (input, init) => ownedAuthFetch(input, initiatedBy, init) })
        .then(() => {
          invalidateLibraryMedia(initiatedBy);
          if (isCurrent()) setStatusMessage(savedToLibraryMessage);
        })
        .catch((error) => {
          if (isCurrent()) setError(error instanceof Error ? error.message : genericError);
        })
        .finally(() => {
          if (isCurrent()) setIsSavingToLibrary(false);
        });
    },
    [
      genericError,
      isRemovingFromLibrary,
      isSavingToLibrary,
      librarySource,
      user?.id,
      previewEntry,
      savedToLibraryMessage,
      setError,
      setStatusMessage,
    ]
  );

  const handleRemoveFromLibrary = useCallback(() => {
    if (!savedAsset?.id || !user?.id) return;
    const initiatedBy = user.id;
    const initiatingScope = owner.current;
    const isCurrent = () => owner.current === initiatingScope;
    if (isRemovingFromLibrary) return;
    if (isSavingToLibrary) return;
    setIsRemovingFromLibrary(true);
    setError(null);
    setStatusMessage(null);
    void ownedAuthFetch(`/api/media-library/assets/${encodeURIComponent(savedAsset.id)}`, initiatedBy, {
      method: 'DELETE',
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error ?? 'Failed to remove from Media');
        }
        invalidateLibraryMedia(initiatedBy);
        if (isCurrent()) setStatusMessage(removedFromLibraryMessage);
      })
      .catch((error) => {
        if (isCurrent()) setError(error instanceof Error ? error.message : genericError);
      })
      .finally(() => {
        if (isCurrent()) setIsRemovingFromLibrary(false);
      });
  }, [
    genericError,
    isRemovingFromLibrary,
    isSavingToLibrary,
    user?.id,
    removedFromLibraryMessage,
    savedAsset?.id,
    setError,
    setStatusMessage,
  ]);

  return {
    copiedUrl,
    handleAddToLibrary,
    handleCopy,
    handleDownload,
    handleRemoveFromLibrary,
    isInLibrary,
    isRemovingFromLibrary,
    isSavingToLibrary,
  };
}
