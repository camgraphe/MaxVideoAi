import { ensureReusableAsset } from '@/server/media-library';
import { createHash } from 'node:crypto';
import { probeMediaBuffer } from '@/server/media/detect-has-audio';
import { deleteStorageObjectByUrl, uploadFileBuffer, recordUserAsset } from '@/server/storage';
import { createUploadVideoThumbnail } from '@/server/upload-thumbnails';
import {
  claimStorageObjectProducer,
  renewStorageObjectProducer,
  settleStorageObjectProducer,
  STORAGE_OBJECT_PRODUCER_LEASE_MS,
  type StorageObjectProducerClaim,
} from '@/server/storage-object-producer-claims';

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
  claimStorageObjectProducer: typeof claimStorageObjectProducer;
  renewStorageObjectProducer: typeof renewStorageObjectProducer;
  settleStorageObjectProducer: typeof settleStorageObjectProducer;
  scheduleProducerHeartbeat(callback: () => Promise<void>, intervalMs: number): () => void;
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
  claimStorageObjectProducer,
  renewStorageObjectProducer,
  settleStorageObjectProducer,
  scheduleProducerHeartbeat(callback, intervalMs) {
    const timer = setInterval(() => { void callback().catch(() => undefined); }, intervalMs);
    return () => clearInterval(timer);
  },
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
    let producerClaim: StorageObjectProducerClaim | null = null;
    const producerController = new AbortController();
    if (input.signal?.aborted) producerController.abort(input.signal.reason);
    else input.signal?.addEventListener('abort', () => producerController.abort(input.signal?.reason), { once: true });
    let producerFenceLoss: unknown = null;
    let producerRenewalTail: Promise<void> = Promise.resolve();
    let stopProducerHeartbeat: (() => Promise<void>) | null = null;
    const stopActiveProducerHeartbeat = async () => {
      const stop = stopProducerHeartbeat as (() => Promise<void>) | null;
      if (stop) await stop();
      stopProducerHeartbeat = null;
    };
    const producerCheckpoint = () => {
      if (producerFenceLoss) throw producerFenceLoss;
      producerController.signal.throwIfAborted();
    };
    const renewProducerClaim = (): Promise<void> => {
      const renewal = producerRenewalTail.then(async () => {
        if (!producerClaim) throw new Error('Storage object producer claim was not acquired.');
        producerClaim = await dependencies.renewStorageObjectProducer({ claim: producerClaim });
      }).catch((error) => {
        if (!producerFenceLoss) {
          producerFenceLoss = error;
          producerController.abort(error);
        }
        throw error;
      });
      producerRenewalTail = renewal.catch(() => undefined);
      return renewal;
    };
    try {
      upload = await dependencies.uploadFileBuffer({
        data: input.bytes,
        mime: probe.canonicalMime,
        fileName: input.fileName,
        userId: input.userId,
        prefix: 'user-assets',
        contentAddressed: true,
        beforeUpload: async (objectKey: string) => {
          input.signal?.throwIfAborted();
          producerClaim = await dependencies.claimStorageObjectProducer({ objectKey });
          const cancelHeartbeat = dependencies.scheduleProducerHeartbeat(
            renewProducerClaim,
            Math.floor(STORAGE_OBJECT_PRODUCER_LEASE_MS / 3),
          );
          stopProducerHeartbeat = async () => {
            cancelHeartbeat();
            await producerRenewalTail;
          };
          try {
            await input.cleanupObjects?.beforeUpload({ objectRole: 'final', objectKey, safeToDelete: false });
          } catch (error) {
            await stopActiveProducerHeartbeat();
            await dependencies.settleStorageObjectProducer({ claim: producerClaim, outcome: 'persisted' }).catch(() => undefined);
            producerClaim = null;
            throw error;
          }
          producerCheckpoint();
        },
        signal: producerController.signal,
      });
      producerCheckpoint();
    } catch (error) {
      await stopActiveProducerHeartbeat();
      if (producerClaim) {
        await dependencies.settleStorageObjectProducer({ claim: producerClaim, outcome: 'abandoned' }).catch(() => undefined);
      }
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
            signal: producerController.signal,
          })
        : null;
      producerCheckpoint();
      await renewProducerClaim();
      producerCheckpoint();
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
      producerCheckpoint();
      await renewProducerClaim();
      producerCheckpoint();
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
      producerCheckpoint();
      await renewProducerClaim();
      producerCheckpoint();
      if (!canonicalAsset.publicId || !/^ma_[a-f0-9]{32}$/u.test(canonicalAsset.publicId)) {
        throw new Error('Canonical media asset has no public alias.');
      }
      if (input.cleanupObjects) {
        await input.cleanupObjects.retain(upload.key);
        producerCheckpoint();
        if (cleanupThumbnailKey) {
          await input.cleanupObjects.retain(cleanupThumbnailKey);
          producerCheckpoint();
        }
      }
      await stopActiveProducerHeartbeat();
      producerCheckpoint();
      await dependencies.settleStorageObjectProducer({ claim: producerClaim!, outcome: 'persisted' });
      producerClaim = null;
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
      await stopActiveProducerHeartbeat();
      if (producerClaim) {
        await dependencies.settleStorageObjectProducer({ claim: producerClaim, outcome: 'abandoned' }).catch(() => undefined);
        producerClaim = null;
      }
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
