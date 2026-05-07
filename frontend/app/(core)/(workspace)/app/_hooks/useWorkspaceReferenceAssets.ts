import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { saveAssetToLibrary, saveImageToLibrary } from '@/lib/api';
import { authFetch } from '@/lib/authFetch';
import { prepareImageFileForUpload } from '@/lib/client-image-upload';
import {
  getSeedanceFieldBlockKey,
  isUnifiedSeedanceEngineId,
} from '@/lib/seedance-workflow';
import type { EngineInputField } from '@/types/engines';
import {
  buildReferenceAssetFromLibraryAsset,
  getAssetLibrarySourceForField,
  getLibraryAssetFieldMismatchMessage,
  insertReferenceAsset,
  mergeMirroredLibraryAsset,
  removeReferenceAsset,
  revokeAssetPreview,
  shouldMirrorCharacterImageAsset,
  shouldMirrorVideoLibraryAsset,
  type AssetLibrarySource,
  type AssetPickerTarget,
  type ReferenceAsset,
  type UserAsset,
} from '../_lib/workspace-assets';
import {
  createUploadFailure,
  getUploadFailureMessage,
  type UploadableAssetKind,
  type UploadFailure,
} from '../_lib/workspace-upload-errors';

type UseWorkspaceReferenceAssetsOptions = {
  engineId?: string | null;
  workflowCopy: {
    clearReferencesToUseStartEnd: string;
    clearStartEndToUseReferences: string;
  };
  showNotice: (message: string) => void;
  inputAssets: Record<string, (ReferenceAsset | null)[]>;
  setInputAssets: Dispatch<SetStateAction<Record<string, (ReferenceAsset | null)[]>>>;
  assetLibrarySource: AssetLibrarySource;
  resetAssetLibraryForSource: (nextSource: AssetLibrarySource) => void;
  setAssetPickerTarget: Dispatch<SetStateAction<AssetPickerTarget | null>>;
  setAssetLibrary: Dispatch<SetStateAction<UserAsset[]>>;
};

