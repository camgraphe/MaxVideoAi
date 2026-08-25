import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import ffprobe from 'ffprobe-static';

const execFileAsync = promisify(execFile);

type DetectOptions = {
  timeoutMs?: number;
  signal?: AbortSignal;
};

type DetectBufferOptions = DetectOptions & {
  fileName?: string | null;
  mimeType?: string | null;
  streamSelector?: 'audio' | 'video';
};

export type ProbedMediaBuffer = {
  kind: 'video' | 'audio';
  canonicalMime: string;
  detectedMime: string | null;
  durationSec: number;
};

type ProbeMetadata = {
  streams?: Array<{
    codec_type?: string;
    duration?: string;
    disposition?: { attached_pic?: number };
  }>;
  format?: { format_name?: string; duration?: string };
};

function canonicalMimeForProbe(kind: 'video' | 'audio', formatName: string): string | null {
  const formats = new Set(formatName.toLowerCase().split(',').map((value) => value.trim()));
  if (kind === 'video') {
    if (formats.has('webm') || formats.has('matroska')) return 'video/webm';
    if (formats.has('ogg')) return 'video/ogg';
    if (formats.has('avi')) return 'video/x-msvideo';
    if (formats.has('mpegts')) return 'video/mp2t';
    if (formats.has('flv')) return 'video/x-flv';
    if (formats.has('mxf')) return 'video/mxf';
    if (formats.has('asf')) return 'video/x-ms-asf';
    if (formats.has('mov') || formats.has('mp4') || formats.has('m4v')) return 'video/mp4';
    return null;
  }
  if (formats.has('mp3')) return 'audio/mpeg';
  if (formats.has('wav')) return 'audio/wav';
  if (formats.has('ogg')) return 'audio/ogg';
  if (formats.has('webm') || formats.has('matroska')) return 'audio/webm';
  if (formats.has('flac')) return 'audio/flac';
  if (formats.has('aac')) return 'audio/aac';
  if (formats.has('aiff')) return 'audio/aiff';
  if (formats.has('mov') || formats.has('mp4') || formats.has('m4a')) return 'audio/mp4';
  return null;
}

export function resolveProbedMediaMetadata(
  metadata: ProbeMetadata,
  options: { declaredMime?: string | null } = {},
): ProbedMediaBuffer | null {
  const streams = metadata.streams ?? [];
  const hasVideo = streams.some((stream) => stream.codec_type === 'video' && stream.disposition?.attached_pic !== 1);
  const hasAudio = streams.some((stream) => stream.codec_type === 'audio');
  const kind = hasVideo ? 'video' : hasAudio ? 'audio' : null;
  if (!kind) return null;
  const declaredMime = options.declaredMime?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  const safeDeclaredMime = declaredMime.startsWith(`${kind}/`) && /^[a-z]+\/[a-z0-9.+-]+$/u.test(declaredMime)
    ? declaredMime : null;
  const detectedMime = canonicalMimeForProbe(kind, metadata.format?.format_name ?? '');
  const canonicalMime = detectedMime ?? safeDeclaredMime;
  if (!canonicalMime) return null;
  const streamDuration = streams.find((stream) => stream.codec_type === kind
    && (kind !== 'video' || stream.disposition?.attached_pic !== 1))?.duration;
  const durationSec = Number.parseFloat(metadata.format?.duration ?? streamDuration ?? '');
  if (!Number.isFinite(durationSec) || durationSec <= 0) return null;
  return { kind, canonicalMime, detectedMime, durationSec: Math.round(durationSec * 1000) / 1000 };
}

export async function probeMediaBuffer(
  mediaBuffer: Buffer,
  options: Omit<DetectBufferOptions, 'streamSelector'> = {},
): Promise<ProbedMediaBuffer | null> {
  if (!ffprobe.path || !mediaBuffer.length) return null;
  const timeoutMs = options.timeoutMs ?? 12_000;
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'maxvideo-media-probe-'));
  const temporaryFile = join(temporaryDirectory, `input.${resolveTemporaryMediaExtension(options)}`);
  try {
    await writeFile(temporaryFile, mediaBuffer);
    const { stdout } = await execFileAsync(ffprobe.path, [
      '-v', 'error',
      '-show_entries', 'stream=codec_type,duration:stream_disposition=attached_pic:format=format_name,duration',
      '-of', 'json',
      temporaryFile,
    ], { timeout: timeoutMs, maxBuffer: 1024 * 1024, signal: options.signal });
    return resolveProbedMediaMetadata(JSON.parse(stdout) as ProbeMetadata, { declaredMime: options.mimeType });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error running ffprobe';
    console.warn('[media-probe] ffprobe buffer probe failed', { reason });
    return null;
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
}

