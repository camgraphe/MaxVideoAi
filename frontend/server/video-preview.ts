import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { query } from '@/lib/db';
import { normalizeMediaUrl } from '@/lib/media';
import { isStorageConfigured, uploadFileBuffer } from '@/server/storage';

type EnsureJobPreviewVideoOptions = {
  jobId: string;
  userId?: string | null;
  videoUrl: string;
  existingPreviewVideoUrl?: string | null;
};

const requireForRuntime = createRequire(import.meta.url);
const DEFAULT_MAX_BYTES = 120 * 1024 * 1024;
const DEFAULT_DURATION_SECONDS = 4;
const DEFAULT_MAX_DIMENSION = 480;
const DEFAULT_FPS = 12;
const DOWNLOAD_TIMEOUT_MS = 60_000;
const PREVIEW_CACHE_CONTROL = 'public, max-age=31536000, immutable';

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
    console.warn('[video-preview] unable to resolve ffmpeg binary', error);
    resolvedFfmpegPath = null;
  }
  ffmpegPathResolved = true;
  return resolvedFfmpegPath;
}

function isDisabled(): boolean {
  return process.env.DISABLE_VIDEO_PREVIEWS === '1' || process.env.NEXT_PHASE === 'phase-production-build';
}

function getMaxBytes(): number {
  const configured = Number(process.env.VIDEO_PREVIEW_MAX_SOURCE_BYTES);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_BYTES;
}

function getPreviewDurationSeconds(): number {
  const configured = Number(process.env.VIDEO_PREVIEW_DURATION_SECONDS);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_DURATION_SECONDS;
  return Math.max(1, Math.min(6, configured));
}

function getPreviewMaxDimension(): number {
  const configured = Number(process.env.VIDEO_PREVIEW_MAX_DIMENSION);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_MAX_DIMENSION;
  return Math.max(240, Math.min(720, Math.round(configured)));
}

function getPreviewFps(): number {
  const configured = Number(process.env.VIDEO_PREVIEW_FPS);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_FPS;
  return Math.max(8, Math.min(24, Math.round(configured)));
}

function isMp4Url(videoUrl: string, contentType?: string | null): boolean {
  if (contentType?.toLowerCase().includes('video/mp4')) return true;
  try {
    return new URL(videoUrl).pathname.toLowerCase().endsWith('.mp4');
  } catch {
    return videoUrl.toLowerCase().includes('.mp4');
  }
}

async function runPreviewFfmpeg(ffmpegPath: string, inputPath: string, outputPath: string): Promise<void> {
  const dimension = String(getPreviewMaxDimension());
  const fps = String(getPreviewFps());
  const duration = getPreviewDurationSeconds().toFixed(2);
  const filter = `scale=${dimension}:${dimension}:force_original_aspect_ratio=decrease:force_divisible_by=2,fps=${fps}`;
  await new Promise<void>((resolve, reject) => {
    execFile(
      ffmpegPath,
      [
        '-y',
        '-i',
        inputPath,
        '-an',
        '-t',
        duration,
        '-vf',
        filter,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '32',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        outputPath,
      ],
      (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      }
    );
  });
}

export async function ensureJobPreviewVideo(options: EnsureJobPreviewVideoOptions): Promise<string | null> {
  const existing = normalizeMediaUrl(options.existingPreviewVideoUrl);
  if (existing) return existing;

  const sourceUrl = normalizeMediaUrl(options.videoUrl) ?? options.videoUrl;
  if (!options.jobId || !/^https?:\/\//i.test(sourceUrl)) return null;
  if (isDisabled() || !isStorageConfigured()) return null;

  const ffmpegPath = getFfmpegPath();
  if (!ffmpegPath) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  let tempDir: string | null = null;

  try {
    const response = await fetch(sourceUrl, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) {
      console.warn('[video-preview] source fetch failed', { jobId: options.jobId, status: response.status });
      return null;
    }

    const contentType = response.headers.get('content-type');
    if (!isMp4Url(sourceUrl, contentType)) return null;

    const lengthHeader = response.headers.get('content-length');
    const maxBytes = getMaxBytes();
    if (lengthHeader && Number(lengthHeader) > maxBytes) {
      console.warn('[video-preview] source too large', { jobId: options.jobId, size: Number(lengthHeader), maxBytes });
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > maxBytes) {
      console.warn('[video-preview] downloaded source too large or empty', {
        jobId: options.jobId,
        size: buffer.length,
        maxBytes,
      });
      return null;
    }

    tempDir = await mkdtemp(path.join(tmpdir(), 'mv-preview-'));
    const inputPath = path.join(tempDir, 'source.mp4');
    const outputPath = path.join(tempDir, 'preview.mp4');
    await writeFile(inputPath, buffer);
    await runPreviewFfmpeg(ffmpegPath, inputPath, outputPath);
    const preview = await readFile(outputPath);
    if (!preview.length) return null;

    const upload = await uploadFileBuffer({
      data: preview,
      mime: 'video/mp4',
      userId: options.userId ?? undefined,
      prefix: 'renders/previews',
      fileName: `${options.jobId}-preview.mp4`,
      cacheControl: PREVIEW_CACHE_CONTROL,
    });
    return normalizeMediaUrl(upload.url) ?? upload.url;
  } catch (error) {
    console.warn('[video-preview] failed', {
      jobId: options.jobId,
      error: error instanceof Error ? error.message : error,
    });
    return null;
  } finally {
    clearTimeout(timeout);
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

export async function generateAndPersistJobPreviewVideo(options: EnsureJobPreviewVideoOptions): Promise<string | null> {
  const previewUrl = await ensureJobPreviewVideo(options);
  if (!previewUrl) return null;

  await query(
    `UPDATE app_jobs
        SET preview_video_url = $2,
            updated_at = NOW()
      WHERE job_id = $1
        AND status = 'completed'
        AND (preview_video_url IS NULL OR preview_video_url = '')`,
    [options.jobId, previewUrl]
  ).catch((error) => {
    console.warn('[video-preview] failed to persist preview', {
      jobId: options.jobId,
      error: error instanceof Error ? error.message : error,
    });
  });

  await query(
    `UPDATE job_outputs
        SET preview_url = $2,
            metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('previewUrl', $2::text),
            updated_at = NOW()
      WHERE job_id = $1
        AND kind = 'video'
        AND status <> 'deleted'
        AND (preview_url IS NULL OR preview_url = '')`,
    [options.jobId, previewUrl]
  ).catch((error) => {
    console.warn('[video-preview] failed to persist output preview', {
      jobId: options.jobId,
      error: error instanceof Error ? error.message : error,
    });
  });

  await query(
    `UPDATE media_assets
        SET preview_url = $2,
            metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('previewUrl', $2::text),
            updated_at = NOW()
      WHERE source_job_id = $1
        AND kind = 'video'
        AND deleted_at IS NULL
        AND (preview_url IS NULL OR preview_url = '')`,
    [options.jobId, previewUrl]
  ).catch((error) => {
    console.warn('[video-preview] failed to persist asset preview', {
      jobId: options.jobId,
      error: error instanceof Error ? error.message : error,
    });
  });

  return previewUrl;
}
