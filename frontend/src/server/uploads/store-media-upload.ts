import { ensureReusableAsset } from '@/server/media-library';
import { createHash } from 'node:crypto';
import { probeMediaBuffer } from '@/server/media/detect-has-audio';
import { deleteStorageObjectByUrl, uploadFileBuffer, recordUserAsset } from '@/server/storage';
import { createUploadVideoThumbnail } from '@/server/upload-thumbnails';

import {
  normalizeSupportedReferenceDuration,
  resolveSupportedReferenceMedia,
} from '@/server/agent-api/reference-media-policy';
import type { CanonicalReferenceMediaKind } from '@/server/agent-api/generation-types';

export const DEFAULT_MAX_AUDIO_UPLOAD_MB = 30;

export function getMaxAudioUploadMB(): number {
  const configured = Number(process.env.ASSET_MAX_AUDIO_MB ?? String(DEFAULT_MAX_AUDIO_UPLOAD_MB));
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_AUDIO_UPLOAD_MB;
}

export function audioUploadLimitBytes(maxMB = getMaxAudioUploadMB()): number {
  return maxMB * 1024 * 1024;
}

export type MediaUploadErrorCode =
  | 'EMPTY_FILE'
  | 'UNSUPPORTED_TYPE'
  | 'METADATA_UNVERIFIED'
  | 'UPLOAD_FAILED'
  | 'STORE_FAILED';

export class MediaUploadError extends Error {
  constructor(
    public readonly code: MediaUploadErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'MediaUploadError';
  }
}

type StoreMediaUploadDependencies = {
  probeMediaBuffer: typeof probeMediaBuffer;
  uploadFileBuffer: typeof uploadFileBuffer;
  createUploadVideoThumbnail: typeof createUploadVideoThumbnail;
  recordUserAsset: typeof recordUserAsset;
  ensureReusableAsset: typeof ensureReusableAsset;
  deleteStorageObjectByUrl: typeof deleteStorageObjectByUrl;
};

export type StoreMediaUploadInput = {
  userId: string;
  fileName: string;
  declaredMime: string | null;
  bytes: Buffer;
  referenceEligibility?: 'workspace' | 'mcp';
  cleanupObjects?: {
    beforeUpload(entry: { objectRole: 'final' | 'thumbnail'; objectKey: string; safeToDelete: boolean }): Promise<void>;
    retain(objectKey: string): Promise<void>;
  };
  signal?: AbortSignal;
};

export type StoredMediaUpload = {
  assetId: string;
  legacyAssetId: string;
  width: null;
  height: null;
  durationSec: number;
  mimeType: string;
  sizeBytes: number;
  previewUrl: string | null;
  storageUrl: string;
};

const defaultDependencies: StoreMediaUploadDependencies = {
  probeMediaBuffer,
  uploadFileBuffer,
  createUploadVideoThumbnail,
  recordUserAsset,
  ensureReusableAsset,
  deleteStorageObjectByUrl,
};

