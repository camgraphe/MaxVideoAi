import { useWorkspaceAssetLifetime } from './useWorkspaceAssetLifetime';
import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { saveAssetToLibrary, saveImageToLibrary } from '@/lib/api';
import { useWorkspaceUploadOperation } from './useWorkspaceUploadOperation';
import { prepareImageFileForUpload } from '@/lib/client-image-upload';
import { uploadVideoFile } from '@/lib/client-video-upload';
import { getSeedanceFieldBlockKey, isUnifiedSeedanceEngineId } from '@/lib/seedance-workflow';
import type { EngineCaps, EngineInputField, EngineInputSchema, Mode } from '@/types/engines';
import { getMediaInputEligibility } from '@/lib/media-input-eligibility';
import { getMediaExcerptImportMode } from '@/lib/video-excerpt';
import { mediaInputEligibilityMessage } from '@/components/library/media-input-eligibility-copy';
import { readMediaDuration, validateEngineImageFile } from '@/components/asset-dropzone/asset-dropzone-helpers';
import { getLocalizedAssetDropzoneCopy, normalizeUiLocale } from '@/lib/ltx-localization';
import { normalizeMinimumImageSide } from '@/lib/image-dimension-constraints';
import { resolveEngineMediaFieldConstraint } from '@/lib/media-field-constraints';
import {
  buildReferenceAssetFromLibraryAsset,
  getAssetLibrarySourceForField,
  getLibraryAssetFieldMismatchMessage,
  mergeMirroredLibraryAsset,
  removeReferenceAsset,
  revokeAssetPreview,
  settleReferenceAssetReservation,
  shouldMirrorCharacterImageAsset,
  shouldMirrorVideoLibraryAsset,
  tryInsertReferenceAsset,
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
import type { CommitInputAssetMutation } from './useWorkspaceAssetState';

type UseWorkspaceReferenceAssetsOptions = {
  accountScope?: string | null;
  engineId?: string | null;
  engine?: EngineCaps | null;
  locale?: string;
  assetPickerTarget?: AssetPickerTarget | null;
  inputSchema?: EngineInputSchema | null;
  preferredMode: Mode;
  workflowCopy: {
    clearReferencesToUseStartEnd: string;
    clearStartEndToUseReferences: string;
  };
  showNotice: (message: string) => void;
  inputAssets: Record<string, (ReferenceAsset | null)[]>;
  setInputAssets: Dispatch<SetStateAction<Record<string, (ReferenceAsset | null)[]>>>;
  commitInputAssetMutation: CommitInputAssetMutation;
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
  accountScope,
  engineId,
  engine,
  locale = 'en',
  assetPickerTarget,
  inputSchema,
  preferredMode,
  workflowCopy,
  showNotice,
  inputAssets,
  setInputAssets,
  commitInputAssetMutation,
  assetLibrarySource,
  resetAssetLibraryForSource,
  setAssetPickerTarget,
  setAssetLibrary,
}: UseWorkspaceReferenceAssetsOptions) {
  const valid = useWorkspaceAssetLifetime(accountScope);
  const beginUpload = useWorkspaceUploadOperation(accountScope, valid);
  const assetsRef = useRef<Record<string, (ReferenceAsset | null)[]>>({});
  const importScope = useRef({ engineId, preferredMode, inputSchema, assetPickerTarget });
  if (importScope.current.engineId !== engineId || importScope.current.preferredMode !== preferredMode
    || importScope.current.inputSchema !== inputSchema || importScope.current.assetPickerTarget !== assetPickerTarget)
    importScope.current = { engineId, preferredMode, inputSchema, assetPickerTarget };

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
    [
      engineId,
      inputAssets,
      workflowCopy.clearReferencesToUseStartEnd,
      workflowCopy.clearStartEndToUseReferences,
    ],
  );

  const handleOpenAssetLibrary = useCallback(
    (field: EngineInputField, slotIndex?: number) => {
      if (!valid()) return;
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
    [
      valid,
      assetLibrarySource,
      getSeedanceFieldBlockedMessage,
      resetAssetLibraryForSource,
      setAssetPickerTarget,
      showNotice,
    ],
  );

  const handleSelectLibraryAsset = useCallback(
    async (field: EngineInputField, asset: UserAsset, slotIndex?: number) => {
      if (!valid()) return;
      const blockedMessage = getSeedanceFieldBlockedMessage(field);
      if (blockedMessage) {
        showNotice(blockedMessage);
        return blockedMessage;
      }
      const mismatchMessage = getLibraryAssetFieldMismatchMessage(field, asset);
      if (mismatchMessage) {
        showNotice(mismatchMessage);
        return mismatchMessage;
      }
      const eligibility = getMediaInputEligibility({ asset, field, engine, mode: preferredMode });
      if (eligibility.status === 'blocked') {
        const message = mediaInputEligibilityMessage(eligibility, locale)!;
        showNotice(message);
        return message;
      }

      const shouldMirrorVideo =
        field.type === 'video' && asset.kind === 'video' && shouldMirrorVideoLibraryAsset(asset);
      const shouldMirrorImage =
        field.type === 'image' && asset.kind === 'image' && shouldMirrorCharacterImageAsset(asset);
      const reservationId =
        shouldMirrorVideo || shouldMirrorImage ? createReferenceAssetId() : null;
      const newAsset = buildReferenceAssetFromLibraryAsset(field, asset);
      const reservedAsset = reservationId
        ? {
            ...newAsset,
            id: reservationId,
            status: 'uploading' as const,
          }
        : newAsset;

      const insertion = commitInputAssetMutation((previous) =>
        tryInsertReferenceAsset(previous, field, reservedAsset, slotIndex, {
          inputSchema,
          preferredMode,
        }),
      );
      if (!insertion.accepted) {
        const message =
          insertion.reason === 'reference_budget'
            ? `Maximum ${insertion.maxTotal} total references reached for this engine mode.`
            : `Maximum ${field.label ?? 'reference image'} count reached for this engine.`;
        showNotice(message);
        return message;
      }
      setAssetPickerTarget(null);
      if (!reservationId) {
        if (insertion.replacedAsset) {
          revokeAssetPreview(insertion.replacedAsset);
        }
        return;
      }

      try {
        const mirrored = shouldMirrorVideo
          ? await saveAssetToLibrary({
              url: asset.url,
              label: field.label ?? asset.url.split('/').pop() ?? 'Video',
              source: asset.source === 'recent' ? 'saved_job_output' : asset.source,
              kind: 'video',
              jobId: asset.jobId ?? null,
              sourceOutputId: asset.sourceOutputId ?? null,
              durationSec: asset.durationSec ?? null,
            })
          : await saveImageToLibrary({
              url: asset.url,
              label: field.label ?? asset.url.split('/').pop() ?? 'Image',
              source: asset.source,
            });
        if (!valid()) {
          if (insertion.replacedAsset) revokeAssetPreview(insertion.replacedAsset);
          return;
        }
        const resolvedAsset = mergeMirroredLibraryAsset(asset, mirrored);
        const resolvedReferenceAsset = {
          ...buildReferenceAssetFromLibraryAsset(field, resolvedAsset),
          id: reservationId,
        };
        const settlement = commitInputAssetMutation((previous) =>
          settleReferenceAssetReservation(previous, field, reservationId, resolvedReferenceAsset),
        );
        if (!settlement.settled) {
          if (insertion.replacedAsset) {
            revokeAssetPreview(insertion.replacedAsset);
          }
          return;
        }
        if (insertion.replacedAsset) {
          revokeAssetPreview(insertion.replacedAsset);
        }
        setAssetLibrary((previous) =>
          previous.map((entry) =>
            entry.id === asset.id || entry.url === asset.url ? resolvedAsset : entry,
          ),
        );
      } catch (error) {
        if (!valid()) {
          if (insertion.replacedAsset) revokeAssetPreview(insertion.replacedAsset);
          return;
        }
        const rollback = commitInputAssetMutation((previous) =>
          settleReferenceAssetReservation(previous, field, reservationId, insertion.replacedAsset),
        );
        if (rollback.settled && rollback.discardedAsset) {
          revokeAssetPreview(rollback.discardedAsset);
        } else if (!rollback.settled && insertion.replacedAsset) {
          revokeAssetPreview(insertion.replacedAsset);
        }
        if (shouldMirrorVideo) {
          console.error('[assets] failed to mirror generated video asset', error);
          showNotice(
            error instanceof Error
              ? error.message
              : 'Unable to prepare this video. Try importing the source clip directly.',
          );
        } else {
          console.error('[assets] failed to mirror character library asset', error);
          showNotice(
            error instanceof Error
              ? error.message
              : 'Unable to prepare this character asset. Try another image.',
          );
        }
      }
    },
    [
      valid,
      commitInputAssetMutation,
      getSeedanceFieldBlockedMessage,
      engine,
      locale,
      inputSchema,
      preferredMode,
      setAssetLibrary,
      setAssetPickerTarget,
      showNotice,
    ],
  );

  const handleAssetAdd = useCallback(
    (
      field: EngineInputField,
      file: File,
      slotIndex?: number,
      meta?: { durationSec?: number; width?: number; height?: number; prepareExcerpt?: boolean },
    ) => {
      if (!valid()) return;
      const blockedMessage = getSeedanceFieldBlockedMessage(field);
      if (blockedMessage) {
        showNotice(blockedMessage);
        return;
      }
      const eligibility = getMediaInputEligibility({ asset: { kind: field.type as 'image' | 'video' | 'audio', url: file.name,
        mime: file.type, size: file.size, ...meta }, field, engine, mode: preferredMode, context: 'file' });
      if (eligibility.status === 'blocked') {
        showNotice(mediaInputEligibilityMessage(eligibility, locale)!);
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
        width: typeof meta?.width === 'number' ? meta.width : null,
        height: typeof meta?.height === 'number' ? meta.height : null,
        durationSec: typeof meta?.durationSec === 'number' ? meta.durationSec : null,
        status: 'uploading' as const,
      };

      const insertion = commitInputAssetMutation((previous) =>
        tryInsertReferenceAsset(previous, field, baseAsset, slotIndex, {
          inputSchema,
          preferredMode,
        }),
      );
      if (!insertion.accepted) {
        revokeAssetPreview(baseAsset);
        showNotice(
          insertion.reason === 'reference_budget'
            ? `Maximum ${insertion.maxTotal} total references reached for this engine mode.`
            : `Maximum ${field.label ?? 'reference file'} count reached for this engine.`,
        );
        return;
      }
      if (insertion.replacedAsset) revokeAssetPreview(insertion.replacedAsset);

      const upload = async () => {
        const operation = beginUpload();
        try {
          const assetResponse =
            field.type === 'video'
              ? await uploadVideoFile(file, { request: operation.request, abortRequest: operation.abortRequest })
              : await (async () => {
                  const preparedFile =
                    field.type === 'image'
                      ? await prepareImageFileForUpload(file, {
                          maxBytes: 25 * 1024 * 1024,
                        })
                      : file;
                  if (!valid()) throw new Error('Retired upload');
                  if (field.type === 'image') {
                    const preparedEligibility = getMediaInputEligibility({ asset: { kind: 'image', url: preparedFile.name,
                      mime: preparedFile.type, size: preparedFile.size, width: meta?.width, height: meta?.height }, field, engine, mode: preferredMode });
                    if (preparedEligibility.status === 'blocked') throw new Error(mediaInputEligibilityMessage(preparedEligibility, locale)!);
                  }
                  const formData = new FormData();
                  formData.append('file', preparedFile, preparedFile.name);
                  if (field.type === 'audio' && engineId) {
                    formData.append('engineId', engineId);
                    const uploadMode = !field.modes?.length || field.modes.includes(preferredMode) ? preferredMode : field.modes[0];
                    formData.append('mode', uploadMode);
                    formData.append('fieldId', field.id);
                    if (meta?.prepareExcerpt) formData.append('prepareExcerpt', '1');
                  }
                  const uploadEndpoint =
                    field.type === 'audio' ? '/api/uploads/audio' : '/api/uploads/image';
                  const uploadAssetType: UploadableAssetKind =
                    field.type === 'audio' ? 'audio' : 'image';
                  const response = await operation.request(uploadEndpoint, {
                    method: 'POST',
                    body: formData,
                  });
                  const payload = await response.json().catch(() => null);
                  if (!response.ok || !payload?.ok) {
                    throw createUploadFailure(
                      uploadAssetType,
                      response.status,
                      payload,
                      'Upload failed',
                    );
                  }
                  return payload.asset as {
                    id: string;
                    url: string;
                    width?: number | null;
                    height?: number | null;
                    size?: number;
                    mime?: string;
                    name?: string;
                  };
                })();
          if (!valid()) {
            revokeAssetPreview(baseAsset);
            return;
          }
          setInputAssets((previous) => {
            const current = previous[field.id];
            if (!current) return previous;
            const next = current.map((entry) => {
              if (!entry || entry.id !== assetId) return entry;
              return {
                ...entry,
                status: 'ready' as const,
                url: assetResponse.url,
                thumbnailUrl: 'thumbUrl' in assetResponse ? assetResponse.thumbUrl ?? entry.thumbnailUrl : entry.thumbnailUrl,
                width: assetResponse.width ?? entry.width,
                height: assetResponse.height ?? entry.height,
                size: assetResponse.size ?? entry.size,
                type: assetResponse.mime ?? entry.type,
                assetId: 'assetId' in assetResponse ? assetResponse.assetId ?? assetResponse.id : assetResponse.id,
                ref: 'ref' in assetResponse ? assetResponse.ref : undefined,
                durationSec: 'durationSec' in assetResponse ? assetResponse.durationSec ?? entry.durationSec : entry.durationSec,
              };
            });
            return { ...previous, [field.id]: next };
          });
        } catch (error) {
          if (!valid()) {
            revokeAssetPreview(baseAsset);
            return;
          }
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
            error,
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
        } finally {
          operation.finish();
        }
      };

      void upload();
      return true;
    },
    [
      valid,
      beginUpload,
      commitInputAssetMutation,
      engineId,
      engine,
      locale,
      getSeedanceFieldBlockedMessage,
      inputSchema,
      preferredMode,
      setInputAssets,
      showNotice,
    ],
  );

  const handleImportLibraryFile = useCallback(async (field: EngineInputField, file: File, slotIndex?: number) => {
    const scope = importScope.current;
    const isCurrent = () => valid() && importScope.current === scope;
    if (!isCurrent()) return;
    let meta: { durationSec?: number; width?: number; height?: number; prepareExcerpt?: boolean } = {};
    if (field.type === 'image' && engine) {
      const validation = await validateEngineImageFile({ file,
        acceptFormats: resolveEngineMediaFieldConstraint({ engine, field }).acceptedFileExtensions,
        minimumSidePx: normalizeMinimumImageSide(engine.inputSchema?.constraints?.minImageSidePx),
        engineLabel: engine.label, assetCopy: getLocalizedAssetDropzoneCopy(normalizeUiLocale(locale)) });
      if (!isCurrent()) return;
      if (!validation.ok) return validation.message;
      meta = validation.dimensions ?? {};
    } else if (field.type === 'video' || field.type === 'audio') {
      const durationSec = await readMediaDuration(file, field.type);
      if (!isCurrent()) return;
      if (durationSec === null) {
        const copy = getLocalizedAssetDropzoneCopy(normalizeUiLocale(locale));
        return field.type === 'audio' ? copy.unableToReadAudioDuration : copy.unableToReadVideoDuration;
      }
      meta = { durationSec, prepareExcerpt: Boolean(engine && getMediaExcerptImportMode(engine, preferredMode, field.id)) };
    }
    if (!isCurrent()) return;
    const eligibility = getMediaInputEligibility({ asset: { kind: field.type as 'image' | 'video' | 'audio', url: file.name,
      mime: file.type, size: file.size, ...meta }, field, engine, mode: preferredMode, context: 'file' });
    if (eligibility.status === 'blocked') return mediaInputEligibilityMessage(eligibility, locale) ?? undefined;
    if (handleAssetAdd(field, file, slotIndex, meta)) setAssetPickerTarget(null);
  }, [engine, locale, preferredMode, valid, handleAssetAdd, setAssetPickerTarget]);

  const handleAssetRemove = useCallback(
    (field: EngineInputField, index: number) => {
      if (!valid()) return;
      setInputAssets((previous) => {
        return removeReferenceAsset(previous, field, index, revokeAssetPreview);
      });
    },
    [valid, setInputAssets],
  );

  return {
    handleImportLibraryFile,
    handleOpenAssetLibrary,
    handleSelectLibraryAsset,
    handleAssetAdd,
    handleAssetRemove,
  };
}
