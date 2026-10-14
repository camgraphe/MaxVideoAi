import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import sharp from 'sharp';
import { ensureExecutableFfmpegPath } from './ffmpeg-runtime';
import { uploadFileBuffer, uploadFilePath } from './storage';
import { createOwnedMediaReadUrl } from './owned-media-read-access';
import { createBoundedMediaDownloader } from '@/server/agent-api/reference-file-download';
import { probeGeneratedVideoFile } from './media/generated-video-facts';
import { copyProviderVideoOriginal } from './provider-video-original-copy';
import type { GeneratedVideoFacts } from '@/lib/generated-video-media-facts';
import { bytePlusRequestedOutputOptions, getBytePlusLasDurableOutput, persistBytePlusLasOutputBeforeCompletion } from './byteplus-output-persistence';

export type BytePlusLastFrame = { url: string; mimeType: 'image/jpeg'; sha256: string;
  sizeBytes: number; width: number; height: number };
const MAX_FRAME_BYTES = 20 * 1024 * 1024;
const MAX_MOV_BYTES = 300 * 1024 * 1024;
const MAX_PLAYBACK_BYTES = 100 * 1024 * 1024;
const execute = promisify(execFile);
const downloadFrame = createBoundedMediaDownloader({ accepted: ['image/jpeg'], maxBytes: MAX_FRAME_BYTES });

export async function copyBytePlusLastFrame(input: { jobId: string; userId?: string | null; url: string },
  deps: { download?: typeof downloadFrame; upload?: typeof uploadFileBuffer } = {}): Promise<BytePlusLastFrame> {
  const downloaded = await (deps.download ?? downloadFrame)({ file_id: input.jobId,
    download_url: input.url, mime_type: 'image/jpeg', file_name: `${input.jobId}-last-frame.jpg` });
  const bytes = downloaded.bytes;
  if (!bytes.length || bytes.length > MAX_FRAME_BYTES) throw new Error('Returned JPEG exceeds the frame budget.');
  const image = await sharp(bytes, { limitInputPixels: 64 * 1024 * 1024 }).metadata();
  if (image.format !== 'jpeg' || !image.width || !image.height) throw new Error('Returned frame must be an actual JPEG.');
  const upload = await (deps.upload ?? uploadFileBuffer)({ data: bytes, mime: 'image/jpeg',
    userId: input.userId ?? undefined, prefix: 'renders/last-frames', fileName: `${input.jobId}-last-frame.jpg`,
    cacheControl: 'public, max-age=31536000, immutable' });
  return { url: upload.url, mimeType: 'image/jpeg', sha256: createHash('sha256').update(bytes).digest('hex'),
    sizeBytes: bytes.length, width: image.width, height: image.height };
}

