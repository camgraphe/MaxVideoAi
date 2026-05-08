import sharp from 'sharp';
import { query } from '@/lib/db';
import { ensureAssetSchema } from '@/lib/schema';
import {
  createSignedDownloadUrl,
  extractStorageKeyFromUrl,
  isAllowedAssetHost,
  isStorageConfigured,
  recordUserAsset,
  uploadImageToStorage,
} from '@/server/storage';
import {
  inferImageFormatFromUrl,
  isSupportedImageFormat,
  isSupportedImageMime,
} from '@/lib/image/formats';

const SIGNED_REFERENCE_URL_TTL_SECONDS = 60 * 60;
const NORMALIZED_REFERENCE_FETCH_TIMEOUT_MS = Number.parseInt(
  process.env.NORMALIZED_REFERENCE_FETCH_TIMEOUT_MS ?? '12000',
  10
);

export type StoredAssetInfo = {
  mime?: string | null;
  width?: number | null;
  height?: number | null;
};

export async function getStoredAssetInfoByUrl(userId: string, urls: string[]): Promise<Map<string, StoredAssetInfo>> {
  if (!urls.length) {
    return new Map();
  }

  try {
    await ensureAssetSchema();
    const rows = await query<{ url: string; mime_type: string | null; width: number | null; height: number | null }>(
      `SELECT url, mime_type, width, height
       FROM user_assets
       WHERE user_id = $1
         AND url = ANY($2::text[])`,
      [userId, urls]
    );
    return new Map(
      rows
        .filter((row) => typeof row.url === 'string')
        .map((row) => [
          row.url,
          {
            mime: row.mime_type,
            width: typeof row.width === 'number' ? row.width : null,
            height: typeof row.height === 'number' ? row.height : null,
          },
        ])
    );
  } catch (error) {
    console.warn('[images] unable to inspect stored asset formats', error);
    return new Map();
  }
}

export function isReferenceImageSupported(
  allowedFormats: string[],
  url: string,
  storedAssetInfoByUrl: Map<string, StoredAssetInfo>
): boolean {
  const storedMime = storedAssetInfoByUrl.get(url)?.mime ?? null;
  const supportedByMime = isSupportedImageMime(allowedFormats, storedMime);
  if (supportedByMime != null) {
    return supportedByMime;
  }
  const inferredFormat = inferImageFormatFromUrl(url);
  if (!inferredFormat) {
    return true;
  }
  return isSupportedImageFormat(allowedFormats, inferredFormat);
}

export function pickNormalizedReferenceMime(allowedFormats: string[], hasAlpha: boolean): string | null {
  const formats = new Set(allowedFormats.map((entry) => entry.trim().toLowerCase()).filter(Boolean));
  const supportsJpeg = formats.has('jpg') || formats.has('jpeg');
  const supportsPng = formats.has('png');
  const supportsWebp = formats.has('webp');
  const supportsAvif = formats.has('avif');

  if (hasAlpha) {
    if (supportsWebp) return 'image/webp';
    if (supportsPng) return 'image/png';
    if (supportsJpeg) return 'image/jpeg';
    if (supportsAvif) return 'image/avif';
    return null;
  }

  if (supportsJpeg) return 'image/jpeg';
  if (supportsWebp) return 'image/webp';
  if (supportsPng) return 'image/png';
  if (supportsAvif) return 'image/avif';
  return null;
}

async function fetchBufferFromUrl(url: string, timeoutMs: number): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`source fetch failed (${response.status})`);
    }
    const payload = await response.arrayBuffer();
    const buffer = Buffer.from(payload);
    if (!buffer.length) {
      throw new Error('source image is empty');
    }
    return buffer;
  } finally {
    clearTimeout(timer);
  }
}

export async function normalizeReferenceImageForEngine(params: {
  userId: string;
  url: string;
  supportedFormats: string[];
  engineId: string;
}): Promise<{ url: string; mime: string }> {
  if (!isAllowedAssetHost(params.url)) {
    throw new Error('reference host is not eligible for server-side normalization');
  }

  const storageKey = extractStorageKeyFromUrl(params.url);
  const sourceUrl =
    storageKey && isStorageConfigured()
      ? await createSignedDownloadUrl(storageKey, { expiresInSeconds: SIGNED_REFERENCE_URL_TTL_SECONDS })
      : params.url;

  const sourceBuffer = await fetchBufferFromUrl(sourceUrl, NORMALIZED_REFERENCE_FETCH_TIMEOUT_MS);
  const metadata = await sharp(sourceBuffer, { failOn: 'none' }).metadata();
  const targetMime = pickNormalizedReferenceMime(params.supportedFormats, metadata.hasAlpha === true);
  if (!targetMime) {
    throw new Error('no compatible target mime available for normalization');
  }

  let pipeline = sharp(sourceBuffer, { failOn: 'none' }).rotate();
  if (targetMime === 'image/jpeg') {
    pipeline = pipeline.jpeg({ quality: 90, mozjpeg: true });
  } else if (targetMime === 'image/png') {
    pipeline = pipeline.png();
  } else if (targetMime === 'image/webp') {
    pipeline = pipeline.webp({ quality: 90 });
  } else if (targetMime === 'image/avif') {
    pipeline = pipeline.avif({ quality: 72 });
  }

  const normalizedBuffer = await pipeline.toBuffer();
  const upload = await uploadImageToStorage({
    data: normalizedBuffer,
    mime: targetMime,
    userId: params.userId,
    fileName: params.url.split('/').pop() ?? 'reference-image',
    prefix: 'normalized-references',
  });

  try {
    await recordUserAsset({
      userId: params.userId,
      url: upload.url,
      mime: upload.mime,
      width: upload.width,
      height: upload.height,
      size: upload.size,
      source: 'normalized_reference',
      metadata: {
        originalUrl: params.url,
        engineId: params.engineId,
        supportedFormats: params.supportedFormats,
      },
    });
  } catch (error) {
    console.warn('[images] failed to record normalized reference asset', error);
  }

  return { url: upload.url, mime: upload.mime };
}
