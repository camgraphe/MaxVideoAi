import { createHash } from 'node:crypto';

import sharp from 'sharp';

import { query } from '@/lib/db';
import { ensureAssetSchema } from '@/lib/schema';
import { ensureReusableAsset } from '@/server/media-library';
import { recordUserAsset, uploadImageToStorage } from '@/server/storage';
import { createUploadImageThumbnail } from '@/server/upload-thumbnails';

const DEFAULT_MAX_IMAGE_MB = 25;
const DEFAULT_MAX_IMAGE_PIXELS = 40_000_000;

function readPositiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const MAX_IMAGE_UPLOAD_MB = readPositiveNumber(
  process.env.ASSET_MAX_IMAGE_MB,
  DEFAULT_MAX_IMAGE_MB
);
export const MAX_IMAGE_UPLOAD_BYTES = Math.floor(MAX_IMAGE_UPLOAD_MB * 1024 * 1024);
export const MAX_IMAGE_UPLOAD_PIXELS = Math.floor(
  readPositiveNumber(process.env.ASSET_MAX_IMAGE_PIXELS, DEFAULT_MAX_IMAGE_PIXELS)
);

export type ImageUploadErrorCode =
  | 'EMPTY_FILE'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_TYPE'
  | 'UPLOAD_FAILED'
  | 'STORE_FAILED';

export class ImageUploadError extends Error {
  readonly code: ImageUploadErrorCode;
  readonly cause?: unknown;

  constructor(code: ImageUploadErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'ImageUploadError';
    this.code = code;
    this.cause = cause;
  }
}

export type ImageUploadLogCode =
  | 'IMAGE_UPLOAD_NORMALIZATION_FAILED'
  | 'IMAGE_UPLOAD_STORE_PREPARE_FAILED'
  | 'IMAGE_UPLOAD_STORAGE_FAILED'
  | 'IMAGE_UPLOAD_MIRROR_FAILED'
  | 'IMAGE_UPLOAD_RECORD_FAILED'
  | 'IMAGE_UPLOAD_PROJECTION_FAILED'
  | 'IMAGE_UPLOAD_UNEXPECTED_FAILURE';

export function logImageUploadEvent(level: 'error' | 'warn', code: ImageUploadLogCode): void {
  const log = level === 'error' ? console.error : console.warn;
  log(`[image-upload] code=${code}`);
}

export type StoreImageUploadParams = {
  userId: string;
  fileName: string;
  declaredMime: string | null;
  bytes: Buffer;
  cleanupObjects?: {
    beforeUpload(entry: { objectRole: 'final' | 'thumbnail'; objectKey: string; safeToDelete: boolean }): Promise<void>;
    retain(objectKey: string): Promise<void>;
  };
  signal?: AbortSignal;
};

export type StoreImageUploadResult = {
  assetId: string;
  width: number;
  height: number;
  mimeType: string;
  sizeBytes: number;
  previewUrl: string | null;
};

type NormalizedImageUpload = {
  bytes: Buffer;
  width: number;
  height: number;
  mimeType: string;
  fileName: string;
  normalizedFromMime: string | null;
};

type ExistingUploadRow = {
  asset_id: string;
  url: string;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  size_bytes: string | number | null;
  thumb_url: string | null;
};

export type StoredImageUploadRouteAsset = {
  assetId: string;
  url: string;
  width: number;
  height: number;
  mimeType: string;
  sizeBytes: number;
  thumbUrl: string | null;
};

type ImageUploadServiceDependencies = {
  decodeImageUpload: (params: {
    fileName: string;
    declaredMime: string | null;
    bytes: Buffer;
  }) => Promise<NormalizedImageUpload>;
  ensureAssetSchema: typeof ensureAssetSchema;
  query: typeof query;
  uploadImageToStorage: typeof uploadImageToStorage;
  createUploadImageThumbnail: typeof createUploadImageThumbnail;
  recordUserAsset: typeof recordUserAsset;
  ensureReusableAsset: typeof ensureReusableAsset;
  logImageUploadEvent: typeof logImageUploadEvent;
};

function normalizedFileName(fileName: string, mimeType: string): string {
  const extension =
    mimeType === 'image/jpeg'
      ? 'jpg'
      : mimeType === 'image/png'
        ? 'png'
        : mimeType === 'image/gif'
          ? 'gif'
          : mimeType === 'image/avif'
            ? 'avif'
            : 'webp';
  const baseName = fileName.replace(/\.[a-zA-Z0-9]{1,10}$/, '') || 'upload';
  return `${baseName}.${extension}`;
}

