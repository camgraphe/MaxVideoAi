"use client";

import {
  useCallback,
  type ChangeEvent,
  type ClipboardEvent as ReactClipboardEvent,
  type DragEvent as ReactDragEvent,
  type RefObject,
} from 'react';
import type { AngleToolResponse } from '@/types/tools-angle';
import {
  cleanupSourcePreview,
  uploadImage,
} from '@/components/tools/angle/_lib/angle-workspace-helpers';
import type { AngleCopy } from '@/components/tools/angle/_lib/angle-workspace-copy';
import type { LibraryAsset, UploadedImage } from '@/components/tools/angle/_lib/angle-workspace-types';

type UseAngleSourceImageHandlersOptions = {
  copy: AngleCopy;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onAuthRequired: () => void;
  setError: (value: string | null) => void;
  setGuestExampleDismissed: (value: boolean) => void;
  setLibraryModalOpen: (value: boolean) => void;
  setResult: (value: AngleToolResponse | null) => void;
  setSelectedOutputIndex: (value: number) => void;
  setSourceDragActive: (value: boolean) => void;
  setSourceImage: (updater: (previous: UploadedImage | null) => UploadedImage | null) => void;
  setUploading: (value: boolean) => void;
  userPresent: boolean;
};

export function useAngleSourceImageHandlers({
  copy,
  fileInputRef,
  onAuthRequired,
  setError,
  setGuestExampleDismissed,
  setLibraryModalOpen,
  setResult,
  setSelectedOutputIndex,
  setSourceDragActive,
  setSourceImage,
  setUploading,
  userPresent,
}: UseAngleSourceImageHandlersOptions) {
  const resetResultSelection = useCallback(() => {
    setResult(null);
    setSelectedOutputIndex(0);
  }, [setResult, setSelectedOutputIndex]);

  const handleSourceFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      if (!userPresent) {
        onAuthRequired();
        return;
      }
      const localPreviewUrl = URL.createObjectURL(file);
      setUploading(true);
      setError(null);

      try {
        const uploaded = await uploadImage(file, copy);
        setSourceImage((previous) => {
          cleanupSourcePreview(previous);
          return {
            ...uploaded,
            previewUrl: localPreviewUrl,
            source: 'upload',
          };
        });
        resetResultSelection();
      } catch (uploadError) {
        cleanupSourcePreview({ url: '', previewUrl: localPreviewUrl });
        setError(uploadError instanceof Error ? uploadError.message : copy.uploadFailed);
      } finally {
        setUploading(false);
      }
    },
    [copy, onAuthRequired, resetResultSelection, setError, setSourceImage, setUploading, userPresent]
  );

  const handleFileSelect = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      event.target.value = '';
      await handleSourceFile(file);
    },
    [handleSourceFile]
  );

  const handleSourceUrl = useCallback(
    (url: string, source: UploadedImage['source']) => {
      const trimmed = url.trim();
      if (!/^https?:\/\//i.test(trimmed)) {
        setError(copy.invalidUrl);
        return;
      }
      setError(null);
      setSourceImage((previous) => {
        cleanupSourcePreview(previous);
        return {
          id: crypto.randomUUID(),
          url: trimmed,
          previewUrl: trimmed,
          name: trimmed.split('/').pop() ?? copy.referenceName,
          source,
        };
      });
      resetResultSelection();
    },
    [copy.invalidUrl, copy.referenceName, resetResultSelection, setError, setSourceImage]
  );

  const handleSourceDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setSourceDragActive(false);
      const files = event.dataTransfer.files;
      if (files && files.length) {
        void handleSourceFile(files[0]);
        return;
      }
      const uri = event.dataTransfer.getData('text/uri-list') || event.dataTransfer.getData('text/plain');
      if (uri && /^https?:\/\//i.test(uri.trim())) {
        handleSourceUrl(uri, 'paste');
      }
    },
    [handleSourceFile, handleSourceUrl, setSourceDragActive]
  );

  const handleSourcePaste = useCallback(
    (event: ReactClipboardEvent<HTMLDivElement>) => {
      const clipboard = event.clipboardData;
      if (!clipboard) return;
      const items = clipboard.items;
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          event.preventDefault();
          const file = item.getAsFile();
          void handleSourceFile(file);
          return;
        }
      }
      const text = clipboard.getData('text/plain');
      if (text && /^https?:\/\//i.test(text.trim())) {
        event.preventDefault();
        handleSourceUrl(text, 'paste');
      }
    },
    [handleSourceFile, handleSourceUrl]
  );

  const handleLibrarySelect = useCallback(
    (asset: LibraryAsset) => {
      if (!userPresent) {
        onAuthRequired();
        return;
      }
      setSourceImage((previous) => {
        cleanupSourcePreview(previous);
        return {
          id: asset.id,
          url: asset.url,
          previewUrl: asset.url,
          width: asset.width,
          height: asset.height,
          name: asset.url.split('/').pop() ?? copy.libraryImageName,
          source: 'library',
        };
      });
      resetResultSelection();
      setError(null);
      setLibraryModalOpen(false);
    },
    [copy.libraryImageName, onAuthRequired, resetResultSelection, setError, setLibraryModalOpen, setSourceImage, userPresent]
  );

  const handleRemoveSource = useCallback(() => {
    setSourceImage((previous) => {
      cleanupSourcePreview(previous);
      return null;
    });
    resetResultSelection();
    if (!userPresent) {
      setGuestExampleDismissed(true);
    }
  }, [resetResultSelection, setGuestExampleDismissed, setSourceImage, userPresent]);

  const handleUploadRequest = useCallback(() => {
    if (!userPresent) {
      onAuthRequired();
      return;
    }
    fileInputRef.current?.click();
  }, [fileInputRef, onAuthRequired, userPresent]);

  return {
    handleFileSelect,
    handleLibrarySelect,
    handleRemoveSource,
    handleSourceDrop,
    handleSourcePaste,
    handleUploadRequest,
  };
}