function createStoreMediaUploadService(
  mediaKind: Exclude<CanonicalReferenceMediaKind, 'image'>,
  overrides: Partial<StoreMediaUploadDependencies> = {},
): (input: StoreMediaUploadInput) => Promise<StoredMediaUpload> {
  const dependencies = { ...defaultDependencies, ...overrides };
  return async (input) => {
    input.signal?.throwIfAborted();
    if (!input.bytes.length) {
      throw new MediaUploadError('EMPTY_FILE', 'The uploaded media file is empty.');
    }
    const declaredMime = input.declaredMime?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
    if (!declaredMime.startsWith(`${mediaKind}/`)) {
      throw new MediaUploadError('UNSUPPORTED_TYPE', 'The uploaded media type is unsupported.');
    }
    const strictDeclared = resolveSupportedReferenceMedia(mediaKind, declaredMime);
    if (input.referenceEligibility === 'mcp' && !strictDeclared) {
      throw new MediaUploadError('UNSUPPORTED_TYPE', 'The uploaded media type is unsupported.');
    }
    const probe = await dependencies.probeMediaBuffer(input.bytes, {
      fileName: input.fileName,
      mimeType: declaredMime,
      signal: input.signal,
    });
    input.signal?.throwIfAborted();
    if (!probe || probe.kind !== mediaKind) {
      throw new MediaUploadError('METADATA_UNVERIFIED', 'The uploaded media metadata could not be verified.');
    }
    const strictDetected = probe.detectedMime
      ? resolveSupportedReferenceMedia(mediaKind, probe.detectedMime)
      : null;
    const isoVideoAlias = mediaKind === 'video'
      && strictDeclared?.canonicalMime === 'video/quicktime'
      && strictDetected?.canonicalMime === 'video/mp4';
    if (input.referenceEligibility === 'mcp'
      && (!strictDetected || (!isoVideoAlias && strictDeclared?.canonicalMime !== strictDetected.canonicalMime))) {
      throw new MediaUploadError('UNSUPPORTED_TYPE', 'The uploaded media type is unsupported.');
    }
    const duration = normalizeSupportedReferenceDuration(mediaKind, probe.durationSec);
    if (!duration.valid || duration.durationSec === null) {
      throw new MediaUploadError('METADATA_UNVERIFIED', 'The uploaded media metadata could not be verified.');
    }

    let upload: Awaited<ReturnType<typeof uploadFileBuffer>>;
    try {
      upload = await dependencies.uploadFileBuffer({
        data: input.bytes,
        mime: probe.canonicalMime,
        fileName: input.fileName,
        userId: input.userId,
        prefix: 'user-assets',
        contentAddressed: true,
        ...(input.cleanupObjects ? {
          beforeUpload: (objectKey: string) => input.cleanupObjects!.beforeUpload({ objectRole: 'final', objectKey, safeToDelete: false }),
        } : {}),
        ...(input.signal ? { signal: input.signal } : {}),
      });
    } catch (error) {
      throw new MediaUploadError('UPLOAD_FAILED', 'The media file could not be uploaded.', { cause: error });
    }

    let previewUrl: string | null = null;
    let cleanupThumbnailKey: string | null = null;
    try {
      previewUrl = mediaKind === 'video'
          ? await dependencies.createUploadVideoThumbnail({
            data: input.bytes,
            userId: input.userId,
            fileName: input.fileName,
            ...(input.cleanupObjects ? {
              beforeUpload: async (objectKey: string) => {
                cleanupThumbnailKey = objectKey;
                await input.cleanupObjects!.beforeUpload({ objectRole: 'thumbnail', objectKey, safeToDelete: true });
              },
            } : {}),
            ...(input.signal ? { signal: input.signal } : {}),
          })
        : null;
      input.signal?.throwIfAborted();
      const metadata = {
        originalName: input.fileName,
        kind: mediaKind,
        durationSec: duration.durationSec,
        ...(previewUrl ? { thumbUrl: previewUrl } : {}),
      };
      const legacyAssetId = await dependencies.recordUserAsset({
        assetId: `ua_${createHash('sha256').update(`${input.userId}:${mediaKind}:`).update(input.bytes).digest('hex').slice(0, 32)}`,
        userId: input.userId,
        url: upload.url,
        mime: probe.canonicalMime,
        width: null,
        height: null,
        size: input.bytes.length,
        source: 'upload',
        metadata,
      });
      const canonicalAsset = await dependencies.ensureReusableAsset({
        userId: input.userId,
        url: upload.url,
        kind: mediaKind,
        source: 'upload',
        mimeType: probe.canonicalMime,
        sizeBytes: input.bytes.length,
        durationSec: duration.durationSec,
        thumbUrl: previewUrl,
        metadata: { originalName: input.fileName },
      });
      if (!canonicalAsset.publicId || !/^ma_[a-f0-9]{32}$/u.test(canonicalAsset.publicId)) {
        throw new Error('Canonical media asset has no public alias.');
      }
      if (input.cleanupObjects) {
        await input.cleanupObjects.retain(upload.key);
        if (cleanupThumbnailKey) {
          await input.cleanupObjects.retain(cleanupThumbnailKey);
        }
      }
      return {
        assetId: canonicalAsset.publicId,
        legacyAssetId,
        width: null,
        height: null,
        durationSec: duration.durationSec,
        mimeType: probe.canonicalMime,
        sizeBytes: input.bytes.length,
        previewUrl,
        storageUrl: upload.url,
      };
    } catch (error) {
      if (previewUrl && !input.cleanupObjects) {
        await dependencies.deleteStorageObjectByUrl(previewUrl).catch(() => false);
      }
      if (error instanceof MediaUploadError) throw error;
      throw new MediaUploadError('STORE_FAILED', 'The media asset could not be recorded.', { cause: error });
    }
  };
}

export function createStoreVideoUploadService(
  dependencies: Partial<StoreMediaUploadDependencies> = {},
): (input: StoreMediaUploadInput) => Promise<StoredMediaUpload> {
  return createStoreMediaUploadService('video', dependencies);
}

export function createStoreAudioUploadService(
  dependencies: Partial<StoreMediaUploadDependencies> = {},
): (input: StoreMediaUploadInput) => Promise<StoredMediaUpload> {
  return createStoreMediaUploadService('audio', dependencies);
}

export const storeVideoUpload = createStoreVideoUploadService();
export const storeAudioUpload = createStoreAudioUploadService();
