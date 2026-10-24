import { useWorkspaceAssetLifetime } from './useWorkspaceAssetLifetime';
import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { KlingElementAsset, KlingElementState } from '@/components/KlingElementsBuilder';
import { useWorkspaceUploadOperation } from './useWorkspaceUploadOperation';
import { uploadVideoFile } from '@/lib/client-video-upload';
import { prepareImageFileForUpload, readImageFileDimensions } from '@/lib/client-image-upload';
import { getKlingElementMediaEligibility } from '@/lib/media-input-eligibility';
import { mediaInputEligibilityMessage } from '@/components/library/media-input-eligibility-copy';
import type { Mode } from '@/types/engines';
import {
  buildKlingLibraryAsset,
  insertKlingLibraryAsset,
  revokeKlingAssetPreview,
  type AssetLibrarySource,
  type AssetPickerTarget,
  type UserAsset,
} from '../_lib/workspace-assets';
import { createKlingElement, createLocalId } from '../_lib/workspace-input-helpers';
import {
  createUploadFailure,
  getUploadFailureMessage,
  type UploadFailure,
} from '../_lib/workspace-upload-errors';

const slotKey = (elementId: string, slot: string, index?: number) => JSON.stringify([elementId, slot, index]);
type SlotOperation = { assetId: string; cancel: () => void };
function retireSlot(operations: Map<string, SlotOperation>, key: string) {
  operations.get(key)?.cancel();
  operations.delete(key);
}

type UseWorkspaceKlingElementAssetsOptions = {
  accountScope?: string | null;
  engineId?: string | null;
  preferredMode?: Mode;
  locale?: string;
  showNotice: (message: string) => void;
  klingElements: KlingElementState[];
  setKlingElements: Dispatch<SetStateAction<KlingElementState[]>>;
  assetLibrarySource: AssetLibrarySource;
  resetAssetLibraryForSource: (nextSource: AssetLibrarySource) => void;
  setAssetPickerTarget: Dispatch<SetStateAction<AssetPickerTarget | null>>;
};