function looksLikeSvg(bytes: Buffer): boolean {
  const prefix = bytes.subarray(0, 64 * 1024).toString('utf8').replace(/^\uFEFF/, '');
  return /<(?:\?xml[\s\S]*?)?\s*svg(?:\s|>)/i.test(prefix);
}

function isBmp(bytes: Buffer): boolean {
  return bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d;
}

function assertPixelLimit(width: number, height: number): void {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width * height > MAX_IMAGE_UPLOAD_PIXELS
  ) {
    throw new ImageUploadError(
      'UNSUPPORTED_TYPE',
      `Image dimensions exceed the ${MAX_IMAGE_UPLOAD_PIXELS} pixel limit.`
    );
  }
}

function decodeBmpPixels(bytes: Buffer): {
  pixels: Buffer;
  width: number;
  height: number;
  channels: 3 | 4;
  hasAlpha: boolean;
} {
  try {
    if (bytes.length < 54 || !isBmp(bytes)) throw new Error('Invalid BMP header.');
    const pixelOffset = bytes.readUInt32LE(10);
    const dibHeaderSize = bytes.readUInt32LE(14);
    if (dibHeaderSize < 40) throw new Error('Unsupported BMP DIB header.');

    const width = bytes.readInt32LE(18);
    const signedHeight = bytes.readInt32LE(22);
    const planes = bytes.readUInt16LE(26);
    const bitsPerPixel = bytes.readUInt16LE(28);
    const compression = bytes.readUInt32LE(30);
    const height = Math.abs(signedHeight);
    if (width <= 0 || signedHeight === 0 || planes !== 1) throw new Error('Invalid BMP dimensions.');
    if ((bitsPerPixel !== 24 && bitsPerPixel !== 32) || compression !== 0) {
      throw new Error('Only uncompressed 24-bit and 32-bit BMP files are supported.');
    }
    assertPixelLimit(width, height);

    const bytesPerPixel = bitsPerPixel / 8;
    const sourceStride = Math.ceil((width * bytesPerPixel) / 4) * 4;
    const requiredBytes = pixelOffset + sourceStride * height;
    if (pixelOffset < 14 + dibHeaderSize || requiredBytes > bytes.length) {
      throw new Error('Truncated BMP pixel data.');
    }

    const channels = bitsPerPixel === 32 ? 4 : 3;
    const pixels = Buffer.allocUnsafe(width * height * channels);
    let hasAlpha = false;
    for (let outputY = 0; outputY < height; outputY += 1) {
      const sourceY = signedHeight > 0 ? height - outputY - 1 : outputY;
      for (let x = 0; x < width; x += 1) {
        const sourceOffset = pixelOffset + sourceY * sourceStride + x * bytesPerPixel;
        const outputOffset = (outputY * width + x) * channels;
        pixels[outputOffset] = bytes[sourceOffset + 2];
        pixels[outputOffset + 1] = bytes[sourceOffset + 1];
        pixels[outputOffset + 2] = bytes[sourceOffset];
        if (channels === 4) {
          const alpha = bytes[sourceOffset + 3];
          pixels[outputOffset + 3] = alpha;
          hasAlpha ||= alpha < 255;
        }
      }
    }
    return { pixels, width, height, channels, hasAlpha };
  } catch (error) {
    if (error instanceof ImageUploadError) throw error;
    throw new ImageUploadError('UNSUPPORTED_TYPE', 'The BMP image could not be decoded.', error);
  }
}

async function normalizeBmpUpload(params: {
  fileName: string;
  bytes: Buffer;
}): Promise<NormalizedImageUpload> {
  const decoded = decodeBmpPixels(params.bytes);
  const pipeline = sharp(decoded.pixels, {
    raw: {
      width: decoded.width,
      height: decoded.height,
      channels: decoded.channels,
    },
  });
  const targetMime = decoded.hasAlpha ? 'image/webp' : 'image/jpeg';
  const output = await (targetMime === 'image/webp'
    ? pipeline.webp({ quality: 90 })
    : pipeline.jpeg({ quality: 90, mozjpeg: true })
  ).toBuffer({ resolveWithObject: true });
  assertPixelLimit(output.info.width, output.info.height);
  return {
    bytes: Buffer.from(output.data),
    width: output.info.width,
    height: output.info.height,
    mimeType: targetMime,
    fileName: normalizedFileName(params.fileName, targetMime),
    normalizedFromMime: 'image/bmp',
  };
}

