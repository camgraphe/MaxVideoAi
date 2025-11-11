import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import ffprobe from 'ffprobe-static';

const execFileAsync = promisify(execFile);

type DetectOptions = {
  timeoutMs?: number;
};

export type VideoDimensions = {
  width: number;
  height: number;
};

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
