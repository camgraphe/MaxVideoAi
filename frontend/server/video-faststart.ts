import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { normalizeMediaUrl } from '@/lib/media';
import { isStorageConfigured, uploadFileBuffer } from '@/server/storage';

type EnsureFastStartVideoOptions = {
  jobId: string;
  userId?: string | null;
  videoUrl: string;
};

const requireForRuntime = createRequire(import.meta.url);
const DEFAULT_MAX_BYTES = 80 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 45_000;
let ffmpegPathResolved = false;
let resolvedFfmpegPath: string | null = null;

function getFfmpegPath(): string | null {
  if (ffmpegPathResolved) {
    return resolvedFfmpegPath;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ffmpeg = requireForRuntime('@ffmpeg-installer/ffmpeg');
    resolvedFfmpegPath = typeof ffmpeg === 'string' ? ffmpeg : typeof ffmpeg?.path === 'string' ? ffmpeg.path : null;
  } catch (error) {
    console.warn('[video-faststart] unable to resolve ffmpeg binary', error);
    resolvedFfmpegPath = null;
  }
  ffmpegPathResolved = true;
  return resolvedFfmpegPath;
}

function isDisabled(): boolean {
  return process.env.DISABLE_VIDEO_FASTSTART === '1' || process.env.NEXT_PHASE === 'phase-production-build';
}

function getMaxBytes(): number {
  const configured = Number(process.env.VIDEO_FASTSTART_MAX_BYTES);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_BYTES;
}

function isStorageUrl(videoUrl: string): boolean {
  try {
    const parsed = new URL(videoUrl);
    const publicBase = process.env.S3_PUBLIC_BASE_URL?.trim();
    if (publicBase) {
      const base = new URL(publicBase);
      if (parsed.host === base.host) return true;
    }
    const bucket = process.env.S3_BUCKET?.trim();
    if (!bucket) return false;
    const region = process.env.S3_REGION?.trim();
    const regionalHost = region ? `${bucket}.s3.${region}.amazonaws.com` : `${bucket}.s3.amazonaws.com`;
    return parsed.host === regionalHost;
  } catch {
    return false;
  }
}

function isMp4Url(videoUrl: string, contentType?: string | null): boolean {
  if (contentType?.toLowerCase().includes('video/mp4')) return true;
  try {
    return new URL(videoUrl).pathname.toLowerCase().endsWith('.mp4');
  } catch {
    return videoUrl.toLowerCase().includes('.mp4');
  }
}

async function runFastStart(ffmpegPath: string, inputPath: string, outputPath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    execFile(ffmpegPath, ['-y', '-i', inputPath, '-c', 'copy', '-movflags', '+faststart', outputPath], (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

export async function ensureFastStartVideo(options: EnsureFastStartVideoOptions): Promise<string | null> {
  const sourceUrl = normalizeMediaUrl(options.videoUrl) ?? options.videoUrl;
  if (!options.jobId || !/^https?:\/\//i.test(sourceUrl)) return null;
  if (isDisabled() || !isStorageConfigured() || isStorageUrl(sourceUrl)) return null;

  const ffmpegPath = getFfmpegPath();
  if (!ffmpegPath) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  let tempDir: string | null = null;

  try {
    const response = await fetch(sourceUrl, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) {
      console.warn('[video-faststart] source fetch failed', { jobId: options.jobId, status: response.status });
      return null;
    }

    const contentType = response.headers.get('content-type');
    if (!isMp4Url(sourceUrl, contentType)) return null;

    const lengthHeader = response.headers.get('content-length');
    const maxBytes = getMaxBytes();
    if (lengthHeader && Number(lengthHeader) > maxBytes) {
      console.warn('[video-faststart] source too large', { jobId: options.jobId, size: Number(lengthHeader), maxBytes });
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > maxBytes) {
      console.warn('[video-faststart] downloaded source too large or empty', {
        jobId: options.jobId,
        size: buffer.length,
        maxBytes,
      });
      return null;
    }

    tempDir = await mkdtemp(path.join(tmpdir(), 'mv-faststart-'));
    const inputPath = path.join(tempDir, 'source.mp4');
    const outputPath = path.join(tempDir, 'faststart.mp4');
    await writeFile(inputPath, buffer);
    await runFastStart(ffmpegPath, inputPath, outputPath);
    const optimized = await readFile(outputPath);
    if (!optimized.length) return null;

    const upload = await uploadFileBuffer({
      data: optimized,
      mime: 'video/mp4',
      userId: options.userId ?? undefined,
      prefix: 'renders',
      fileName: `${options.jobId}-faststart.mp4`,
      cacheControl: 'public, max-age=5184000, immutable',
    });
    return normalizeMediaUrl(upload.url) ?? upload.url;
  } catch (error) {
    console.warn('[video-faststart] failed', { jobId: options.jobId, error });
    return null;
  } finally {
    clearTimeout(timeout);
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
