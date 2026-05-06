import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { KlingElementAsset, KlingElementState } from '@/components/KlingElementsBuilder';
import { saveAssetToLibrary, saveImageToLibrary } from '@/lib/api';
import { authFetch } from '@/lib/authFetch';
import { prepareImageFileForUpload } from '@/lib/client-image-upload';
import {
  getSeedanceFieldBlockKey,
  isUnifiedSeedanceEngineId,
} from '@/lib/seedance-workflow';
import type { EngineInputField } from '@/types/engines';
import {
  buildAssetLibraryCacheKey,
  buildAssetLibraryUrl,
  buildKlingLibraryAsset,
  buildReferenceAssetFromLibraryAsset,
  getAssetLibrarySourceForField,
  getLibraryAssetFieldMismatchMessage,
  insertKlingLibraryAsset,
  insertReferenceAsset,
  mergeMirroredLibraryAsset,
  normalizeAssetLibraryPayload,
  removeReferenceAsset,
  revokeAssetPreview,
  revokeKlingAssetPreview,
  shouldMirrorCharacterImageAsset,
  shouldMirrorVideoLibraryAsset,
  type AssetLibraryKind,
  type AssetLibrarySource,
  type AssetPickerTarget,
  type ReferenceAsset,
  type UserAsset,
} from '../_lib/workspace-assets';
import { createKlingElement, createLocalId } from '../_lib/workspace-input-helpers';
import {
  createUploadFailure,
  getUploadFailureMessage,
  type UploadableAssetKind,
  type UploadFailure,
} from '../_lib/workspace-upload-errors';

type UseWorkspaceAssetsOptions = {
  engineId?: string | null;
  workflowCopy: {
    clearReferencesToUseStartEnd: string;
    clearStartEndToUseReferences: string;
  };
  showNotice: (message: string) => void;
  klingElements: KlingElementState[];
  setKlingElements: Dispatch<SetStateAction<KlingElementState[]>>;
};

type FetchAssetLibraryOptions = {
  source?: AssetLibrarySource;
  kind?: AssetLibraryKind;
};

