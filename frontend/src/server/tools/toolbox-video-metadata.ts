import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import ffprobe from 'ffprobe-static';
import { createBoundedMediaDownloader } from '@/server/agent-api/reference-file-download';
import { videoUploadLimitBytes } from '@/app/api/uploads/video/_lib/video-upload-limits';
import type { VideoMetadata } from './upscale-request-utils';
const execFileAsync = promisify(execFile);
const downloadVideo = createBoundedMediaDownloader({ accepted: ['video/mp4', 'video/quicktime', 'video/webm'], maxBytes: videoUploadLimitBytes() });
const activeAccounts = new Set<string>();
const probes = new Map<string, { expires: number; pending: Promise<VideoMetadata> }>();

export function parseToolVideoMetadata(value: unknown): VideoMetadata {
  const data = value as { streams?: Array<{ width?: number; height?: number; r_frame_rate?: string }>; format?: { duration?: string } };
  const stream = data?.streams?.[0];
  const width = Number(stream?.width), height = Number(stream?.height), durationSec = Number(data?.format?.duration);
  const [numerator, denominator] = (stream?.r_frame_rate ?? '').split('/').map(Number);
  const rate = denominator ? numerator / denominator : numerator;
  const fps = Number.isFinite(rate) && rate > 0 ? rate : 30;
  if (![width, height, durationSec].every(value => Number.isFinite(value) && value > 0)) throw new Error('Video metadata unavailable.');
  return { width, height, durationSec, fps };
}
async function probe(url: string): Promise<VideoMetadata> {
  // Shared downloader pins public DNS and revalidates redirects; never feed an untrusted URL to ffprobe.
  const file = await downloadVideo({ file_id: 'toolbox-quote', download_url: url });
  if (!file.mimeType.startsWith('video/')) throw new Error('A video is required.');
  const directory = await mkdtemp(join(tmpdir(), 'toolbox-probe-'));
  try {
    const path = join(directory, 'source');
    await writeFile(path, file.bytes);
    const { stdout } = await execFileAsync(ffprobe.path!, ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate:format=duration', '-of', 'json', path], { timeout: 15_000, maxBuffer: 1024 * 1024 });
    return parseToolVideoMetadata(JSON.parse(stdout));
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
