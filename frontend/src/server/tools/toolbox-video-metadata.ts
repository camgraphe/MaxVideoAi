import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import ffprobe from 'ffprobe-static';
import { createBoundedMediaDownloader } from '@/server/agent-api/reference-file-download';
import { videoUploadLimitBytes } from '@/app/api/uploads/video/_lib/video-upload-limits';
import type { VideoMetadata } from './upscale-request-utils';
import { getVideoDisplayDimensions } from '@/lib/video-display-dimensions';
import { ToolMediaValidationError } from './tool-media-errors';
export const MAX_TOOL_OUTPUT_BYTES = 500 * 1024 * 1024;
const execFileAsync = promisify(execFile);
const downloadVideo = createBoundedMediaDownloader({ accepted: ['video/mp4', 'video/quicktime', 'video/webm'], maxBytes: videoUploadLimitBytes() });
const activeAccounts = new Set<string>();
const probes = new Map<string, { expires: number; pending: Promise<VideoMetadata> }>();

export function parseToolVideoMetadata(value: unknown): VideoMetadata {
  const data = value as { streams?: Array<{ codec_type?: string; width?: number; height?: number; r_frame_rate?: string; avg_frame_rate?: string; side_data_list?: Array<{ rotation?: number }>; tags?: { rotate?: string } }>; format?: { duration?: string } };
  const stream = data?.streams?.find(entry => entry.codec_type === 'video') ?? data?.streams?.[0];
  const { width, height } = getVideoDisplayDimensions(stream);
  const durationSec = Number(data?.format?.duration);
  const [numerator, denominator] = (stream?.avg_frame_rate && stream.avg_frame_rate !== '0/0' ? stream.avg_frame_rate : stream?.r_frame_rate ?? '').split('/').map(Number);
  const rate = denominator ? numerator / denominator : numerator;
  const fps = rate;
  if (![width, height, durationSec, fps].every(value => Number.isFinite(value) && value > 0)) throw new ToolMediaValidationError('Video metadata unavailable.');
  return { width, height, durationSec, fps, hasAudio: Boolean(data.streams?.some(entry => entry.codec_type === 'audio')) };
}
async function probe(url: string): Promise<VideoMetadata> {
  // Shared downloader pins public DNS and revalidates redirects; never feed an untrusted URL to ffprobe.
  const file = await downloadVideo({ file_id: 'toolbox-quote', download_url: url });
  if (!file.mimeType.startsWith('video/')) throw new Error('A video is required.');
  return readToolVideoBufferMetadata(file.bytes);
}

/** Inspect trusted downloaded bytes without applying the smaller source-import limit again. */
export async function readToolVideoBufferMetadata(data: Uint8Array): Promise<VideoMetadata> {
  if (!data.byteLength || data.byteLength > MAX_TOOL_OUTPUT_BYTES) throw new ToolMediaValidationError('Tool output size is invalid.');
  const directory = await mkdtemp(join(tmpdir(), 'toolbox-probe-'));
  try {
    const path = join(directory, 'source');
    await writeFile(path, data);
    const { stdout } = await execFileAsync(ffprobe.path!, ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-show_entries', 'stream=codec_type,width,height,r_frame_rate,avg_frame_rate:stream_side_data_list:stream_tags=rotate:format=duration', '-of', 'json', path], { timeout: 15_000, maxBuffer: 1024 * 1024 });
    return parseToolVideoMetadata(JSON.parse(stdout));
  } catch (error) {
    if (error instanceof SyntaxError || (error && typeof error === 'object' && 'code' in error && typeof error.code === 'number')) {
      throw new ToolMediaValidationError('The processed file could not be read as a video.');
    }
    throw error;
  } finally { await rm(directory, { recursive: true, force: true }); }
}
/** Metadata only, bounded account-scoped cache; source bytes are removed after probing. */
export function readToolVideoMetadata(url: string, account: string): Promise<VideoMetadata> {
  const key = JSON.stringify([account, url]);
  const cached = probes.get(key);
  if (cached && cached.expires > Date.now()) return cached.pending;
  if (activeAccounts.has(account) || activeAccounts.size >= 2) return Promise.reject(new Error('Video price preparation is busy. Retry shortly.'));
  activeAccounts.add(account);
  for (const [entry, value] of probes) if (value.expires <= Date.now()) probes.delete(entry);
  if (probes.size >= 16) probes.delete(probes.keys().next().value!);
  const pending = probe(url).catch(error => { if (probes.get(key)?.pending === pending) probes.delete(key); throw error; }).finally(() => { activeAccounts.delete(account); });
  probes.set(key, { expires: Date.now() + 60_000, pending });
  return pending;
}
