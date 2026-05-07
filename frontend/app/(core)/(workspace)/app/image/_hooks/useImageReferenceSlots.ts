import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type { CharacterReferenceSelection, ImageGenerationMode } from '@/types/image-generation';
import type { EngineCaps } from '@/types/engines';
import { prepareImageFileForUpload } from '@/lib/client-image-upload';
import { authFetch } from '@/lib/authFetch';
import {
  inferImageFormatFromUrl,
  isSupportedImageFormat,
  isSupportedImageMime,
} from '@/lib/image/formats';
import { getReferenceConstraints } from '@/lib/image/inputSchema';
import { createCharacterReferenceSlot } from '../_lib/image-workspace-character-references';
import { formatTemplate, type ImageWorkspaceCopy } from '../_lib/image-workspace-copy';
import {
  DEFAULT_UPLOAD_LIMIT_MB,
  DEFAULT_VISIBLE_REFERENCE_SLOTS,
  MAX_REFERENCE_SLOTS,
  type ImageLibraryModalState,
  type LibraryAsset,
  type PersistedReferenceSlot,
  type ReferenceSlotValue,
  type UploadFailure,
} from '../_lib/image-workspace-types';

type UseImageReferenceSlotsParams = {
  autoModeFromReferences: boolean;
  mode: ImageGenerationMode;
  resolvedCopy: ImageWorkspaceCopy;
  selectedEngineCaps?: EngineCaps;
  setError: Dispatch<SetStateAction<string | null>>;
  supportedReferenceFormats: string[];
  supportedReferenceFormatsLabel: string;
  toolsEnabled: boolean;
};

function cleanupSlotPreview(slot: ReferenceSlotValue | null) {
  if (slot?.previewUrl && slot.previewUrl.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(slot.previewUrl);
    } catch {}
  }
}

