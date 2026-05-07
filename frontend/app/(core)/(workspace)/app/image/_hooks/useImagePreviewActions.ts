import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import useSWR from 'swr';
import { saveImageToLibrary } from '@/lib/api';
import { authFetch } from '@/lib/authFetch';
import { suggestDownloadFilename, triggerAppDownload } from '@/lib/download';
import type {
  AssetsResponse,
  HistoryEntry,
  LibraryAsset,
} from '../_lib/image-workspace-types';

type UseImagePreviewActionsParams = {
  canUseWorkspace: boolean;
  genericError: string;
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
  previewEntry,
  removedFromLibraryMessage,
  savedToLibraryMessage,
  selectedPreviewImageIndex,
  setError,
  setStatusMessage,
}: UseImagePreviewActionsParams) {
  const [isSavingToLibrary, setIsSavingToLibrary] = useState(false);
  const [isRemovingFromLibrary, setIsRemovingFromLibrary] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const selectedPreviewUrl = previewEntry?.images?.[selectedPreviewImageIndex]?.url ?? null;
  const savedAssetLookupKey =
    canUseWorkspace && selectedPreviewUrl
      ? `/api/user-assets?limit=1&source=generated&originUrl=${encodeURIComponent(selectedPreviewUrl)}`
      : null;
  const {
    data: savedAssets,
    mutate: mutateSavedAssets,
  } = useSWR(savedAssetLookupKey, async (url: string) => {
    const response = await authFetch(url);
    const payload = (await response.json().catch(() => null)) as AssetsResponse | null;
    if (!response.ok || !payload?.ok) {
      let message: string | undefined;
      if (payload && typeof payload === 'object' && 'error' in payload) {
        const maybeError = (payload as { error?: unknown }).error;
        if (typeof maybeError === 'string') {
          message = maybeError;
        }
      }
      throw new Error(message ?? 'Failed to load library');
    }
    return payload.assets;
  });
  const savedAsset = (savedAssets?.[0] as LibraryAsset | undefined) ?? null;
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
      if (!previewEntry?.id) return;
      if (isSavingToLibrary) return;
      if (isRemovingFromLibrary) return;
      setIsSavingToLibrary(true);
      setError(null);
      setStatusMessage(null);
      void saveImageToLibrary({
        url,
        jobId: previewEntry.jobId ?? previewEntry.id,
        label: previewEntry.prompt ?? undefined,
      })
        .then(() => {
          setStatusMessage(savedToLibraryMessage);
          void mutateSavedAssets();
        })
        .catch((error) => {
          setError(error instanceof Error ? error.message : genericError);
        })
        .finally(() => {
          setIsSavingToLibrary(false);
        });
    },
    [
      genericError,
      isRemovingFromLibrary,
      isSavingToLibrary,
      mutateSavedAssets,
      previewEntry,
      savedToLibraryMessage,
      setError,
      setStatusMessage,
    ]
  );

  const handleRemoveFromLibrary = useCallback(() => {
    if (!savedAsset?.id) return;
    if (isRemovingFromLibrary) return;
    if (isSavingToLibrary) return;
    setIsRemovingFromLibrary(true);
    setError(null);
    setStatusMessage(null);
    void authFetch('/api/user-assets', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: savedAsset.id }),
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error ?? 'Failed to remove from library');
        }
        setStatusMessage(removedFromLibraryMessage);
        void mutateSavedAssets();
      })
      .catch((error) => {
        setError(error instanceof Error ? error.message : genericError);
      })
      .finally(() => {
        setIsRemovingFromLibrary(false);
      });
  }, [
    genericError,
    isRemovingFromLibrary,
    isSavingToLibrary,
    mutateSavedAssets,
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
