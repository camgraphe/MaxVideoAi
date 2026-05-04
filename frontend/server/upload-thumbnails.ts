import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

import sharp from 'sharp';

import { normalizeMediaUrl } from '@/lib/media';
import { uploadImageToStorage } from '@/server/storage';

const requireForRuntime = createRequire(import.meta.url);
const DEFAULT_MAX_DIMENSION = Number.parseInt(process.env.UPLOAD_THUMB_MAX_DIMENSION ?? '640', 10);
const DEFAULT_IMAGE_QUALITY = Number.parseInt(process.env.UPLOAD_THUMB_IMAGE_QUALITY ?? '76', 10);

let resolvedFfmpegPath: string | null | undefined;

type UploadThumbnailParams = {
  data: Buffer;
  userId?: string | null;
  fileName?: string | null;
};

function normalizePositiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.max(1, Math.round(value));
}

function baseName(fileName?: string | null): string {
  const raw = fileName?.trim() || 'upload';
  const withoutExtension = raw.replace(/\.[a-zA-Z0-9]{1,10}$/, '') || 'upload';
  return withoutExtension.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').slice(0, 80) || 'upload';
}

function getFfmpegPath(): string | null {
  if (resolvedFfmpegPath !== undefined) return resolvedFfmpegPath;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ffmpeg = requireForRuntime('@ffmpeg-installer/ffmpeg');
    resolvedFfmpegPath =
      typeof ffmpeg === 'string' ? ffmpeg : typeof ffmpeg?.path === 'string' ? ffmpeg.path : null;
  } catch (error) {
    console.warn('[upload-thumbnails] unable to resolve ffmpeg binary', error);
    resolvedFfmpegPath = null;
  }
  return resolvedFfmpegPath ?? null;
}

export async function createUploadImageThumbnail(params: UploadThumbnailParams): Promise<string | null> {
  if (!params.data.length) return null;

  try {
    const maxDimension = normalizePositiveInt(DEFAULT_MAX_DIMENSION, 640);
    const quality = normalizePositiveInt(DEFAULT_IMAGE_QUALITY, 76);
    const thumb = await sharp(params.data, { failOn: 'none' })
      .rotate()
      .resize({
        width: maxDimension,
        height: maxDimension,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality })
      .toBuffer();

    const upload = await uploadImageToStorage({
      data: thumb,
      mime: 'image/webp',
      userId: params.userId ?? undefined,
      prefix: 'user-asset-thumbs',
      fileName: `${baseName(params.fileName)}-thumb.webp`,
    });

    return normalizeMediaUrl(upload.url) ?? upload.url;
  } catch (error) {
    console.warn('[upload-thumbnails] failed to create image thumbnail', {
      fileName: params.fileName ?? null,
      error,
    });
    return null;
  }
}

export async function createUploadVideoThumbnail(params: UploadThumbnailParams): Promise<string | null> {
  if (!params.data.length) return null;

  const ffmpegPath = getFfmpegPath();
  if (!ffmpegPath) return null;

  const tempDir = await mkdtemp(path.join(tmpdir(), 'mv-upload-thumb-'));
  const inputPath = path.join(tempDir, 'source');
  const outputPath = path.join(tempDir, 'thumb.jpg');

  try {
    await writeFile(inputPath, params.data);
    await runFfmpeg(ffmpegPath, inputPath, outputPath);
    const thumb = await readFile(outputPath);
    if (!thumb.length) return null;

    const upload = await uploadImageToStorage({
      data: thumb,
      mime: 'image/jpeg',
      userId: params.userId ?? undefined,
      prefix: 'user-asset-thumbs',
      fileName: `${baseName(params.fileName)}-thumb.jpg`,
    });

    return normalizeMediaUrl(upload.url) ?? upload.url;
  } catch (error) {
    console.warn('[upload-thumbnails] failed to create video thumbnail', {
      fileName: params.fileName ?? null,
      error,
    });
    return null;
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

function runFfmpeg(ffmpegPath: string, inputPath: string, outputPath: string): Promise<void> {
  const args = ['-y', '-ss', '0.75', '-i', inputPath, '-frames:v', '1', '-vf', 'scale=640:-2', '-q:v', '4', outputPath];

  return new Promise((resolve, reject) => {
    execFile(ffmpegPath, args, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}
