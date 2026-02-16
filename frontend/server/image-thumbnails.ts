import pLimit from 'p-limit';
import sharp from 'sharp';
import { normalizeMediaUrl } from '@/lib/media';
import { uploadImageToStorage } from '@/server/storage';

type ThumbnailInput = {
  jobId: string;
  imageUrl: string;
  userId?: string | null;
  index: number;
  maxDimension?: number;
  fetchTimeoutMs?: number;
  processingTimeoutMs?: number;
};

type BatchInput = {
  jobId: string;
  userId?: string | null;
  imageUrls: string[];
  maxDimension?: number;
  concurrency?: number;
  fetchTimeoutMs?: number;
  processingTimeoutMs?: number;
};

const DEFAULT_MAX_DIMENSION = Number.parseInt(process.env.IMAGE_THUMB_MAX_DIMENSION ?? '640', 10);
const DEFAULT_WEBP_QUALITY = Number.parseInt(process.env.IMAGE_THUMB_WEBP_QUALITY ?? '72', 10);
const DEFAULT_JPEG_QUALITY = Number.parseInt(process.env.IMAGE_THUMB_JPEG_QUALITY ?? '80', 10);
const DEFAULT_FETCH_TIMEOUT_MS = Number.parseInt(process.env.IMAGE_THUMB_FETCH_TIMEOUT_MS ?? '10000', 10);
const DEFAULT_PROCESSING_TIMEOUT_MS = Number.parseInt(process.env.IMAGE_THUMB_PROCESSING_TIMEOUT_MS ?? '12000', 10);
const DEFAULT_CONCURRENCY = Number.parseInt(process.env.IMAGE_THUMB_CONCURRENCY ?? '2', 10);

function normalizePositiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.max(1, Math.round(value));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function fetchSourceImage(url: string, timeoutMs: number): Promise<Buffer> {
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

async function encodeThumb(source: Buffer, maxDimension: number): Promise<{ data: Buffer; mime: string }> {
  const pipeline = sharp(source, { failOn: 'none' })
    .rotate()
    .resize({
      width: maxDimension,
      height: maxDimension,
      fit: 'inside',
      withoutEnlargement: true,
    });

  try {
    const output = await pipeline
      .clone()
      .webp({ quality: normalizePositiveInt(DEFAULT_WEBP_QUALITY, 72) })
      .toBuffer();
    return { data: output, mime: 'image/webp' };
  } catch {
    const output = await pipeline
      .clone()
      .jpeg({ quality: normalizePositiveInt(DEFAULT_JPEG_QUALITY, 80), mozjpeg: true })
      .toBuffer();
    return { data: output, mime: 'image/jpeg' };
  }
}

export async function createImageThumbnail(input: ThumbnailInput): Promise<string | null> {
  const normalizedUrl = normalizeMediaUrl(input.imageUrl);
  if (!normalizedUrl || !/^https?:\/\//i.test(normalizedUrl)) {
    return null;
  }
  const maxDimension = normalizePositiveInt(input.maxDimension ?? DEFAULT_MAX_DIMENSION, 640);
  const fetchTimeoutMs = normalizePositiveInt(input.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS, 10000);
  const processingTimeoutMs = normalizePositiveInt(
    input.processingTimeoutMs ?? DEFAULT_PROCESSING_TIMEOUT_MS,
    12000
  );

  try {
    const source = await withTimeout(fetchSourceImage(normalizedUrl, fetchTimeoutMs), fetchTimeoutMs + 500, 'fetch');
    const encoded = await withTimeout(encodeThumb(source, maxDimension), processingTimeoutMs, 'image processing');
    const extension = encoded.mime === 'image/webp' ? 'webp' : 'jpg';
    const upload = await withTimeout(
      uploadImageToStorage({
        data: encoded.data,
        mime: encoded.mime,
        userId: input.userId ?? undefined,
        prefix: 'renders/thumbs',
        fileName: `${input.jobId}-${input.index + 1}.${extension}`,
      }),
      processingTimeoutMs,
      'thumbnail upload'
    );
    return normalizeMediaUrl(upload.url) ?? upload.url;
  } catch (error) {
    console.warn('[image-thumbnails] failed to create image thumbnail', {
      jobId: input.jobId,
      index: input.index,
      imageUrl: normalizedUrl,
      error,
    });
    return null;
  }
}

export async function createImageThumbnailBatch(input: BatchInput): Promise<Array<string | null>> {
  if (!input.imageUrls.length) return [];
  const concurrency = normalizePositiveInt(input.concurrency ?? DEFAULT_CONCURRENCY, 2);
  const limit = pLimit(concurrency);

  return await Promise.all(
    input.imageUrls.map((imageUrl, index) =>
      limit(() =>
        createImageThumbnail({
          jobId: input.jobId,
          userId: input.userId ?? null,
          imageUrl,
          index,
          maxDimension: input.maxDimension,
          fetchTimeoutMs: input.fetchTimeoutMs,
          processingTimeoutMs: input.processingTimeoutMs,
        })
      )
    )
  );
}
