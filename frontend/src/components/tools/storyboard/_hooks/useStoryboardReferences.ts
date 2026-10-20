'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CaptureStoryboardAccountRequest } from './useStoryboardAccountScope';
import type { AssetSlotAttachment } from '@/components/AssetDropzone';
import type { EngineInputField } from '@/types/engines';
import {
  cleanupStoryboardReferenceImage,
  uploadStoryboardReferenceImage,
  type StoryboardReferenceImage,
} from '../_lib/storyboard-reference-image';
import {
  CLOSED_STORYBOARD_LIBRARY_MODAL,
  createStoryboardReferenceImageFromLibraryAsset,
  resolveStoryboardReferenceLibrarySlotIndex,
  type StoryboardLibraryAsset,
  type StoryboardLibraryModalState,
} from '../_lib/storyboard-reference-library';
import {
  STORYBOARD_REFERENCE_FIELD,
  STORYBOARD_REFERENCE_SLOT_COUNT,
} from '../_lib/storyboard-workspace-config';
import type { StoryboardCopy } from '../_lib/storyboard-workspace-copy';

export type UseStoryboardReferencesParams = {
  authenticated: boolean;
  captureAccountRequest: CaptureStoryboardAccountRequest;
  copy: StoryboardCopy;
  onAuthRequired: () => void;
  onError: (message: string) => void;
  onFeedbackReset: () => void;
};