function createReferenceAssetId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `asset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useWorkspaceReferenceAssets({
  engineId,
  workflowCopy,
  showNotice,
  inputAssets,
  setInputAssets,
  assetLibrarySource,
  resetAssetLibraryForSource,
  setAssetPickerTarget,
  setAssetLibrary,
}: UseWorkspaceReferenceAssetsOptions) {
  const assetsRef = useRef<Record<string, (ReferenceAsset | null)[]>>({});

  useEffect(() => {
    assetsRef.current = inputAssets;
  }, [inputAssets]);

  useEffect(() => {
    return () => {
      Object.values(assetsRef.current).forEach((entries) => {
        entries.forEach((asset) => {
          revokeAssetPreview(asset);
        });
      });
    };
  }, []);

  const getSeedanceFieldBlockedMessage = useCallback(
    (field: EngineInputField) => {
      if (!isUnifiedSeedanceEngineId(engineId)) return null;
      const fieldHasOwnAssets = (inputAssets[field.id] ?? []).some((asset) => asset !== null);
      const blockKey = getSeedanceFieldBlockKey(field.id, inputAssets, fieldHasOwnAssets);
      if (blockKey === 'clearReferences') {
        return workflowCopy.clearReferencesToUseStartEnd;
      }
      if (blockKey === 'clearStartEnd') {
        return workflowCopy.clearStartEndToUseReferences;
      }
      return null;
    },
    [engineId, inputAssets, workflowCopy.clearReferencesToUseStartEnd, workflowCopy.clearStartEndToUseReferences]
  );

  const handleOpenAssetLibrary = useCallback(
    (field: EngineInputField, slotIndex?: number) => {
      const blockedMessage = getSeedanceFieldBlockedMessage(field);
      if (blockedMessage) {
        showNotice(blockedMessage);
        return;
      }
      const nextSource = getAssetLibrarySourceForField(field);
      if (nextSource !== assetLibrarySource) {
        resetAssetLibraryForSource(nextSource);
      }
      setAssetPickerTarget({ kind: 'field', field, slotIndex });
    },
    [assetLibrarySource, getSeedanceFieldBlockedMessage, resetAssetLibraryForSource, setAssetPickerTarget, showNotice]
  );

  const handleSelectLibraryAsset = useCallback(
    async (field: EngineInputField, asset: UserAsset, slotIndex?: number) => {
      const blockedMessage = getSeedanceFieldBlockedMessage(field);
      if (blockedMessage) {
        showNotice(blockedMessage);
        return;
      }
      const mismatchMessage = getLibraryAssetFieldMismatchMessage(field, asset);
      if (mismatchMessage) {
        showNotice(mismatchMessage);
        return;
      }

      let resolvedAsset = asset;

      if (field.type === 'video' && asset.kind === 'video') {
        try {
          if (shouldMirrorVideoLibraryAsset(asset)) {
            const mirrored = await saveAssetToLibrary({
              url: asset.url,
              label:
                field.label ??
                asset.url.split('/').pop() ??
                'Video',
              source: asset.source === 'recent' ? 'saved_job_output' : asset.source,
              kind: 'video',
              jobId: asset.jobId ?? null,
              sourceOutputId: asset.sourceOutputId ?? null,
            });
            resolvedAsset = mergeMirroredLibraryAsset(asset, mirrored);
            setAssetLibrary((previous) =>
              previous.map((entry) =>
                entry.id === asset.id || entry.url === asset.url ? resolvedAsset : entry
              )
            );
          }
        } catch (error) {
          console.error('[assets] failed to mirror generated video asset', error);
          showNotice(error instanceof Error ? error.message : 'Unable to prepare this video. Try importing the source clip directly.');
          return;
        }
      }

      if (field.type === 'image' && asset.kind === 'image') {
        try {
          if (shouldMirrorCharacterImageAsset(asset)) {
            const mirrored = await saveImageToLibrary({
              url: asset.url,
              label:
                field.label ??
                asset.url.split('/').pop() ??
                'Image',
              source: asset.source,
            });
            resolvedAsset = mergeMirroredLibraryAsset(asset, mirrored);
            setAssetLibrary((previous) =>
              previous.map((entry) =>
                entry.id === asset.id || entry.url === asset.url ? resolvedAsset : entry
              )
            );
          }
        } catch (error) {
          console.error('[assets] failed to mirror character library asset', error);
          showNotice(error instanceof Error ? error.message : 'Unable to prepare this character asset. Try another image.');
          return;
        }
      }

      const newAsset = buildReferenceAssetFromLibraryAsset(field, resolvedAsset);

      setInputAssets((previous) => {
        return insertReferenceAsset(previous, field, newAsset, slotIndex, {
          release: revokeAssetPreview,
          onMaxReached: () => showNotice(`Maximum ${field.label ?? 'reference image'} count reached for this engine.`),
        });
      });

      setAssetPickerTarget(null);
    },
    [getSeedanceFieldBlockedMessage, setAssetLibrary, setAssetPickerTarget, setInputAssets, showNotice]
  );

  const handleAssetAdd = useCallback(
    (field: EngineInputField, file: File, slotIndex?: number, meta?: { durationSec?: number }) => {
      const blockedMessage = getSeedanceFieldBlockedMessage(field);
      if (blockedMessage) {
        showNotice(blockedMessage);
        return;
      }
      const assetId = createReferenceAssetId();
      const previewUrl = URL.createObjectURL(file);
      const baseAsset: ReferenceAsset = {
        id: assetId,
        fieldId: field.id,
        previewUrl,
        kind: field.type === 'video' ? 'video' : field.type === 'audio' ? 'audio' : 'image',
        name: file.name,
        size: file.size,
        type: file.type,
        durationSec: typeof meta?.durationSec === 'number' ? meta.durationSec : null,
        status: 'uploading' as const,
      };

      setInputAssets((previous) => {
        return insertReferenceAsset(previous, field, baseAsset, slotIndex, {
          release: revokeAssetPreview,
          onMaxReached: () => revokeAssetPreview(baseAsset),
        });
      });

      const upload = async () => {
        try {
          const preparedFile =
            field.type === 'image'
              ? await prepareImageFileForUpload(file, { maxBytes: 25 * 1024 * 1024 })
              : file;
          const formData = new FormData();
          formData.append('file', preparedFile, preparedFile.name);
          const uploadEndpoint =
            field.type === 'video'
              ? '/api/uploads/video'
              : field.type === 'audio'
                ? '/api/uploads/audio'
                : '/api/uploads/image';
          const uploadAssetType: UploadableAssetKind =
            field.type === 'video' ? 'video' : field.type === 'audio' ? 'audio' : 'image';
          const response = await authFetch(uploadEndpoint, {
            method: 'POST',
            body: formData,
          });
          const payload = await response.json().catch(() => null);
          if (!response.ok || !payload?.ok) {
            throw createUploadFailure(uploadAssetType, response.status, payload, 'Upload failed');
          }
          const assetResponse = payload.asset as {
            id: string;
            url: string;
            width?: number | null;
            height?: number | null;
            size?: number;
            mime?: string;
            name?: string;
          };
          setInputAssets((previous) => {
            const current = previous[field.id];
            if (!current) return previous;
            const next = current.map((entry) => {
              if (!entry || entry.id !== assetId) return entry;
              return {
                ...entry,
                status: 'ready' as const,
                url: assetResponse.url,
                width: assetResponse.width ?? entry.width,
                height: assetResponse.height ?? entry.height,
                size: assetResponse.size ?? entry.size,
                type: assetResponse.mime ?? entry.type,
                assetId: assetResponse.id,
              };
            });
            return { ...previous, [field.id]: next };
          });
        } catch (error) {
          const uploadAssetType: UploadableAssetKind =
            field.type === 'video' ? 'video' : field.type === 'audio' ? 'audio' : 'image';
          const message = getUploadFailureMessage(uploadAssetType, error, 'Upload failed');
          const uploadError = error as UploadFailure;
          console.error(
            '[assets] upload failed',
            {
              fieldId: field.id,
              assetType: uploadAssetType,
              status: uploadError?.status ?? null,
              code: uploadError?.code ?? null,
              maxMB: uploadError?.maxMB ?? null,
              message,
            },
            error
          );
          setInputAssets((previous) => {
            const current = previous[field.id];
            if (!current) return previous;
            const next = current.map((entry) => {
              if (!entry || entry.id !== assetId) return entry;
              return {
                ...entry,
                status: 'error' as const,
                error: message,
              };
            });
            return { ...previous, [field.id]: next };
          });
          showNotice(message);
        }
      };

      void upload();
    },
    [getSeedanceFieldBlockedMessage, setInputAssets, showNotice]
  );

  const handleAssetRemove = useCallback((field: EngineInputField, index: number) => {
    setInputAssets((previous) => {
      return removeReferenceAsset(previous, field, index, revokeAssetPreview);
    });
  }, [setInputAssets]);

  return {
    handleOpenAssetLibrary,
    handleSelectLibraryAsset,
    handleAssetAdd,
    handleAssetRemove,
  };
}
