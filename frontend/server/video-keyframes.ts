import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { query } from '@/lib/db';
import { normalizeMediaUrl } from '@/lib/media';
import { isStorageConfigured, uploadFileBuffer } from '@/server/storage';

export type JobKeyframeUrls = {
  start?: string | null;
  middle?: string | null;
  end?: string | null;
};

type EnsureJobKeyframesOptions = {
  jobId: string;
  userId?: string | null;
  videoUrl: string;
  durationSec?: number | null;
  existingKeyframeUrls?: unknown;
};

type KeyframeSpec = {
  key: keyof JobKeyframeUrls;
  seekSec: number;
  fileName: string;
};

const requireForRuntime = createRequire(import.meta.url);
const DEFAULT_MAX_BYTES = 120 * 1024 * 1024;
const DEFAULT_MAX_DIMENSION = 720;
const DOWNLOAD_TIMEOUT_MS = 60_000;
const KEYFRAME_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const REQUIRED_KEYS: Array<keyof JobKeyframeUrls> = ['start', 'middle', 'end'];

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
    console.warn('[video-keyframes] unable to resolve ffmpeg binary', error);
    resolvedFfmpegPath = null;
  }
  ffmpegPathResolved = true;
  return resolvedFfmpegPath;
}

function isDisabled(): boolean {
  return process.env.DISABLE_VIDEO_KEYFRAMES === '1' || process.env.NEXT_PHASE === 'phase-production-build';
}

function getMaxBytes(): number {
  const configured = Number(process.env.VIDEO_KEYFRAMES_MAX_SOURCE_BYTES);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_BYTES;
}

function getMaxDimension(): number {
  const configured = Number(process.env.VIDEO_KEYFRAMES_MAX_DIMENSION);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_MAX_DIMENSION;
  return Math.max(360, Math.min(1080, Math.round(configured)));
}

function normalizeKeyframeValue(value: unknown): string | null {
  return typeof value === 'string' ? normalizeMediaUrl(value) ?? value : null;
}

export function normalizeJobKeyframeUrls(value: unknown): JobKeyframeUrls | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const normalized = {
    start: normalizeKeyframeValue(record.start),
    middle: normalizeKeyframeValue(record.middle),
    end: normalizeKeyframeValue(record.end),
  };
  return REQUIRED_KEYS.every((key) => Boolean(normalized[key])) ? normalized : null;
}

function buildKeyframeSpecs(durationSec?: number | null): KeyframeSpec[] {
  const duration = Number.isFinite(Number(durationSec)) && Number(durationSec) > 0 ? Number(durationSec) : 6;
  const endSafe = Math.max(0.2, duration - 0.35);
  return [
    { key: 'start', seekSec: Math.min(endSafe, 0.15), fileName: 'start.jpg' },
    { key: 'middle', seekSec: Math.min(endSafe, Math.max(0, duration * 0.5)), fileName: 'middle.jpg' },
    { key: 'end', seekSec: endSafe, fileName: 'end.jpg' },
  ];
}

function isMp4Url(videoUrl: string, contentType?: string | null): boolean {
  if (contentType?.toLowerCase().includes('video/mp4')) return true;
  try {
    return new URL(videoUrl).pathname.toLowerCase().endsWith('.mp4');
  } catch {
    return videoUrl.toLowerCase().includes('.mp4');
  }
}

async function runKeyframeFfmpeg(ffmpegPath: string, inputPath: string, outputPath: string, seekSec: number): Promise<void> {
  const dimension = String(getMaxDimension());
  await new Promise<void>((resolve, reject) => {
    execFile(
      ffmpegPath,
      [
        '-y',
        '-ss',
        Math.max(0, seekSec).toFixed(2),
        '-i',
        inputPath,
        '-frames:v',
        '1',
        '-vf',
        `scale=${dimension}:${dimension}:force_original_aspect_ratio=decrease:force_divisible_by=2`,
        '-q:v',
        '3',
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

export async function ensureJobKeyframes(options: EnsureJobKeyframesOptions): Promise<JobKeyframeUrls | null> {
  const existing = normalizeJobKeyframeUrls(options.existingKeyframeUrls);
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
      console.warn('[video-keyframes] source fetch failed', { jobId: options.jobId, status: response.status });
      return null;
    }

    const contentType = response.headers.get('content-type');
    if (!isMp4Url(sourceUrl, contentType)) return null;

    const lengthHeader = response.headers.get('content-length');
    const maxBytes = getMaxBytes();
    if (lengthHeader && Number(lengthHeader) > maxBytes) {
      console.warn('[video-keyframes] source too large', { jobId: options.jobId, size: Number(lengthHeader), maxBytes });
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > maxBytes) {
      console.warn('[video-keyframes] downloaded source too large or empty', {
        jobId: options.jobId,
        size: buffer.length,
        maxBytes,
      });
      return null;
    }

    tempDir = await mkdtemp(path.join(tmpdir(), 'mv-keyframes-'));
    const inputPath = path.join(tempDir, 'source.mp4');
    await writeFile(inputPath, buffer);

    const result: JobKeyframeUrls = {};
    for (const spec of buildKeyframeSpecs(options.durationSec)) {
      const outputPath = path.join(tempDir, spec.fileName);
      await runKeyframeFfmpeg(ffmpegPath, inputPath, outputPath, spec.seekSec);
      const data = await readFile(outputPath);
      if (!data.length) return null;
      const upload = await uploadFileBuffer({
        data,
        mime: 'image/jpeg',
        userId: options.userId ?? undefined,
        prefix: 'renders/keyframes',
        fileName: `${options.jobId}-${spec.fileName}`,
        cacheControl: KEYFRAME_CACHE_CONTROL,
      });
      result[spec.key] = normalizeMediaUrl(upload.url) ?? upload.url;
    }

    return normalizeJobKeyframeUrls(result);
  } catch (error) {
    console.warn('[video-keyframes] failed', {
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

export async function generateAndPersistJobKeyframes(options: EnsureJobKeyframesOptions): Promise<JobKeyframeUrls | null> {
  const keyframes = await ensureJobKeyframes(options);
  if (!keyframes) return null;

  await query(
    `UPDATE app_jobs
        SET keyframe_urls = $2::jsonb,
            updated_at = NOW()
      WHERE job_id = $1
        AND status = 'completed'
        AND (keyframe_urls IS NULL OR keyframe_urls = '{}'::jsonb)`,
    [options.jobId, JSON.stringify(keyframes)]
  ).catch((error) => {
    console.warn('[video-keyframes] failed to persist keyframes', {
      jobId: options.jobId,
      error: error instanceof Error ? error.message : error,
    });
  });

  return keyframes;
}