function sourceMimeFromMetadata(params: {
  format?: string;
  compression?: string;
  declaredMime: string | null;
  fileName: string;
}): string | null {
  if (params.format === 'jpeg') return 'image/jpeg';
  if (params.format === 'png') return 'image/png';
  if (params.format === 'webp') return 'image/webp';
  if (params.format === 'gif') return 'image/gif';
  if (params.format === 'tiff') return 'image/tiff';
  if (params.format === 'svg') return 'image/svg+xml';
  if (params.format === 'heif' && params.compression === 'av1') return 'image/avif';
  if (params.format === 'avif') return 'image/avif';
  if (params.format === 'heif') {
    const declared = params.declaredMime?.trim().toLowerCase();
    if (declared === 'image/heif') return 'image/heif';
    if (declared === 'image/heic') return 'image/heic';
    return params.fileName.toLowerCase().endsWith('.heif') ? 'image/heif' : 'image/heic';
  }
  return null;
}

export async function decodeImageUpload(params: {
  fileName: string;
  declaredMime: string | null;
  bytes: Buffer;
}): Promise<NormalizedImageUpload> {
  if (!params.bytes.length) {
    throw new ImageUploadError('EMPTY_FILE', 'The image upload is empty.');
  }
  if (params.bytes.length > MAX_IMAGE_UPLOAD_BYTES) {
    throw new ImageUploadError('FILE_TOO_LARGE', 'The image upload exceeds the byte limit.');
  }
  if (looksLikeSvg(params.bytes)) {
    throw new ImageUploadError('UNSUPPORTED_TYPE', 'SVG uploads are not supported.');
  }
  if (isBmp(params.bytes)) {
    return normalizeBmpUpload(params);
  }

  try {
    const inputOptions: sharp.SharpOptions = {
      failOn: 'error',
      limitInputPixels: MAX_IMAGE_UPLOAD_PIXELS,
      page: 0,
      pages: 1,
    };
    const metadata = await sharp(params.bytes, inputOptions).metadata();
    const width = metadata.width ?? 0;
    const height = metadata.pageHeight ?? metadata.height ?? 0;
    assertPixelLimit(width, height);

    const sourceMime = sourceMimeFromMetadata({
      format: metadata.format,
      compression: metadata.compression,
      declaredMime: params.declaredMime,
      fileName: params.fileName,
    });
    if (!sourceMime || sourceMime === 'image/svg+xml') {
      throw new ImageUploadError('UNSUPPORTED_TYPE', 'The uploaded file is not a supported raster image.');
    }

    let outputMime: string;
    let pipeline = sharp(params.bytes, inputOptions).rotate();
    if (sourceMime === 'image/jpeg') {
      outputMime = sourceMime;
      pipeline = pipeline.jpeg({ quality: 92, mozjpeg: true });
    } else if (sourceMime === 'image/png') {
      outputMime = sourceMime;
      pipeline = pipeline.png();
    } else if (sourceMime === 'image/webp') {
      outputMime = sourceMime;
      pipeline = pipeline.webp({ quality: 90 });
    } else if (sourceMime === 'image/gif') {
      outputMime = sourceMime;
      pipeline = pipeline.gif();
    } else if (sourceMime === 'image/avif') {
      outputMime = sourceMime;
      pipeline = pipeline.avif({ quality: 90 });
    } else {
      outputMime = metadata.hasAlpha ? 'image/webp' : 'image/jpeg';
      pipeline =
        outputMime === 'image/webp'
          ? pipeline.webp({ quality: 90 })
          : pipeline.jpeg({ quality: 90, mozjpeg: true });
    }

    const output = await pipeline.toBuffer({ resolveWithObject: true });
    assertPixelLimit(output.info.width, output.info.height);
    return {
      bytes: Buffer.from(output.data),
      width: output.info.width,
      height: output.info.height,
      mimeType: outputMime,
      fileName: normalizedFileName(params.fileName, outputMime),
      normalizedFromMime: sourceMime === outputMime ? null : sourceMime,
    };
  } catch (error) {
    if (error instanceof ImageUploadError) throw error;
    throw new ImageUploadError('UNSUPPORTED_TYPE', 'The image could not be decoded.', error);
  }
}