function createReferenceAssetId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `asset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useWorkspaceAssets({
  engineId,
  workflowCopy,
  showNotice,
  klingElements,
  setKlingElements,
}: UseWorkspaceAssetsOptions) {
  const [inputAssets, setInputAssets] = useState<Record<string, (ReferenceAsset | null)[]>>({});
  const [assetPickerTarget, setAssetPickerTarget] = useState<AssetPickerTarget | null>(null);
  const [assetLibrary, setAssetLibrary] = useState<UserAsset[]>([]);
  const [isAssetLibraryLoading, setIsAssetLibraryLoading] = useState(false);
  const [assetLibraryError, setAssetLibraryError] = useState<string | null>(null);
  const [assetLibrarySource, setAssetLibrarySource] = useState<AssetLibrarySource>('all');
  const [assetLibraryLoadedKey, setAssetLibraryLoadedKey] = useState<string | null>(null);
  const [assetDeletePendingId, setAssetDeletePendingId] = useState<string | null>(null);

  const assetLibraryKind = useMemo<AssetLibraryKind>(() => {
    if (!assetPickerTarget) return 'image';
    if (assetPickerTarget.kind === 'field' && assetPickerTarget.field.type === 'video') {
      return 'video';
    }
    return 'image';
  }, [assetPickerTarget]);
  const assetLibraryRequestKey = assetPickerTarget
    ? buildAssetLibraryCacheKey(assetLibraryKind, assetLibrarySource)
    : null;
  const visibleAssetLibrary = useMemo(
    () => assetLibrary.filter((asset) => asset.kind === assetLibraryKind),
    [assetLibrary, assetLibraryKind]
  );

  const assetsRef = useRef<Record<string, (ReferenceAsset | null)[]>>({});
  const klingElementsRef = useRef<KlingElementState[]>([]);

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

  const fetchAssetLibrary = useCallback(async (options?: FetchAssetLibraryOptions) => {
    const source = options?.source ?? assetLibrarySource;
    const kind = options?.kind ?? assetLibraryKind;
    const requestKey = buildAssetLibraryCacheKey(kind, source);
    setIsAssetLibraryLoading(true);
    setAssetLibraryError(null);
    try {
      const assetResponse = await authFetch(buildAssetLibraryUrl(kind, source));
      if (assetResponse.status === 401) {
        setAssetLibrary([]);
        setAssetLibraryError(
          kind === 'video' ? 'Sign in to access your video library.' : 'Sign in to access your image library.'
        );
        setAssetLibraryLoadedKey(requestKey);
        return;
      }
      const payload = await assetResponse.json().catch(() => null);
      if (!assetResponse.ok || !payload?.ok) {
        const message =
          typeof payload?.error === 'string'
            ? payload.error
            : kind === 'video'
              ? 'Failed to load videos'
              : 'Failed to load images';
        throw new Error(message);
      }
      setAssetLibrary(normalizeAssetLibraryPayload(payload, source, kind));
      setAssetLibraryLoadedKey(requestKey);
    } catch (error) {
      console.error('[assets] failed to load library', error);
      setAssetLibraryError(
        error instanceof Error
          ? error.message
          : kind === 'video'
            ? 'Failed to load videos'
            : 'Failed to load images'
      );
      setAssetLibraryLoadedKey(requestKey);
    } finally {
      setIsAssetLibraryLoading(false);
    }
  }, [assetLibraryKind, assetLibrarySource]);

  useEffect(() => {
    if (!assetPickerTarget || !assetLibraryRequestKey || isAssetLibraryLoading) return;
    if (assetLibraryLoadedKey === assetLibraryRequestKey) return;
    setAssetLibrary([]);
    setAssetLibraryError(null);
    void fetchAssetLibrary({ kind: assetLibraryKind, source: assetLibrarySource });
  }, [
    assetLibraryKind,
    assetLibraryLoadedKey,
    assetLibraryRequestKey,
    assetLibrarySource,
    assetPickerTarget,
    fetchAssetLibrary,
    isAssetLibraryLoading,
  ]);

  const handleDeleteLibraryAsset = useCallback(
    async (asset: UserAsset) => {
      if (!asset?.id) return;
      setAssetDeletePendingId(asset.id);
      try {
        const response = await authFetch('/api/user-assets', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: asset.id }),
        });
        const payload = await response.json().catch(() => null);
        const success = response.ok && Boolean(payload?.ok);
        const notFound = response.status === 404 || payload?.error === 'NOT_FOUND';
        if (!success && !notFound) {
          const message = typeof payload?.error === 'string' ? payload.error : 'Failed to delete image';
          throw new Error(message);
        }

        setAssetLibrary((previous) => previous.filter((entry) => entry.id !== asset.id));
        setInputAssets((previous) => {
          let changed = false;
          const next: typeof previous = {};
          for (const [fieldId, entries] of Object.entries(previous)) {
            let fieldChanged = false;
            const updated = entries.map((entry) => {
              if (entry && entry.assetId === asset.id) {
                fieldChanged = true;
                changed = true;
                if (entry.previewUrl.startsWith('blob:')) {
                  URL.revokeObjectURL(entry.previewUrl);
                }
                return null;
              }
              return entry;
            });
            next[fieldId] = fieldChanged ? updated : entries;
          }
          return changed ? next : previous;
        });
      } catch (error) {
        console.error('[assets] failed to delete asset', error);
        showNotice(error instanceof Error ? error.message : 'Failed to delete image');
        throw error;
      } finally {
        setAssetDeletePendingId(null);
      }
    },
    [showNotice]
  );

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

  const resetAssetLibraryForSource = useCallback((nextSource: AssetLibrarySource) => {
    setAssetLibrarySource(nextSource);
    setAssetLibrary([]);
    setAssetLibraryError(null);
    setAssetLibraryLoadedKey(null);
  }, []);

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
    [assetLibrarySource, getSeedanceFieldBlockedMessage, resetAssetLibraryForSource, showNotice]
  );

  const handleOpenKlingAssetLibrary = useCallback(
    (elementId: string, slot: 'frontal' | 'reference', slotIndex?: number) => {
      if (assetLibrarySource !== 'all') {
        resetAssetLibraryForSource('all');
      }
      setAssetPickerTarget({ kind: 'kling', elementId, slot, slotIndex });
    },
    [assetLibrarySource, resetAssetLibraryForSource]
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
    [getSeedanceFieldBlockedMessage, showNotice]
  );

  const handleSelectKlingLibraryAsset = useCallback(
    (target: Extract<AssetPickerTarget, { kind: 'kling' }>, asset: UserAsset) => {
      const newAsset = buildKlingLibraryAsset(asset);
      setKlingElements((previous) =>
        insertKlingLibraryAsset(previous, target, newAsset, revokeKlingAssetPreview)
      );

      setAssetPickerTarget(null);
    },
    [setKlingElements]
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
    [getSeedanceFieldBlockedMessage, showNotice]
  );

  const handleAssetRemove = useCallback((field: EngineInputField, index: number) => {
    setInputAssets((previous) => {
      return removeReferenceAsset(previous, field, index, revokeAssetPreview);
    });
  }, []);

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

  const handleAssetLibrarySourceChange = useCallback(
    (nextSource: AssetLibrarySource) => {
      if (nextSource === assetLibrarySource) return;
      resetAssetLibraryForSource(nextSource);
    },
    [assetLibrarySource, resetAssetLibraryForSource]
  );

  const closeAssetLibrary = useCallback(() => {
    setAssetPickerTarget(null);
  }, []);

  return {
    inputAssets,
    setInputAssets,
    assetPickerTarget,
    assetLibraryKind,
    assetLibrarySource,
    visibleAssetLibrary,
    isAssetLibraryLoading,
    assetLibraryError,
    assetDeletePendingId,
    fetchAssetLibrary,
    handleAssetLibrarySourceChange,
    closeAssetLibrary,
    handleDeleteLibraryAsset,
    handleOpenAssetLibrary,
    handleOpenKlingAssetLibrary,
    handleSelectLibraryAsset,
    handleSelectKlingLibraryAsset,
    handleAssetAdd,
    handleAssetRemove,
    handleKlingElementAdd,
    handleKlingElementRemove,
    handleKlingElementAssetRemove,
    handleKlingElementAssetAdd,
  };
}