export async function copyBytePlusVideoOriginal(input: { jobId: string; userId?: string | null; videoUrl: string;
  outputFormat?: 'mp4' | 'mov';
  onVideoMediaFacts?: (facts: GeneratedVideoFacts) => void }, deps: { fetch?: typeof fetch } = {}): Promise<string> {
  const response = await (deps.fetch ?? fetch)(input.videoUrl, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error('Provider MOV could not be downloaded.');
  return copyProviderVideoOriginal(response, { ...input, outputFormat: input.outputFormat ?? 'mp4' },
    { upload: uploadFilePath, maxBytes: MAX_MOV_BYTES });
}

/** Full-duration browser rendition for MOV and HEVC. The original is never edited or replaced. */
export async function ensureBytePlusCompatiblePlayback(input: { jobId: string; userId?: string | null; videoUrl: string },
  deps: { fetch?: typeof fetch; createReadUrl?: typeof createOwnedMediaReadUrl; upload?: typeof uploadFilePath; maxPlaybackBytes?: number } = {}): Promise<string> {
  const maxPlaybackBytes = Number.isSafeInteger(deps.maxPlaybackBytes) && deps.maxPlaybackBytes! > 0
    ? Math.min(deps.maxPlaybackBytes!, MAX_PLAYBACK_BYTES) : MAX_PLAYBACK_BYTES;
  const readUrl = await (deps.createReadUrl ?? createOwnedMediaReadUrl)({ url: input.videoUrl, userId: input.userId });
  const response = await (deps.fetch ?? fetch)(readUrl, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(120_000) });
  if (!response.ok || !response.body) throw new Error('Stored MOV is not available for playback preparation.');
  const directory = await mkdtemp(join(tmpdir(), 'byteplus-mov-playback-'));
  try {
    const outputPath = join(directory, 'playback.mp4');
    // Reuse the same streaming, byte-limit and truncation checks without publishing another original.
    return await copyProviderVideoOriginal(response, { jobId: input.jobId, outputFormat: 'mov' }, {
      maxBytes: MAX_MOV_BYTES,
      upload: async source => {
        const measured = await probeGeneratedVideoFile(source.path);
        const duration = Number(measured?.format?.duration);
        if (!Number.isFinite(duration) || duration <= 0 || duration > 30.25) throw new Error('MOV playback duration exceeds the supported 30-second bound.');
        const binary = await ensureExecutableFfmpegPath(ffmpeg.path);
        await execute(binary, ['-y', '-v', 'error', '-protocol_whitelist', 'file,pipe', '-i', source.path,
          '-map', '0:v:0', '-map', '0:a:0?', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
          '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
          '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-fs', String(maxPlaybackBytes), outputPath],
        { timeout: 90_000, maxBuffer: 1024 * 1024 });
        const sizeBytes = (await stat(outputPath)).size;
        if (!sizeBytes || sizeBytes > maxPlaybackBytes) throw new Error('MOV playback rendition exceeds the output budget.');
        const playback = await probeGeneratedVideoFile(outputPath);
        const playbackDuration = Number(playback?.format?.duration);
        const hasSourceAudio = measured?.streams?.some(stream => stream.codec_type === 'audio');
        if (!Number.isFinite(playbackDuration) || Math.abs(playbackDuration - duration) > 0.1
          || (hasSourceAudio && !playback?.streams?.some(stream => stream.codec_type === 'audio'))) {
          throw new Error('Compatible playback is incomplete.');
        }
        return (deps.upload ?? uploadFilePath)({ path: outputPath, sizeBytes, mime: 'video/mp4',
          userId: input.userId ?? undefined, prefix: 'renders/playback', fileName: `${input.jobId}-playback.mp4`,
          cacheControl: 'public, max-age=31536000, immutable' });
      },
    });
  } finally { await rm(directory, { recursive: true, force: true }); }
}

/** Checkpoint each artifact before advancing; projection replay never copies durable bytes again. */
export async function persistBytePlusRequiredArtifacts(input: Parameters<typeof persistBytePlusLasOutputBeforeCompletion>[0]
  & { providerLastFrameUrl?: string | null }, deps: {
    ensurePlayback?: typeof ensureBytePlusCompatiblePlayback; copyLastFrame?: typeof copyBytePlusLastFrame;
  } = {}): Promise<boolean> {
  const options = bytePlusRequestedOutputOptions(input.job);
  const previous = getBytePlusLasDurableOutput(input.job);
  let playbackVideoUrl = previous?.playbackVideoUrl;
  let lastFrame = previous?.lastFrame;
  const checkpoint = () => persistBytePlusLasOutputBeforeCompletion({ ...input, playbackVideoUrl, lastFrame, persistOutputs: false });
  if (!await checkpoint()) return false;
  if (options.requiresCompatiblePlayback && !playbackVideoUrl) {
    playbackVideoUrl = await (deps.ensurePlayback ?? ensureBytePlusCompatiblePlayback)({
      jobId: input.job.job_id, userId: input.job.user_id, videoUrl: input.videoUrl });
    if (!await checkpoint()) return false;
  }
  if (options.returnLastFrame && !lastFrame) {
    if (!input.providerLastFrameUrl) throw new Error('The completed provider task has no requested last frame.');
    lastFrame = await (deps.copyLastFrame ?? copyBytePlusLastFrame)({
      jobId: input.job.job_id, userId: input.job.user_id, url: input.providerLastFrameUrl });
    if (!await checkpoint()) return false;
  }
  return true;
}