export type VideoDimensions = {
  width: number;
  height: number;
};

export type VideoMetadata = VideoDimensions & {
  durationSec: number;
  fps: number;
};

export async function detectMediaDuration(
  mediaUrl: string,
  options: DetectOptions = {},
  streamSelector?: 'a' | 'v'
): Promise<number | null> {
  if (!ffprobe.path) {
    console.warn('[media-duration] ffprobe binary not available.');
    return null;
  }
  if (!mediaUrl || !/^https?:\/\//i.test(mediaUrl)) {
    return null;
  }

  const timeoutMs = options.timeoutMs ?? 12_000;
  const args = ['-v', 'error'];
  if (streamSelector) {
    args.push('-select_streams', streamSelector === 'a' ? 'a:0' : 'v:0');
  }
  args.push('-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', mediaUrl);

  try {
    const { stdout } = await execFileAsync(ffprobe.path, args, { timeout: timeoutMs, maxBuffer: 1024 * 1024 });
    const parsed = Number.parseFloat(stdout.trim());
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    return parsed;
  } catch (error) {
    const reason =
      error instanceof Error && typeof error.message === 'string' ? error.message : 'unknown error running ffprobe';
    console.warn('[media-duration] ffprobe failed', { mediaUrl, reason });
    return null;
  }
}

function resolveTemporaryMediaExtension(options: DetectBufferOptions): string {
  const fileExtension = options.fileName?.trim().toLowerCase().match(/\.([a-z0-9]{1,10})$/)?.[1];
  if (fileExtension) return fileExtension;

  const mimeType = options.mimeType?.split(';', 1)[0]?.trim().toLowerCase();
  if (mimeType === 'audio/wav' || mimeType === 'audio/x-wav' || mimeType === 'audio/wave') return 'wav';
  if (mimeType === 'audio/mpeg' || mimeType === 'audio/mp3') return 'mp3';
  if (mimeType === 'audio/mp4') return 'm4a';
  if (mimeType === 'audio/ogg') return 'ogg';
  return 'bin';
}