export function useStoryboardReferences(params: UseStoryboardReferencesParams): {
  referenceImages: (StoryboardReferenceImage | null)[];
  readyReferenceImages: StoryboardReferenceImage[];
  referenceUploading: boolean;
  storyboardReferenceField: EngineInputField;
  storyboardReferenceAssets: Record<string, (AssetSlotAttachment | null)[]>;
  libraryModal: StoryboardLibraryModalState;
  handleReferenceFile: (field: EngineInputField, file: File, slotIndex?: number) => Promise<void>;
  handleRemoveReferenceSlot: (field: EngineInputField, index: number) => void;
  openReferenceLibrary: (field: EngineInputField, slotIndex?: number) => void;
  closeReferenceLibrary: () => void;
  handleReferenceLibrarySelect: (asset: StoryboardLibraryAsset) => void;
} {
  const { authenticated, captureAccountRequest, copy, onAuthRequired, onError, onFeedbackReset } = params;
  const [referenceImages, setReferenceImages] = useState<(StoryboardReferenceImage | null)[]>(
    () => Array.from({ length: STORYBOARD_REFERENCE_SLOT_COUNT }, () => null)
  );
  const [libraryModal, setLibraryModal] = useState<StoryboardLibraryModalState>(CLOSED_STORYBOARD_LIBRARY_MODAL);
  const referenceImagesRef = useRef(referenceImages);
  const uploadsRef = useRef(new Map<number, AbortController>());

  const retireUpload = (index: number) => {
    uploadsRef.current.get(index)?.abort();
    uploadsRef.current.delete(index);
  };

  referenceImagesRef.current = referenceImages;

  useEffect(() => {
    const uploads = uploadsRef.current;
    return () => {
      uploads.forEach(controller => controller.abort());
      uploads.clear();
      referenceImagesRef.current.forEach(cleanupStoryboardReferenceImage);
    };
  }, []);

  const referenceUploading = referenceImages.some((image) => image?.status === 'uploading');
  const readyReferenceImages = useMemo(
    () => referenceImages.filter((image): image is StoryboardReferenceImage => Boolean(image?.url && image.status === 'ready')),
    [referenceImages]
  );
  const storyboardReferenceField = useMemo<EngineInputField>(
    () => ({
      ...STORYBOARD_REFERENCE_FIELD,
      label: copy.referenceImageLabel,
      description: copy.referenceImageBody,
    }),
    [copy.referenceImageBody, copy.referenceImageLabel]
  );
  const storyboardReferenceAssets = useMemo<Record<string, (AssetSlotAttachment | null)[]>>(
    () => ({
      [STORYBOARD_REFERENCE_FIELD.id]: referenceImages.map((image) =>
        image
          ? {
              kind: 'image',
              name: image.name ?? copy.referenceSlotNameFallback,
              size: image.size ?? 0,
              type: image.type ?? 'image/*',
              previewUrl: image.previewUrl,
              status: image.status,
              error: image.error ?? undefined,
            }
          : null
      ),
    }),
    [copy.referenceSlotNameFallback, referenceImages]
  );

  async function handleReferenceFile(_field: EngineInputField, file: File, slotIndex = 0) {
    const account = captureAccountRequest();
    if (!authenticated || !account) {
      onAuthRequired();
      return;
    }

    retireUpload(slotIndex);
    const controller = new AbortController();
    uploadsRef.current.set(slotIndex, controller);
    const abort = () => controller.abort();
    account.signal.addEventListener('abort', abort, { once: true });
    const request = {
      ...account,
      signal: controller.signal,
      isCurrent: () => account.isCurrent() && uploadsRef.current.get(slotIndex) === controller && !controller.signal.aborted,
    };

    const previewUrl = URL.createObjectURL(file);
    onFeedbackReset();
    setReferenceImages((current) => {
      const next = current.slice();
      cleanupStoryboardReferenceImage(next[slotIndex] ?? null);
      next[slotIndex] = {
        url: previewUrl,
        previewUrl,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'uploading',
      };
      return next;
    });
    try {
      const uploaded = await uploadStoryboardReferenceImage(file, copy, () => {
        if (!request.isCurrent()) return null;
        const currentAccount = captureAccountRequest();
        return currentAccount ? { ...currentAccount, signal: controller.signal, isCurrent: request.isCurrent } : null;
      });
      if (!request.isCurrent()) return;
      setReferenceImages((current) => {
        if (!request.isCurrent()) return current;
        const next = current.slice();
        next[slotIndex] = { ...uploaded, previewUrl, size: file.size, type: file.type, status: 'ready' };
        return next;
      });
    } catch (uploadError) {
      if (!request.isCurrent()) return;
      const messageText = uploadError instanceof Error ? uploadError.message : copy.uploadFailed;
      setReferenceImages((current) => {
        if (!request.isCurrent()) return current;
        const next = current.slice();
        next[slotIndex] = {
          url: previewUrl,
          previewUrl,
          name: file.name,
          size: file.size,
          type: file.type,
          status: 'error',
          error: messageText,
        };
        return next;
      });
      onError(messageText);
    } finally {
      account.signal.removeEventListener('abort', abort);
    }
  }

  function handleRemoveReferenceSlot(_field: EngineInputField, index: number) {
    retireUpload(index);
    setReferenceImages((current) => {
      const next = current.slice();
      cleanupStoryboardReferenceImage(next[index] ?? null);
      next[index] = null;
      return next;
    });
  }

  function openReferenceLibrary(_field: EngineInputField, slotIndex = 0) {
    if (!authenticated) {
      onAuthRequired();
      return;
    }
    onFeedbackReset();
    setLibraryModal({
      open: true,
      slotIndex,
      selectionMode: 'reference',
      initialSource: 'all',
    });
  }

  function closeReferenceLibrary() {
    setLibraryModal(CLOSED_STORYBOARD_LIBRARY_MODAL);
  }

  function handleReferenceLibrarySelect(asset: StoryboardLibraryAsset) {
    if (!asset.url) return;
    const slotIndex = resolveStoryboardReferenceLibrarySlotIndex(
      referenceImages,
      libraryModal.slotIndex,
      STORYBOARD_REFERENCE_SLOT_COUNT
    );
    retireUpload(slotIndex);
    onFeedbackReset();
    setReferenceImages((current) => {
      const next = current.slice();
      cleanupStoryboardReferenceImage(next[slotIndex] ?? null);
      next[slotIndex] = createStoryboardReferenceImageFromLibraryAsset(asset, copy.referenceSlotNameFallback);
      return next;
    });
    closeReferenceLibrary();
  }

  return {
    referenceImages,
    readyReferenceImages,
    referenceUploading,
    storyboardReferenceField,
    storyboardReferenceAssets,
    libraryModal,
    handleReferenceFile,
    handleRemoveReferenceSlot,
    openReferenceLibrary,
    closeReferenceLibrary,
    handleReferenceLibrarySelect,
  };
}
