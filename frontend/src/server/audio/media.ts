import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { detectHasAudioStream, detectMediaDuration, detectVideoDimensions } from '@/server/media/detect-has-audio';
import { ensureJobThumbnail } from '@/server/thumbnails';
import { uploadFileBuffer } from '@/server/storage';
import type { AudioIntensity } from '@/lib/audio-generation';

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

type StemPresence = {
  hasSoundDesign: boolean;
  hasMusic: boolean;
  hasVoice: boolean;
  targetDurationSec?: number | null;
  mixIntensity?: AudioIntensity | null;
};

type MixAudioTracksParams = {
  soundDesignUrl?: string | null;
  musicUrl?: string | null;
  voiceUrl?: string | null;
  targetDurationSec?: number | null;
  mixIntensity?: AudioIntensity | null;
};

type MixAudioIntoVideoParams = MixAudioTracksParams & {
  sourceVideoUrl: string;
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

function buildTrimSuffix(targetDurationSec?: number | null): string {
  if (!targetDurationSec || !Number.isFinite(targetDurationSec) || targetDurationSec <= 0) {
    return '';
  }
  return `,atrim=0:${targetDurationSec.toFixed(3)},asetpts=N/SR/TB`;
}

function normalizeStemPresence(input: boolean | StemPresence): StemPresence {
  if (typeof input === 'boolean') {
    return {
      hasSoundDesign: true,
      hasMusic: true,
      hasVoice: input,
      targetDurationSec: null,
      mixIntensity: 'standard',
    };
  }
  return {
    hasSoundDesign: Boolean(input.hasSoundDesign),
    hasMusic: Boolean(input.hasMusic),
    hasVoice: Boolean(input.hasVoice),
    targetDurationSec: input.targetDurationSec ?? null,
    mixIntensity: input.mixIntensity ?? 'standard',
  };
}

function resolveMixProfile(intensity: AudioIntensity | null | undefined) {
  switch (intensity) {
    case 'subtle':
      return {
        soundDesignVolume: 0.92,
        musicVolume: 0.52,
        voiceVolume: 1.12,
        musicWeight: 0.72,
        voiceWeight: 1.22,
      };
    case 'intense':
      return {
        soundDesignVolume: 1.02,
        musicVolume: 0.84,
        voiceVolume: 1.2,
        musicWeight: 1.0,
        voiceWeight: 1.34,
      };
    case 'standard':
    default:
      return {
        soundDesignVolume: 0.96,
        musicVolume: 0.7,
        voiceVolume: 1.18,
        musicWeight: 0.85,
        voiceWeight: 1.3,
      };
  }
}

export function buildAudioMixFilterGraph(input: boolean | StemPresence): string {
  const normalized = normalizeStemPresence(input);
  const trimSuffix = buildTrimSuffix(normalized.targetDurationSec);
  const profile = resolveMixProfile(normalized.mixIntensity);

  if (normalized.hasSoundDesign && normalized.hasMusic && normalized.hasVoice) {
    return [
      `[0:a]aresample=48000,volume=${profile.soundDesignVolume.toFixed(2)}[sfx]`,
      `[1:a]aresample=48000,volume=${profile.musicVolume.toFixed(2)}[music]`,
      `[2:a]aresample=48000,volume=${profile.voiceVolume.toFixed(2)}[voice]`,
      '[music][voice]sidechaincompress=threshold=0.03:ratio=10:attack=20:release=450[musicduck]',
      `[sfx][musicduck]amix=inputs=2:duration=longest:normalize=0:weights=1 ${profile.musicWeight.toFixed(2)}[bed]`,
      `[bed][voice]amix=inputs=2:duration=longest:normalize=0:weights=1 ${profile.voiceWeight.toFixed(2)}${trimSuffix},alimiter=limit=0.92[outa]`,
    ].join(';');
  }

  if (normalized.hasSoundDesign && normalized.hasMusic) {
    return [
      `[0:a]aresample=48000,volume=${profile.soundDesignVolume.toFixed(2)}[sfx]`,
      `[1:a]aresample=48000,volume=${profile.musicVolume.toFixed(2)}[music]`,
      `[sfx][music]amix=inputs=2:duration=longest:normalize=0:weights=1 ${profile.musicWeight.toFixed(2)}${trimSuffix},alimiter=limit=0.92[outa]`,
    ].join(';');
  }

  if (normalized.hasSoundDesign && normalized.hasVoice) {
    return [
      `[0:a]aresample=48000,volume=${profile.soundDesignVolume.toFixed(2)}[sfx]`,
      `[1:a]aresample=48000,volume=${profile.voiceVolume.toFixed(2)}[voice]`,
      `[sfx][voice]amix=inputs=2:duration=longest:normalize=0:weights=1 ${profile.voiceWeight.toFixed(2)}${trimSuffix},alimiter=limit=0.92[outa]`,
    ].join(';');
  }

  if (normalized.hasSoundDesign) {
    return [`[0:a]aresample=48000,volume=${profile.soundDesignVolume.toFixed(2)}${trimSuffix},alimiter=limit=0.92[outa]`].join(';');
  }

  if (normalized.hasMusic) {
    return [`[0:a]aresample=48000,volume=${(profile.musicVolume + 0.18).toFixed(2)}${trimSuffix},alimiter=limit=0.92[outa]`].join(';');
  }

  if (normalized.hasVoice) {
    return [`[0:a]aresample=48000,volume=${Math.max(1.08, profile.voiceVolume - 0.04).toFixed(2)}${trimSuffix},alimiter=limit=0.92[outa]`].join(';');
  }

  throw new Error('At least one audio stem is required for mixing.');
}

export async function mixAudioTracks(params: MixAudioTracksParams): Promise<Buffer> {
  const ffmpegPath = getFfmpegPath();
  if (!ffmpegPath) {
    throw new Error('ffmpeg is not available');
  }

  const stems = [
    params.soundDesignUrl ? { url: params.soundDesignUrl, fileName: 'sound.bin' } : null,
    params.musicUrl ? { url: params.musicUrl, fileName: 'music.bin' } : null,
    params.voiceUrl ? { url: params.voiceUrl, fileName: 'voice.bin' } : null,
  ].filter((entry): entry is { url: string; fileName: string } => Boolean(entry));

  if (!stems.length) {
    throw new Error('No audio stems were provided.');
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), 'mv-audio-mix-'));
  const outputPath = path.join(tempDir, 'mixed.m4a');

  try {
    const inputPaths = await Promise.all(
      stems.map(async (stem, index) => {
        const filePath = path.join(tempDir, `${index}-${stem.fileName}`);
        await writeFetchedFile(stem.url, filePath);
        return filePath;
      })
    );

    const filterComplex = buildAudioMixFilterGraph({
      hasSoundDesign: Boolean(params.soundDesignUrl),
      hasMusic: Boolean(params.musicUrl),
      hasVoice: Boolean(params.voiceUrl),
      targetDurationSec: params.targetDurationSec ?? null,
      mixIntensity: params.mixIntensity ?? 'standard',
    });

    const args = [
      '-y',
      ...inputPaths.flatMap((inputPath) => ['-i', inputPath]),
      '-filter_complex',
      filterComplex,
      '-map',
      '[outa]',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-movflags',
      '+faststart',
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

export async function muxAudioBufferIntoVideo(params: {
  sourceVideoUrl: string;
  audioBuffer: Buffer;
}): Promise<Buffer> {
  const ffmpegPath = getFfmpegPath();
  if (!ffmpegPath) {
    throw new Error('ffmpeg is not available');
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), 'mv-audio-mux-'));
  const sourcePath = path.join(tempDir, 'source.mp4');
  const audioPath = path.join(tempDir, 'mixed.m4a');
  const outputPath = path.join(tempDir, 'output.mp4');

  try {
    await writeFetchedFile(params.sourceVideoUrl, sourcePath);
    await writeFile(audioPath, params.audioBuffer);

    const args = [
      '-y',
      '-i',
      sourcePath,
      '-i',
      audioPath,
      '-map',
      '0:v:0',
      '-map',
      '1:a:0',
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

export async function mixAudioIntoVideo(
  params: MixAudioIntoVideoParams
): Promise<{ audioBuffer: Buffer; videoBuffer: Buffer }> {
  const audioBuffer = await mixAudioTracks({
    soundDesignUrl: params.soundDesignUrl,
    musicUrl: params.musicUrl,
    voiceUrl: params.voiceUrl,
    targetDurationSec: params.targetDurationSec ?? null,
    mixIntensity: params.mixIntensity ?? 'standard',
  });
  const videoBuffer = await muxAudioBufferIntoVideo({
    sourceVideoUrl: params.sourceVideoUrl,
    audioBuffer,
  });
  return { audioBuffer, videoBuffer };
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

export async function uploadAudioRenderAudio(params: {
  userId: string;
  jobId: string;
  audioBuffer: Buffer;
}): Promise<{ audioUrl: string }> {
  const upload = await uploadFileBuffer({
    data: params.audioBuffer,
    mime: 'audio/mp4',
    fileName: `${params.jobId}.m4a`,
    prefix: 'renders',
    userId: params.userId,
  });

  return {
    audioUrl: upload.url,
  };
}

export function resolveAudioAspectRatio(width: number | null, height: number | null): string | null {
  return resolveAspectRatio(width, height);
}