export function createImageUploadContentHash(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

const defaultDependencies: ImageUploadServiceDependencies = {
  decodeImageUpload,
  ensureAssetSchema,
  query,
  uploadImageToStorage,
  createUploadImageThumbnail,
  recordUserAsset,
  ensureReusableAsset,
  logImageUploadEvent,
};

function numericSize(value: string | number | null, fallback: number): number {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function createStoreImageUploadService(
  overrides: Partial<ImageUploadServiceDependencies> = {}
): (params: StoreImageUploadParams) => Promise<StoreImageUploadResult> {
  const dependencies = { ...defaultDependencies, ...overrides };

  return async function store(params: StoreImageUploadParams): Promise<StoreImageUploadResult> {
    params.signal?.throwIfAborted();
    if (!params.bytes.length) {
      throw new ImageUploadError('EMPTY_FILE', 'The image upload is empty.');
    }
    if (params.bytes.length > MAX_IMAGE_UPLOAD_BYTES) {
      throw new ImageUploadError('FILE_TOO_LARGE', 'The image upload exceeds the byte limit.');
    }

    let normalized: NormalizedImageUpload;
    try {
      normalized = await dependencies.decodeImageUpload({
        fileName: params.fileName,
        declaredMime: params.declaredMime,
        bytes: params.bytes,
      });
      params.signal?.throwIfAborted();
    } catch (error) {
      dependencies.logImageUploadEvent('warn', 'IMAGE_UPLOAD_NORMALIZATION_FAILED');
      throw error;
    }
    assertPixelLimit(normalized.width, normalized.height);
    const contentSha256 = createImageUploadContentHash(normalized.bytes);

    let existingAssets: ExistingUploadRow[];
    try {
      await dependencies.ensureAssetSchema();
      existingAssets = await dependencies.query<ExistingUploadRow>(
        `SELECT ua.asset_id,
                ua.url,
                ua.mime_type,
                ua.width,
                ua.height,
                ua.size_bytes,
                COALESCE(ma.thumb_url, ua.metadata->>'thumbUrl') AS thumb_url
         FROM user_assets ua
         LEFT JOIN media_assets ma
           ON ma.user_id = ua.user_id
          AND ma.url = ua.url
          AND ma.deleted_at IS NULL
         WHERE ua.user_id = $1
           AND ua.source = 'upload'
           AND ua.metadata->>'contentSha256' = $2
         ORDER BY ua.created_at DESC
         LIMIT 1`,
        [params.userId, contentSha256]
      );
    } catch (error) {
      dependencies.logImageUploadEvent('error', 'IMAGE_UPLOAD_STORE_PREPARE_FAILED');
      throw new ImageUploadError('STORE_FAILED', 'Failed to prepare the image asset store.', error);
    }

    if (existingAssets.length > 0) {
      const [asset] = existingAssets;
      return {
        assetId: asset.asset_id,
        width: asset.width ?? normalized.width,
        height: asset.height ?? normalized.height,
        mimeType: asset.mime_type ?? normalized.mimeType,
        sizeBytes: numericSize(asset.size_bytes, normalized.bytes.length),
        previewUrl: asset.thumb_url ?? asset.url,
      };
    }

    let uploadResult: Awaited<ReturnType<typeof uploadImageToStorage>>;
    try {
      uploadResult = await dependencies.uploadImageToStorage({
        data: normalized.bytes,
        mime: normalized.mimeType,
        fileName: normalized.fileName,
        userId: params.userId,
        prefix: 'user-assets',
        ...(params.cleanupObjects ? {
          beforeUpload: (objectKey: string) => params.cleanupObjects!.beforeUpload({ objectRole: 'final', objectKey, safeToDelete: true }),
        } : {}),
        ...(params.signal ? { signal: params.signal } : {}),
      });
    } catch (error) {
      dependencies.logImageUploadEvent('error', 'IMAGE_UPLOAD_STORAGE_FAILED');
      throw new ImageUploadError('UPLOAD_FAILED', 'Failed to upload the image.', error);
    }

    try {
      let cleanupThumbnailKey: string | null = null;
      const imageThumbUrl = await dependencies.createUploadImageThumbnail({
        data: normalized.bytes,
        userId: params.userId,
        fileName: normalized.fileName,
        ...(params.cleanupObjects ? {
          beforeUpload: async (objectKey: string) => {
            cleanupThumbnailKey = objectKey;
            await params.cleanupObjects!.beforeUpload({ objectRole: 'thumbnail', objectKey, safeToDelete: true });
          },
        } : {}),
        ...(params.signal ? { signal: params.signal } : {}),
      });
      params.signal?.throwIfAborted();
      const width = uploadResult.width ?? normalized.width;
      const height = uploadResult.height ?? normalized.height;
      const sizeBytes = numericSize(uploadResult.size, normalized.bytes.length);
      const mimeType = uploadResult.mime || normalized.mimeType;
      const assetId = await dependencies.recordUserAsset({
        userId: params.userId,
        url: uploadResult.url,
        mime: mimeType,
        width,
        height,
        size: sizeBytes,
        source: 'upload',
        metadata: {
          originalName: params.fileName,
          originalMime: params.declaredMime,
          normalizedFromMime: normalized.normalizedFromMime,
          contentSha256,
          thumbUrl: imageThumbUrl,
        },
      });

      await dependencies
        .ensureReusableAsset({
          userId: params.userId,
          url: uploadResult.url,
          kind: 'image',
          source: 'upload',
          mimeType,
          width,
          height,
          sizeBytes,
          thumbUrl: imageThumbUrl,
        })
        .catch(() => {
          dependencies.logImageUploadEvent('warn', 'IMAGE_UPLOAD_MIRROR_FAILED');
        });

      if (params.cleanupObjects) {
        await params.cleanupObjects.retain(uploadResult.key);
        if (cleanupThumbnailKey) await params.cleanupObjects.retain(cleanupThumbnailKey);
      }

      return {
        assetId,
        width,
        height,
        mimeType,
        sizeBytes,
        previewUrl: imageThumbUrl ?? uploadResult.url,
      };
    } catch (error) {
      if (error instanceof ImageUploadError) throw error;
      dependencies.logImageUploadEvent('error', 'IMAGE_UPLOAD_RECORD_FAILED');
      throw new ImageUploadError('STORE_FAILED', 'Failed to record the image asset.', error);
    }
  };
}

const defaultStoreImageUpload = createStoreImageUploadService();

export async function storeImageUpload(params: {
  userId: string;
  fileName: string;
  declaredMime: string | null;
  bytes: Buffer;
  cleanupObjects?: StoreImageUploadParams['cleanupObjects'];
  signal?: AbortSignal;
}): Promise<{
  assetId: string;
  width: number;
  height: number;
  mimeType: string;
  sizeBytes: number;
  previewUrl: string | null;
}> {
  return defaultStoreImageUpload(params);
}

export async function loadStoredImageUploadRouteAsset(params: {
  userId: string;
  assetId: string;
}): Promise<StoredImageUploadRouteAsset> {
  try {
    await ensureAssetSchema();
    const assets = await query<ExistingUploadRow>(
      `SELECT ua.asset_id,
              ua.url,
              ua.mime_type,
              ua.width,
              ua.height,
              ua.size_bytes,
              COALESCE(ma.thumb_url, ua.metadata->>'thumbUrl') AS thumb_url
       FROM user_assets ua
       LEFT JOIN media_assets ma
         ON ma.user_id = ua.user_id
        AND ma.url = ua.url
        AND ma.deleted_at IS NULL
       WHERE ua.user_id = $1
         AND ua.asset_id = $2
       LIMIT 1`,
      [params.userId, params.assetId]
    );
    const [asset] = assets;
    if (!asset || !asset.url || !asset.mime_type || !asset.width || !asset.height) {
      throw new Error('Stored image asset projection is incomplete.');
    }
    return {
      assetId: asset.asset_id,
      url: asset.url,
      width: asset.width,
      height: asset.height,
      mimeType: asset.mime_type,
      sizeBytes: numericSize(asset.size_bytes, 0),
      thumbUrl: asset.thumb_url,
    };
  } catch (error) {
    logImageUploadEvent('error', 'IMAGE_UPLOAD_PROJECTION_FAILED');
    throw new ImageUploadError('STORE_FAILED', 'Failed to load the stored image asset.', error);
  }
}
