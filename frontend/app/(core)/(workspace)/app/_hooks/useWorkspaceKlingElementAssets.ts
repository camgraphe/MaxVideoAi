import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { KlingElementAsset, KlingElementState } from '@/components/KlingElementsBuilder';
import { authFetch } from '@/lib/authFetch';
import { prepareImageFileForUpload } from '@/lib/client-image-upload';
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

type UseWorkspaceKlingElementAssetsOptions = {
  showNotice: (message: string) => void;
  klingElements: KlingElementState[];
  setKlingElements: Dispatch<SetStateAction<KlingElementState[]>>;
  assetLibrarySource: AssetLibrarySource;
  resetAssetLibraryForSource: (nextSource: AssetLibrarySource) => void;
  setAssetPickerTarget: Dispatch<SetStateAction<AssetPickerTarget | null>>;
};

export function useWorkspaceKlingElementAssets({
  showNotice,
  klingElements,
  setKlingElements,
  assetLibrarySource,
  resetAssetLibraryForSource,
  setAssetPickerTarget,
}: UseWorkspaceKlingElementAssetsOptions) {
  const klingElementsRef = useRef<KlingElementState[]>([]);

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
    (elementId: string, slot: 'frontal' | 'reference', slotIndex?: number) => {
      if (assetLibrarySource !== 'all') {
        resetAssetLibraryForSource('all');
      }
      setAssetPickerTarget({ kind: 'kling', elementId, slot, slotIndex });
    },
    [assetLibrarySource, resetAssetLibraryForSource, setAssetPickerTarget]
  );

  const handleSelectKlingLibraryAsset = useCallback(
    (target: Extract<AssetPickerTarget, { kind: 'kling' }>, asset: UserAsset) => {
      const newAsset = buildKlingLibraryAsset(asset);
      setKlingElements((previous) =>
        insertKlingLibraryAsset(previous, target, newAsset, revokeKlingAssetPreview)
      );

      setAssetPickerTarget(null);
    },
    [setAssetPickerTarget, setKlingElements]
  );

  const handleKlingElementAdd = useCallback(() => {
    setKlingElements((previous) => [...previous, createKlingElement()]);
  }, [setKlingElements]);

  const handleKlingElementRemove = useCallback((id: string) => {
    setKlingElements((previous) => {
      const next = previous.filter((element) => element.id !== id);
      return next.length ? next : [createKlingElement()];
    });
  }, [setKlingElements]);

  const handleKlingElementAssetRemove = useCallback(
    (elementId: string, slot: 'frontal' | 'reference' | 'video', index?: number) => {
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
        })
      );
    },
    [setKlingElements]
  );

  const handleKlingElementAssetAdd = useCallback(
    (elementId: string, slot: 'frontal' | 'reference' | 'video', file: File, index?: number) => {
      const assetId = createLocalId('element_asset');
      const previewUrl = URL.createObjectURL(file);
      const baseAsset: KlingElementAsset = {
        id: assetId,
        previewUrl,
        name: file.name,
        kind: slot === 'video' ? 'video' : 'image',
        status: 'uploading' as const,
        url: undefined as string | undefined,
      };

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
          let targetIndex = typeof index === 'number' ? index : references.findIndex((entry) => entry === null);
          if (targetIndex < 0) {
            targetIndex = references.length;
          }
          if (targetIndex >= references.length) {
            return element;
          }
          revokeKlingAssetPreview(references[targetIndex]);
          references[targetIndex] = baseAsset;
          return { ...element, references };
        })
      );

      const upload = async () => {
        try {
          const preparedFile =
            slot === 'video'
              ? file
              : await prepareImageFileForUpload(file, { maxBytes: 25 * 1024 * 1024 });
          const formData = new FormData();
          formData.append('file', preparedFile, preparedFile.name);
          const uploadEndpoint = slot === 'video' ? '/api/uploads/video' : '/api/uploads/image';
          const response = await authFetch(uploadEndpoint, {
            method: 'POST',
            body: formData,
          });
          const payload = await response.json().catch(() => null);
          if (!response.ok || !payload?.ok) {
            throw createUploadFailure(slot === 'video' ? 'video' : 'image', response.status, payload, 'Upload failed');
          }
          const assetResponse = payload.asset as {
            id: string;
            url: string;
            name?: string;
          };
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
            })
          );
        } catch (error) {
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
            error
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
            })
          );
          showNotice(message);
        }
      };

      void upload();
    },
    [setKlingElements, showNotice]
  );

  return {
    handleOpenKlingAssetLibrary,
    handleSelectKlingLibraryAsset,
    handleKlingElementAdd,
    handleKlingElementRemove,
    handleKlingElementAssetRemove,
    handleKlingElementAssetAdd,
  };
}