export function useImageReferenceSlots({
  autoModeFromReferences,
  mode,
  resolvedCopy,
  selectedEngineCaps,
  setError,
  supportedReferenceFormats,
  supportedReferenceFormatsLabel,
  toolsEnabled,
}: UseImageReferenceSlotsParams) {
  const [referenceSlots, setReferenceSlots] = useState<(ReferenceSlotValue | null)[]>(
    Array(MAX_REFERENCE_SLOTS).fill(null)
  );
  const [areReferenceSlotsExpanded, setAreReferenceSlotsExpanded] = useState(false);
  const [libraryModal, setLibraryModal] = useState<ImageLibraryModalState>({
    open: false,
    slotIndex: null,
    selectionMode: 'reference',
    initialSource: 'all',
  });

  const referenceConstraints = useMemo(
    () =>
      selectedEngineCaps
        ? getReferenceConstraints(selectedEngineCaps, mode)
        : { min: mode === 'i2i' ? 1 : 0, max: 4, requires: mode === 'i2i' },
    [selectedEngineCaps, mode]
  );
  const referenceMinRequired = referenceConstraints.min;
  const referencePickerConstraints = useMemo(
    () =>
      autoModeFromReferences && selectedEngineCaps
        ? getReferenceConstraints(selectedEngineCaps, 'i2i')
        : referenceConstraints,
    [autoModeFromReferences, referenceConstraints, selectedEngineCaps]
  );
  const baseReferenceSlotLimit = Math.min(MAX_REFERENCE_SLOTS, referencePickerConstraints.max);
  const supportsCharacterReferences = toolsEnabled && baseReferenceSlotLimit > 0;
  const visibleReferenceSlots = useMemo(
    () => referenceSlots.slice(0, baseReferenceSlotLimit),
    [baseReferenceSlotLimit, referenceSlots]
  );
  const referenceSizeSignature = useMemo(
    () =>
      visibleReferenceSlots
        .filter((slot): slot is ReferenceSlotValue => Boolean(slot && slot.status === 'ready'))
        .map((slot) => `${slot.width ?? ''}x${slot.height ?? ''}`)
        .join('|'),
    [visibleReferenceSlots]
  );
  const selectedCharacterReferences = useMemo(
    () =>
      visibleReferenceSlots.reduce<CharacterReferenceSelection[]>((acc, slot) => {
        if (slot?.characterReference) {
          acc.push(slot.characterReference);
        }
        return acc;
      }, []),
    [visibleReferenceSlots]
  );
  const totalRegularReferenceSelections = useMemo(
    () => visibleReferenceSlots.filter((slot) => Boolean(slot && !slot.characterReference)).length,
    [visibleReferenceSlots]
  );
  const characterSelectionLimit = useMemo(
    () =>
      supportsCharacterReferences
        ? Math.max(0, baseReferenceSlotLimit - totalRegularReferenceSelections)
        : 0,
    [baseReferenceSlotLimit, supportsCharacterReferences, totalRegularReferenceSelections]
  );
  const referenceSlotLimit = baseReferenceSlotLimit;
  const canCollapseReferenceSlots = referenceSlotLimit > DEFAULT_VISIBLE_REFERENCE_SLOTS;
  const displayedReferenceSlotCount =
    canCollapseReferenceSlots && !areReferenceSlotsExpanded
      ? DEFAULT_VISIBLE_REFERENCE_SLOTS
      : referenceSlotLimit;
  const displayedReferenceSlots = useMemo(
    () => visibleReferenceSlots.slice(0, displayedReferenceSlotCount),
    [displayedReferenceSlotCount, visibleReferenceSlots]
  );
  const collapsedReferenceSlotCount = Math.max(referenceSlotLimit - displayedReferenceSlotCount, 0);
  const hasCollapsedReferenceContent = useMemo(
    () =>
      referenceSlots
        .slice(DEFAULT_VISIBLE_REFERENCE_SLOTS, referenceSlotLimit)
        .some((slot) => Boolean(slot)),
    [referenceSlotLimit, referenceSlots]
  );
  const referenceHelperText = useMemo(
    () => formatTemplate(resolvedCopy.composer.referenceHelper, { count: referenceSlotLimit }),
    [referenceSlotLimit, resolvedCopy.composer.referenceHelper]
  );
  const referenceToggleLabel = useMemo(
    () =>
      areReferenceSlotsExpanded
        ? resolvedCopy.composer.referenceCollapse
        : formatTemplate(resolvedCopy.composer.referenceExpand, { count: collapsedReferenceSlotCount }),
    [
      areReferenceSlotsExpanded,
      collapsedReferenceSlotCount,
      resolvedCopy.composer.referenceCollapse,
      resolvedCopy.composer.referenceExpand,
    ]
  );
  const readyReferenceUrls = useMemo(
    () =>
      visibleReferenceSlots
        .filter((slot): slot is ReferenceSlotValue => Boolean(slot && slot.status === 'ready'))
        .map((slot) => slot.url),
    [visibleReferenceSlots]
  );
  const readyReferenceSizes = useMemo(
    () =>
      visibleReferenceSlots
        .filter((slot): slot is ReferenceSlotValue => Boolean(slot && slot.status === 'ready'))
        .map((slot) => ({ width: slot.width ?? null, height: slot.height ?? null })),
    [visibleReferenceSlots]
  );
  const combinedReferenceUrls = readyReferenceUrls;
  const hasAnyReferenceSelection = useMemo(
    () => visibleReferenceSlots.some((slot) => Boolean(slot)),
    [visibleReferenceSlots]
  );
  const persistableReferenceSlots = useMemo<PersistedReferenceSlot[]>(
    () =>
      referenceSlots.slice(0, MAX_REFERENCE_SLOTS).map((slot) => {
        if (!slot || slot.status !== 'ready') return null;
        const url = slot.url?.trim?.() ?? '';
        if (!url || url.startsWith('blob:')) return null;
        return {
          url,
          source: slot.source,
          width: slot.width ?? null,
          height: slot.height ?? null,
          characterReference: slot.characterReference
            ? {
                id: slot.characterReference.id,
                jobId: slot.characterReference.jobId,
                imageUrl: slot.characterReference.imageUrl,
                thumbUrl: slot.characterReference.thumbUrl ?? null,
                prompt: slot.characterReference.prompt ?? null,
                createdAt: slot.characterReference.createdAt ?? null,
                engineLabel: slot.characterReference.engineLabel ?? null,
                outputMode: slot.characterReference.outputMode ?? null,
                action: slot.characterReference.action ?? null,
              }
            : null,
        };
      }),
    [referenceSlots]
  );

  useEffect(() => {
    setReferenceSlots((previous) => {
      let mutated = false;
      const next = previous.slice();
      for (let index = baseReferenceSlotLimit; index < next.length; index += 1) {
        if (next[index]) {
          cleanupSlotPreview(next[index]);
          next[index] = null;
          mutated = true;
        }
      }
      return mutated ? next : previous;
    });
  }, [baseReferenceSlotLimit]);

  useEffect(() => {
    if (!canCollapseReferenceSlots && areReferenceSlotsExpanded) {
      setAreReferenceSlotsExpanded(false);
    }
  }, [areReferenceSlotsExpanded, canCollapseReferenceSlots]);

  useEffect(() => {
    if (!areReferenceSlotsExpanded && hasCollapsedReferenceContent) {
      setAreReferenceSlotsExpanded(true);
    }
  }, [areReferenceSlotsExpanded, hasCollapsedReferenceContent]);

  const showUnsupportedFormatError = useCallback(() => {
    setError(
      formatTemplate(resolvedCopy.errors.unsupportedFormat, {
        formats: supportedReferenceFormatsLabel || 'JPG, JPEG, PNG, WEBP',
      })
    );
  }, [resolvedCopy.errors.unsupportedFormat, setError, supportedReferenceFormatsLabel]);

  const isSupportedReferenceAsset = useCallback(
    (mime?: string | null, locator?: string | null) => {
      if (!supportedReferenceFormats.length) return true;
      const supportedByMime = isSupportedImageMime(supportedReferenceFormats, mime);
      if (supportedByMime != null) {
        return supportedByMime;
      }
      const inferredFormat = inferImageFormatFromUrl(locator);
      if (!inferredFormat) {
        return true;
      }
      return isSupportedImageFormat(supportedReferenceFormats, inferredFormat);
    },
    [supportedReferenceFormats]
  );

  const handleRemoveReferenceSlot = useCallback((index: number) => {
    setReferenceSlots((previous) => {
      const next = previous.slice();
      cleanupSlotPreview(next[index]);
      next[index] = null;
      return next;
    });
  }, []);

  const handleReferenceFile = useCallback(
    async (index: number, file: File | null) => {
      if (!file) {
        return;
      }
      if (!file.type.startsWith('image/')) {
        setError(resolvedCopy.errors.onlyImages);
        return;
      }
      const tempUrl = URL.createObjectURL(file);
      const slotId = crypto.randomUUID();
      setReferenceSlots((previous) => {
        const next = previous.slice();
        cleanupSlotPreview(next[index]);
        next[index] = {
          id: slotId,
          url: tempUrl,
          previewUrl: tempUrl,
          name: file.name,
          status: 'uploading',
          source: 'upload',
        };
        return next;
      });
      try {
        const preparedFile = await prepareImageFileForUpload(file, {
          maxBytes: DEFAULT_UPLOAD_LIMIT_MB * 1024 * 1024,
        });
        const formData = new FormData();
        formData.append('file', preparedFile, preparedFile.name);
        const response = await authFetch('/api/uploads/image', {
          method: 'POST',
          body: formData,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok) {
          const uploadError = new Error(
            typeof payload?.error === 'string' ? payload.error : 'UPLOAD_FAILED'
          ) as UploadFailure;
          uploadError.code = typeof payload?.error === 'string' ? payload.error : 'UPLOAD_FAILED';
          if (typeof payload?.maxMB === 'number') {
            uploadError.maxMB = payload.maxMB;
          }
          throw uploadError;
        }
        const asset = payload.asset as {
          id: string;
          url: string;
          width?: number | null;
          height?: number | null;
        };
        setReferenceSlots((previous) => {
          const next = previous.slice();
          const current = next[index];
          if (!current || current.id !== slotId) {
            return previous;
          }
          next[index] = {
            id: slotId,
            url: asset.url,
            previewUrl: asset.url,
            name: file.name,
            status: 'ready',
            source: 'upload',
            width: asset.width ?? null,
            height: asset.height ?? null,
          };
          if (current.previewUrl && current.previewUrl !== asset.url) {
            try {
              URL.revokeObjectURL(current.previewUrl);
            } catch {}
          }
          return next;
        });
      } catch (uploadError) {
        console.error('[image-workspace] reference upload failed', uploadError);
        setReferenceSlots((previous) => {
          const next = previous.slice();
          const current = next[index];
          if (current?.previewUrl) {
            try {
              URL.revokeObjectURL(current.previewUrl);
            } catch {}
          }
          next[index] = null;
          return next;
        });
        const failure = uploadError as UploadFailure;
        const code = failure?.code;
        if (code === 'FILE_TOO_LARGE') {
          const limit =
            typeof failure?.maxMB === 'number' && Number.isFinite(failure.maxMB)
              ? failure.maxMB
              : DEFAULT_UPLOAD_LIMIT_MB;
          setError(formatTemplate(resolvedCopy.errors.fileTooLarge, { maxMB: limit }));
        } else if (code === 'UNAUTHORIZED') {
          setError(resolvedCopy.errors.unauthorized);
        } else {
          setError(resolvedCopy.errors.uploadFailed);
        }
      }
    },
    [
      resolvedCopy.errors.fileTooLarge,
      resolvedCopy.errors.onlyImages,
      resolvedCopy.errors.unauthorized,
      resolvedCopy.errors.uploadFailed,
      setError,
    ]
  );

  const handleReferenceUrl = useCallback(
    (index: number, url: string, source: ReferenceSlotValue['source']) => {
      if (!url) return;
      if (!isSupportedReferenceAsset(null, url)) {
        showUnsupportedFormatError();
        return;
      }
      setReferenceSlots((previous) => {
        const next = previous.slice();
        cleanupSlotPreview(next[index]);
        next[index] = {
          id: crypto.randomUUID(),
          url,
          previewUrl: url,
          status: 'ready',
          source: source ?? 'paste',
        };
        return next;
      });
    },
    [isSupportedReferenceAsset, showUnsupportedFormatError]
  );

  const resolveTargetReferenceSlotIndex = useCallback(
    (preferredIndex: number | null = null) => {
      if (preferredIndex != null && preferredIndex >= 0 && preferredIndex < referenceSlotLimit) {
        return preferredIndex;
      }
      const emptyIndex = referenceSlots.slice(0, referenceSlotLimit).findIndex((slot) => slot === null);
      if (emptyIndex >= 0) {
        return emptyIndex;
      }
      return Math.max(0, referenceSlotLimit - 1);
    },
    [referenceSlotLimit, referenceSlots]
  );

  const closeLibraryModal = useCallback(() => {
    setLibraryModal({ open: false, slotIndex: null, selectionMode: 'reference', initialSource: 'all' });
  }, []);

  const openCharacterLibrary = useCallback(() => {
    setLibraryModal({
      open: true,
      slotIndex: null,
      selectionMode: 'character',
      initialSource: 'character',
    });
  }, []);

  const handleLibrarySelect = useCallback(
    (asset: LibraryAsset) => {
      if (!isSupportedReferenceAsset(asset.mime, asset.url)) {
        showUnsupportedFormatError();
        return;
      }
      const slotIndex = resolveTargetReferenceSlotIndex(libraryModal.slotIndex);
      if (slotIndex >= referenceSlotLimit) {
        closeLibraryModal();
        return;
      }
      const index = slotIndex;
      if (index >= DEFAULT_VISIBLE_REFERENCE_SLOTS && canCollapseReferenceSlots) {
        setAreReferenceSlotsExpanded(true);
      }
      setReferenceSlots((previous) => {
        const next = previous.slice();
        cleanupSlotPreview(next[index]);
        next[index] = {
          id: asset.id,
          url: asset.url,
          previewUrl: asset.url,
          status: 'ready',
          source: 'library',
          width: asset.width ?? null,
          height: asset.height ?? null,
        };
        return next;
      });
      closeLibraryModal();
    },
    [
      canCollapseReferenceSlots,
      closeLibraryModal,
      isSupportedReferenceAsset,
      libraryModal.slotIndex,
      referenceSlotLimit,
      resolveTargetReferenceSlotIndex,
      showUnsupportedFormatError,
    ]
  );

  const openLibraryForSlot = useCallback((index: number) => {
    setLibraryModal({ open: true, slotIndex: index, selectionMode: 'reference', initialSource: 'all' });
  }, []);

  const toggleCharacterReference = useCallback(
    (reference: CharacterReferenceSelection) => {
      if (!supportsCharacterReferences) {
        return;
      }
      const existingIndex = referenceSlots.findIndex((slot) => slot?.characterReference?.id === reference.id);
      if (existingIndex >= 0) {
        setReferenceSlots((previous) => {
          const next = previous.slice();
          cleanupSlotPreview(next[existingIndex]);
          next[existingIndex] = null;
          return next;
        });
        return;
      }
      if (selectedCharacterReferences.length >= characterSelectionLimit) {
        return;
      }
      const nextIndex = resolveTargetReferenceSlotIndex(libraryModal.slotIndex);
      if (nextIndex >= referenceSlotLimit) {
        return;
      }
      if (nextIndex >= DEFAULT_VISIBLE_REFERENCE_SLOTS && canCollapseReferenceSlots) {
        setAreReferenceSlotsExpanded(true);
      }
      setReferenceSlots((previous) => {
        const next = previous.slice();
        cleanupSlotPreview(next[nextIndex]);
        next[nextIndex] = createCharacterReferenceSlot(reference);
        return next;
      });
    },
    [
      canCollapseReferenceSlots,
      characterSelectionLimit,
      libraryModal.slotIndex,
      referenceSlotLimit,
      referenceSlots,
      resolveTargetReferenceSlotIndex,
      selectedCharacterReferences.length,
      supportsCharacterReferences,
    ]
  );

  return {
    canCollapseReferenceSlots,
    characterSelectionLimit,
    closeLibraryModal,
    combinedReferenceUrls,
    displayedReferenceSlotCount,
    displayedReferenceSlots,
    handleLibrarySelect,
    handleReferenceFile,
    handleReferenceUrl,
    handleRemoveReferenceSlot,
    hasAnyReferenceSelection,
    libraryModal,
    openCharacterLibrary,
    openLibraryForSlot,
    persistableReferenceSlots,
    readyReferenceSizes,
    readyReferenceUrls,
    referenceHelperText,
    referenceMinRequired,
    referenceSizeSignature,
    referenceSlotLimit,
    referenceToggleLabel,
    selectedCharacterReferences,
    setAreReferenceSlotsExpanded,
    setReferenceSlots,
    supportsCharacterReferences,
    toggleCharacterReference,
  };
}
