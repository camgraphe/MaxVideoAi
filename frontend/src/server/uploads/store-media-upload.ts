import { ensureReusableAsset } from '@/server/media-library';
import { detectMediaBufferDuration } from '@/server/media/detect-has-audio';
import { uploadFileBuffer, recordUserAsset } from '@/server/storage';
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
  detectMediaBufferDuration: typeof detectMediaBufferDuration;
  uploadFileBuffer: typeof uploadFileBuffer;
  createUploadVideoThumbnail: typeof createUploadVideoThumbnail;
  recordUserAsset: typeof recordUserAsset;
  ensureReusableAsset: typeof ensureReusableAsset;
};

export type StoreMediaUploadInput = {
  userId: string;
  fileName: string;
  declaredMime: string | null;
  bytes: Buffer;
  verifiedDurationSec?: number | null;
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
  detectMediaBufferDuration,
  uploadFileBuffer,
  createUploadVideoThumbnail,
  recordUserAsset,
  ensureReusableAsset,
};

function createStoreMediaUploadService(
  mediaKind: Exclude<CanonicalReferenceMediaKind, 'image'>,
  overrides: Partial<StoreMediaUploadDependencies> = {},
): (input: StoreMediaUploadInput) => Promise<StoredMediaUpload> {
  const dependencies = { ...defaultDependencies, ...overrides };
  return async (input) => {
    if (!input.bytes.length) {
      throw new MediaUploadError('EMPTY_FILE', 'The uploaded media file is empty.');
    }
    const supported = resolveSupportedReferenceMedia(mediaKind, input.declaredMime);
    if (!supported) {
      throw new MediaUploadError('UNSUPPORTED_TYPE', 'The uploaded media type is unsupported.');
    }
    const durationSec = input.verifiedDurationSec === undefined
      ? await dependencies.detectMediaBufferDuration(input.bytes, {
          fileName: input.fileName,
          mimeType: supported.canonicalMime,
          streamSelector: mediaKind,
        })
      : input.verifiedDurationSec;
    const duration = normalizeSupportedReferenceDuration(mediaKind, durationSec);
    if (!duration.valid || duration.durationSec === null) {
      throw new MediaUploadError('METADATA_UNVERIFIED', 'The uploaded media metadata could not be verified.');
    }

    let upload: Awaited<ReturnType<typeof uploadFileBuffer>>;
    try {
      upload = await dependencies.uploadFileBuffer({
        data: input.bytes,
        mime: supported.canonicalMime,
        fileName: input.fileName,
        userId: input.userId,
        prefix: 'user-assets',
      });
    } catch (error) {
      throw new MediaUploadError('UPLOAD_FAILED', 'The media file could not be uploaded.', { cause: error });
    }

    try {
      const previewUrl = mediaKind === 'video'
        ? await dependencies.createUploadVideoThumbnail({
            data: input.bytes,
            userId: input.userId,
            fileName: input.fileName,
          })
        : null;
      const metadata = {
        originalName: input.fileName,
        kind: mediaKind,
        durationSec: duration.durationSec,
        ...(previewUrl ? { thumbUrl: previewUrl } : {}),
      };
      const legacyAssetId = await dependencies.recordUserAsset({
        userId: input.userId,
        url: upload.url,
        mime: supported.canonicalMime,
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
        mimeType: supported.canonicalMime,
        sizeBytes: input.bytes.length,
        durationSec: duration.durationSec,
        thumbUrl: previewUrl,
        metadata: { originalName: input.fileName },
      });
      return {
        assetId: canonicalAsset.id,
        legacyAssetId,
        width: null,
        height: null,
        durationSec: duration.durationSec,
        mimeType: supported.canonicalMime,
        sizeBytes: input.bytes.length,
        previewUrl,
        storageUrl: upload.url,
      };
    } catch (error) {
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
