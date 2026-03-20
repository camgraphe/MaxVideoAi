import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { detectHasAudioStream, detectMediaDuration, detectVideoDimensions } from '@/server/media/detect-has-audio';
import { ensureJobThumbnail } from '@/server/thumbnails';
import { uploadFileBuffer } from '@/server/storage';

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
    console.warn('[audio-media] unable to resolve ffmpeg binary', error);
    resolvedFfmpegPath = null;
    ffmpegPathResolved = true;
    return resolvedFfmpegPath;
  }
}

type SourceVideoProbe = {
  durationSec: number | null;
  width: number | null;
  height: number | null;
  hasAudio: boolean | null;
};

export async function inspectSourceVideo(videoUrl: string): Promise<SourceVideoProbe> {
  const [durationSec, dimensions, hasAudio] = await Promise.all([
    detectMediaDuration(videoUrl, {}, 'v'),
    detectVideoDimensions(videoUrl),
    detectHasAudioStream(videoUrl),
  ]);

  return {
    durationSec,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
    hasAudio,
  };
}

async function fetchFileBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch media (${response.status})`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) {
    throw new Error('Fetched media was empty');
  }
  return buffer;
}

async function writeFetchedFile(url: string, filePath: string): Promise<void> {
  const buffer = await fetchFileBuffer(url);
  await writeFile(filePath, buffer);
}

function resolveAspectRatio(width: number | null, height: number | null): string | null {
  if (!width || !height) return null;
  if (height > width) return '9:16';
  if (height === width) return '1:1';
  return '16:9';
}

type MixAudioIntoVideoParams = {
  sourceVideoUrl: string;
  soundDesignUrl: string;
  musicUrl: string;
  voiceUrl?: string | null;
};

export function buildAudioMixFilterGraph(hasVoice: boolean): string {
  return hasVoice
    ? [
        '[1:a]aresample=48000,volume=0.96[sfx]',
        '[2:a]aresample=48000,volume=0.70[music]',
        '[3:a]aresample=48000,volume=1.18[voice]',
        '[music][voice]sidechaincompress=threshold=0.03:ratio=10:attack=20:release=450[musicduck]',
        '[sfx][musicduck]amix=inputs=2:duration=longest:normalize=0:weights=1 0.85[bed]',
        '[bed][voice]amix=inputs=2:duration=longest:normalize=0:weights=1 1.3,alimiter=limit=0.92[outa]',
      ].join(';')
    : [
        '[1:a]aresample=48000,volume=0.96[sfx]',
        '[2:a]aresample=48000,volume=0.70[music]',
        '[sfx][music]amix=inputs=2:duration=longest:normalize=0:weights=1 0.85,alimiter=limit=0.92[outa]',
      ].join(';');
}

export async function mixAudioIntoVideo(params: MixAudioIntoVideoParams): Promise<Buffer> {
  const ffmpegPath = getFfmpegPath();
  if (!ffmpegPath) {
    throw new Error('ffmpeg is not available');
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), 'mv-audio-'));
  const sourcePath = path.join(tempDir, 'source.mp4');
  const soundPath = path.join(tempDir, 'sound.wav');
  const musicPath = path.join(tempDir, 'music.wav');
  const voicePath = path.join(tempDir, 'voice.wav');
  const outputPath = path.join(tempDir, 'output.mp4');

  try {
    await writeFetchedFile(params.sourceVideoUrl, sourcePath);
    await writeFetchedFile(params.soundDesignUrl, soundPath);
    await writeFetchedFile(params.musicUrl, musicPath);
    if (params.voiceUrl) {
      await writeFetchedFile(params.voiceUrl, voicePath);
    }

    const filterComplex = buildAudioMixFilterGraph(Boolean(params.voiceUrl));

    const args = [
      '-y',
      '-i',
      sourcePath,
      '-i',
      soundPath,
      '-i',
      musicPath,
      ...(params.voiceUrl ? ['-i', voicePath] : []),
      '-filter_complex',
      filterComplex,
      '-map',
      '0:v:0',
      '-map',
      '[outa]',
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-movflags',
      '+faststart',
      '-shortest',
      outputPath,
    ];

    await new Promise<void>((resolve, reject) => {
      execFile(ffmpegPath, args, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    return await readFile(outputPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function uploadAudioRenderVideo(params: {
  userId: string;
  jobId: string;
  videoBuffer: Buffer;
}): Promise<{ videoUrl: string; thumbUrl: string | null }> {
  const upload = await uploadFileBuffer({
    data: params.videoBuffer,
    mime: 'video/mp4',
    fileName: `${params.jobId}.mp4`,
    prefix: 'renders',
    userId: params.userId,
  });

  const thumbUrl =
    (await ensureJobThumbnail({
      jobId: params.jobId,
      userId: params.userId,
      videoUrl: upload.url,
      force: true,
    })) ?? null;

  return {
    videoUrl: upload.url,
    thumbUrl,
  };
}

export function resolveAudioAspectRatio(width: number | null, height: number | null): string | null {
  return resolveAspectRatio(width, height);
}
