import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { uploadImageToStorage, type UploadResult } from '@/server/storage';
import { normalizeMediaUrl } from '@/lib/media';

const PLACEHOLDER_PREFIX = '/assets/frames/';
const requireForRuntime = createRequire(import.meta.url);
let ffmpegPathResolved = false;
let resolvedFfmpegPath: string | null = null;

function getFfmpegPath(): string | null {
  if (ffmpegPathResolved) {
    return resolvedFfmpegPath;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ffmpeg = requireForRuntime('@ffmpeg-installer/ffmpeg');
    const candidate =
      typeof ffmpeg === 'string'
        ? ffmpeg
        : typeof ffmpeg?.path === 'string'
          ? ffmpeg.path
          : null;
    resolvedFfmpegPath = candidate;
    ffmpegPathResolved = true;
    return resolvedFfmpegPath;
  } catch (error) {
    console.warn('[thumbnails] unable to resolve ffmpeg binary', error);
    resolvedFfmpegPath = null;
    ffmpegPathResolved = true;
    return resolvedFfmpegPath;
  }
}

const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';
const isThumbnailCaptureDisabled = process.env.DISABLE_THUMBNAIL_CAPTURE === '1';
const isOmittedForSSR = process.env.NEXT_PUBLIC_ENABLE_THUMBNAILS !== 'true';

type EnsureThumbnailOptions = {
  jobId: string;
  userId?: string | null;
  videoUrl: string;
  aspectRatio?: string | null;
  force?: boolean;
  existingThumbUrl?: string | null;
};

export function isPlaceholderThumbnail(url?: string | null): boolean {
  if (!url) return true;
  const trimmed = url.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith(PLACEHOLDER_PREFIX)) return true;
  try {
    const parsed = new URL(trimmed, 'https://placeholder.local');
    return parsed.pathname.startsWith(PLACEHOLDER_PREFIX);
  } catch {
    return false;
  }
}

export async function ensureJobThumbnail(options: EnsureThumbnailOptions): Promise<string | null> {
  const { jobId, userId, videoUrl, aspectRatio, existingThumbUrl, force = false } = options;
  if (!videoUrl || !jobId) return null;
  if (isBuildPhase || isThumbnailCaptureDisabled || isOmittedForSSR) return null;

  const normalizedExisting = existingThumbUrl ? normalizeMediaUrl(existingThumbUrl) ?? existingThumbUrl : null;
  if (!force && normalizedExisting && !isPlaceholderThumbnail(normalizedExisting)) {
    return normalizedExisting;
  }

  try {
    const upload = await captureThumbnailFromVideo({
      jobId,
      userId: userId ?? undefined,
      videoUrl,
      aspectRatio: aspectRatio ?? undefined,
    });
    if (!upload) return null;
    return normalizeMediaUrl(upload.url) ?? upload.url;
  } catch (error) {
    console.warn('[thumbnails] failed to create thumbnail', { jobId, videoUrl, error });
    return null;
  }
}

async function captureThumbnailFromVideo(params: {
  jobId: string;
  userId?: string;
  videoUrl: string;
  aspectRatio?: string;
}): Promise<UploadResult | null> {
  if (isBuildPhase || isThumbnailCaptureDisabled || isOmittedForSSR) {
    return null;
  }

  const ffmpegPath = getFfmpegPath();
  if (!ffmpegPath) {
    console.warn('[thumbnails] ffmpeg binary path not resolved');
    return null;
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), 'mv-thumb-'));
  const inputPath = path.join(tempDir, 'source');
  const outputPath = path.join(tempDir, 'thumb.jpg');

  try {
    const response = await fetch(params.videoUrl);
    if (!response.ok) {
      console.warn('[thumbnails] failed to fetch video for thumbnail', {
        jobId: params.jobId,
        status: response.status,
      });
      return null;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(inputPath, buffer);

    const seeks = [1.5, 0.5, 0];
    let success = false;
    for (const seek of seeks) {
      try {
        await runFfmpeg(ffmpegPath, inputPath, outputPath, seek, params.aspectRatio);
        success = true;
        break;
      } catch (error) {
        console.warn('[thumbnails] ffmpeg attempt failed', { jobId: params.jobId, seek, error });
      }
    }

    if (!success) {
      return null;
    }

    const imageBuffer = await readFile(outputPath);
    if (!imageBuffer.length) {
      return null;
    }

    const upload = await uploadImageToStorage({
      data: imageBuffer,
      mime: 'image/jpeg',
      userId: params.userId,
      prefix: 'renders',
      fileName: `${params.jobId}.jpg`,
    });
    return upload;
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

function runFfmpeg(
  ffmpegPath: string,
  inputPath: string,
  outputPath: string,
  seek: number,
  aspectRatio?: string
): Promise<void> {
  const seekValue = seek > 0 ? seek.toFixed(2) : '0';
  const vfArgs = buildVideoFilter(aspectRatio);
  const args = ['-y'];
  if (seek > 0) {
    args.push('-ss', seekValue);
  }
  args.push('-i', inputPath, '-frames:v', '1');
  if (vfArgs.length) {
    args.push('-vf', vfArgs.join(','));
  }
  args.push('-q:v', '3', outputPath);

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

function buildVideoFilter(aspectRatio?: string): string[] {
  const filters: string[] = [];
  if (aspectRatio === '9:16') {
    filters.push('scale=720:-2');
  } else if (aspectRatio === '1:1') {
    filters.push('scale=720:720');
  } else {
    filters.push('scale=1280:-2');
  }
  filters.push('fps=1');
  return filters;
}