export async function detectMediaBufferDuration(
  mediaBuffer: Buffer,
  options: DetectBufferOptions = {}
): Promise<number | null> {
  if (!ffprobe.path) {
    console.warn('[media-duration] ffprobe binary not available.');
    return null;
  }
  if (!mediaBuffer.length) return null;

  const timeoutMs = options.timeoutMs ?? 12_000;
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'maxvideo-media-probe-'));
  const temporaryFile = join(
    temporaryDirectory,
    `input.${resolveTemporaryMediaExtension(options)}`
  );

  try {
    await writeFile(temporaryFile, mediaBuffer);
    const args = options.streamSelector
      ? [
          '-v',
          'error',
          '-select_streams',
          options.streamSelector === 'audio' ? 'a:0' : 'v:0',
          '-show_entries',
          'stream=codec_type:format=duration',
          '-of',
          'json',
          temporaryFile,
        ]
      : [
          '-v',
          'error',
          '-show_entries',
          'format=duration',
          '-of',
          'default=noprint_wrappers=1:nokey=1',
          temporaryFile,
        ];
    const { stdout } = await execFileAsync(
      ffprobe.path,
      args,
      { timeout: timeoutMs, maxBuffer: 1024 * 1024 }
    );
    let parsed: number;
    if (options.streamSelector) {
      const metadata = JSON.parse(stdout) as {
        streams?: Array<{ codec_type?: string }>;
        format?: { duration?: string };
      };
      if (metadata.streams?.[0]?.codec_type !== options.streamSelector) return null;
      parsed = Number.parseFloat(metadata.format?.duration ?? '');
    } else {
      parsed = Number.parseFloat(stdout.trim());
    }
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.round(parsed * 1000) / 1000;
  } catch (error) {
    const reason =
      error instanceof Error && typeof error.message === 'string'
        ? error.message
        : 'unknown error running ffprobe';
    console.warn('[media-duration] ffprobe buffer probe failed', { reason });
    return null;
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * Run ffprobe against the provided video URL and detect if at least one audio stream exists.
 * Returns true/false when the probe succeeds, or null when probing fails (network issues, unsupported format, etc).
 */
export async function detectHasAudioStream(videoUrl: string, options: DetectOptions = {}): Promise<boolean | null> {
  if (!ffprobe.path) {
    console.warn('[audio-detector] ffprobe binary not available.');
    return null;
  }
  if (!videoUrl || !/^https?:\/\//i.test(videoUrl)) {
    return null;
  }

  const timeoutMs = options.timeoutMs ?? 12_000;
  const args = [
    '-v',
    'error',
    '-select_streams',
    'a',
    '-show_entries',
    'stream=codec_type',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    videoUrl,
  ];

  try {
    const { stdout } = await execFileAsync(ffprobe.path, args, { timeout: timeoutMs, maxBuffer: 1024 * 1024 });
    const normalized = stdout.trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    // ffprobe prints "audio" for each detected audio stream.
    return normalized.split(/\s+/).includes('audio');
  } catch (error) {
    const reason =
      error instanceof Error && typeof error.message === 'string' ? error.message : 'unknown error running ffprobe';
    console.warn('[audio-detector] ffprobe failed', { videoUrl, reason });
    return null;
  }
}

/**
 * Detect the pixel dimensions (width x height) of the first video stream using ffprobe.
 * Returns null when probing fails or when width/height are unavailable.
 */
export async function detectVideoDimensions(
  videoUrl: string,
  options: DetectOptions = {}
): Promise<VideoDimensions | null> {
  if (!ffprobe.path) {
    console.warn('[video-metadata] ffprobe binary not available.');
    return null;
  }
  if (!videoUrl || !/^https?:\/\//i.test(videoUrl)) {
    return null;
  }

  const timeoutMs = options.timeoutMs ?? 12_000;
  const args = [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height',
    '-of',
    'csv=p=0:s=x',
    videoUrl,
  ];

  try {
    const { stdout } = await execFileAsync(ffprobe.path, args, { timeout: timeoutMs, maxBuffer: 1024 * 1024 });
    const line = stdout.trim();
    if (!line) {
      return null;
    }
    const [widthRaw, heightRaw] = line.split(/[xX,]/);
    const width = Number.parseInt(widthRaw, 10);
    const height = Number.parseInt(heightRaw, 10);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return null;
    }
    return { width, height };
  } catch (error) {
    const reason =
      error instanceof Error && typeof error.message === 'string' ? error.message : 'unknown error running ffprobe';
    console.warn('[video-metadata] ffprobe failed', { videoUrl, reason });
    return null;
  }
}

function parseFrameRate(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes('/')) {
    const [numeratorRaw, denominatorRaw] = trimmed.split('/');
    const numerator = Number(numeratorRaw);
    const denominator = Number(denominatorRaw);
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0) {
      return numerator / denominator;
    }
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function detectVideoMetadata(
  videoUrl: string,
  options: DetectOptions = {}
): Promise<VideoMetadata | null> {
  if (!ffprobe.path) {
    console.warn('[video-metadata] ffprobe binary not available.');
    return null;
  }
  if (!videoUrl || !/^https?:\/\//i.test(videoUrl)) {
    return null;
  }

  const timeoutMs = options.timeoutMs ?? 12_000;
  const args = [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height,r_frame_rate:format=duration',
    '-of',
    'json',
    videoUrl,
  ];

  try {
    const { stdout } = await execFileAsync(ffprobe.path, args, { timeout: timeoutMs, maxBuffer: 1024 * 1024 });
    const parsed = JSON.parse(stdout) as {
      streams?: Array<{ width?: number; height?: number; r_frame_rate?: string }>;
      format?: { duration?: string };
    };
    const stream = parsed.streams?.[0];
    const width = Number(stream?.width);
    const height = Number(stream?.height);
    const durationSec = Number(parsed.format?.duration);
    const fps = parseFrameRate(stream?.r_frame_rate ?? '') ?? 30;
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      !Number.isFinite(durationSec) ||
      width <= 0 ||
      height <= 0 ||
      durationSec <= 0
    ) {
      return null;
    }
    return {
      width: Math.round(width),
      height: Math.round(height),
      durationSec,
      fps: Math.max(1, Math.round(fps)),
    };
  } catch (error) {
    const reason =
      error instanceof Error && typeof error.message === 'string' ? error.message : 'unknown error running ffprobe';
    console.warn('[video-metadata] ffprobe metadata failed', { videoUrl, reason });
    return null;
  }
}