export function useWorkspaceKlingElementAssets({
  accountScope,
  engineId,
  preferredMode,
  locale,
  showNotice,
  klingElements,
  setKlingElements,
  assetLibrarySource,
  resetAssetLibraryForSource,
  setAssetPickerTarget,
}: UseWorkspaceKlingElementAssetsOptions) {
  const accountValid = useWorkspaceAssetLifetime(accountScope);
  const valid = useWorkspaceAssetLifetime(accountScope === null ? null : JSON.stringify([accountScope ?? 'legacy', engineId, preferredMode]));
  const beginUpload = useWorkspaceUploadOperation(accountScope, valid);
  const klingElementsRef = useRef<KlingElementState[]>(klingElements);
  const slotOperations = useRef(new Map<string, SlotOperation>());

  useEffect(() => {
    const operations = slotOperations.current;
    return () => {
      if (!accountValid()) return;
      const retiredIds = new Set(Array.from(operations.values(), operation => operation.assetId));
      operations.forEach(operation => operation.cancel());
      operations.clear();
      if (!retiredIds.size) return;
      setKlingElements(previous => previous.map(element => {
        const keep = (asset: KlingElementAsset | null) => {
          if (!asset || !retiredIds.has(asset.id)) return asset;
          revokeKlingAssetPreview(asset);
          return null;
        };
        return { ...element, frontal: keep(element.frontal), video: keep(element.video), references: element.references.map(keep) };
      }));
    };
  }, [valid, accountValid, setKlingElements]);

  useEffect(() => {
    klingElementsRef.current = klingElements;
  }, [klingElements]);

  useEffect(() => {
    return () => {
      klingElementsRef.current.forEach((element) => {
        revokeKlingAssetPreview(element.frontal);
        element.references.forEach((asset) => revokeKlingAssetPreview(asset));
        revokeKlingAssetPreview(element.video);
      });
    };
  }, []);

  const handleOpenKlingAssetLibrary = useCallback(
    (elementId: string, slot: 'frontal' | 'reference' | 'video', slotIndex?: number) => {
      if (!valid()) return;
      const nextSource = slot === 'video' ? 'recent' : 'all';
      if (assetLibrarySource !== nextSource) {
        resetAssetLibraryForSource(nextSource);
      }
      setAssetPickerTarget({ kind: 'kling', elementId, slot, slotIndex });
    },
    [valid, assetLibrarySource, resetAssetLibraryForSource, setAssetPickerTarget],
  );

  const handleSelectKlingLibraryAsset = useCallback(
    (target: Extract<AssetPickerTarget, { kind: 'kling' }>, asset: UserAsset) => {
      if (!valid()) return;
      const eligibility = getKlingElementMediaEligibility(asset, target.slot);
      if (eligibility.status === 'blocked') return mediaInputEligibilityMessage(eligibility, locale)!;
      retireSlot(slotOperations.current, slotKey(target.elementId, target.slot, target.slotIndex));
      const newAsset = buildKlingLibraryAsset(asset);
      setKlingElements((previous) =>
        insertKlingLibraryAsset(previous, target, newAsset, revokeKlingAssetPreview),
      );

      setAssetPickerTarget(null);
    },
    [valid, locale, setAssetPickerTarget, setKlingElements],
  );

  const handleKlingElementAdd = useCallback(() => {
    if (!valid()) return;
    setKlingElements((previous) => [...previous, createKlingElement()]);
  }, [valid, setKlingElements]);

  const handleKlingElementRemove = useCallback(
    (id: string) => {
      if (!valid()) return;
      for (const key of slotOperations.current.keys()) {
        if (JSON.parse(key)[0] === id) retireSlot(slotOperations.current, key);
      }
      setKlingElements((previous) => {
        const next = previous.filter((element) => element.id !== id);
        return next.length ? next : [createKlingElement()];
      });
    },
    [valid, setKlingElements],
  );

  const handleKlingElementAssetRemove = useCallback(
    (elementId: string, slot: 'frontal' | 'reference' | 'video', index?: number) => {
      if (!valid()) return;
      retireSlot(slotOperations.current, slotKey(elementId, slot, index));
      setKlingElements((previous) =>
        previous.map((element) => {
          if (element.id !== elementId) return element;
          if (slot === 'frontal') {
            revokeKlingAssetPreview(element.frontal);
            return { ...element, frontal: null };
          }
          if (slot === 'video') {
            revokeKlingAssetPreview(element.video);
            return { ...element, video: null };
          }
          const references = [...element.references];
          if (typeof index === 'number' && index >= 0 && index < references.length) {
            revokeKlingAssetPreview(references[index]);
            references[index] = null;
          }
          return { ...element, references };
        }),
      );
    },
    [valid, setKlingElements],
  );

  const handleKlingElementAssetAdd = useCallback(
    (elementId: string, slot: 'frontal' | 'reference' | 'video', file: File, index?: number) => {
      if (!valid()) return;
      const kind = slot === 'video' ? 'video' : 'image';
      const eligibility = getKlingElementMediaEligibility({ kind, url: file.name, mime: file.type }, slot);
      if (eligibility.status === 'blocked') {
        const message = mediaInputEligibilityMessage(eligibility, locale)!;
        showNotice(message);
        return message;
      }
      const element = klingElementsRef.current.find(entry => entry.id === elementId);
      if (!element) return;
      const targetIndex = slot === 'reference' ? index ?? element.references.findIndex(entry => entry === null) : undefined;
      if (slot === 'reference' && (targetIndex == null || targetIndex < 0 || targetIndex >= element.references.length)) return;
      const assetId = createLocalId('element_asset');
      const key = slotKey(elementId, slot, targetIndex);
      retireSlot(slotOperations.current, key);
      const operation = beginUpload();
      slotOperations.current.set(key, { assetId, cancel: operation.cancel });
      const current = () => valid() && slotOperations.current.get(key)?.assetId === assetId;
      const previewUrl = URL.createObjectURL(file);
      const baseAsset: KlingElementAsset = {
        id: assetId,
        previewUrl,
        name: file.name,
        kind: slot === 'video' ? 'video' : 'image',
        status: 'uploading' as const,
        url: undefined as string | undefined,
      };

      if (!valid()) return;
      setKlingElements((previous) =>
        previous.map((element) => {
          if (element.id !== elementId) return element;
          if (slot === 'frontal') {
            revokeKlingAssetPreview(element.frontal);
            return { ...element, frontal: baseAsset };
          }
          if (slot === 'video') {
            revokeKlingAssetPreview(element.video);
            return { ...element, video: baseAsset };
          }
          const references = [...element.references];
          if (targetIndex == null || targetIndex >= references.length) {
            return element;
          }
          revokeKlingAssetPreview(references[targetIndex]);
          references[targetIndex] = baseAsset;
          return { ...element, references };
        }),
      );

      const upload = async () => {
        try {
          const assetResponse = slot === 'video'
            ? await uploadVideoFile(file, { request: operation.request, abortRequest: operation.abortRequest })
            : await (async () => {
                const preparedFile = await prepareImageFileForUpload(file, {
                  maxBytes: 25 * 1024 * 1024,
                });
                if (!current()) throw new Error('Retired upload');
                const dimensions = await readImageFileDimensions(preparedFile).catch(() => null);
                if (!current()) throw new Error('Retired upload');
                const prepared = getKlingElementMediaEligibility({ kind: 'image', url: preparedFile.name, mime: preparedFile.type, ...dimensions }, slot);
                if (prepared.status === 'blocked') throw new Error(mediaInputEligibilityMessage(prepared, locale)!);
                const formData = new FormData();
                formData.append('file', preparedFile, preparedFile.name);
                const response = await operation.request('/api/uploads/image', {
                  method: 'POST',
                  body: formData,
                });
                const payload = await response.json().catch(() => null);
                if (!response.ok || !payload?.ok) {
                  throw createUploadFailure('image', response.status, payload, 'Upload failed');
                }
                return payload.asset as { id: string; url: string; name?: string };
              })();
          if (!current()) {
            revokeKlingAssetPreview(baseAsset);
            return;
          }
          setKlingElements((previous) =>
            previous.map((element) => {
              if (element.id !== elementId) return element;
              const updateAsset = (asset: typeof baseAsset | null) => {
                if (!asset || asset.id !== assetId) return asset;
                if (asset.previewUrl.startsWith('blob:')) {
                  URL.revokeObjectURL(asset.previewUrl);
                }
                return {
                  ...asset,
                  status: 'ready' as const,
                  assetId: assetResponse.id,
                  url: assetResponse.url,
                  previewUrl: assetResponse.url || asset.previewUrl,
                  name: assetResponse.name ?? asset.name,
                };
              };
              if (slot === 'frontal') {
                return { ...element, frontal: updateAsset(element.frontal) };
              }
              if (slot === 'video') {
                return { ...element, video: updateAsset(element.video) };
              }
              const references = element.references.map((asset) => updateAsset(asset));
              return { ...element, references };
            }),
          );
        } catch (error) {
          if (!current()) {
            revokeKlingAssetPreview(baseAsset);
            return;
          }
          const assetType = slot === 'video' ? 'video' : 'image';
          const message = getUploadFailureMessage(assetType, error, 'Upload failed.');
          const uploadError = error as UploadFailure;
          console.error(
            '[kling-assets] upload failed',
            {
              elementId,
              slot,
              assetType,
              status: uploadError?.status ?? null,
              code: uploadError?.code ?? null,
              maxMB: uploadError?.maxMB ?? null,
              message,
            },
            error,
          );
          setKlingElements((previous) =>
            previous.map((element) => {
              if (element.id !== elementId) return element;
              const markError = (asset: typeof baseAsset | null) => {
                if (!asset || asset.id !== assetId) return asset;
                return { ...asset, status: 'error' as const, error: message };
              };
              if (slot === 'frontal') return { ...element, frontal: markError(element.frontal) };
              if (slot === 'video') return { ...element, video: markError(element.video) };
              const references = element.references.map((asset) => markError(asset));
              return { ...element, references };
            }),
          );
          showNotice(message);
        } finally {
          if (slotOperations.current.get(key)?.assetId === assetId) slotOperations.current.delete(key);
          operation.finish();
        }
      };

      void upload();
      return true;
    },
    [valid, locale, beginUpload, setKlingElements, showNotice],
  );

  const handleImportKlingLibraryFile = useCallback(async (target: Extract<AssetPickerTarget, { kind: 'kling' }>, file: File) => {
    const result = handleKlingElementAssetAdd(target.elementId, target.slot, file, target.slotIndex);
    if (typeof result === 'string') return result;
    if (result) setAssetPickerTarget(null);
  }, [handleKlingElementAssetAdd, setAssetPickerTarget]);

  return {
    handleOpenKlingAssetLibrary,
    handleSelectKlingLibraryAsset,
    handleImportKlingLibraryFile,
    handleKlingElementAdd,
    handleKlingElementRemove,
    handleKlingElementAssetRemove,
    handleKlingElementAssetAdd,
  };
}
